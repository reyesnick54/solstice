/**
 * HELIOS OS03 — deterministic liquidation when maintenance margin breached.
 */

import type { LiquidationOutcome, MarginAccountSnapshot } from './types.ts';
import { isUnderMaintenanceMargin } from './margin-model.ts';

export function evaluateLiquidation(
  snapshot: MarginAccountSnapshot,
  markPriceMinorUnits: bigint,
  evidenceRef: string,
): LiquidationOutcome {
  if (!isUnderMaintenanceMargin(snapshot)) {
    return Object.freeze({
      liquidated: false,
      reason: null,
      closedQuantityUnits: 0n,
      liquidationPriceMinorUnits: null,
      evidenceRef,
    });
  }
  return Object.freeze({
    liquidated: true,
    reason: 'MAINTENANCE_MARGIN_BREACH',
    closedQuantityUnits: snapshot.positionUnits,
    liquidationPriceMinorUnits: markPriceMinorUnits,
    evidenceRef,
  });
}
