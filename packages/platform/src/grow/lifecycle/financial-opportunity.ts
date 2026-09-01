import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { SerializedMoney } from '../../mandate/types.ts';
import type { Opportunity } from '../../growth/opportunity/types.ts';
import type { OpportunityCategory } from '../../growth/opportunity/taxonomy.ts';
import type { ExecutionCapability } from './taxonomy.ts';
import type { FinancialRiskProfile } from './risk-model.ts';
import { riskFromOpportunityLevel } from './risk-model.ts';
import { sourcedFact, type SourcedFact } from './data-freshness.ts';

/**
 * Canonical normalized financial opportunity for Grow agents.
 * Maps from the existing Opportunity engine without inventing returns.
 */
export type FinancialOpportunity = {
  readonly opportunityId: string;
  readonly type: OpportunityCategory;
  readonly source: string;
  readonly instrumentOrAction: string;
  readonly currency: string;
  readonly expectedReturnData: ExpectedReturnData;
  readonly risk: FinancialRiskProfile;
  readonly liquidity: string;
  readonly timeHorizon: string;
  readonly minimumAmount?: SerializedMoney;
  readonly fees: readonly { readonly code: string; readonly amount: SerializedMoney; readonly description: string }[];
  readonly provider?: string;
  readonly dataTimestamp: UtcInstant;
  readonly evidence: readonly string[];
  readonly availability: 'ELIGIBLE' | 'INELIGIBLE' | 'EXPIRED' | 'DISMISSED';
  readonly executionCapability: ExecutionCapability;
  readonly dataFacts: readonly SourcedFact[];
  readonly immediatelyExecutable: false;
  readonly achievementPromised: false;
};

export type ExpectedReturnData =
  | { readonly kind: 'UNKNOWN'; readonly reason: string }
  | { readonly kind: 'DETERMINISTIC_EFFECT'; readonly amount: SerializedMoney; readonly note: string }
  | {
      readonly kind: 'SCENARIO_RANGE';
      readonly low: SerializedMoney;
      readonly high: SerializedMoney;
      readonly assumptions: readonly string[];
      readonly notRealized: true;
    }
  | { readonly kind: 'NON_QUANTIFIED'; readonly summary: string };

export function normalizeFinancialOpportunity(
  opportunity: Opportunity,
  now: UtcInstant,
): FinancialOpportunity {
  const expectedReturnData = expectedReturnFrom(opportunity);
  const dataFacts = Object.freeze([
    sourcedFact({
      source: opportunity.source,
      retrievedAt: opportunity.updatedAt,
      now,
      effectiveAt: opportunity.impact.asOf,
    }),
    ...(opportunity.impact.rateSource
      ? [
          sourcedFact({
            source: opportunity.impact.rateSource.catalogId,
            retrievedAt: opportunity.impact.rateSource.asOf,
            now,
          }),
        ]
      : []),
  ]);
  return Object.freeze({
    opportunityId: opportunity.opportunityId,
    type: opportunity.type,
    source: opportunity.source,
    instrumentOrAction: opportunity.productId ?? opportunity.detector,
    currency: opportunity.currency,
    expectedReturnData,
    risk: riskFromOpportunityLevel(opportunity.riskLevel),
    liquidity: opportunity.liquidityImpact,
    timeHorizon: opportunity.timeHorizon,
    fees: opportunity.fees,
    ...(opportunity.eligibility.providerId ? { provider: opportunity.eligibility.providerId } : {}),
    dataTimestamp: opportunity.updatedAt,
    evidence: Object.freeze([...opportunity.evidence.factRefs, ...opportunity.evidence.notes]),
    availability: availabilityOf(opportunity),
    executionCapability: executionCapabilityOf(opportunity),
    dataFacts,
    immediatelyExecutable: false,
    achievementPromised: false,
  });
}

function expectedReturnFrom(opportunity: Opportunity): ExpectedReturnData {
  if (opportunity.impact.returnGuaranteed || opportunity.impact.achievementPromised) {
    return { kind: 'UNKNOWN', reason: 'return guarantees are forbidden' };
  }
  if (opportunity.estimatedImpact) {
    return {
      kind: 'DETERMINISTIC_EFFECT',
      amount: opportunity.estimatedImpact,
      note: 'Known cash effect only; not investment performance.',
    };
  }
  if (opportunity.impactRange) {
    return {
      kind: 'SCENARIO_RANGE',
      low: opportunity.impactRange.low,
      high: opportunity.impactRange.high,
      assumptions: Object.freeze([...opportunity.impact.assumptions]),
      notRealized: true,
    };
  }
  if (opportunity.impact.kind === 'NON_QUANTIFIED_BENEFIT') {
    return { kind: 'NON_QUANTIFIED', summary: opportunity.summary };
  }
  return { kind: 'UNKNOWN', reason: 'insufficient data to quantify expected return' };
}

function availabilityOf(opportunity: Opportunity): FinancialOpportunity['availability'] {
  if (opportunity.status === 'EXPIRED') return 'EXPIRED';
  if (opportunity.status === 'DISMISSED') return 'DISMISSED';
  return opportunity.eligible ? 'ELIGIBLE' : 'INELIGIBLE';
}

function executionCapabilityOf(opportunity: Opportunity): ExecutionCapability {
  if (!opportunity.eligible) {
    return 'UNAVAILABLE';
  }
  if (opportunity.type === 'INVESTMENT_ALLOCATION' || opportunity.type === 'PORTFOLIO_REBALANCE') {
    return 'PROVIDER_REQUIRED';
  }
  if (opportunity.type === 'CASH_OPTIMIZATION' || opportunity.type === 'EMERGENCY_RESERVE') {
    return 'KERNEL_GATED';
  }
  return 'USER_CONFIRMATION_REQUIRED';
}
