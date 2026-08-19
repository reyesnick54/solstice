/**
 * Warehouse capacity is not realized storage service.
 * Volume-time requires duration. Digital byte storage is not cubic volume.
 * Temperature telemetry is quality evidence, not a new productive event.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact, integerQuantity } from '../../../../units/index.ts';
import type { NormalizationReceipt } from '../../../../units/types.ts';
import { parseIntegerMeasure } from './schemas.ts';
import { commitmentOf } from './privacy.ts';
import type {
  LogisticsRefusal,
  LogisticsSourceObservation,
  RealizationState,
  StorageSemanticQualifier,
  TemperatureReading,
} from './types.ts';

export type StorageMeasurement = {
  readonly realizationState: RealizationState;
  readonly qualifier: StorageSemanticQualifier;
  readonly unit: string;
  readonly mantissa: bigint;
  readonly volumeTimeReceipt: NormalizationReceipt | null;
  readonly temperatureEvidenceCommitment: string | null;
  readonly temperatureCreatesEvent: false;
};

function temperatureCommitment(readings: readonly TemperatureReading[] | undefined): string | null {
  if (!readings || readings.length === 0) {
    return null;
  }
  return commitmentOf(
    readings.map((row) => `${row.observedAtUnix.toString()}:${row.milliCelsius.toString()}`).join('|'),
  );
}

export function measureStorage(
  observation: LogisticsSourceObservation,
): Result<StorageMeasurement, LogisticsRefusal> {
  const qualifier = observation.storageQualifier ?? 'PHYSICAL_WAREHOUSE_VOLUME';
  if (qualifier === 'DIGITAL_BYTE_STORAGE' && observation.volume) {
    return err({
      code: 'DIGITAL_PHYSICAL_STORAGE_MERGED',
      detail: 'digital byte storage and warehouse cubic volume are distinct dimensions',
      reviewRequired: false,
    });
  }
  if (qualifier === 'PHYSICAL_WAREHOUSE_VOLUME' && observation.unit && (observation.unit === 'GB' || observation.unit === 'TB')) {
    return err({
      code: 'DIGITAL_PHYSICAL_STORAGE_MERGED',
      detail: 'physical warehouse storage cannot use digital byte units',
      reviewRequired: false,
    });
  }
  if (
    observation.unit &&
    (observation.unit === 'GB' || observation.unit === 'TB') &&
    observation.volume &&
    (observation.volume.unit === 'm3' || observation.volume.unit === 'L')
  ) {
    return err({
      code: 'DIGITAL_PHYSICAL_STORAGE_MERGED',
      detail: 'refusing to physically normalize warehouse volume into digital bytes',
      reviewRequired: false,
    });
  }

  const realization = observation.realizationState ?? 'CAPACITY';
  const volume = parseIntegerMeasure(observation.volume, 'volume');
  if (!volume.ok) {
    return volume;
  }

  if (realization === 'CAPACITY') {
    if (observation.numericValue && observation.unit === 'm3_hour') {
      return err({
        code: 'CAPACITY_TREATED_AS_REALIZED',
        detail: 'warehouse available volume is capacity, not realized m3-hour service',
        reviewRequired: false,
      });
    }
    const mantissa = volume.value?.mantissa ?? (observation.numericValue ? BigInt(observation.numericValue) : 0n);
    return ok(
      Object.freeze({
        realizationState: 'CAPACITY',
        qualifier,
        unit: volume.value?.unit ?? observation.unit ?? 'm3',
        mantissa,
        volumeTimeReceipt: null,
        temperatureEvidenceCommitment: temperatureCommitment(observation.temperatureReadings),
        temperatureCreatesEvent: false,
      }),
    );
  }

  if (qualifier === 'DIGITAL_BYTE_STORAGE') {
    const mantissa = observation.numericValue ? BigInt(observation.numericValue) : 0n;
    return ok(
      Object.freeze({
        realizationState: realization,
        qualifier,
        unit: observation.unit ?? 'GB',
        mantissa,
        volumeTimeReceipt: null,
        temperatureEvidenceCommitment: null,
        temperatureCreatesEvent: false,
      }),
    );
  }

  if (!volume.value) {
    return err({
      code: 'DURATION_REQUIRED',
      detail: 'realized warehouse service requires occupied volume',
      reviewRequired: false,
    });
  }
  const duration =
    observation.durationSeconds ??
    (observation.measurementStartUnix !== undefined && observation.measurementEndUnix !== undefined
      ? observation.measurementEndUnix - observation.measurementStartUnix
      : undefined);
  if (duration === undefined) {
    return err({
      code: 'DURATION_REQUIRED',
      detail: 'Chunk 118 requires duration context before fabricating m3_hour',
      reviewRequired: false,
    });
  }
  const source = integerQuantity(volume.value.unit, volume.value.mantissa);
  if (!source.ok) {
    return err({
      code: 'INCOMPATIBLE_UNITS',
      detail: source.error.detail,
      reviewRequired: false,
    });
  }
  const converted = convertExact({
    source: source.value,
    targetUnitId: 'm3_hour',
    context: {
      durationSeconds: duration,
      measurementStart: observation.measurementStartUnix,
      measurementEnd: observation.measurementEndUnix,
      factType: 'STORAGE_CAPACITY',
      productiveCategory: 'STORAGE',
    },
  });
  if (!converted.ok) {
    return err({
      code: converted.error.outcome === 'REQUIRE_CONTEXT' ? 'DURATION_REQUIRED' : 'INCOMPATIBLE_UNITS',
      detail: converted.error.detail,
      reviewRequired: false,
    });
  }
  return ok(
    Object.freeze({
      realizationState: 'REALIZED',
      qualifier,
      unit: converted.value.targetUnit,
      mantissa: converted.value.targetQuantity.mantissa,
      volumeTimeReceipt: converted.value,
      temperatureEvidenceCommitment: temperatureCommitment(observation.temperatureReadings),
      temperatureCreatesEvent: false,
    }),
  );
}

export function temperatureIsNotStorageQuantity(): true {
  return true;
}
