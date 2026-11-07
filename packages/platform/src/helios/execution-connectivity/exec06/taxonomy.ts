/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC06 bounded execution algorithm taxonomies.
 * Research/production-shaped scheduling only; does not grant Execution Authority.
 */

export const EXEC06_ENGINE_VERSION = 'helios-exec06-bounded-algos-v1' as const;

export const EXECUTION_ALGORITHM_KINDS = [
  'MARKET',
  'LIMIT',
  'PASSIVE_LIMIT',
  'AGGRESSIVE_LIMIT',
  'TWAP',
  'VWAP',
  'POV',
  'ARRIVAL_PRICE',
  'IMPLEMENTATION_SHORTFALL',
] as const;
export type ExecutionAlgorithmKind = (typeof EXECUTION_ALGORITHM_KINDS)[number];

export const PARENT_ORDER_STATUSES = [
  'REGISTERED',
  'WORKING',
  'PAUSED',
  'CANCEL_ONLY',
  'COMPLETED',
  'HALTED',
] as const;
export type ParentOrderStatus = (typeof PARENT_ORDER_STATUSES)[number];

export const CHILD_ORDER_STATUSES = [
  'SCHEDULED',
  'WORKING',
  'PARTIAL',
  'FILLED',
  'CANCELED',
  'REPLACED',
] as const;
export type ChildOrderStatus = (typeof CHILD_ORDER_STATUSES)[number];

export const EXECUTION_ALGORITHM_MODES = [
  'ACTIVE',
  'PAUSED_CHILD_GENERATION',
  'CANCEL_ONLY',
] as const;
export type ExecutionAlgorithmMode = (typeof EXECUTION_ALGORITHM_MODES)[number];

export const MARKET_DATA_UNTRUSTED_POLICIES = [
  'CANCEL_OPEN_CHILDREN',
  'CANCEL_ONLY',
] as const;
export type MarketDataUntrustedPolicy = (typeof MARKET_DATA_UNTRUSTED_POLICIES)[number];

export const AUTHORITATIVE_MARKET_TRUST = ['TRUSTED', 'UNTRUSTED'] as const;
export type AuthoritativeMarketTrust = (typeof AUTHORITATIVE_MARKET_TRUST)[number];

export const EXECUTION_ALGORITHM_VIOLATION_CODES = [
  'PARENT_QUANTITY_INCREASE_FORBIDDEN',
  'SIDE_REVERSED_FORBIDDEN',
  'INSTRUMENT_CHANGED_FORBIDDEN',
  'CUSTOMER_CHANGED_FORBIDDEN',
  'NOTIONAL_EXCEEDED',
  'VALIDITY_ENVELOPE_EXCEEDED',
  'LIMIT_OUT_OF_AUTHORIZED_BOUNDS',
  'PARTICIPATION_CEILING_EXCEEDED',
  'RISK_OVERRIDDEN_FORBIDDEN',
  'RISK_REFUSED',
  'CHILD_GENERATION_PAUSED',
  'CANCEL_ONLY_MODE',
  'ZERO_SLICE_QUANTITY',
  'PARENT_NOT_GOVERNED',
] as const;
export type ExecutionAlgorithmViolationCode = (typeof EXECUTION_ALGORITHM_VIOLATION_CODES)[number];
