/**
 * Deterministic fixture payloads for FX reference adapters.
 * Simulation only — no live network calls.
 */

export type FxFixturePayload = {
  readonly base: string;
  readonly rates: Readonly<Record<string, string>>;
  readonly date?: string;
  readonly providerTimestamp: string;
};

const BASE_FIXTURES: Readonly<Record<string, FxFixturePayload>> = Object.freeze({
  USD: Object.freeze({
    base: 'USD',
    providerTimestamp: '2026-08-30T12:00:00.000Z',
    rates: Object.freeze({
      EUR: '0.9200',
      GBP: '0.7900',
      SAR: '3.7500',
      AED: '3.6725',
      JPY: '149.5000',
      CHF: '0.8050',
    }),
  }),
  EUR: Object.freeze({
    base: 'EUR',
    providerTimestamp: '2026-08-30T12:00:00.000Z',
    rates: Object.freeze({
      USD: '1.0870',
      GBP: '0.8580',
      SAR: '4.0700',
      AED: '3.9900',
    }),
  }),
});

export const PROVIDER_RATE_BIAS: Readonly<Record<string, bigint>> = Object.freeze({
  frankfurter: 0n,
  'currency-api': 1n,
  'exchangerate-dev': 2n,
  'exchangerate-host': 3n,
  'economia-awesome': 4n,
  'bank-of-russia': 0n,
  'national-bank-poland': 0n,
});

export function fixturePayloadForBase(base: string): FxFixturePayload | undefined {
  return BASE_FIXTURES[base.toUpperCase()];
}

export function biasedNumerator(baseNumerator: bigint, providerId: string): bigint {
  const bias = PROVIDER_RATE_BIAS[providerId] ?? 0n;
  return baseNumerator + bias;
}

export const FX_REFERENCE_PROVIDER_IDS = [
  'bank-of-russia',
  'national-bank-poland',
  'frankfurter',
  'currency-api',
  'exchangerate-dev',
  'exchangerate-host',
  'economia-awesome',
] as const;

export type FxReferenceProviderId = (typeof FX_REFERENCE_PROVIDER_IDS)[number];

export const BLOCKED_FX_REFERENCE_PROVIDER_IDS = ['currencyapi-com'] as const;
