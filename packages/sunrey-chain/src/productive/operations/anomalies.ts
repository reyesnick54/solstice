/**
 * Wave 5 — Productive asset anomaly detection.
 *
 * Anomalies are REVIEW SIGNALS only. They do not constitute automatic
 * monetary judgment, issuance reversal, or supply modification.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import { objectIsActive, type ProductiveEconomicObject } from '../objects.ts';
import type { AnomalySignalKind, ProductiveAssetAnomaly } from './types.ts';
import { PRODUCTIVE_OPERATIONS_SCHEMA_VERSION } from './types.ts';

export const ANOMALY_IS_REVIEW_SIGNAL_ONLY = true as const;

export type AnomalyDetectionInput = {
  readonly anomalyId: string;
  readonly object: ProductiveEconomicObject;
  readonly claimId?: string;
  readonly reportedQuantity: bigint;
  readonly configuredCapacity?: bigint;
  readonly configuredThroughput?: bigint;
  readonly configuredWaterBounds?: bigint;
  readonly priorGeographyId?: string;
  readonly duplicateEventCount?: number;
  readonly duplicateThreshold?: number;
  readonly height: number;
  readonly blockTimeUnixSeconds: bigint;
  readonly evidenceCommitment: string;
  readonly detectedAtUtc?: UtcInstant;
};

function anomaly(
  input: AnomalyDetectionInput,
  kind: AnomalySignalKind,
  severity: ProductiveAssetAnomaly['severity'],
): ProductiveAssetAnomaly {
  return Object.freeze({
    schemaVersion: PRODUCTIVE_OPERATIONS_SCHEMA_VERSION,
    anomalyId: input.anomalyId,
    objectId: input.object.objectId,
    claimId: input.claimId ?? null,
    kind,
    domain: input.object.category,
    severity,
    reviewSignalOnly: true,
    automaticMonetaryJudgment: false,
    detectedAtUtc: input.detectedAtUtc ?? asUtcInstant(new Date().toISOString()),
    evidenceCommitment: input.evidenceCommitment,
  });
}

export function detectProductiveAnomalies(input: AnomalyDetectionInput): readonly ProductiveAssetAnomaly[] {
  const signals: ProductiveAssetAnomaly[] = [];

  if (
    input.configuredCapacity !== undefined &&
    input.configuredCapacity > 0n &&
    input.reportedQuantity > input.configuredCapacity
  ) {
    signals.push(anomaly(input, 'PRODUCTION_EXCEEDS_CAPACITY', 'HIGH'));
  }

  if (!objectIsActive(input.object, input.height, input.blockTimeUnixSeconds)) {
    signals.push(anomaly(input, 'RETIRED_FACILITY_OUTPUT', 'HIGH'));
  }

  if (
    input.priorGeographyId !== undefined &&
    input.priorGeographyId !== input.object.geography.geographyId
  ) {
    signals.push(anomaly(input, 'IMPOSSIBLE_GEOGRAPHIC_MOVEMENT', 'HIGH'));
  }

  if (
    (input.object.category === 'COMPUTE' || input.object.category === 'AI_COMPUTE') &&
    input.configuredCapacity !== undefined &&
    input.configuredCapacity > 0n &&
    input.reportedQuantity > input.configuredCapacity * 5n
  ) {
    signals.push(anomaly(input, 'EXTREME_COMPUTE_OUTPUT', 'HIGH'));
  }

  const duplicateThreshold = input.duplicateThreshold ?? 3;
  if ((input.duplicateEventCount ?? 0) >= duplicateThreshold) {
    signals.push(anomaly(input, 'DUPLICATE_EVENT_FREQUENCY', 'MEDIUM'));
  }

  if (
    input.object.category === 'WATER' &&
    input.configuredWaterBounds !== undefined &&
    input.configuredWaterBounds > 0n &&
    input.reportedQuantity > input.configuredWaterBounds
  ) {
    signals.push(anomaly(input, 'WATER_OUTPUT_EXCEEDS_BOUNDS', 'HIGH'));
  }

  if (
    input.object.category === 'MANUFACTURING' &&
    input.configuredThroughput !== undefined &&
    input.configuredThroughput > 0n &&
    input.reportedQuantity > input.configuredThroughput
  ) {
    signals.push(anomaly(input, 'MANUFACTURING_EXCEEDS_THROUGHPUT', 'HIGH'));
  }

  return Object.freeze(signals);
}

export function anomalyRequiresManualReview(signal: ProductiveAssetAnomaly): boolean {
  return signal.reviewSignalOnly && signal.severity !== 'LOW';
}
