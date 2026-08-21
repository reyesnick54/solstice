import type { UtcInstant } from '../../../domain/src/time.ts';
import type { LiquidityViewId } from '../ids.ts';

export const LIQUIDITY_WARNING_STATES = [
  'NORMAL',
  'WATCH',
  'INSUFFICIENT',
  'NEGATIVE',
  'UNEXPECTED_EXPOSURE',
] as const;
export type LiquidityWarningState = (typeof LIQUIDITY_WARNING_STATES)[number];

/**
 * Operations-console read model. Not an autonomous trading signal.
 */
export type TreasuryLiquidityView = {
  readonly viewId: LiquidityViewId;
  readonly currency: string;
  readonly internalAvailableMinor: bigint;
  readonly expectedOutgoingSettlementMinor: bigint;
  readonly expectedIncomingSettlementMinor: bigint;
  readonly providerReportedMinor: bigint | null;
  readonly unsettledObligationMinor: bigint;
  readonly warningState: LiquidityWarningState;
  readonly asOf: UtcInstant;
};

export function warningStateFor(input: {
  readonly internalAvailableMinor: bigint;
  readonly expectedOutgoingSettlementMinor: bigint;
  readonly unsettledObligationMinor: bigint;
}): LiquidityWarningState {
  if (input.internalAvailableMinor < 0n) {
    return 'NEGATIVE';
  }
  if (input.internalAvailableMinor < input.expectedOutgoingSettlementMinor) {
    return 'INSUFFICIENT';
  }
  if (input.unsettledObligationMinor > input.internalAvailableMinor) {
    return 'WATCH';
  }
  return 'NORMAL';
}

export function freezeLiquidityView(input: TreasuryLiquidityView): TreasuryLiquidityView {
  return Object.freeze({ ...input });
}
