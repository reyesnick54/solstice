import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import {
  STOCKPILE_MOVEMENT_EQUALS_EXTRACTION,
  type NormalizedResourceObservation,
  type ResourceFabricPolicy,
  type ResourceRefusal,
} from './types.ts';

export type StockpileBalance = {
  readonly stockpileId: string;
  readonly openingGrams: bigint;
  readonly inflowsGrams: bigint;
  readonly outflowsGrams: bigint;
  readonly governedAdjustmentsGrams: bigint;
  readonly closingGrams: bigint;
  readonly toleranceGrams: bigint;
};

export type StockpileReconciliation = {
  readonly balancedWithinTolerance: boolean;
  readonly expectedClosingGrams: bigint;
  readonly residualGrams: bigint;
  readonly createsExtraction: false;
};

/**
 * Mine face → truck → stockpile does not create new extraction.
 * Stockpile measurement is inventory evidence. If the pile increased
 * because of extraction, callers attach lineage to the extraction event.
 */
export function stockpileMovementIsNotExtraction(
  observation: NormalizedResourceObservation,
): Result<true, ResourceRefusal> {
  if (observation.createsExtractionEvent && observation.createsInventoryEvidence) {
    return err({
      code: 'STOCKPILE_MOVEMENT_IS_NOT_EXTRACTION',
      detail: 'stockpile inventory cannot also be treated as realized extraction',
    });
  }
  if (observation.sourceClass === 'INVENTORY_STOCKPILE_SYSTEM' && observation.createsExtractionEvent) {
    return err({
      code: 'STOCKPILE_MOVEMENT_IS_NOT_EXTRACTION',
      detail: 'INVENTORY_STOCKPILE_SYSTEM observations are inventory, not extraction',
    });
  }
  return ok(true);
}

export function reconcileStockpile(
  balance: StockpileBalance,
  policy: ResourceFabricPolicy,
): Result<StockpileReconciliation, ResourceRefusal> {
  if (balance.toleranceGrams > policy.stockpileToleranceGrams) {
    return err({
      code: 'RECONCILIATION_TOLERANCE_EXCEEDED',
      detail: `explicit stockpile tolerance ${balance.toleranceGrams.toString()}g exceeds policy maximum ${policy.stockpileToleranceGrams.toString()}g`,
    });
  }
  const expected = balance.openingGrams + balance.inflowsGrams - balance.outflowsGrams + balance.governedAdjustmentsGrams;
  const residual = expected >= balance.closingGrams ? expected - balance.closingGrams : balance.closingGrams - expected;
  const tolerance = balance.toleranceGrams;
  if (residual > tolerance) {
    return err({
      code: 'RECONCILIATION_TOLERANCE_EXCEEDED',
      detail: `stockpile residual ${residual.toString()}g exceeds explicit tolerance ${tolerance.toString()}g`,
    });
  }
  return ok(
    Object.freeze({
      balancedWithinTolerance: true,
      expectedClosingGrams: expected,
      residualGrams: residual,
      createsExtraction: false,
    }),
  );
}

export function stockpileMovementEqualsExtraction(): false {
  return STOCKPILE_MOVEMENT_EQUALS_EXTRACTION;
}
