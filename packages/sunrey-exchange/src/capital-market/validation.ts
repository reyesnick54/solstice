/**
 * Capital market observation validation and quarantine.
 */

import { isUtcInstant } from '../../../domain/src/time.ts';
import type { CapitalMarketObservation } from './types.ts';

export type CapitalMarketValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function validateCapitalMarketObservation(observation: CapitalMarketObservation): CapitalMarketValidationResult {
  if (!isUtcInstant(observation.sourceTimestamp)) {
    return { ok: false, code: 'INVALID_TIMESTAMP', message: 'sourceTimestamp is malformed' };
  }
  if (!isUtcInstant(observation.arrivalTimestamp)) {
    return { ok: false, code: 'INVALID_TIMESTAMP', message: 'arrivalTimestamp is malformed' };
  }
  if (observation.availabilityTimestamp !== null && !isUtcInstant(observation.availabilityTimestamp)) {
    return { ok: false, code: 'INVALID_TIMESTAMP', message: 'availabilityTimestamp is malformed' };
  }
  if (!observation.instrument.instrumentId || observation.instrument.instrumentId.length < 8) {
    return { ok: false, code: 'INVALID_INSTRUMENT', message: 'instrument identity is invalid' };
  }
  if (!/^[A-Z]{3}$/.test(observation.currency)) {
    return { ok: false, code: 'UNSUPPORTED_CURRENCY', message: `unsupported currency ${observation.currency}` };
  }
  for (const field of [
    observation.bidMinorUnits,
    observation.askMinorUnits,
    observation.lastMinorUnits,
    observation.openMinorUnits,
    observation.highMinorUnits,
    observation.lowMinorUnits,
    observation.previousCloseMinorUnits,
    observation.volumeUnits,
  ]) {
    if (field !== null && field < 0n) {
      return { ok: false, code: 'NEGATIVE_PRICE', message: 'negative numeric field is not permitted' };
    }
  }
  if (!isFiniteMinor(observation.lastMinorUnits) || !isFiniteMinor(observation.bidMinorUnits) || !isFiniteMinor(observation.askMinorUnits)) {
    return { ok: false, code: 'NON_FINITE_VALUE', message: 'non-finite numeric field' };
  }
  if (observation.lastMinorUnits === null && observation.bidMinorUnits === null && observation.askMinorUnits === null) {
    return { ok: false, code: 'MISSING_PRICE', message: 'observation has no price fields' };
  }
  return { ok: true };
}

function isFiniteMinor(value: bigint | null): boolean {
  return value === null || typeof value === 'bigint';
}

export function quarantineIfInvalid(
  observation: CapitalMarketObservation,
): CapitalMarketValidationResult & { readonly observation?: CapitalMarketObservation } {
  const result = validateCapitalMarketObservation(observation);
  if (!result.ok) {
    return result;
  }
  return { ok: true, observation };
}
