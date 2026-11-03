/**
 * HELIOS OS03 — initial and maintenance margin for futures/perpetuals research.
 */

import type { FuturesContractMetadata } from '../../multi-asset/futures/types.ts';
import type { MarginAccountSnapshot, PerpetualInstrumentSpec } from './types.ts';

export function marginFromFuturesMetadata(
  metadata: FuturesContractMetadata,
  positionUnits: bigint,
  markPriceMinorUnits: bigint,
  maintenanceMarginRateBps: number,
  initialMarginRateBps: number,
): { readonly maintenanceMarginMinorUnits: bigint; readonly initialMarginMinorUnits: bigint } {
  const notional = absBig(positionUnits) * markPriceMinorUnits * metadata.multiplierMinorUnits;
  const scale = BigInt(10 ** metadata.multiplierScale);
  const scaledNotional = notional / scale;
  return Object.freeze({
    maintenanceMarginMinorUnits: (scaledNotional * BigInt(maintenanceMarginRateBps)) / 10_000n,
    initialMarginMinorUnits: (scaledNotional * BigInt(initialMarginRateBps)) / 10_000n,
  });
}

export function marginFromPerpetualSpec(
  spec: PerpetualInstrumentSpec,
  positionUnits: bigint,
  markPriceMinorUnits: bigint,
): { readonly maintenanceMarginMinorUnits: bigint; readonly initialMarginMinorUnits: bigint } {
  const notional = absBig(positionUnits) * markPriceMinorUnits * spec.contractMultiplierMinorUnits;
  const scale = BigInt(10 ** spec.multiplierScale);
  const scaledNotional = notional / scale;
  return Object.freeze({
    maintenanceMarginMinorUnits: (scaledNotional * BigInt(spec.maintenanceMarginRateBps)) / 10_000n,
    initialMarginMinorUnits: (scaledNotional * BigInt(spec.initialMarginRateBps)) / 10_000n,
  });
}

export function buildMarginSnapshot(input: {
  readonly accountId: string;
  readonly collateralMinorUnits: bigint;
  readonly currency: string;
  readonly positionUnits: bigint;
  readonly entryPriceMinorUnits: bigint;
  readonly markPriceMinorUnits: bigint;
  readonly spec: PerpetualInstrumentSpec;
}): MarginAccountSnapshot {
  const pnlPerUnit = input.markPriceMinorUnits - input.entryPriceMinorUnits;
  const unrealized =
    (input.positionUnits * pnlPerUnit * input.spec.contractMultiplierMinorUnits) /
    BigInt(10 ** input.spec.multiplierScale);
  const margins = marginFromPerpetualSpec(input.spec, input.positionUnits, input.markPriceMinorUnits);
  return Object.freeze({
    accountId: input.accountId,
    collateralMinorUnits: input.collateralMinorUnits,
    currency: input.currency,
    unrealizedPnlMinorUnits: unrealized,
    positionUnits: input.positionUnits,
    entryPriceMinorUnits: input.entryPriceMinorUnits,
    maintenanceMarginMinorUnits: margins.maintenanceMarginMinorUnits,
    initialMarginMinorUnits: margins.initialMarginMinorUnits,
  });
}

export function isUnderMaintenanceMargin(snapshot: MarginAccountSnapshot): boolean {
  const equity = snapshot.collateralMinorUnits + snapshot.unrealizedPnlMinorUnits;
  return equity < snapshot.maintenanceMarginMinorUnits;
}

function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}
