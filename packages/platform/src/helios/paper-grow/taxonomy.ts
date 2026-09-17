/**
 * HELIOS H15 — customer-visible Grow cycle status contract.
 * Explicit statuses; never generic SUCCESS for every state.
 */

export const GROW_CYCLE_STATUSES = [
  'RESEARCHING',
  'NO_ACTION',
  'PROPOSAL_READY',
  'AWAITING_CONTROL',
  'REJECTED',
  'PAPER_SUBMITTED',
  'PAPER_FILLED',
  'PAPER_ACTIVE',
  'PAPER_CLOSED',
  'BLOCKED',
  'DEGRADED',
] as const;

export type GrowCycleStatus = (typeof GROW_CYCLE_STATUSES)[number];

export const GROW_DEGRADED_REASONS = [
  'RESEARCH_PROVIDER_UNAVAILABLE',
  'MARKET_DATA_STALE',
  'OPPORTUNITY_EXPIRED',
  'AUTHORITY_REVOKED',
  'INSUFFICIENT_SANDBOX_CAPITAL',
  'PAPER_EXECUTOR_UNAVAILABLE',
  'RECONCILIATION_PENDING',
  'RECONCILIATION_ERROR',
] as const;

export type GrowDegradedReason = (typeof GROW_DEGRADED_REASONS)[number];

export const PAPER_DISCLOSURE_KINDS = [
  'SANDBOX_SIMULATION',
  'PAPER_TRADING',
  'NOT_LIVE_RETURN',
  'NOT_WITHDRAWABLE_EXTERNAL',
] as const;

export type PaperDisclosureKind = (typeof PAPER_DISCLOSURE_KINDS)[number];
