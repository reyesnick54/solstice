import type { UtcInstant } from '../../../../domain/src/time.ts';
import { termsStillValid } from '../executable-opportunity/terms.ts';
import type { ExecutableOpportunity, QualificationTermsSnapshot } from '../executable-opportunity/types.ts';
import type { EconomicWorkOrder } from '../types.ts';
import type { PaperStrategyValidationResult } from './types.ts';
import type { ValidationReasonCode } from './taxonomy.ts';

export function validatePaperStrategyInputs(input: {
  readonly opportunity: ExecutableOpportunity;
  readonly workOrder: EconomicWorkOrder;
  readonly terms: QualificationTermsSnapshot;
  readonly now: UtcInstant;
  readonly venueSession: 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET' | 'UNKNOWN';
  readonly reservedCapitalMinor: string;
  readonly proposedNotionalMinor: string;
  readonly researchBudgetRemaining: string;
  readonly taskAlreadyCompleted: boolean;
  readonly decisionObservedAt: UtcInstant;
}): PaperStrategyValidationResult {
  const reasons: ValidationReasonCode[] = [];

  if (input.taskAlreadyCompleted) {
    reasons.push('DUPLICATE_TASK');
  }
  if (input.opportunity.state !== 'QUALIFIED_FOR_PROPOSAL') {
    reasons.push('OPPORTUNITY_NOT_QUALIFIED');
  }
  if (input.opportunity.qualificationExpiresAt && Date.parse(input.now) > Date.parse(input.opportunity.qualificationExpiresAt)) {
    reasons.push('OPPORTUNITY_STALE');
  }
  if (!termsStillValid(input.terms, input.now)) {
    reasons.push('EVIDENCE_STALE');
  }
  if (input.venueSession === 'CLOSED') {
    reasons.push('VENUE_CLOSED');
  }
  if (input.workOrder.state !== 'ACTIVE') {
    reasons.push('WORK_ORDER_INACTIVE');
  }
  if (!input.opportunity.instrument?.mappingVerified) {
    reasons.push('INSTRUMENT_MAPPING_INVALID');
  }
  if (input.opportunity.eligibilityDecision && !input.opportunity.eligibilityDecision.eligible) {
    reasons.push('CUSTOMER_INELIGIBLE');
  }
  if (!input.opportunity.routeDecision?.routeReady) {
    reasons.push('ROUTE_UNAVAILABLE');
  }
  const capital = BigInt(input.reservedCapitalMinor);
  const notional = BigInt(input.proposedNotionalMinor);
  if (notional > capital) {
    reasons.push('CAPITAL_UNAVAILABLE');
  }
  if (BigInt(input.researchBudgetRemaining) <= 0n) {
    reasons.push('RESEARCH_BUDGET_INVALID');
  }
  if (Date.parse(input.decisionObservedAt) > Date.parse(input.now)) {
    reasons.push('FUTURE_INFORMATION');
  }

  if (reasons.length > 0) {
    const outcome = reasons.includes('DUPLICATE_TASK')
      ? 'WAIT'
      : reasons.some((code) => code === 'VENUE_CLOSED' || code === 'RESEARCH_BUDGET_INVALID')
        ? 'WAIT'
        : 'REJECTED_VALIDATION';
    return Object.freeze({ ok: false, reasonCodes: Object.freeze(reasons), outcome });
  }
  return Object.freeze({ ok: true });
}
