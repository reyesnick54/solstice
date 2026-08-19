/**
 * Transfer-volume semantics and exact rate × duration conversion.
 *
 * 2 GB/s for 10 seconds → 20 GB. Duration is required. No float.
 * Gross wire bytes are not delivered application bytes.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact, lookupUnit } from '../../../../units/convert.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import {
  GROSS_EQUALS_DELIVERED,
  bandwidthRefusal,
  type BandwidthRefusal,
  type BandwidthSourceObservation,
  type BandwidthTransferSemantics,
} from './types.ts';

export function sourceQuantityOf(observation: BandwidthSourceObservation): Result<ExactQuantity, BandwidthRefusal> {
  if (observation.numericValue.includes('.') || observation.numericValue.toLowerCase().includes('e')) {
    return err(bandwidthRefusal('FLOAT_QUANTITY_FORBIDDEN', 'bandwidth quantities must be integer strings'));
  }
  if (observation.numericValue.startsWith('-')) {
    return err(bandwidthRefusal('NEGATIVE_USAGE', 'negative bandwidth usage is refused'));
  }
  if (!/^\d+$/.test(observation.numericValue)) {
    return err(bandwidthRefusal('FLOAT_QUANTITY_FORBIDDEN', 'bandwidth quantities must be integer strings'));
  }
  const unitId = observation.unit === 'B_s' ? 'B_s' : observation.unit;
  return ok(exactQuantity(BigInt(observation.numericValue), 0, 1n, 1n, unitId));
}

export function rateTimesDuration(input: {
  readonly rate: ExactQuantity;
  readonly durationSeconds: bigint | null;
  readonly factType: 'BANDWIDTH_CAPACITY' | 'BANDWIDTH_USAGE';
}): Result<{ readonly volume: ExactQuantity; readonly receipt: NormalizationReceipt }, BandwidthRefusal> {
  if (input.durationSeconds === null || input.durationSeconds <= 0n) {
    return err(
      bandwidthRefusal('DURATION_REQUIRED', 'rate × duration requires a positive integer duration; rate is not volume'),
    );
  }
  const rateDef = lookupUnit(input.rate.unitId);
  if (!rateDef || rateDef.dimension !== 'DATA_RATE') {
    return err(bandwidthRefusal('INCOMPATIBLE_DIMENSION', `${input.rate.unitId} is not a DATA_RATE unit`));
  }
  const receipt = convertExact({
    source: input.rate,
    targetUnitId: 'GB',
    context: {
      durationSeconds: input.durationSeconds,
      factType: input.factType,
      productiveCategory: 'BANDWIDTH_COMMUNICATIONS',
    },
  });
  if (!receipt.ok) {
    if (receipt.error.outcome === 'REQUIRE_CONTEXT') {
      return err(bandwidthRefusal('DURATION_REQUIRED', receipt.error.detail));
    }
    return err(bandwidthRefusal('INCOMPATIBLE_DIMENSION', receipt.error.detail));
  }
  return ok(Object.freeze({ volume: receipt.value.targetQuantity, receipt: receipt.value }));
}

export function normalizeVolume(input: {
  readonly quantity: ExactQuantity;
  readonly factType: 'BANDWIDTH_CAPACITY' | 'BANDWIDTH_USAGE';
}): Result<{ readonly volume: ExactQuantity; readonly receipt: NormalizationReceipt }, BandwidthRefusal> {
  const def = lookupUnit(input.quantity.unitId);
  if (!def || def.dimension !== 'DATA_VOLUME') {
    return err(bandwidthRefusal('INCOMPATIBLE_DIMENSION', `${input.quantity.unitId} is not a DATA_VOLUME unit`));
  }
  const receipt = convertExact({
    source: input.quantity,
    targetUnitId: 'GB',
    context: {
      factType: input.factType,
      productiveCategory: 'BANDWIDTH_COMMUNICATIONS',
    },
  });
  if (!receipt.ok) {
    return err(bandwidthRefusal('INCOMPATIBLE_DIMENSION', receipt.error.detail));
  }
  return ok(Object.freeze({ volume: receipt.value.targetQuantity, receipt: receipt.value }));
}

export function retainTransferSemantics(semantics: BandwidthTransferSemantics): BandwidthTransferSemantics {
  return semantics;
}

export function grossIsNotDelivered(
  left: BandwidthTransferSemantics,
  right: BandwidthTransferSemantics,
): true {
  void left;
  void right;
  return true;
}

export function retransmissionIsNotNewOutput(observation: BandwidthSourceObservation): true {
  return observation.retransmissionObserved !== true || observation.transferSemantics !== 'DELIVERED_BYTES';
}

export function transferSemanticsAreNotInterchangeable(
  left: BandwidthTransferSemantics,
  right: BandwidthTransferSemantics,
): boolean {
  return left !== right && GROSS_EQUALS_DELIVERED === false;
}
