/**
 * Interval versus cumulative meter semantics.
 *
 * A cumulative register value is not production for the current period.
 * Interval quantity is current − previous only when the same meter and
 * register are ordered in time with no reset or rollover ambiguity.
 *
 * Reset, rollover, replacement, backwards, duplicate, and reversed
 * timestamps become explicit review/refusal states. They never become
 * negative production.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { energyRejection, type EnergyIntegerQuantity, type EnergyObservationInput, type EnergyRejection, type EnergyRegisterSnapshot, type EnergyTimeWindow } from './types.ts';
import { parseEnergyIntegerQuantity, quantityToWh } from './normalization.ts';

export const ENERGY_DEFAULT_MAX_AGE_SECONDS = 3_600n;
export const ENERGY_DEFAULT_FUTURE_TOLERANCE_SECONDS = 60n;

export function parseEnergyTimeWindow(
  input: EnergyObservationInput,
  nowUnix: bigint,
  maxAgeSeconds = ENERGY_DEFAULT_MAX_AGE_SECONDS,
  futureToleranceSeconds = ENERGY_DEFAULT_FUTURE_TOLERANCE_SECONDS,
): Result<EnergyTimeWindow, EnergyRejection> {
  if (!input.sourceTimestampUnix) {
    return err(energyRejection('MISSING_SOURCE_TIMESTAMP', 'source timestamp is required', false));
  }
  const source = parseUnix(input.sourceTimestampUnix, 'MISSING_SOURCE_TIMESTAMP');
  if (!source.ok) {
    return source;
  }
  const collection = parseUnix(input.collectionTimestampUnix, 'UNDEFINED_INTERVAL');
  if (!collection.ok) {
    return collection;
  }
  if (input.meterSemantics === 'INTERVAL_ENERGY' || input.meterSemantics === 'INSTANTANEOUS_CAPACITY_REFERENCE') {
    if (input.measurementStartUnix === null || input.measurementEndUnix === null) {
      return err(
        energyRejection(
          'UNDEFINED_INTERVAL',
          'measurement start and end are required; an interval is not inferred from collection time',
          false,
        ),
      );
    }
  }
  const startRaw =
    input.measurementStartUnix ??
    (input.prior ? input.prior.sourceTimestampUnix.toString() : null) ??
    (input.meterSemantics === 'CUMULATIVE_REGISTER' ? source.value.toString() : null);
  const endRaw =
    input.measurementEndUnix ??
    (input.meterSemantics === 'CUMULATIVE_REGISTER' && !input.prior && !input.measurementEndUnix
      ? (source.value + 1n).toString()
      : input.sourceTimestampUnix);
  if (startRaw === null) {
    return err(
      energyRejection(
        'UNDEFINED_INTERVAL',
        'cumulative registers require a previous valid reading to define the measurement period',
        true,
      ),
    );
  }
  const start = parseUnix(startRaw, 'UNDEFINED_INTERVAL');
  const end = parseUnix(endRaw, 'UNDEFINED_INTERVAL');
  if (!start.ok) {
    return start;
  }
  if (!end.ok) {
    return end;
  }
  if (end.value <= start.value) {
    return err(energyRejection('END_NOT_AFTER_START', 'measurement end must be after measurement start', false));
  }
  if (collection.value - source.value > maxAgeSeconds) {
    return err(energyRejection('STALE_READING', 'source observation is older than the freshness policy', false));
  }
  if (source.value > collection.value + futureToleranceSeconds) {
    return err(energyRejection('FUTURE_READING', 'source timestamp is beyond the future-tolerance policy', false));
  }
  return ok(
    Object.freeze({
      sourceTimestampUnix: source.value,
      measurementStartUnix: start.value,
      measurementEndUnix: end.value,
      collectionTimestampUnix: collection.value,
    }),
  );
}

export type IntervalDerivation =
  | { readonly kind: 'INTERVAL'; readonly quantity: EnergyIntegerQuantity }
  | { readonly kind: 'CUMULATIVE_DELTA'; readonly quantity: EnergyIntegerQuantity; readonly prior: EnergyRegisterSnapshot }
  | { readonly kind: 'CUMULATIVE_REGISTER_ONLY'; readonly quantity: EnergyIntegerQuantity };

export function deriveIntervalQuantity(
  input: EnergyObservationInput,
  parsed: EnergyIntegerQuantity,
  time: EnergyTimeWindow,
): Result<IntervalDerivation, EnergyRejection> {
  if (input.meterSemantics === 'INSTANTANEOUS_CAPACITY_REFERENCE') {
    return err(
      energyRejection(
        'UNIT_EXTENSION_REQUIRED',
        'capacity is a power-dimension reference until the unit constitution is extended',
        false,
      ),
    );
  }
  if (input.meterSemantics === 'INTERVAL_ENERGY') {
    return ok(Object.freeze({ kind: 'INTERVAL', quantity: parsed }));
  }
  if (!input.prior) {
    return ok(Object.freeze({ kind: 'CUMULATIVE_REGISTER_ONLY', quantity: parsed }));
  }
  const prior = input.prior;
  if (prior.meterRef !== input.meterRef) {
    return err(energyRejection('REPLACEMENT_METER', 'meter identity changed; replacement is not treated as production', true));
  }
  if (prior.registerId !== input.registerId) {
    return err(energyRejection('REPLACEMENT_METER', 'register identity changed; not interpreted as period production', true));
  }
  if (time.sourceTimestampUnix < prior.sourceTimestampUnix) {
    return err(energyRejection('TIMESTAMP_REVERSAL', 'source timestamp moved backwards relative to the previous valid reading', true));
  }
  if (time.sourceTimestampUnix === prior.sourceTimestampUnix && parsed.originalMantissa === prior.readingMantissa && parsed.originalUnit === prior.unit) {
    return err(energyRejection('DUPLICATE_READING', 'identical cumulative reading retransmission is idempotent, not new production', false));
  }
  const priorParsed = parseEnergyIntegerQuantity(prior.readingMantissa.toString(), prior.unit);
  if (!priorParsed.ok) {
    return priorParsed;
  }
  const currentWh = quantityToWh(parsed);
  const priorWh = quantityToWh(priorParsed.value);
  if (!currentWh.ok) {
    return currentWh;
  }
  if (!priorWh.ok) {
    return priorWh;
  }
  if (currentWh.value === priorWh.value) {
    return err(energyRejection('DUPLICATE_READING', 'same cumulative register value is a retransmission, not interval production', false));
  }
  if (currentWh.value < priorWh.value) {
    const extras = input.extras ?? {};
    if (extras.meterReset === true || extras.reset === true) {
      return err(energyRejection('METER_RESET', 'meter reset is not converted into negative or replacement production', true));
    }
    if (looksLikeRollover(priorWh.value, currentWh.value)) {
      return err(energyRejection('COUNTER_ROLLOVER', 'counter rollover is ambiguous and is not converted into production', true));
    }
    return err(energyRejection('BACKWARDS_READING', 'backwards cumulative reading is not converted into negative production', true));
  }
  const deltaWh = currentWh.value - priorWh.value;
  return ok(
    Object.freeze({
      kind: 'CUMULATIVE_DELTA',
      quantity: Object.freeze({
        mantissa: deltaWh,
        scale: 0 as const,
        unit: 'Wh' as const,
        originalMantissa: parsed.originalMantissa,
        originalUnit: parsed.originalUnit,
      }),
      prior,
    }),
  );
}

export function cumulativeRegisterIsNotPeriodProduction(derivation: IntervalDerivation): boolean {
  return derivation.kind === 'CUMULATIVE_REGISTER_ONLY';
}

function looksLikeRollover(previousWh: bigint, currentWh: bigint): boolean {
  return previousWh > 1_000_000n && currentWh < previousWh / 10n;
}

function parseUnix(value: string, code: 'MISSING_SOURCE_TIMESTAMP' | 'UNDEFINED_INTERVAL'): Result<bigint, EnergyRejection> {
  if (!/^-?\d+$/.test(value)) {
    return err(energyRejection(code, 'timestamps must be integer UTC unix seconds', false));
  }
  return ok(BigInt(value));
}
