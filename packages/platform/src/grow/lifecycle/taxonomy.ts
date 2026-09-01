/**
 * Wave 5 Prompt 15 — Grow My Money end-to-end lifecycle vocabulary.
 * Planning, proposal, and execution-boundary types only. Not a second ledger.
 */

export const EXECUTION_CAPABILITIES = [
  'UNAVAILABLE',
  'PROVIDER_REQUIRED',
  'USER_CONFIRMATION_REQUIRED',
  'SIMULATION_SANDBOX',
  'KERNEL_GATED',
] as const;
export type ExecutionCapability = (typeof EXECUTION_CAPABILITIES)[number];

export const LIFECYCLE_STAGE_STATUSES = [
  'NOT_IMPLEMENTED',
  'CONFIGURED',
  'SIMULATED',
  'IMPLEMENTED',
  'PARTIAL',
  'PROVIDER_GATED',
  'REGULATORY_GATED',
  'LIVE',
] as const;
export type LifecycleStageStatus = (typeof LIFECYCLE_STAGE_STATUSES)[number];

export const DATA_FRESHNESS_STATUSES = [
  'CURRENT',
  'AGING',
  'STALE',
  'UNKNOWN',
  'UNAVAILABLE',
] as const;
export type DataFreshnessStatus = (typeof DATA_FRESHNESS_STATUSES)[number];

export const CANONICAL_EXECUTION_LIFECYCLE_STATES = [
  'PROPOSED',
  'REVIEWED',
  'AUTHORIZED',
  'SUBMITTED',
  'PENDING',
  'PARTIALLY_FILLED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
] as const;
export type CanonicalExecutionLifecycleState = (typeof CANONICAL_EXECUTION_LIFECYCLE_STATES)[number];

export const GROW_FINANCIAL_AGENT_IDS = [
  'savings',
  'cash_optimization',
  'investment',
  'debt',
  'income_opportunity',
  'subscription_savings',
  'resource_exposure',
  'real_estate',
  'travel_savings',
  'portfolio_monitoring',
] as const;
export type GrowFinancialAgentId = (typeof GROW_FINANCIAL_AGENT_IDS)[number];

export const GROW_AUDIT_EVENT_KINDS = [
  'opportunity_discovered',
  'proposal_created',
  'proposal_presented',
  'proposal_authorized',
  'proposal_rejected',
  'execution_submitted',
  'execution_confirmed',
  'execution_failed',
  'portfolio_monitored',
  'proposal_reassessed',
  'mandate_created',
  'mandate_revoked',
] as const;
export type GrowAuditEventKind = (typeof GROW_AUDIT_EVENT_KINDS)[number];

export const FINANCIAL_RISK_DIMENSIONS = [
  'market',
  'liquidity',
  'concentration',
  'credit',
  'currency',
  'duration',
  'volatility',
  'provider',
] as const;
export type FinancialRiskDimension = (typeof FINANCIAL_RISK_DIMENSIONS)[number];
