import { addMs } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { EconomicWorkOrder } from '../types.ts';
import type { ExecutableOpportunity } from '../executable-opportunity/types.ts';
import { paperProposalIdFor } from './ids.ts';
import type { HeliosPaperGrowProposal, HeliosPaperResearchResult, HeliosStrategyDecision } from './types.ts';

const PROPOSAL_TTL_MS = 30 * 60 * 1000;

export function buildHeliosPaperProposal(input: {
  readonly workOrder: EconomicWorkOrder;
  readonly opportunity: ExecutableOpportunity;
  readonly research: HeliosPaperResearchResult;
  readonly decision: HeliosStrategyDecision;
  readonly notionalMinor: string;
  readonly currency: string;
  readonly reservedCapitalMinor: string;
  readonly now: UtcInstant;
  readonly key?: string;
}): HeliosPaperGrowProposal {
  if (input.decision.action === 'NO_ACTION') {
    throw new Error('cannot build proposal for NO_ACTION decision');
  }
  const proposalId = paperProposalIdFor(input.workOrder.workOrderId, input.key ?? input.decision.action);
  const notional = Object.freeze({ minorUnits: input.notionalMinor, currency: input.currency });
  return Object.freeze({
    proposalId,
    workOrderId: input.workOrder.workOrderId,
    customerId: input.workOrder.customerId,
    subjectId: input.workOrder.subjectId,
    sandboxAllocationMinor: input.reservedCapitalMinor,
    sandboxAllocationCurrency: input.currency,
    instrumentId: input.decision.instrumentId,
    direction: input.decision.action,
    quantityUnits: input.decision.quantityUnits,
    notional,
    referencePrice: input.research.referencePrice,
    evidenceRefs: input.research.evidenceRefs,
    research: input.research,
    strategyDecision: input.decision,
    rationale: input.decision.rationale,
    invalidationConditions: Object.freeze([
      `Reference price rises above exit threshold ${input.decision.exitThresholdMinor}`,
      'Work order completes or is revoked',
      'Qualification terms expire',
      'Mandate restriction applies',
    ]),
    expiresAt: addMs(input.now, PROPOSAL_TTL_MS) as UtcInstant,
    environment: 'PAPER',
    state: 'DRAFT',
    createdAt: input.now,
    updatedAt: input.now,
    grantsFinancialEffect: false,
  });
}
