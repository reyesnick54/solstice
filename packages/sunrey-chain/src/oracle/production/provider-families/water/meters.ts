import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { convertExact } from '../../../../units/convert.ts';
import { exactQuantity } from '../../../../units/quantity.ts';
import type { ExactQuantity, NormalizationReceipt } from '../../../../units/types.ts';
import type { WaterRefusal, WaterRegisterSnapshot, WaterSourceRecord } from './types.ts';

const LITERS_PER_M3 = 1_000n;

export type WaterIntervalDerivation =
  | { readonly kind: 'INTERVAL'; readonly mantissa: bigint }
  | { readonly kind: 'CUMULATIVE_DELTA'; readonly mantissa: bigint; readonly prior: WaterRegisterSnapshot }
  | { readonly kind: 'CUMULATIVE_REGISTER_ONLY'; readonly mantissa: bigint };

/**
 * Interval volume is the reported quantity. Cumulative volume is
 * current − prior only when register identity and time ordering are
 * valid. Never negative production.
 */
export function deriveWaterInterval(
  record: WaterSourceRecord,
  currentMantissa: bigint,
): Result<WaterIntervalDerivation, WaterRefusal> {
  if (record.meterSemantics === 'INTERVAL_VOLUME') {
    return ok(Object.freeze({ kind: 'INTERVAL', mantissa: currentMantissa }));
  }
  const prior = record.prior;
  if (!prior) {
    return ok(Object.freeze({ kind: 'CUMULATIVE_REGISTER_ONLY', mantissa: currentMantissa }));
  }
  if (record.equipmentReplacement || prior.meterRef !== record.meterRef || prior.registerId !== record.registerId) {
    return err({
      code: 'EQUIPMENT_REPLACEMENT',
      detail: 'meter replacement or register identity change is not treated as water production',
    });
  }
  const currentTs = BigInt(record.sourceTimestampUnix);
  if (currentTs < prior.sourceTimestampUnix) {
    return err({
      code: 'TIMESTAMP_REVERSAL',
      detail: 'source timestamp moved backwards relative to the previous valid reading',
    });
  }
  if (currentTs === prior.sourceTimestampUnix && currentMantissa === prior.readingMantissa && record.unit === prior.unit) {
    return err({
      code: 'DUPLICATE_READING',
      detail: 'identical cumulative water reading is a retransmission, not new production',
    });
  }
  if (currentMantissa === prior.readingMantissa) {
    return err({
      code: 'DUPLICATE_READING',
      detail: 'same cumulative register value is not interval volume',
    });
  }
  if (currentMantissa < prior.readingMantissa) {
    const extras = record.extras ?? {};
    if (record.documentedMeterReset || extras.meterReset === true || extras.reset === true) {
      return err({
        code: 'METER_RESET',
        detail: 'documented water-meter reset is not converted into negative or replacement production',
      });
    }
    if (prior.readingMantissa > 1_000_000n && currentMantissa < prior.readingMantissa / 10n) {
      return err({
        code: 'COUNTER_ROLLOVER',
        detail: 'water-meter rollover is ambiguous and is not converted into production',
      });
    }
    return err({
      code: 'COUNTER_RESET_UNDOCUMENTED',
      detail: 'cumulative water meter decreased without a documented reset',
    });
  }
  return ok(
    Object.freeze({
      kind: 'CUMULATIVE_DELTA',
      mantissa: currentMantissa - prior.readingMantissa,
      prior,
    }),
  );
}

export function normalizeWaterVolume(input: {
  readonly mantissa: bigint;
  readonly unit: string;
  readonly factType: 'WATER_PRODUCTION' | 'WATER_AVAILABILITY';
  readonly targetUnit?: 'L' | 'm3';
}): Result<
  {
    readonly source: ExactQuantity;
    readonly canonical: ExactQuantity;
    readonly unit: 'L' | 'm3';
    readonly receipt: NormalizationReceipt;
  },
  WaterRefusal
> {
  if (input.unit === 'L_s' || input.unit === 'm3_s' || input.unit === 'm3_hour') {
    return err({
      code: 'VOLUME_TIME_IS_STORAGE',
      detail: 'water production is volume; volume-time belongs to the storage domain',
    });
  }
  if (input.unit !== 'L' && input.unit !== 'm3') {
    return err({
      code: 'INCOMPATIBLE_UNIT',
      detail: `water facts accept L/m3 exactly; received ${input.unit}`,
    });
  }
  const target = input.targetUnit ?? (input.unit === 'L' ? 'L' : 'm3');
  const source = exactQuantity({ mantissa: input.mantissa, unitId: input.unit });
  if (!source.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: source.error.detail });
  }
  const converted = convertExact({
    source: source.value,
    targetUnitId: target,
    context: { factType: input.factType, productiveCategory: 'WATER' },
    clock: { nowIso: () => '2026-08-19T00:00:00.000Z' },
  });
  if (!converted.ok) {
    return err({ code: 'INCOMPATIBLE_UNIT', detail: converted.error.detail });
  }
  return ok(
    Object.freeze({
      source: source.value,
      canonical: converted.value.targetQuantity,
      unit: target,
      receipt: converted.value,
    }),
  );
}

export function litersPerCubicMeter(): bigint {
  return LITERS_PER_M3;
}
