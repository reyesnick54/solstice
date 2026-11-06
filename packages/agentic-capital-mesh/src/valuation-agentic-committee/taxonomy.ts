export const VALUATION_COMMITTEE_SCHEMA = 'sunrey.helios.val06.agentic-valuation-committee.v1' as const;

export const HELIOS_VAL06_AGENTIC_VALUATION = 'HELIOS_VAL06_AGENTIC_VALUATION' as const;
export const HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED =
  'HELIOS_VAL06_AGENTIC_VALUATION_QUALIFIED' as const;
export const HELIOS_VAL06_AGENTIC_VALUATION_BLOCKED =
  'HELIOS_VAL06_AGENTIC_VALUATION_BLOCKED' as const;

/** Independent valuation specialists (run before advocacy). */
export const VALUATION_ANALYST_SPECIALIST_ROLES = [
  'REVENUE_FORECAST',
  'MARGIN',
  'RESIDUAL_INCOME',
  'COST_OF_CAPITAL',
  'DCF_VALUATION',
  'REVERSE_DCF_CHALLENGE',
  'COMPARABLE_VALUATION',
  'SOTP',
] as const;

export type ValuationAnalystSpecialistRole = (typeof VALUATION_ANALYST_SPECIALIST_ROLES)[number];

export const VALUATION_ADVOCACY_ROLES = ['BULL_VALUATION', 'BEAR_VALUATION'] as const;
export type ValuationAdvocacyRole = (typeof VALUATION_ADVOCACY_ROLES)[number];

export const VALUATION_REVIEW_ROLES = ['VALUATION_RISK'] as const;
export type ValuationReviewRole = (typeof VALUATION_REVIEW_ROLES)[number];

export const VALUATION_COMMITTEE_ROLES = [
  ...VALUATION_ANALYST_SPECIALIST_ROLES,
  ...VALUATION_ADVOCACY_ROLES,
  ...VALUATION_REVIEW_ROLES,
  'VALUATION_SYNTHESIS',
] as const;

export type ValuationCommitteeRole = (typeof VALUATION_COMMITTEE_ROLES)[number];

export const VALUATION_COMMITTEE_PHASES = [
  'EVIDENCE_FREEZE',
  'CANONICAL_FACTS_BIND',
  'ASSUMPTION_CHALLENGE_STATE',
  'H20_SPECIALIST_ASSIGNMENT',
  'SPECIALIST_ANALYSIS',
  'ADVOCACY_DEBATE',
  'RISK_REVIEW',
  'CONTRADICTION_CHALLENGE',
  'SYNTHESIS',
] as const;

export type ValuationCommitteePhase = (typeof VALUATION_COMMITTEE_PHASES)[number];

export const VALUATION_TIME_HORIZONS = [
  'NEAR_TERM',
  'MEDIUM_TERM',
  'LONG_TERM',
  'EVENT_DRIVEN',
] as const;

export type ValuationTimeHorizon = (typeof VALUATION_TIME_HORIZONS)[number];

export const VALUATION_COMMITTEE_AGENT_NAMES: Readonly<Record<ValuationCommitteeRole, string>> =
  Object.freeze({
    REVENUE_FORECAST: 'RevenueForecastAgent',
    MARGIN: 'MarginAgent',
    RESIDUAL_INCOME: 'ResidualIncomeAgent',
    COST_OF_CAPITAL: 'CostOfCapitalAgent',
    DCF_VALUATION: 'DCFValuationAgent',
    REVERSE_DCF_CHALLENGE: 'ReverseDCFChallengeAgent',
    COMPARABLE_VALUATION: 'ComparableValuationAgent',
    SOTP: 'SOTPAgent',
    BULL_VALUATION: 'BullValuationAgent',
    BEAR_VALUATION: 'BearValuationAgent',
    VALUATION_RISK: 'ModelRiskAgent',
    VALUATION_SYNTHESIS: 'SynthesisAgent',
  });
