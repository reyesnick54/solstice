/**
 * HELIOS Forward Alpha ALPHA04 — shadow capital portfolio accounting (research only).
 * Not the SunRey financial ledger.
 */

export const SHADOW_CAPITAL_SCHEMA = 'sunrey.helios.forward-alpha.alpha04-shadow-capital.v1' as const;

export const HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED =
  'HELIOS_ALPHA04_SHADOW_CAPITAL_QUALIFIED' as const;
export const HELIOS_ALPHA04_SHADOW_CAPITAL_BLOCKED = 'HELIOS_ALPHA04_SHADOW_CAPITAL_BLOCKED' as const;

export const SHADOW_SETTLEMENT_STATES = ['TRADE_DATE', 'PENDING_SETTLEMENT', 'SETTLED'] as const;
export type ShadowSettlementState = (typeof SHADOW_SETTLEMENT_STATES)[number];

export const SHADOW_TRADE_SIDES = ['BUY', 'SELL'] as const;
export type ShadowTradeSide = (typeof SHADOW_TRADE_SIDES)[number];

export const SHADOW_CAPITAL_FAILURE_CODES = [
  'INSUFFICIENT_SETTLED_CASH',
  'INSUFFICIENT_BUYING_POWER',
  'INSUFFICIENT_POSITION',
  'STARTING_NOTIONAL_IMMUTABLE',
  'HIDDEN_CAPITAL_DETECTED',
  'REINVESTMENT_POLICY_VIOLATION',
  'REGISTRATION_REQUIRED',
  'CURRENCY_MISMATCH',
  'INVALID_QUANTITY',
] as const;
export type ShadowCapitalFailureCode = (typeof SHADOW_CAPITAL_FAILURE_CODES)[number];
