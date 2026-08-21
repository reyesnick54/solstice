export const TREASURY_OWNERSHIPS = [
  'CUSTOMER',
  'TREASURY',
  'CORPORATE',
  'PROVIDER',
  'SIMULATION_SYSTEM',
] as const;

export type TreasuryOwnership = (typeof TREASURY_OWNERSHIPS)[number];

export const TREASURY_ACCOUNT_KINDS = [
  'PROVIDER_SETTLEMENT',
  'CORRESPONDENT',
  'FX_CLEARING',
  'CORRIDOR_PREFUNDING',
  'LIQUIDITY',
  'CARD_SETTLEMENT_REF',
  'OPERATING',
  'CUSTOMER_FUNDS',
  'SETTLEMENT',
  'CLEARING',
  'PROVIDER_PREFUNDING',
  'FX_LIQUIDITY',
  'CARD_SETTLEMENT',
  'FEE',
  'SUSPENSE',
] as const;

export type TreasuryAccountKind = (typeof TREASURY_ACCOUNT_KINDS)[number];

export const RESERVATION_STATES = [
  'ACTIVE',
  'COMMITTED',
  'RELEASED',
  'EXPIRED',
  'CANCELLED',
] as const;

export type ReservationState = (typeof RESERVATION_STATES)[number];

export const SETTLEMENT_RISK_STATES = ['NORMAL', 'ELEVATED', 'RESTRICTED', 'HALTED'] as const;

export type SettlementRiskState = (typeof SETTLEMENT_RISK_STATES)[number];

export const KILL_SWITCH_SCOPES = [
  'PROVIDER',
  'RAIL',
  'CORRIDOR',
  'SETTLEMENT_ACCOUNT',
  'CURRENCY_ROUTE',
  'HALT_RESERVATIONS',
  'RECONCILIATION_ONLY',
] as const;

export type KillSwitchScope = (typeof KILL_SWITCH_SCOPES)[number];

export const RECONCILIATION_STATUSES = [
  'MATCHED',
  'PENDING',
  'MISMATCH',
  'MISSING_INTERNAL',
  'MISSING_EXTERNAL',
  'INVESTIGATION_REQUIRED',
] as const;

export type TreasuryReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const REBALANCE_STATES = ['PROPOSED', 'REFUSED', 'EXECUTED', 'CANCELLED'] as const;

export type RebalanceState = (typeof REBALANCE_STATES)[number];

export const ROUTING_VERSION = 'treasury-route-v1';

export const ROUTING_WEIGHTS_V1 = Object.freeze({
  version: ROUTING_VERSION,
  providerFee: 30n,
  fxCost: 20n,
  expectedSpeed: 15n,
  historicalReliability: 15n,
  liquidityConsumption: 10n,
  providerConcentration: 5n,
  settlementExposure: 5n,
  regulatoryNote: 'RESEARCH_REQUIRED — engineering simulation weights, not regulatory capital',
});

export type RoutingWeights = typeof ROUTING_WEIGHTS_V1;

export const CONCENTRATION_THRESHOLD_NOTE =
  'RESEARCH_REQUIRED — simulation engineering threshold, not a regulatory capital requirement';
