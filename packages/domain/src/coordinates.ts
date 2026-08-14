import { type Brand, brandAs } from './brand.ts';
import type { AccountId } from './account.ts';
import { ibanCheckDigits, parseIban, type ParsedIban } from './iban.ts';
import { err, ok, type Result } from './result.ts';

export type CoordinateId = Brand<string, 'CoordinateId'>;

export function asCoordinateId(value: string): CoordinateId {
  if (value.length === 0) {
    throw new TypeError('CoordinateId must be a non-empty string');
  }
  return brandAs<string, 'CoordinateId'>(value);
}

export const COORDINATE_SCHEMES = [
  'SIMULATED_DOMESTIC',
  'SIMULATED_ROUTING',
  'SIMULATED_IBAN',
  'SIMULATED_BIC',
] as const;

export type CoordinateScheme = (typeof COORDINATE_SCHEMES)[number];

/**
 * External account coordinates for future integration.
 * Every assigned value is synthetic and cannot be mistaken for a live
 * bank detail. Live IBANs are never assigned.
 */
export type ExternalAccountCoordinate = {
  readonly id: CoordinateId;
  readonly accountId: AccountId;
  readonly scheme: CoordinateScheme;
  readonly value: string;
  readonly synthetic: true;
  readonly liveAssignable: false;
  readonly parsedIban?: ParsedIban;
};

export type CoordinateRejection = {
  readonly code: 'COORDINATE_INVALID';
  readonly message: string;
};

const SIM_PREFIX: Record<CoordinateScheme, string> = {
  SIMULATED_DOMESTIC: 'SIM-DOM-',
  SIMULATED_ROUTING: 'SIM-RTG-',
  SIMULATED_IBAN: 'SIM-IBAN-',
  SIMULATED_BIC: 'SIM-BIC-',
};

export function freezeCoordinate(coordinate: ExternalAccountCoordinate): ExternalAccountCoordinate {
  if (coordinate.synthetic !== true || coordinate.liveAssignable !== false) {
    throw new TypeError('external coordinates must be synthetic and not live-assignable');
  }
  if (!coordinate.value.startsWith(SIM_PREFIX[coordinate.scheme])) {
    throw new TypeError(`simulated ${coordinate.scheme} must use prefix ${SIM_PREFIX[coordinate.scheme]}`);
  }
  return Object.freeze({ ...coordinate });
}

/**
 * Build a simulated IBAN using ISO 13616 check digits and country code XZ.
 * XZ is not a live issuing country. The stored value is still SIM-prefixed.
 */
export function createSimulatedIbanCoordinate(input: {
  readonly id: CoordinateId;
  readonly accountId: AccountId;
  readonly serial: string;
}): Result<ExternalAccountCoordinate, CoordinateRejection> {
  if (!/^[0-9]{1,10}$/.test(input.serial)) {
    return err({
      code: 'COORDINATE_INVALID',
      message: 'simulated IBAN serial must be 1–10 digits',
    });
  }
  const bban = `SOLSTICE${input.serial.padStart(10, '0')}`;
  const check = ibanCheckDigits('XZ', bban);
  const compact = `XZ${check}${bban}`;
  const parsed = parseIban(compact);
  if (!parsed.ok) {
    return err({
      code: 'COORDINATE_INVALID',
      message: parsed.error.message,
    });
  }
  return ok(
    freezeCoordinate({
      id: input.id,
      accountId: input.accountId,
      scheme: 'SIMULATED_IBAN',
      value: `SIM-IBAN-${compact}`,
      synthetic: true,
      liveAssignable: false,
      parsedIban: parsed.value,
    }),
  );
}

export function createSimulatedDomesticCoordinate(input: {
  readonly id: CoordinateId;
  readonly accountId: AccountId;
  readonly serial: string;
}): ExternalAccountCoordinate {
  return freezeCoordinate({
    id: input.id,
    accountId: input.accountId,
    scheme: 'SIMULATED_DOMESTIC',
    value: `SIM-DOM-${input.serial}`,
    synthetic: true,
    liveAssignable: false,
  });
}

export function createSimulatedRoutingCoordinate(input: {
  readonly id: CoordinateId;
  readonly accountId: AccountId;
  readonly serial: string;
}): ExternalAccountCoordinate {
  return freezeCoordinate({
    id: input.id,
    accountId: input.accountId,
    scheme: 'SIMULATED_ROUTING',
    value: `SIM-RTG-${input.serial}`,
    synthetic: true,
    liveAssignable: false,
  });
}

export function createSimulatedBicCoordinate(input: {
  readonly id: CoordinateId;
  readonly accountId: AccountId;
  readonly serial: string;
}): ExternalAccountCoordinate {
  return freezeCoordinate({
    id: input.id,
    accountId: input.accountId,
    scheme: 'SIMULATED_BIC',
    value: `SIM-BIC-XZSOLST${input.serial.padStart(3, '0')}`,
    synthetic: true,
    liveAssignable: false,
  });
}
