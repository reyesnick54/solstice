/**
 * Resource-time semantics for compute metering.
 *
 * Wall-clock seconds, CPU-seconds, GPU-seconds, and generic
 * compute-seconds are not automatically equivalent.
 *
 * 1 GPU for 10 seconds = 10 GPU-seconds
 * 8 GPUs for 10 seconds = 80 GPU-seconds
 *
 * Generic compute_s requires resourceClass (and resourceCount when
 * the quantity is wall duration) before canonical conversion.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import type { NormalizationReceipt } from '../../../../units/types.ts';
import { measureCanonical } from '../../../../units/measurement.ts';
import type { CanonicalProductiveMeasurement } from '../../../../units/measurement.ts';
import { computeRefusal, type ComputeRefusal, type ComputeSourceObservation } from './types.ts';
import { computeFeedSchema } from './schemas.ts';

export type ResolvedResourceTime = {
  readonly sourceUnit: string;
  readonly sourceQuantity: bigint;
  readonly resourceClass: 'CPU' | 'GPU' | null;
  readonly resourceCount: bigint | null;
  readonly receipt: NormalizationReceipt;
  readonly measurement: CanonicalProductiveMeasurement;
};

function positiveIntegerString(value: string): boolean {
  return /^\d+$/.test(value);
}

export function resolveResourceTime(
  observation: ComputeSourceObservation,
): Result<ResolvedResourceTime, ComputeRefusal> {
  if (!positiveIntegerString(observation.numericValue) || observation.numericValue.includes('.')) {
    return err(computeRefusal('FLOAT_USAGE_FORBIDDEN', 'compute usage must be an integer minor-unit string'));
  }
  const reported = BigInt(observation.numericValue);
  if (reported <= 0n) {
    return err(computeRefusal('FLOAT_USAGE_FORBIDDEN', 'compute usage must be a positive integer'));
  }

  if (observation.timeBase === 'GENERIC_COMPUTE_SECONDS' && observation.resourceClass === null) {
    return err(
      computeRefusal(
        'NORMALIZATION_CONTEXT_REQUIRED',
        'generic compute_s requires resourceClass before CPU or GPU conversion; do not guess',
      ),
    );
  }

  if (
    (observation.timeBase === 'GPU_SECONDS' || observation.resourceClass === 'GPU') &&
    observation.resourceCount === null &&
    observation.factType !== 'AI_INFERENCE_USAGE'
  ) {
    return err(computeRefusal('GPU_COUNT_OMITTED', 'GPU resource-time requires an explicit resourceCount'));
  }

  if (observation.quantitySemantic === 'WALL_DURATION' && (observation.resourceCount === null || observation.resourceCount <= 0n)) {
    return err(
      computeRefusal('RESOURCE_COUNT_REQUIRED', 'wall-clock duration requires resourceCount to become resource-time'),
    );
  }

  if (
    observation.timeBase === 'GPU_SECONDS' &&
    observation.quantitySemantic === 'RESOURCE_TIME' &&
    observation.wallClockSeconds !== null &&
    observation.resourceCount !== null &&
    observation.wallClockSeconds * observation.resourceCount !== reported
  ) {
    return err(
      computeRefusal(
        'WALL_TIME_LABELED_AS_GPU_TIME',
        `wall-clock ${observation.wallClockSeconds.toString()}s × ${observation.resourceCount.toString()} GPUs is not ${reported.toString()} GPU-seconds`,
      ),
    );
  }

  const resourceSeconds =
    observation.quantitySemantic === 'WALL_DURATION' && observation.resourceCount !== null
      ? reported * observation.resourceCount
      : reported;

  const classifiedUnit =
    observation.timeBase === 'GPU_SECONDS' || observation.resourceClass === 'GPU'
      ? 'gpu_s'
      : observation.timeBase === 'CPU_SECONDS' || observation.resourceClass === 'CPU'
        ? 'cpu_s'
        : observation.unit === 'gpu_s' || observation.unit === 'GPU_HOUR'
          ? 'gpu_s'
          : observation.unit === 'cpu_s' || observation.unit === 'CPU_HOUR'
            ? 'cpu_s'
            : 'compute_s';

  if (classifiedUnit === 'compute_s' && observation.resourceClass === null) {
    return err(
      computeRefusal('NORMALIZATION_CONTEXT_REQUIRED', 'compute_s cannot become CPU or GPU time without resourceClass'),
    );
  }

  const sourceUnit =
    observation.timeBase === 'GENERIC_COMPUTE_SECONDS' && observation.unit === 'compute_s'
      ? 'compute_s'
      : classifiedUnit;

  const source = exactQuantity({
    mantissa: observation.timeBase === 'GENERIC_COMPUTE_SECONDS' ? reported : resourceSeconds,
    scale: 0,
    numerator: 1n,
    denominator: 1n,
    unitId: sourceUnit,
  });
  if (!source.ok) {
    return err(computeRefusal('INCOMPATIBLE_DIMENSION', source.error.detail));
  }

  const targetUnit =
    sourceUnit === 'compute_s'
      ? observation.resourceClass === 'GPU'
        ? 'gpu_s'
        : 'cpu_s'
      : sourceUnit === 'gpu_s' || sourceUnit === 'GPU_HOUR'
        ? 'gpu_s'
        : 'cpu_s';

  const context = {
    resourceClass: observation.resourceClass ?? undefined,
    resourceCount:
      sourceUnit === 'compute_s' && observation.quantitySemantic === 'WALL_DURATION'
        ? observation.resourceCount ?? undefined
        : sourceUnit === 'compute_s'
          ? observation.resourceCount ?? 1n
          : undefined,
    factType: observation.factType,
    productiveCategory: observation.productiveCategory,
    measurementStart: observation.measurementStart,
    measurementEnd: observation.measurementEnd,
    durationSeconds: observation.measurementEnd - observation.measurementStart,
  };

  const receipt = convertExact({
    source: source.value,
    targetUnitId: targetUnit,
    context,
  });
  if (!receipt.ok) {
    if (receipt.error.outcome === 'REQUIRE_CONTEXT') {
      return err(computeRefusal('NORMALIZATION_CONTEXT_REQUIRED', receipt.error.detail));
    }
    return err(computeRefusal('INCOMPATIBLE_DIMENSION', receipt.error.detail));
  }

  const schema = computeFeedSchema(observation.schemaId);
  const measured = measureCanonical({
    sourceQuantity: source.value,
    productiveCategory: observation.productiveCategory,
    factType: observation.factType,
    claimType: observation.claimType,
    targetUnit,
    context,
    measurementPeriod: {
      startUnix: observation.measurementStart,
      endUnix: observation.measurementEnd,
    },
  });
  if (!measured.ok) {
    if (measured.error.code === 'NORMALIZATION_CONTEXT_REQUIRED') {
      return err(computeRefusal('NORMALIZATION_CONTEXT_REQUIRED', measured.error.detail));
    }
    return err(computeRefusal('INCOMPATIBLE_DIMENSION', `${measured.error.code}: ${measured.error.detail}`));
  }

  void schema;
  void receipt;
  return ok(
    Object.freeze({
      sourceUnit,
      sourceQuantity: source.value.mantissa,
      resourceClass: observation.resourceClass,
      resourceCount: observation.resourceCount,
      receipt: measured.value.receipt,
      measurement: measured.value,
    }),
  );
}

export function gpuSecondsOf(gpuCount: bigint, wallSeconds: bigint): bigint {
  return gpuCount * wallSeconds;
}
