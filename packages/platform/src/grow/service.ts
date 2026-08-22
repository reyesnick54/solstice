import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { EvidenceVault } from '../../evidence/src/vault.ts';
import { authorizeConfirmMandate, authorizeViewGrowthPlan } from '../access.ts';
import type { GrowthActionCandidate, GrowthPlan } from '../growth/types.ts';
import {
  createExecutionCommand,
  initialExecutionRecord,
  recordApproval,
  revalidateBeforeExecution,
  transitionExecution,
} from './execution.ts';
import { emptyTrace, sealGrowEvidence } from './evidence.ts';
import {
  activateGrowthPlan,
  agentIncreaseRecurringAmount,
  cancelActivatedPlan,
  createRecurringMandate,
  evaluateRebalance,
  pauseActivatedPlan,
  performanceAgainstPlan,
  resumeActivatedPlan,
  runMonitoringCycle,
  transitionRecurring,
} from './lifecycle.ts';
import { generateFinancialProposal, modifyProposalAmount } from './proposal.ts';
import { buildGrowScenarios } from './scenarios.ts';
import { InMemoryGrowStore } from './store.ts';
import type { SuitabilityFacts } from './suitability.ts';
import type {
  ActivatedGrowthPlan,
  FinancialProposal,
  GrowApproval,
  GrowExecutionCommand,
  GrowExecutionRecord,
  GrowFailure,
  GrowRevalidationFact,
  GrowRevalidationResult,
  RecurringContributionMandate,
} from './types.ts';

/**
 * Productized Grow lifecycle. Generates proposals and execution
 * commands. Does not post journals, issue Execution Authority, or call
 * provider APIs.
 */
export class GrowLifecycleService {
  private readonly clock: Clock;
  private readonly evidence?: EvidenceVault;
  readonly store: InMemoryGrowStore;

  constructor(input: {
    readonly clock: Clock;
    readonly evidence?: EvidenceVault;
    readonly store?: InMemoryGrowStore;
  }) {
    this.clock = input.clock;
    if (input.evidence) {
      this.evidence = input.evidence;
    }
    this.store = input.store ?? new InMemoryGrowStore();
  }

  generateProposal(
    actor: unknown,
    plan: GrowthPlan,
    candidate: GrowthActionCandidate,
    customerId: string,
    suitabilityFacts: SuitabilityFacts,
  ): Result<FinancialProposal, GrowFailure> {
    const access = authorizeViewGrowthPlan(actor, plan.subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    if (plan.state === 'STALE') {
      return err({ code: 'REFRESH_PROPOSAL_REQUIRED', message: 'stale GrowthPlan cannot generate a current proposal' });
    }
    const proposal = generateFinancialProposal({
      plan,
      candidate,
      customerId,
      now: this.clock.now(),
      suitabilityFacts,
    });
    this.store.putProposal(proposal);
    this.seal('GROW_PROPOSAL_GENERATED', {
      ...emptyTrace(),
      pegSnapshotId: plan.pegSnapshotId,
      opportunityIds: proposal.opportunityIds,
      planId: plan.planId,
      proposalId: proposal.proposalId,
      proposalVersion: proposal.version,
      suitability: proposal.suitability,
      policyDecision: proposal.policyDecision,
    });
    return ok(proposal);
  }

  modifyAmount(
    actor: unknown,
    proposalId: string,
    plan: GrowthPlan,
    candidate: GrowthActionCandidate,
    amount: FinancialProposal['amount'],
    suitabilityFacts: SuitabilityFacts,
  ): Result<FinancialProposal, GrowFailure> {
    const current = this.store.getProposal(proposalId);
    if (!current) {
      return err({ code: 'PROPOSAL_NOT_FOUND', message: 'proposal not found' });
    }
    const access = authorizeConfirmMandate(actor, current.subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    const superseded: FinancialProposal = Object.freeze({ ...current, state: 'SUPERSEDED' });
    this.store.putProposal(superseded);
    const next = modifyProposalAmount(current, plan, candidate, amount, this.clock.now(), suitabilityFacts);
    this.store.putProposal(next);
    return ok(next);
  }

  approve(
    actor: unknown,
    proposalId: string,
    input: {
      readonly actorKind: GrowApproval['actorKind'];
      readonly authenticationAssurance: GrowApproval['authenticationAssurance'];
      readonly stepUpSatisfied: boolean;
    },
  ): Result<{ readonly proposal: FinancialProposal; readonly approval: GrowApproval }, GrowFailure> {
    const proposal = this.store.getProposal(proposalId);
    if (!proposal) {
      return err({ code: 'PROPOSAL_NOT_FOUND', message: 'proposal not found' });
    }
    const access = authorizeConfirmMandate(actor, proposal.subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    if (input.actorKind !== 'CUSTOMER' && input.actorKind !== 'HUMAN_OPERATOR') {
      return err({ code: 'AGENT_CANNOT_SELF_APPROVE', message: 'agent cannot approve its own proposal' });
    }
    const approval = recordApproval({
      proposal,
      actorId: access.value.actorId,
      actorKind: input.actorKind,
      now: this.clock.now(),
      authenticationAssurance: input.authenticationAssurance,
      stepUpSatisfied: input.stepUpSatisfied,
    });
    if ('code' in approval) {
      if (approval.code === 'STEP_UP_REQUIRED') {
        this.store.putProposal(Object.freeze({ ...proposal, state: 'AWAITING_STEP_UP' }));
      }
      return err(approval);
    }
    const approved = Object.freeze({ ...proposal, state: 'APPROVED' as const });
    this.store.putProposal(approved);
    this.store.putApproval(approval);
    this.seal('GROW_PROPOSAL_APPROVED', {
      ...emptyTrace(),
      pegSnapshotId: approved.pegSnapshotId,
      opportunityIds: approved.opportunityIds,
      planId: approved.planId,
      proposalId: approved.proposalId,
      proposalVersion: approved.version,
      suitability: approved.suitability,
      policyDecision: approved.policyDecision,
      approvalId: approval.approvalId,
      stepUpSatisfied: approval.stepUpSatisfied,
    });
    return ok({ proposal: approved, approval });
  }

  createCommand(
    actor: unknown,
    proposalId: string,
    idempotencyKey: string,
  ): Result<GrowExecutionCommand, GrowFailure> {
    const existing = this.store.commandByIdempotency(idempotencyKey);
    if (existing) {
      return ok(existing);
    }
    const proposal = this.store.getProposal(proposalId);
    if (!proposal) {
      return err({ code: 'PROPOSAL_NOT_FOUND', message: 'proposal not found' });
    }
    const access = authorizeConfirmMandate(actor, proposal.subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    const approval = this.store.approvalFor(proposal.proposalId, proposal.version);
    if (!approval) {
      return err({ code: 'APPROVAL_INVALID', message: 'no approval for this proposal version' });
    }
    const command = createExecutionCommand({
      proposal,
      approval,
      now: this.clock.now(),
      idempotencyKey,
    });
    if ('code' in command) {
      return err(command);
    }
    this.store.putCommand(command);
    this.store.putExecution(initialExecutionRecord(command, this.clock.now()));
    return ok(command);
  }

  revalidate(
    commandId: string,
    facts: Omit<GrowRevalidationFact, 'proposalExpired' | 'proposalSuperseded' | 'approvalValid' | 'authenticationSufficient' | 'materialChange'>,
  ): Result<GrowRevalidationResult, GrowFailure> {
    const command = this.store.getCommand(commandId);
    if (!command) {
      return err({ code: 'PROPOSAL_NOT_FOUND', message: 'execution command not found' });
    }
    const proposal = this.store.getProposal(command.proposalId, command.proposalVersion);
    const approval = this.store.getApproval(command.approvalId);
    if (!proposal || !approval) {
      return err({ code: 'APPROVAL_INVALID', message: 'proposal or approval missing for revalidation' });
    }
    return ok(
      revalidateBeforeExecution({
        proposal,
        command,
        approval,
        now: this.clock.now(),
        facts,
      }),
    );
  }

  recordExecutionTransition(
    executionId: string,
    to: GrowExecutionRecord['state'],
    patch: Partial<GrowExecutionRecord> = {},
  ): Result<GrowExecutionRecord, GrowFailure> {
    const current = this.store.getExecution(executionId);
    if (!current) {
      return err({ code: 'PROPOSAL_NOT_FOUND', message: 'execution not found' });
    }
    const next = transitionExecution(current, to, this.clock.now(), patch);
    if ('code' in next && !('executionId' in next)) {
      return err(next);
    }
    const record = next as GrowExecutionRecord;
    this.store.putExecution(record);
    this.seal('GROW_EXECUTION_TRANSITION', {
      ...emptyTrace(),
      proposalId: record.proposalId,
      proposalVersion: record.proposalVersion,
      executionAuthorityId: record.authorityId,
      providerId: record.providerId,
      providerResult: record.providerResult,
      ledgerJournalId: record.ledgerJournalId,
      custodyRef: record.custodyRef,
      settlementRef: record.ledgerJournalId,
    });
    return ok(record);
  }

  activatePlan(
    actor: unknown,
    input: {
      readonly planId: string;
      readonly planVersion: number;
      readonly subjectId: string;
      readonly customerId: string;
      readonly components: readonly { readonly actionId: string; readonly amount: RecurringContributionMandate['amount'] }[];
    },
  ): Result<ActivatedGrowthPlan, GrowFailure> {
    const access = authorizeConfirmMandate(actor, input.subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    const activated = activateGrowthPlan({ ...input, now: this.clock.now() });
    this.store.putActivatedPlan(activated);
    return ok(activated);
  }

  createRecurring(
    actor: unknown,
    input: Parameters<typeof createRecurringMandate>[0],
  ): Result<RecurringContributionMandate, GrowFailure> {
    const access = authorizeConfirmMandate(actor, input.subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    const mandate = createRecurringMandate(input);
    if ('code' in mandate) {
      return err(mandate);
    }
    this.store.putRecurring(mandate);
    return ok(mandate);
  }

  refuseAgentAmountIncrease(mandateId: string, nextMinorUnits: string): GrowFailure {
    const mandate = this.store.getRecurring(mandateId);
    if (!mandate) {
      return { code: 'RECURRING_REVOKED', message: 'recurring mandate not found' };
    }
    return agentIncreaseRecurringAmount(mandate, nextMinorUnits);
  }

  pausePlan(actor: unknown, subjectId: string): Result<ActivatedGrowthPlan, GrowFailure> {
    return this.controlPlan(actor, subjectId, pauseActivatedPlan);
  }

  resumePlan(actor: unknown, subjectId: string): Result<ActivatedGrowthPlan, GrowFailure> {
    return this.controlPlan(actor, subjectId, resumeActivatedPlan);
  }

  cancelPlan(actor: unknown, subjectId: string): Result<ActivatedGrowthPlan, GrowFailure> {
    return this.controlPlan(actor, subjectId, cancelActivatedPlan);
  }

  revokeRecurring(actor: unknown, subjectId: string, recurringMandateId: string): Result<RecurringContributionMandate, GrowFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    const mandate = this.store.getRecurring(recurringMandateId);
    if (!mandate) {
      return err({ code: 'RECURRING_REVOKED', message: 'recurring mandate not found' });
    }
    const next = transitionRecurring(mandate, 'REVOKED');
    if ('code' in next) {
      return err(next);
    }
    this.store.putRecurring(next);
    return ok(next);
  }

  monitor(subjectId: string, input: { readonly cashReserveBelowTarget: boolean; readonly driftExceeded: boolean; readonly productAvailable: boolean }) {
    const cycle = runMonitoringCycle({ subjectId, now: this.clock.now(), ...input });
    this.store.putMonitoring(cycle);
    return cycle;
  }

  rebalanceOpportunity(targetBps: number, currentBps: number, thresholdBps: number) {
    return evaluateRebalance({ targetBps, currentBps, thresholdBps });
  }

  recordPerformance(input: Parameters<typeof performanceAgainstPlan>[0]) {
    const model = performanceAgainstPlan(input);
    this.store.putPerformance(model);
    this.seal('GROW_PERFORMANCE', {
      ...emptyTrace(),
      planId: input.planId,
      performanceResult: model.performance.minorUnits,
    });
    return model;
  }

  scenarios(currency: string, contributionMinorUnits: string, horizonMonths: number) {
    return buildGrowScenarios({ currency, contributionMinorUnits, horizonMonths });
  }

  private controlPlan(
    actor: unknown,
    subjectId: string,
    mutate: (plan: ActivatedGrowthPlan) => ActivatedGrowthPlan,
  ): Result<ActivatedGrowthPlan, GrowFailure> {
    const access = authorizeConfirmMandate(actor, subjectId);
    if (!access.ok) {
      return err({ code: 'USER_INELIGIBLE', message: access.error.message });
    }
    const plan = this.store.latestActivatedPlan(subjectId);
    if (!plan) {
      return err({ code: 'PLAN_NOT_FOUND', message: 'no activated plan' });
    }
    const next = mutate(plan);
    this.store.putActivatedPlan(next);
    return ok(next);
  }

  private seal(kind: string, trace: Parameters<typeof sealGrowEvidence>[2]): void {
    this.store.putEvidence(`${kind}:${trace.proposalId ?? trace.planId ?? 'none'}`, trace);
    sealGrowEvidence(this.evidence, kind, trace);
  }
}
