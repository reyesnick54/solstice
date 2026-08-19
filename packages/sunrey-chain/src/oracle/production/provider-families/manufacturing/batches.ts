/**
 * Production-order and batch semantics.
 *
 * A created, scheduled, or released production order does not prove
 * that production occurred. Scrap, rework, and unfinished WIP are not
 * completed output unless a later governed measurement says so.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { ManufacturingObservation, ManufacturingRejection, OutputState } from './types.ts';

export const COMPLETED_OUTPUT_STATES = Object.freeze(['GOOD_OUTPUT'] as const);

export function isCompletedProductionState(state: OutputState): boolean {
  return state === 'GOOD_OUTPUT';
}

export function productionOrderIsNotOutput(observation: ManufacturingObservation): boolean {
  return observation.orderLifecycleState !== null && observation.realizedEvidenceKind === null;
}

export function evaluateProductionEvidence(
  observation: ManufacturingObservation,
): Result<ManufacturingObservation, ManufacturingRejection> {
  if (productionOrderIsNotOutput(observation)) {
    return err({
      code: 'PRODUCTION_ORDER_IS_NOT_OUTPUT',
      detail: `production order ${observation.orderLifecycleState} does not prove production occurred`,
    });
  }
  if (observation.factType === 'MANUFACTURING_OUTPUT' || observation.factType === 'AUTOMATED_MACHINE_OUTPUT') {
    if (observation.realizedEvidenceKind === null) {
      return err({
        code: 'MISSING_REALIZED_EVIDENCE',
        detail: 'output facts require completed quantity, measurement, batch completion, weigh-scale, or accepted record',
      });
    }
  }
  if (observation.outputState === 'SCRAP') {
    return err({
      code: 'SCRAP_IS_NOT_ACCEPTED_OUTPUT',
      detail: 'scrap and rejected output are not completed production',
    });
  }
  if (observation.outputState === 'REWORK') {
    return err({
      code: 'REWORK_IS_NOT_COMPLETED_OUTPUT',
      detail: 'rework is excluded until a later completed good-output measurement exists',
    });
  }
  if (observation.outputState === 'WORK_IN_PROGRESS') {
    return err({
      code: 'WIP_IS_NOT_COMPLETED_OUTPUT',
      detail: 'unfinished WIP is not completed production',
    });
  }
  return ok(observation);
}

export function completedQuantityOf(observation: ManufacturingObservation): bigint | null {
  if (!isCompletedProductionState(observation.outputState) || observation.realizedEvidenceKind === null) {
    return null;
  }
  try {
    return BigInt(observation.numericValue);
  } catch {
    return null;
  }
}
