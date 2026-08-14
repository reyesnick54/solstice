import { err, ok, type Result } from './result.ts';

/**
 * ISO 13616 IBAN format validation (ISO 7064 MOD-97-10).
 * This is parsing infrastructure. It does not assign a live IBAN.
 *
 * Simulation identifiers are created separately and are always synthetic.
 */

const IBAN_CHAR = /^[A-Z0-9]+$/;

/**
 * Published IBAN lengths for countries we may parse. Unknown countries are
 * still checked for charset and MOD-97. XZ is the simulation country code
 * and is not a live issuing country.
 */
export const IBAN_LENGTH_BY_COUNTRY: Readonly<Record<string, number>> = Object.freeze({
  AE: 23,
  AT: 20,
  BE: 16,
  CH: 21,
  DE: 22,
  ES: 24,
  FR: 27,
  GB: 22,
  IE: 22,
  IT: 27,
  NL: 18,
  SA: 24,
  XZ: 22,
});

export type ParsedIban = {
  readonly countryCode: string;
  readonly checkDigits: string;
  readonly bban: string;
  readonly compact: string;
  readonly electronic: string;
};

export type IbanRejection = {
  readonly code: 'IBAN_INVALID';
  readonly field: string;
  readonly message: string;
};

export function compactIban(value: string): string {
  return value.replace(/[\s-]+/g, '').toUpperCase();
}

export function parseIban(value: string): Result<ParsedIban, IbanRejection> {
  const compact = compactIban(value);
  if (compact.length < 5 || compact.length > 34) {
    return reject('length', 'IBAN must be between 5 and 34 characters');
  }
  if (!IBAN_CHAR.test(compact)) {
    return reject('charset', 'IBAN may contain only A–Z and 0–9');
  }
  const countryCode = compact.slice(0, 2);
  const checkDigits = compact.slice(2, 4);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return reject('countryCode', 'IBAN country code must be two letters');
  }
  if (!/^[0-9]{2}$/.test(checkDigits)) {
    return reject('checkDigits', 'IBAN check digits must be two digits');
  }
  const expected = IBAN_LENGTH_BY_COUNTRY[countryCode];
  if (expected !== undefined && compact.length !== expected) {
    return reject('length', `IBAN for ${countryCode} must be ${String(expected)} characters`);
  }
  if (mod97(compact) !== 1) {
    return reject('checkDigits', 'IBAN MOD-97 checksum failed');
  }
  const bban = compact.slice(4);
  return ok(
    Object.freeze({
      countryCode,
      checkDigits,
      bban,
      compact,
      electronic: compact,
    }),
  );
}

export function isValidIban(value: string): boolean {
  return parseIban(value).ok;
}

/**
 * ISO 7064 MOD-97-10 over the rearranged IBAN character string.
 * Processes in chunks so the intermediate value stays a safe integer.
 */
export function ibanMod97(compact: string): number {
  return mod97(compactIban(compact));
}

export function ibanCheckDigits(countryCode: string, bban: string): string {
  const country = countryCode.toUpperCase();
  const body = `${country}00${bban.toUpperCase()}`;
  const remainder = mod97(body);
  const check = 98 - remainder;
  return check < 10 ? `0${String(check)}` : String(check);
}

function mod97(compact: string): number {
  const rearranged = `${compact.slice(4)}${compact.slice(0, 4)}`;
  let expanded = '';
  for (const char of rearranged) {
    if (char >= 'A' && char <= 'Z') {
      expanded += String(char.charCodeAt(0) - 55);
    } else {
      expanded += char;
    }
  }
  let remainder = 0;
  for (const char of expanded) {
    remainder = (remainder * 10 + (char.charCodeAt(0) - 48)) % 97;
  }
  return remainder;
}

function reject(field: string, message: string): Result<ParsedIban, IbanRejection> {
  return err(Object.freeze({ code: 'IBAN_INVALID' as const, field, message }));
}
