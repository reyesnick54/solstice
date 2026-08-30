/**
 * Canonical macro indicator ID mapping across provider-native identifiers.
 */

import type { MacroCatalogProviderId } from './catalog-entries.ts';

export const CANONICAL_INDICATORS = Object.freeze({
  US_CPI: 'us.cpi',
  US_GDP: 'us.gdp',
  US_UNEMPLOYMENT: 'us.unemployment_rate',
  US_POLICY_RATE: 'us.policy_rate',
  US_TREASURY_10Y: 'us.treasury_10y',
  US_TREASURY_2Y: 'us.treasury_2y',
  US_FED_FUNDS: 'us.fed_funds_rate',
  US_POPULATION: 'us.population',
  US_INFLATION_EXPECTATIONS: 'us.inflation_expectations',
  GLOBAL_GDP: 'global.gdp',
  GLOBAL_POPULATION: 'global.population',
  SA_GDP: 'sa.gdp',
  SA_POPULATION: 'sa.population',
  US_FEDERAL_DEBT: 'us.federal_debt',
  US_FEDERAL_SPENDING: 'us.federal_spending',
} as const);

export type CanonicalIndicatorId = (typeof CANONICAL_INDICATORS)[keyof typeof CANONICAL_INDICATORS];

type ProviderMapping = Readonly<Record<string, CanonicalIndicatorId>>;

export const PROVIDER_INDICATOR_MAPPINGS: Readonly<
  Record<MacroCatalogProviderId, ProviderMapping>
> = Object.freeze({
  fred: Object.freeze({
    CPIAUCSL: CANONICAL_INDICATORS.US_CPI,
    GDPC1: CANONICAL_INDICATORS.US_GDP,
    UNRATE: CANONICAL_INDICATORS.US_UNEMPLOYMENT,
    FEDFUNDS: CANONICAL_INDICATORS.US_FED_FUNDS,
    DGS10: CANONICAL_INDICATORS.US_TREASURY_10Y,
    DGS2: CANONICAL_INDICATORS.US_TREASURY_2Y,
    T10YIE: CANONICAL_INDICATORS.US_INFLATION_EXPECTATIONS,
  }),
  'world-bank': Object.freeze({
    'NY.GDP.MKTP.CD': CANONICAL_INDICATORS.GLOBAL_GDP,
    'SP.POP.TOTL': CANONICAL_INDICATORS.GLOBAL_POPULATION,
    'SL.UEM.TOTL.ZS': CANONICAL_INDICATORS.US_UNEMPLOYMENT,
  }),
  econdb: Object.freeze({
    'US.CPI': CANONICAL_INDICATORS.US_CPI,
    'US.GDP': CANONICAL_INDICATORS.US_GDP,
    'US.UNEMPLOYMENT': CANONICAL_INDICATORS.US_UNEMPLOYMENT,
  }),
  'us-treasury-fiscaldata': Object.freeze({
    avg_interest_rates: CANONICAL_INDICATORS.US_TREASURY_10Y,
    debt_to_penny: CANONICAL_INDICATORS.US_FEDERAL_DEBT,
  }),
  'data-usa': Object.freeze({
    'acs_yg_total_population_1': CANONICAL_INDICATORS.US_POPULATION,
    'acs_yg_gini_index_1': CANONICAL_INDICATORS.US_GDP,
  }),
  'census-gov': Object.freeze({
    B01003_001E: CANONICAL_INDICATORS.US_POPULATION,
  }),
  'saudi-open-data': Object.freeze({
    'sa-gdp-current': CANONICAL_INDICATORS.SA_GDP,
    'sa-population': CANONICAL_INDICATORS.SA_POPULATION,
  }),
  usaspending: Object.freeze({
    spending_by_category: CANONICAL_INDICATORS.US_FEDERAL_SPENDING,
    total_budgetary_resources: CANONICAL_INDICATORS.US_FEDERAL_SPENDING,
  }),
  'federal-register': Object.freeze({
    economic_policy_documents: CANONICAL_INDICATORS.US_POLICY_RATE,
  }),
});

const REVERSE_MAPPINGS: Readonly<Record<string, Readonly<Record<CanonicalIndicatorId, string>>>> =
  Object.freeze(
    Object.fromEntries(
      (Object.keys(PROVIDER_INDICATOR_MAPPINGS) as MacroCatalogProviderId[]).map((providerId) => {
        const forward = PROVIDER_INDICATOR_MAPPINGS[providerId];
        const reverse = Object.fromEntries(
          Object.entries(forward).map(([nativeId, canonicalId]) => [canonicalId, nativeId]),
        ) as Record<CanonicalIndicatorId, string>;
        return [providerId, Object.freeze(reverse)];
      }),
    ),
  );

export function resolveCanonicalIndicatorId(
  providerId: MacroCatalogProviderId,
  nativeId: string,
): CanonicalIndicatorId | null {
  const mapping = PROVIDER_INDICATOR_MAPPINGS[providerId];
  return mapping[nativeId] ?? null;
}

export function getProviderNativeId(
  canonicalId: CanonicalIndicatorId,
  providerId: MacroCatalogProviderId,
): string | null {
  const reverse = REVERSE_MAPPINGS[providerId];
  return reverse?.[canonicalId] ?? null;
}
