import type { Aaf10MacroReleaseType, Aaf10UsMacroSeries } from './taxonomy.ts';

export type CatalogSeriesEntry = {
  readonly seriesKey: Aaf10UsMacroSeries;
  readonly fredSeriesId: string | null;
  readonly blsSeriesId: string | null;
  readonly worldBankIndicator: string | null;
  readonly defaultReleaseType: Aaf10MacroReleaseType;
  readonly valueScale: 'percent_bps' | 'index_scaled' | 'level_scaled';
};

export const US_MACRO_SERIES_CATALOG: Readonly<Record<Aaf10UsMacroSeries, CatalogSeriesEntry>> = Object.freeze({
  cpi: Object.freeze({
    seriesKey: 'cpi',
    fredSeriesId: 'CPIAUCSL',
    blsSeriesId: 'CPI',
    worldBankIndicator: null,
    defaultReleaseType: 'cpi_release',
    valueScale: 'index_scaled',
  }),
  unemployment: Object.freeze({
    seriesKey: 'unemployment',
    fredSeriesId: 'UNRATE',
    blsSeriesId: 'LNS14000000',
    worldBankIndicator: null,
    defaultReleaseType: 'employment_release',
    valueScale: 'percent_bps',
  }),
  payroll: Object.freeze({
    seriesKey: 'payroll',
    fredSeriesId: 'PAYEMS',
    blsSeriesId: 'CES0000000001',
    worldBankIndicator: null,
    defaultReleaseType: 'employment_release',
    valueScale: 'level_scaled',
  }),
  gdp: Object.freeze({
    seriesKey: 'gdp',
    fredSeriesId: 'GDP',
    blsSeriesId: null,
    worldBankIndicator: 'NY.GDP.MKTP.CD',
    defaultReleaseType: 'gdp_release',
    valueScale: 'level_scaled',
  }),
  policy_rate: Object.freeze({
    seriesKey: 'policy_rate',
    fredSeriesId: 'FEDFUNDS',
    blsSeriesId: null,
    worldBankIndicator: null,
    defaultReleaseType: 'central_bank_policy_decision',
    valueScale: 'percent_bps',
  }),
  treasury_yield_2y: Object.freeze({
    seriesKey: 'treasury_yield_2y',
    fredSeriesId: 'DGS2',
    blsSeriesId: null,
    worldBankIndicator: null,
    defaultReleaseType: 'official_release',
    valueScale: 'percent_bps',
  }),
  treasury_yield_10y: Object.freeze({
    seriesKey: 'treasury_yield_10y',
    fredSeriesId: 'DGS10',
    blsSeriesId: null,
    worldBankIndicator: null,
    defaultReleaseType: 'official_release',
    valueScale: 'percent_bps',
  }),
  inflation_expectations: Object.freeze({
    seriesKey: 'inflation_expectations',
    fredSeriesId: 'T10YIE',
    blsSeriesId: null,
    worldBankIndicator: null,
    defaultReleaseType: 'official_release',
    valueScale: 'percent_bps',
  }),
});

export function resolveSeriesKeyFromProviderId(input: {
  readonly providerId: string;
  readonly seriesId: string;
}): Aaf10UsMacroSeries | null {
  for (const entry of Object.values(US_MACRO_SERIES_CATALOG)) {
    if (entry.fredSeriesId === input.seriesId && input.providerId === 'fred') {
      return entry.seriesKey;
    }
    if (entry.blsSeriesId === input.seriesId && input.providerId === 'bls') {
      return entry.seriesKey;
    }
    if (entry.worldBankIndicator === input.seriesId && input.providerId === 'world-bank') {
      return entry.seriesKey;
    }
  }
  return null;
}
