/**
 * HELIOS Multi-Asset M23 — execution routing taxonomies.
 *
 * Routing selects authorized provider/account/venue candidates.
 * It does not issue Execution Authority or authorize financial activity.
 */

export const EXECUTION_ROUTING_OUTCOMES = [
  'ROUTE_SELECTED',
  'EXECUTION_ROUTE_UNAVAILABLE',
] as const;
export type ExecutionRoutingOutcome = (typeof EXECUTION_ROUTING_OUTCOMES)[number];

export const EXECUTION_ROUTING_REJECTION_REASONS = [
  'UNSUPPORTED_INSTRUMENT',
  'UNSUPPORTED_ASSET_CLASS',
  'UNSUPPORTED_JURISDICTION',
  'UNSUPPORTED_ORDER_TYPE',
  'UNSUPPORTED_SESSION',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_DEGRADED',
  'PROVIDER_NOT_CERTIFIED',
  'PROVIDER_NOT_SANDBOX',
  'PROVIDER_PRODUCTION_DISABLED',
  'EXTERNAL_PROVIDER_REQUIRED',
  'ACCOUNT_NOT_ELIGIBLE',
  'ACCOUNT_NOT_FUNDED',
  'ACCOUNT_NOT_CERTIFIED',
  'CUSTOMER_NOT_ELIGIBLE',
  'MANDATE_INACTIVE',
  'VENUE_UNAVAILABLE',
  'MARKET_SESSION_CLOSED',
  'EXECUTION_CAPABILITY_UNAVAILABLE',
  'CUSTODY_CAPABILITY_UNAVAILABLE',
  'SETTLEMENT_CAPABILITY_UNAVAILABLE',
  'INSUFFICIENT_LIQUIDITY',
  'RATE_LIMITED',
  'RISK_ENGINE_REFUSED',
  'JURISDICTION_DENIED',
  'LOWER_PRIORITY_CANDIDATE',
  'FAILOVER_SECONDARY',
] as const;
export type ExecutionRoutingRejectionReason = (typeof EXECUTION_ROUTING_REJECTION_REASONS)[number];

export const PROVIDER_CAPABILITY_STATES = [
  'AVAILABLE',
  'SANDBOX_AVAILABLE',
  'CONFIGURED',
  'CERTIFICATION_ONLY',
  'DEGRADED',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'EXTERNAL_PROVIDER_REQUIRED',
] as const;
export type ProviderCapabilityState = (typeof PROVIDER_CAPABILITY_STATES)[number];

export const PROVIDER_ENVIRONMENT_STATES = [
  'simulation',
  'sandbox',
  'production_candidate',
  'production_disabled',
] as const;
export type ProviderEnvironmentState = (typeof PROVIDER_ENVIRONMENT_STATES)[number];

export const PROVIDER_CERTIFICATION_STATES = [
  'NOT_CERTIFIED',
  'SANDBOX_CERTIFIED',
  'CERTIFICATION_IN_PROGRESS',
  'PRODUCTION_CANDIDATE',
  'PRODUCTION_CERTIFIED',
] as const;
export type ProviderCertificationState = (typeof PROVIDER_CERTIFICATION_STATES)[number];

export const PROVIDER_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'UNKNOWN',
] as const;
export type ProviderHealthState = (typeof PROVIDER_HEALTH_STATES)[number];

export const EXECUTION_CAPABILITY_LEVELS = [
  'FULL',
  'LIMITED',
  'VIEW_ONLY',
  'UNAVAILABLE',
] as const;
export type ExecutionCapabilityLevel = (typeof EXECUTION_CAPABILITY_LEVELS)[number];

export const ROUTE_IMPLEMENTATION_STATUSES = [
  'IMPLEMENTED',
  'SANDBOX_QUALIFIED',
  'CREDENTIAL_DEPENDENT',
  'PRODUCTION_DISABLED',
  'EXTERNALLY_REQUIRED',
] as const;
export type RouteImplementationStatus = (typeof ROUTE_IMPLEMENTATION_STATUSES)[number];

export const SUPPORTED_ORDER_TYPES = [
  'MARKET',
  'LIMIT',
  'STOP',
  'STOP_LIMIT',
] as const;
export type SupportedOrderType = (typeof SUPPORTED_ORDER_TYPES)[number];

export const SUPPORTED_ORDER_ACTIONS = ['BUY', 'SELL'] as const;
export type SupportedOrderAction = (typeof SUPPORTED_ORDER_ACTIONS)[number];
