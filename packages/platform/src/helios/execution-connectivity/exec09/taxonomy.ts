/**
 * HELIOS EXEC09 — institutional settlement and post-trade lifecycle taxonomies.
 * Extends H23/M24 settlement semantics for external provider post-trade processing.
 * Not a second ledger or Execution Authority.
 */

export const EXEC09_SETTLEMENT_LIFECYCLE_STATES = [
  'PENDING',
  'MATCHED',
  'AFFIRMED',
  'SETTLING',
  'SETTLED',
  'FAILED',
  'PARTIALLY_SETTLED',
  'CORRECTED',
  'CANCELED',
] as const;

export type Exec09SettlementLifecycleState = (typeof EXEC09_SETTLEMENT_LIFECYCLE_STATES)[number];

export const EXEC09_DVP_MODELS = ['LINKED_LEGS', 'PROVIDER_ATOMIC', 'NON_DVP'] as const;
export type Exec09DvpModel = (typeof EXEC09_DVP_MODELS)[number];

export const EXEC09_SETTLEMENT_LEG_KINDS = ['ASSET', 'CASH', 'FEE'] as const;
export type Exec09SettlementLegKind = (typeof EXEC09_SETTLEMENT_LEG_KINDS)[number];

export const EXEC09_FAILURE_KINDS = [
  'COUNTERPARTY_FAIL',
  'INSUFFICIENT_SECURITIES',
  'INSUFFICIENT_CASH',
  'CURRENCY_HOLIDAY_DELAY',
  'MARKET_HOLIDAY_DELAY',
  'PROVIDER_REJECT',
  'AFFIRMATION_TIMEOUT',
  'UNKNOWN',
] as const;
export type Exec09SettlementFailureKind = (typeof EXEC09_FAILURE_KINDS)[number];

export const EXEC09_CORRECTION_KINDS = ['TRADE_BUST', 'PRICE_CORRECTION', 'QUANTITY_CORRECTION', 'FEE_ADJUSTMENT'] as const;
export type Exec09SettlementCorrectionKind = (typeof EXEC09_CORRECTION_KINDS)[number];

export const EXEC09_ASSET_CLASSES = ['EQUITY', 'ETF', 'CRYPTO', 'FUTURES', 'FX', 'FIXED_INCOME'] as const;
export type Exec09AssetClass = (typeof EXEC09_ASSET_CLASSES)[number];

export const EXEC09_POLICY_VERSION = 'helios-exec09-settlement-lifecycle-v1' as const;

export const LEGAL_EXEC09_SETTLEMENT_TRANSITIONS: Readonly<
  Record<Exec09SettlementLifecycleState, readonly Exec09SettlementLifecycleState[]>
> = Object.freeze({
  PENDING: Object.freeze(['MATCHED', 'CANCELED', 'FAILED'] as const),
  MATCHED: Object.freeze(['AFFIRMED', 'FAILED', 'CANCELED'] as const),
  AFFIRMED: Object.freeze(['SETTLING', 'FAILED', 'CANCELED'] as const),
  SETTLING: Object.freeze(['SETTLED', 'PARTIALLY_SETTLED', 'FAILED', 'CORRECTED'] as const),
  PARTIALLY_SETTLED: Object.freeze(['SETTLING', 'SETTLED', 'FAILED', 'CORRECTED'] as const),
  SETTLED: Object.freeze(['CORRECTED'] as const),
  FAILED: Object.freeze(['SETTLING', 'CORRECTED', 'CANCELED'] as const),
  CORRECTED: Object.freeze(['PENDING', 'MATCHED', 'CANCELED'] as const),
  CANCELED: Object.freeze([] as const),
});

export function canTransitionExec09Settlement(
  from: Exec09SettlementLifecycleState,
  to: Exec09SettlementLifecycleState,
): boolean {
  return LEGAL_EXEC09_SETTLEMENT_TRANSITIONS[from].includes(to);
}

export function isTerminalExec09SettlementState(state: Exec09SettlementLifecycleState): boolean {
  return state === 'SETTLED' || state === 'CANCELED';
}

/** Fill or partial fill does not imply post-trade settlement is complete. */
export function exec09FillIsNotSettled(input: {
  readonly orderFilled: boolean;
  readonly lifecycleState: Exec09SettlementLifecycleState | null;
}): boolean {
  if (!input.orderFilled) return true;
  if (input.lifecycleState === null) return true;
  return input.lifecycleState !== 'SETTLED';
}
