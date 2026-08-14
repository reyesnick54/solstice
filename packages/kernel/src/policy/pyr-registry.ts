import type { LegalReviewState } from './schema.ts';

export const PYR_COUNTRIES = ['US', 'EU', 'GB', 'SA', 'AE'] as const;
export type PyrCountry = (typeof PYR_COUNTRIES)[number];

export const PYR_CAPABILITIES = [
  'HOLD',
  'TRANSFER',
  'TRADE',
  'CUSTODY',
  'EXCHANGE',
  'RECEIVE_REWARD',
  'DATA_SETTLEMENT_LIVE',
] as const;

export type PyrCapability = (typeof PYR_CAPABILITIES)[number];

export type Reviewed<T> = {
  readonly value: T;
  readonly legalReviewState: LegalReviewState;
};

export type PyrStatus = 'DISABLED' | 'PERMITTED';

export type PyrJurisdictionEntry = {
  readonly country: PyrCountry;
  readonly legalClassification: Reviewed<string>;
  readonly permittedUsers: Reviewed<readonly string[]>;
  readonly custodyStatus: Reviewed<PyrStatus>;
  readonly tradingStatus: Reviewed<PyrStatus>;
  readonly transferStatus: Reviewed<PyrStatus>;
  readonly exchangeRequirements: Reviewed<string>;
  readonly disclosures: Reviewed<readonly string[]>;
  readonly licensingRequirements: Reviewed<string>;
  readonly taxHandling: Reviewed<string>;
  readonly dataSettlementStatus: Reviewed<PyrStatus>;
};

function researched<T>(value: T): Reviewed<T> {
  return Object.freeze({ value, legalReviewState: 'RESEARCH_REQUIRED' });
}

function entry(
  country: PyrCountry,
  classification: string,
): PyrJurisdictionEntry {
  return Object.freeze({
    country,
    legalClassification: researched(classification),
    permittedUsers: researched(Object.freeze(['none'])),
    custodyStatus: researched('DISABLED' as const),
    tradingStatus: researched('DISABLED' as const),
    transferStatus: researched('DISABLED' as const),
    exchangeRequirements: researched('unknown — RESEARCH_REQUIRED'),
    disclosures: researched(Object.freeze(['none on file'])),
    licensingRequirements: researched('unknown — RESEARCH_REQUIRED'),
    taxHandling: researched('unknown — RESEARCH_REQUIRED'),
    dataSettlementStatus: researched('DISABLED' as const),
  });
}

/**
 * Per-country PYR registry. No entry is CONFIRMED_BY_COUNSEL.
 * Every status defaults to DISABLED. Capabilities are derived only
 * from this table — there is no manual global toggle.
 */
export const PYR_JURISDICTION_REGISTRY: readonly PyrJurisdictionEntry[] = Object.freeze([
  entry('US', 'unclassified participation asset — not a legal opinion'),
  entry('EU', 'unclassified crypto-asset under MiCA analysis — not a legal opinion'),
  entry('GB', 'unclassified crypto-asset — not a legal opinion'),
  entry('SA', 'unclassified virtual asset — not a legal opinion'),
  entry('AE', 'unclassified virtual asset — not a legal opinion'),
]);

const FIELD_FOR_CAPABILITY: {
  readonly [C in PyrCapability]: keyof PyrJurisdictionEntry;
} = {
  HOLD: 'custodyStatus',
  TRANSFER: 'transferStatus',
  TRADE: 'tradingStatus',
  CUSTODY: 'custodyStatus',
  EXCHANGE: 'tradingStatus',
  RECEIVE_REWARD: 'dataSettlementStatus',
  DATA_SETTLEMENT_LIVE: 'dataSettlementStatus',
};

export function pyrEntryFor(country: string): PyrJurisdictionEntry | undefined {
  const mapped = country === 'DE' || country === 'FR' || country === 'IE' || country === 'NL' ? 'EU' : country;
  return PYR_JURISDICTION_REGISTRY.find((row) => row.country === mapped);
}

/**
 * A PYR capability is enabled only when the governing registry field is
 * PERMITTED and that field is CONFIRMED_BY_COUNSEL. Anything else is
 * disabled, including DRAFT, RESEARCH_REQUIRED, and missing countries.
 * There is no override.
 */
export function isPyrCapabilityEnabled(country: string, capability: PyrCapability): boolean {
  const row = pyrEntryFor(country);
  if (!row) return false;
  const fieldName = FIELD_FOR_CAPABILITY[capability];
  const field = row[fieldName];
  if (typeof field !== 'object' || field === null || !('legalReviewState' in field)) {
    return false;
  }
  const reviewed = field as Reviewed<unknown>;
  if (reviewed.legalReviewState !== 'CONFIRMED_BY_COUNSEL') {
    return false;
  }
  return reviewed.value === 'PERMITTED';
}

export function pyrCapabilitiesFor(
  country: string,
): { readonly [C in PyrCapability]: boolean } {
  const out = {} as { [C in PyrCapability]: boolean };
  for (const capability of PYR_CAPABILITIES) {
    out[capability] = isPyrCapabilityEnabled(country, capability);
  }
  return Object.freeze(out);
}

export function assertNoPyrCounselConfirmed(
  registry: readonly PyrJurisdictionEntry[] = PYR_JURISDICTION_REGISTRY,
): void {
  for (const row of registry) {
    for (const [key, value] of Object.entries(row)) {
      if (key === 'country') continue;
      const reviewed = value as Reviewed<unknown>;
      if (reviewed.legalReviewState === 'CONFIRMED_BY_COUNSEL') {
        throw new Error(
          `PYR registry ${row.country}.${key} is CONFIRMED_BY_COUNSEL, which this build forbids`,
        );
      }
    }
  }
}
