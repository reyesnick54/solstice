/**
 * HELIOS Multi-Asset M24 — execution, settlement, reconciliation lifecycle taxonomies.
 * Composes H22–H24 infrastructure. Not a second ledger or Execution Authority.
 */

export const HELIOS_MULTI_ASSET_M24 = 'HELIOS_MULTI_ASSET_M24' as const;

export const M24_EXECUTION_ASSET_CLASSES = ['EQUITY', 'ETF', 'CRYPTO', 'FUTURES', 'FX'] as const;
export type M24ExecutionAssetClass = (typeof M24_EXECUTION_ASSET_CLASSES)[number];

/** Canonical M24 order lifecycle — extends H23 with SETTLEMENT_PENDING and UNKNOWN_PROVIDER_STATE. */
export const M24_ORDER_LIFECYCLE_STATES = [
  'AUTHORIZED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PARTIALLY_FILLED',
  'FILLED',
  'SETTLEMENT_PENDING',
  'SETTLED',
  'RECONCILED',
  'AVAILABLE',
  'REJECTED',
  'CANCEL_PENDING',
  'CANCELLED',
  'EXPIRED',
  'UNKNOWN_PROVIDER_STATE',
  'RECONCILIATION_REQUIRED',
] as const;
export type M24OrderLifecycleState = (typeof M24_ORDER_LIFECYCLE_STATES)[number];

export const M24_EXIT_KINDS = [
  'STRATEGY_EXIT',
  'USER_CLOSE',
  'RISK_CLOSE',
  'EMERGENCY_CLOSE',
  'FUTURES_ROLL',
  'PROVIDER_LIQUIDATION',
] as const;
export type M24ExitKind = (typeof M24_EXIT_KINDS)[number];

export const M24_RECONCILIATION_EXCEPTION_KINDS = [
  'ORDER_STATUS_MISMATCH',
  'FILL_QUANTITY_MISMATCH',
  'POSITION_MISMATCH',
  'CASH_MISMATCH',
  'FEE_MISMATCH',
  'SETTLEMENT_STATE_MISMATCH',
  'DUPLICATE_PROVIDER_EVENT',
  'MISSING_PROVIDER_RECORD',
] as const;
export type M24ReconciliationExceptionKind = (typeof M24_RECONCILIATION_EXCEPTION_KINDS)[number];

export const M24_SETTLEMENT_CYCLES = ['T_PLUS_0', 'T_PLUS_1', 'T_PLUS_2'] as const;
export type M24SettlementCycle = (typeof M24_SETTLEMENT_CYCLES)[number];

/** Submitted orders must not count as fills; fills must not count as settled cash until semantics permit. */
export function submittedIsNotFill(state: M24OrderLifecycleState): boolean {
  return (
    state === 'AUTHORIZED' ||
    state === 'SUBMITTED' ||
    state === 'ACKNOWLEDGED' ||
    state === 'CANCEL_PENDING'
  );
}

export function fillIsNotSettledCash(state: M24OrderLifecycleState): boolean {
  return state === 'PARTIALLY_FILLED' || state === 'FILLED' || state === 'SETTLEMENT_PENDING';
}

export function mapH23StatusToM24(h23Status: string): M24OrderLifecycleState {
  switch (h23Status) {
    case 'PROPOSED':
      return 'AUTHORIZED';
    case 'UNKNOWN':
      return 'UNKNOWN_PROVIDER_STATE';
    case 'PARTIALLY_FILLED_THEN_CANCELLED':
      return 'PARTIALLY_FILLED';
    case 'FAILED':
      return 'RECONCILIATION_REQUIRED';
    default:
      if ((M24_ORDER_LIFECYCLE_STATES as readonly string[]).includes(h23Status)) {
        return h23Status as M24OrderLifecycleState;
      }
      return 'RECONCILIATION_REQUIRED';
  }
}
