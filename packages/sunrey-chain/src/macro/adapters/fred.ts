import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const FRED_PROVIDER_ID = 'fred' as const;

export const FRED_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'fred',
  baseUrl: 'https://api.stlouisfed.org/fred',
  authorityClass: 'authoritative_official',
  providerCategory: 'macroeconomics',
  fixtureFile: 'fred-series.json',
  indicatorPath: '/fred/series/observations',
  seriesPath: '/fred/series/observations',
  defaultCountry: 'US',
  providerSchemaVersion: 'fred/1',
});

export function createFredFixtureTransport() {
  return createFixtureTransport(FRED_ADAPTER_CONFIG);
}

export function createFredAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: FRED_ADAPTER_CONFIG });
}
