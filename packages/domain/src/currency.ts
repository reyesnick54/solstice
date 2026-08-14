import { type Brand, brandAs } from './brand.ts';

/** ISO 4217 alphabetic currency code. */
export type CurrencyCode = Brand<string, 'CurrencyCode'>;

const ISO_4217 = /^[A-Z]{3}$/;

export function asCurrencyCode(code: string): CurrencyCode {
  if (!ISO_4217.test(code)) {
    throw new TypeError(`Invalid currency code: ${code}`);
  }
  return brandAs<string, 'CurrencyCode'>(code);
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && ISO_4217.test(value);
}

/**
 * Canonical simulation currencies for the banking core.
 * This extends the existing CurrencyCode taxonomy. It is not a second catalog.
 */
export const CANONICAL_SIMULATION_CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED'] as const;

export type CanonicalSimulationCurrency = (typeof CANONICAL_SIMULATION_CURRENCIES)[number];

export const CURRENCY_STATUSES = ['SUPPORTED_SIMULATION', 'RESERVED', 'DISABLED'] as const;

export type CurrencyStatus = (typeof CURRENCY_STATUSES)[number];

export type CurrencyDisplay = {
  readonly symbol: string;
  readonly majorUnitName: string;
  readonly minorUnitName: string;
};

export type CurrencyRecord = {
  readonly code: CurrencyCode;
  readonly isoNumeric: string;
  readonly name: string;
  readonly minorUnitExponent: number;
  readonly display: CurrencyDisplay;
  readonly status: CurrencyStatus;
  readonly supportedLegalEntityIds: readonly string[];
  readonly simulationEnabled: true;
  readonly liveEnabled: false;
};

function record(input: {
  readonly code: CanonicalSimulationCurrency;
  readonly isoNumeric: string;
  readonly name: string;
  readonly minorUnitExponent: number;
  readonly display: CurrencyDisplay;
  readonly supportedLegalEntityIds: readonly string[];
}): CurrencyRecord {
  if (!Number.isInteger(input.minorUnitExponent) || input.minorUnitExponent < 0) {
    throw new TypeError('minor-unit exponent must be a non-negative integer');
  }
  return Object.freeze({
    code: asCurrencyCode(input.code),
    isoNumeric: input.isoNumeric,
    name: input.name,
    minorUnitExponent: input.minorUnitExponent,
    display: Object.freeze({ ...input.display }),
    status: 'SUPPORTED_SIMULATION',
    supportedLegalEntityIds: Object.freeze([...input.supportedLegalEntityIds]),
    simulationEnabled: true,
    liveEnabled: false,
  });
}

/**
 * Metadata for supported simulation currencies. Live capability is always false.
 * Money remains integer minor units; the exponent is only a scale factor.
 */
export const CURRENCY_REGISTRY: {
  readonly [C in CanonicalSimulationCurrency]: CurrencyRecord;
} = Object.freeze({
  USD: record({
    code: 'USD',
    isoNumeric: '840',
    name: 'United States dollar',
    minorUnitExponent: 2,
    display: { symbol: 'US$', majorUnitName: 'dollar', minorUnitName: 'cent' },
    supportedLegalEntityIds: ['le_solstice_us_inc', 'le_solstice_uk_ltd'],
  }),
  EUR: record({
    code: 'EUR',
    isoNumeric: '978',
    name: 'Euro',
    minorUnitExponent: 2,
    display: { symbol: '€', majorUnitName: 'euro', minorUnitName: 'cent' },
    supportedLegalEntityIds: ['le_solstice_eu_entity', 'le_solstice_uk_ltd'],
  }),
  GBP: record({
    code: 'GBP',
    isoNumeric: '826',
    name: 'Pound sterling',
    minorUnitExponent: 2,
    display: { symbol: '£', majorUnitName: 'pound', minorUnitName: 'penny' },
    supportedLegalEntityIds: ['le_solstice_uk_ltd'],
  }),
  SAR: record({
    code: 'SAR',
    isoNumeric: '682',
    name: 'Saudi riyal',
    minorUnitExponent: 2,
    display: { symbol: 'SAR', majorUnitName: 'riyal', minorUnitName: 'halala' },
    supportedLegalEntityIds: ['le_solstice_sa_entity', 'le_solstice_uk_ltd'],
  }),
  AED: record({
    code: 'AED',
    isoNumeric: '784',
    name: 'UAE dirham',
    minorUnitExponent: 2,
    display: { symbol: 'AED', majorUnitName: 'dirham', minorUnitName: 'fils' },
    supportedLegalEntityIds: ['le_solstice_ae_entity', 'le_solstice_uk_ltd'],
  }),
});

export function isCanonicalSimulationCurrency(
  value: unknown,
): value is CanonicalSimulationCurrency {
  return (
    typeof value === 'string' &&
    (CANONICAL_SIMULATION_CURRENCIES as readonly string[]).includes(value)
  );
}

export function currencyRecord(code: string): CurrencyRecord | undefined {
  if (!isCanonicalSimulationCurrency(code)) {
    return undefined;
  }
  return CURRENCY_REGISTRY[code];
}

export function requireCurrencyRecord(code: string): CurrencyRecord {
  const found = currencyRecord(code);
  if (!found) {
    throw new TypeError(`currency ${code} is not a canonical supported simulation currency`);
  }
  return found;
}

/**
 * Scale a major-unit integer into minor units using the registry exponent.
 * Uses bigint only. Never floating point.
 */
export function majorUnitsToMinorUnits(majorUnits: bigint, code: string): bigint {
  if (typeof majorUnits !== 'bigint') {
    throw new TypeError('major units must be bigint');
  }
  const found = requireCurrencyRecord(code);
  let scale = 1n;
  for (let i = 0; i < found.minorUnitExponent; i += 1) {
    scale *= 10n;
  }
  return majorUnits * scale;
}
