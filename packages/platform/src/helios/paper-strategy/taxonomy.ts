export const HELIOS_PAPER_STRATEGY_IDS = ['HELIOS_H14_REFERENCE_PRICE_ENTRY_V1'] as const;
export type HeliosPaperStrategyId = (typeof HELIOS_PAPER_STRATEGY_IDS)[number];

export const PAPER_CYCLE_OUTCOMES = [
  'NO_ACTION',
  'PROPOSAL_CREATED',
  'EXECUTED',
  'CLOSED',
  'REJECTED_RISK',
  'REJECTED_COMPLIANCE',
  'REJECTED_VALIDATION',
  'WAIT',
] as const;
export type PaperCycleOutcome = (typeof PAPER_CYCLE_OUTCOMES)[number];

export const PAPER_PROPOSAL_STATES = [
  'DRAFT',
  'SUBMITTED',
  'RISK_APPROVED',
  'RISK_DENIED',
  'KERNEL_DENIED',
  'EXECUTED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type PaperProposalState = (typeof PAPER_PROPOSAL_STATES)[number];

export const PAPER_POSITION_STATUSES = ['OPEN', 'CLOSING', 'CLOSED'] as const;
export type PaperPositionStatus = (typeof PAPER_POSITION_STATUSES)[number];

export const PAPER_ATTRIBUTION_CLASSES = ['PAPER', 'SIMULATED'] as const;
export type PaperAttributionClass = (typeof PAPER_ATTRIBUTION_CLASSES)[number];

export const VALIDATION_REASON_CODES = [
  'OK',
  'OPPORTUNITY_NOT_QUALIFIED',
  'OPPORTUNITY_STALE',
  'EVIDENCE_STALE',
  'VENUE_CLOSED',
  'WORK_ORDER_INACTIVE',
  'CAPITAL_UNAVAILABLE',
  'RESEARCH_BUDGET_INVALID',
  'INSTRUMENT_MAPPING_INVALID',
  'CUSTOMER_INELIGIBLE',
  'ROUTE_UNAVAILABLE',
  'FUTURE_INFORMATION',
  'DUPLICATE_TASK',
] as const;
export type ValidationReasonCode = (typeof VALIDATION_REASON_CODES)[number];
