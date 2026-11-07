/**
 * HELIOS EXEC05 — smart order routing taxonomy.
 * Engineering evidence only; not a legal best-execution certification.
 */

export const EXEC05_SCHEMA = 'sunrey.helios.execution-connectivity.exec05.v1' as const;

export const ROUTING_SELECTION_MODES = ['HELIOS_OPTIMIZED', 'DIRECTED'] as const;
export type RoutingSelectionMode = (typeof ROUTING_SELECTION_MODES)[number];

export const ROUTING_SCORE_COMPONENTS = [
  'DISPLAYED_PRICE',
  'AVAILABLE_QUANTITY',
  'SPREAD',
  'DEPTH',
  'EXPECTED_FILL_PROBABILITY',
  'HISTORICAL_FILL_RATE',
  'LATENCY',
  'FEES',
  'REBATES',
  'ESTIMATED_MARKET_IMPACT',
  'EXPECTED_SLIPPAGE',
  'PRICE_IMPROVEMENT',
  'ORDER_SIZE',
  'URGENCY',
  'VOLATILITY',
  'VENUE_HEALTH',
  'PROVIDER_HEALTH',
] as const;
export type RoutingScoreComponent = (typeof ROUTING_SCORE_COMPONENTS)[number];

export const ORDER_URGENCY_LEVELS = ['LOW', 'NORMAL', 'HIGH', 'IMMEDIATE'] as const;
export type OrderUrgencyLevel = (typeof ORDER_URGENCY_LEVELS)[number];

export const VENUE_HEALTH_STATES = ['HEALTHY', 'DEGRADED', 'UNAVAILABLE'] as const;
export type Exec05VenueHealthState = (typeof VENUE_HEALTH_STATES)[number];

export const ROUTING_DECISION_OUTCOMES = ['VENUE_SELECTED', 'NO_ELIGIBLE_VENUE', 'DIRECTED_INELIGIBLE'] as const;
export type RoutingDecisionOutcome = (typeof ROUTING_DECISION_OUTCOMES)[number];

export const PROHIBITED_SOLE_REASONS = [
  'REBATE_HIGHEST',
  'PAYMENT_REVENUE_HIGHEST',
  'COMMERCIAL_PREFERENCE',
] as const;
export type ProhibitedSoleSelectionReason = (typeof PROHIBITED_SOLE_REASONS)[number];
