import type { Clock } from '../../../../config/src/clock.ts';
import type { EvidenceVault } from '../../../../evidence/src/vault.ts';
import { asIntentId } from '../../../../permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../../../../permissions/src/action-types.ts';
import type { CreatePaperOrderIntent } from '../../../../permissions/src/action-types.ts';
import { asAccountId } from '../../../../domain/src/account.ts';
import type { EvidenceRegistryPort } from '../executable-opportunity/types.ts';
import { paperCycleIdFor, paperPositionIdFor } from './ids.ts';
import { buildHeliosPaperProposal } from './proposal.ts';
import { synthesizeDeterministicResearch } from './research.ts';
import {
  DEFAULT_ENTRY_QUANTITY_UNITS,
  evaluateReferencePriceEntryRule,
  HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
} from './strategy-rule.ts';
import { validatePaperStrategyInputs } from './validation.ts';
import {
  computePaperFillAssumptions,
  grossNotionalFromAssumptions,
  netNotionalFromAssumptions,
  slippageCostFromAssumptions,
  spreadCostFromAssumptions,
} from './fill-model.ts';
import { InMemoryHeliosPaperStrategyStore } from './store.ts';
import {
  sealExecutionPhase,
  sealGrowResultPhase,
  sealPositionPhase,
  sealProposalPhase,
  sealResearchPhase,
} from './evidence.ts';
import type {
  HeliosPaperExecutionPort,
  HeliosPaperExecutionRecord,
  HeliosPaperGrowResult,
  HeliosPaperPosition,
  HeliosPaperRiskPort,
  PaperStrategyCloseInput,
  PaperStrategyRunInput,
} from './types.ts';

export class HeliosPaperGrowStrategyService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  private readonly evidenceRegistry: EvidenceRegistryPort;
  private readonly executionPort: HeliosPaperExecutionPort;
  private readonly riskPort: HeliosPaperRiskPort | null;
  readonly store: InMemoryHeliosPaperStrategyStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly evidenceRegistry: EvidenceRegistryPort;
    readonly executionPort: HeliosPaperExecutionPort;
    readonly riskPort?: HeliosPaperRiskPort | null;
    readonly store?: InMemoryHeliosPaperStrategyStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.evidenceRegistry = input.evidenceRegistry;
    this.executionPort = input.executionPort;
    this.riskPort = input.riskPort ?? null;
    this.store = input.store ?? new InMemoryHeliosPaperStrategyStore();
  }

  runCycle(input: PaperStrategyRunInput): HeliosPaperGrowResult {
    const now = this.clock.now();
    const cycleId = paperCycleIdFor(input.workOrder.workOrderId, input.taskId);
    const evidenceChain: string[] = [];

    const instrumentId = input.opportunity.instrument?.instrumentId ?? 'SIM-ETF-1';
    const currency = input.terms.priceReference?.currency ?? 'USD';
    const notionalMinor = (
      (BigInt(DEFAULT_ENTRY_QUANTITY_UNITS) / 1_000_000_000n) * BigInt(input.terms.priceReference?.minorUnits ?? '10000')
    ).toString();

    const validation = validatePaperStrategyInputs({
      opportunity: input.opportunity,
      workOrder: input.workOrder,
      terms: input.terms,
      now,
      venueSession: input.venueSession,
      reservedCapitalMinor: input.reservedCapitalMinor,
      proposedNotionalMinor: notionalMinor,
      researchBudgetRemaining: input.researchBudgetRemaining,
      taskAlreadyCompleted: this.store.isTaskCompleted(input.taskId),
      decisionObservedAt: input.terms.priceReference?.asOf ?? now,
    });
    if (!validation.ok) {
      return this.finalizeCycle({
        cycleId,
        proposalId: null,
        positionId: null,
        outcome: validation.outcome,
        reasonCodes: validation.reasonCodes,
        evidenceChainRefs: evidenceChain,
        now,
      });
    }

    const evidenceRecords = input.opportunity.candidate.evidenceRefs
      .map((ref) => this.evidenceRegistry.resolve(ref))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const research = synthesizeDeterministicResearch({
      strategyId: HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
      evidenceRefs: input.opportunity.candidate.evidenceRefs,
      evidenceRecords,
      terms: input.terms,
      now,
    });

    const openPosition = this.store
      .listPositionsForCustomer(input.workOrder.customerId)
      .find((row) => row.workOrderId === input.workOrder.workOrderId && row.status === 'OPEN');

    const decision = evaluateReferencePriceEntryRule({
      strategyId: HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
      instrumentId,
      terms: input.terms,
      now,
      hasOpenPosition: Boolean(openPosition),
    });

    evidenceChain.push(...sealResearchPhase(this.evidence, research, decision));

    if (decision.action === 'NO_ACTION') {
      this.store.markTaskCompleted(input.taskId);
      return this.finalizeCycle({
        cycleId,
        proposalId: null,
        positionId: openPosition?.positionId ?? null,
        outcome: 'NO_ACTION',
        reasonCodes: Object.freeze(['OK']),
        evidenceChainRefs: evidenceChain,
        now,
      });
    }

    const proposal = buildHeliosPaperProposal({
      workOrder: input.workOrder,
      opportunity: input.opportunity,
      research,
      decision,
      notionalMinor,
      currency,
      reservedCapitalMinor: input.reservedCapitalMinor,
      now,
      key: input.taskId,
    });
    this.store.putProposal(proposal);
    const proposalRef = sealProposalPhase(this.evidence, proposal);
    if (proposalRef) evidenceChain.push(proposalRef);

    if (this.riskPort) {
      const risk = this.riskPort.assess({
        proposedNotionalMinor: BigInt(notionalMinor),
        instrumentId,
        portfolioId: input.investmentAccountId,
      });
      if (risk.outcome === 'BLOCK') {
        this.store.putProposal(Object.freeze({ ...proposal, state: 'RISK_DENIED', updatedAt: now }));
        return this.finalizeCycle({
          cycleId,
          proposalId: proposal.proposalId,
          positionId: null,
          outcome: 'REJECTED_RISK',
          reasonCodes: Object.freeze(['OK']),
          evidenceChainRefs: evidenceChain,
          now,
        });
      }
      this.store.putProposal(Object.freeze({ ...proposal, state: 'RISK_APPROVED', updatedAt: now }));
    }

    const intent = this.buildOrderIntent(input, proposal);
    const submitted = this.executionPort.createPaperOrder(intent);

    if (submitted.outcome === 'KERNEL_REFUSED') {
      this.store.putProposal(Object.freeze({ ...proposal, state: 'KERNEL_DENIED', updatedAt: now }));
      return this.finalizeCycle({
        cycleId,
        proposalId: proposal.proposalId,
        positionId: null,
        outcome: 'REJECTED_COMPLIANCE',
        reasonCodes: Object.freeze(['OK']),
        evidenceChainRefs: evidenceChain,
        now,
      });
    }
    if (submitted.outcome !== 'OK' || !submitted.value) {
      this.store.putProposal(Object.freeze({ ...proposal, state: 'KERNEL_DENIED', updatedAt: now }));
      return this.finalizeCycle({
        cycleId,
        proposalId: proposal.proposalId,
        positionId: null,
        outcome: 'REJECTED_COMPLIANCE',
        reasonCodes: Object.freeze(['OK']),
        evidenceChainRefs: evidenceChain,
        now,
      });
    }

    const assumptions = computePaperFillAssumptions({
      side: proposal.direction,
      terms: input.terms,
      quantityUnits: proposal.quantityUnits,
      now,
    });
    const execution = this.buildExecutionRecord({
      orderId: submitted.value.orderId,
      fillId: submitted.value.fillId ?? null,
      proposal,
      assumptions,
      authorityId: submitted.authorityId ?? null,
      riskAssessmentId: submitted.riskAssessmentId ?? null,
      now,
    });

    const execRef = sealExecutionPhase(this.evidence, {
      proposalId: proposal.proposalId,
      orderId: execution.orderId,
      fillId: execution.fillId,
      environment: 'PAPER',
      simulation: true,
      providerSourced: false,
    });
    if (execRef) evidenceChain.push(execRef);

    const position = this.upsertPosition({
      input,
      proposal,
      execution,
      now,
      ...(openPosition ? { existing: openPosition } : {}),
    });
    const posRef = sealPositionPhase(this.evidence, position);
    if (posRef) evidenceChain.push(posRef);

    this.store.putProposal(Object.freeze({ ...proposal, state: 'EXECUTED', updatedAt: now }));
    this.store.markTaskCompleted(input.taskId);

    return this.finalizeCycle({
      cycleId,
      proposalId: proposal.proposalId,
      positionId: position.positionId,
      outcome: 'EXECUTED',
      reasonCodes: Object.freeze(['OK']),
      evidenceChainRefs: evidenceChain,
      now,
      grossResult: execution.grossNotional,
      netResult: execution.netNotional,
      feesIncluded: execution.fee,
    });
  }

  closePosition(input: PaperStrategyCloseInput): HeliosPaperGrowResult {
    const now = this.clock.now();
    const cycleId = paperCycleIdFor(input.workOrder.workOrderId, `close_${input.positionId}`);
    const evidenceChain: string[] = [];
    const position = this.store.getPosition(input.positionId);
    if (!position || position.customerId !== input.customerId || position.status !== 'OPEN') {
      return this.finalizeCycle({
        cycleId,
        proposalId: null,
        positionId: input.positionId,
        outcome: 'REJECTED_VALIDATION',
        reasonCodes: Object.freeze(['CUSTOMER_INELIGIBLE']),
        evidenceChainRefs: evidenceChain,
        now,
      });
    }

    const decision = evaluateReferencePriceEntryRule({
      strategyId: HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
      instrumentId: position.instrumentId,
      terms: input.terms,
      now,
      hasOpenPosition: true,
      forceClose: input.reason === 'EXPLICIT_CLOSE' || input.reason === 'WORK_ORDER_COMPLETE',
    });

    if (decision.action !== 'SELL') {
      return this.finalizeCycle({
        cycleId,
        proposalId: null,
        positionId: position.positionId,
        outcome: 'WAIT',
        reasonCodes: Object.freeze(['OK']),
        evidenceChainRefs: evidenceChain,
        now,
      });
    }

    const intent = this.buildCloseIntent(input, position, decision.quantityUnits);
    const submitted = this.executionPort.createPaperOrder(intent);
    if (submitted.outcome !== 'OK' || !submitted.value) {
      return this.finalizeCycle({
        cycleId,
        proposalId: null,
        positionId: position.positionId,
        outcome: submitted.outcome === 'KERNEL_REFUSED' ? 'REJECTED_COMPLIANCE' : 'REJECTED_VALIDATION',
        reasonCodes: Object.freeze(['OK']),
        evidenceChainRefs: evidenceChain,
        now,
      });
    }

    const assumptions = computePaperFillAssumptions({
      side: 'SELL',
      terms: input.terms,
      quantityUnits: position.quantityUnits,
      now,
    });
    const execution = this.buildExecutionRecord({
      orderId: submitted.value.orderId,
      fillId: submitted.value.fillId ?? null,
      proposal: null,
      side: 'SELL',
      quantityUnits: position.quantityUnits,
      assumptions,
      authorityId: submitted.authorityId ?? null,
      riskAssessmentId: submitted.riskAssessmentId ?? null,
      now,
    });

    const costBasisMinor = BigInt(position.costBasis.minorUnits);
    const netProceeds = BigInt(execution.netNotional.minorUnits);
    const realizedMinor = netProceeds - costBasisMinor;
    const closed: HeliosPaperPosition = Object.freeze({
      ...position,
      status: 'CLOSED',
      exitFills: Object.freeze([...position.exitFills, execution]),
      realizedResult: Object.freeze({
        minorUnits: realizedMinor.toString(),
        currency: position.costBasis.currency,
      }),
      unrealizedResult: null,
      referenceValuation: execution.grossNotional,
      closedAt: now,
    });
    this.store.putPosition(closed);
    sealPositionPhase(this.evidence, closed);

    return this.finalizeCycle({
      cycleId,
      proposalId: null,
      positionId: closed.positionId,
      outcome: 'CLOSED',
      reasonCodes: Object.freeze(['OK']),
      evidenceChainRefs: evidenceChain,
      now,
      grossResult: execution.grossNotional,
      netResult: Object.freeze({
        minorUnits: realizedMinor.toString(),
        currency: position.costBasis.currency,
      }),
      feesIncluded: execution.fee,
    });
  }

  private buildOrderIntent(input: PaperStrategyRunInput, proposal: { readonly proposalId: string; readonly direction: 'BUY' | 'SELL'; readonly instrumentId: string; readonly quantityUnits: string }): CreatePaperOrderIntent {
    return Object.freeze({
      id: asIntentId(`I_h14_${input.taskId}`),
      actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_INVESTMENT',
      payload: Object.freeze({
        accountId: asAccountId(input.brokerageAccountId),
        investmentAccountId: input.investmentAccountId,
        orderId: `ord_h14_${input.taskId}`.slice(0, 48),
        instrumentId: proposal.instrumentId,
        side: proposal.direction,
        quantityUnits: proposal.quantityUnits,
        orderType: 'MARKET_SIMULATION',
      }),
    });
  }

  private buildCloseIntent(
    input: PaperStrategyCloseInput,
    position: HeliosPaperPosition,
    quantityUnits: string,
  ): CreatePaperOrderIntent {
    return Object.freeze({
      id: asIntentId(`I_h14_close_${input.idempotencyKey}`),
      actionType: ACTION_TYPES.CREATE_PAPER_ORDER,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      requestedAt: this.clock.now(),
      purpose: 'CUSTOMER_INVESTMENT',
      payload: Object.freeze({
        accountId: asAccountId(input.brokerageAccountId),
        investmentAccountId: input.investmentAccountId,
        orderId: `ord_h14_close_${input.idempotencyKey}`.slice(0, 48),
        instrumentId: position.instrumentId,
        side: 'SELL',
        quantityUnits,
        orderType: 'MARKET_SIMULATION',
      }),
    });
  }

  private buildExecutionRecord(input: {
    readonly orderId: string;
    readonly fillId: string | null;
    readonly proposal: { readonly quantityUnits: string; readonly direction: 'BUY' | 'SELL' } | null;
    readonly side?: 'BUY' | 'SELL';
    readonly quantityUnits?: string;
    readonly assumptions: ReturnType<typeof computePaperFillAssumptions>;
    readonly authorityId: string | null;
    readonly riskAssessmentId: string | null;
    readonly now: import('../../../../domain/src/time.ts').UtcInstant;
  }): HeliosPaperExecutionRecord {
    const side = input.side ?? input.proposal?.direction ?? 'BUY';
    const quantityUnits = input.quantityUnits ?? input.proposal?.quantityUnits ?? '0';
    const gross = grossNotionalFromAssumptions(input.assumptions, quantityUnits);
    const net = netNotionalFromAssumptions(input.assumptions, quantityUnits, side);
    const fee = Object.freeze({
      minorUnits: input.assumptions.feeMinorUnits,
      currency: input.assumptions.feeCurrency,
    });
    return Object.freeze({
      orderId: input.orderId,
      fillId: input.fillId,
      submissionState: input.fillId ? 'FILLED' : 'SUBMITTED',
      quantityUnits,
      executionPrice: Object.freeze({
        minorUnits: input.assumptions.executionPriceMinor,
        currency: input.assumptions.feeCurrency,
      }),
      grossNotional: gross,
      netNotional: net,
      fee,
      spreadCost: spreadCostFromAssumptions(input.assumptions, quantityUnits),
      slippageCost: slippageCostFromAssumptions(input.assumptions, quantityUnits),
      assumptions: input.assumptions,
      environment: 'PAPER',
      providerSourced: false,
      simulation: true,
      executedAt: input.now,
      authorityId: input.authorityId,
      riskAssessmentId: input.riskAssessmentId,
    });
  }

  private upsertPosition(input: {
    readonly input: PaperStrategyRunInput;
    readonly proposal: { readonly proposalId: string; readonly instrumentId: string; readonly quantityUnits: string };
    readonly execution: HeliosPaperExecutionRecord;
    readonly now: import('../../../../domain/src/time.ts').UtcInstant;
    readonly existing?: HeliosPaperPosition;
  }): HeliosPaperPosition {
    if (input.existing) {
      return input.existing;
    }
    const position: HeliosPaperPosition = Object.freeze({
      positionId: paperPositionIdFor(input.input.workOrder.workOrderId, input.proposal.instrumentId),
      customerId: input.input.workOrder.customerId,
      workOrderId: input.input.workOrder.workOrderId,
      strategyId: HELIOS_H14_REFERENCE_PRICE_ENTRY_V1,
      instrumentId: input.proposal.instrumentId,
      quantityUnits: input.proposal.quantityUnits,
      costBasis: input.execution.netNotional,
      status: 'OPEN',
      entryFills: Object.freeze([input.execution]),
      exitFills: Object.freeze([]),
      referenceValuation: input.execution.grossNotional,
      feesAssumed: input.execution.fee,
      realizedResult: null,
      unrealizedResult: null,
      environment: 'PAPER',
      liveProviderPosition: false,
      openedAt: input.now,
      closedAt: null,
    });
    this.store.putPosition(position);
    return position;
  }

  private finalizeCycle(input: {
    readonly cycleId: import('./ids.ts').HeliosPaperCycleId;
    readonly proposalId: import('./ids.ts').HeliosPaperProposalId | null;
    readonly positionId: import('./ids.ts').HeliosPaperPositionId | null;
    readonly outcome: HeliosPaperGrowResult['outcome'];
    readonly reasonCodes: readonly import('./taxonomy.ts').ValidationReasonCode[];
    readonly evidenceChainRefs: readonly string[];
    readonly now: import('../../../../domain/src/time.ts').UtcInstant;
    readonly grossResult?: { readonly minorUnits: string; readonly currency: string } | null;
    readonly netResult?: { readonly minorUnits: string; readonly currency: string } | null;
    readonly feesIncluded?: { readonly minorUnits: string; readonly currency: string } | null;
  }): HeliosPaperGrowResult {
    const result: HeliosPaperGrowResult = Object.freeze({
      cycleId: input.cycleId,
      proposalId: input.proposalId,
      positionId: input.positionId,
      outcome: input.outcome,
      attributionClass: 'PAPER',
      grossResult: input.grossResult ?? null,
      netResult: input.netResult ?? null,
      feesIncluded: input.feesIncluded ?? null,
      reasonCodes: input.reasonCodes,
      evidenceChainRefs: Object.freeze([...input.evidenceChainRefs]),
      completedAt: input.now,
    });
    sealGrowResultPhase(this.evidence, result);
    this.store.putCycle(result);
    return result;
  }
}

export const HELIOS_H14_PAPER_GROW_STRATEGY = 'HELIOS_H14_PAPER_GROW_STRATEGY' as const;
