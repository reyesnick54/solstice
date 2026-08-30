import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const CENSUS_GOV_PROVIDER_ID = 'census-gov' as const;

export const CENSUS_GOV_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'census-gov',
  baseUrl: 'https://api.census.gov/data',
  authorityClass: 'authoritative_official',
  providerCategory: 'government_open_data',
  fixtureFile: 'census-gov.json',
  indicatorPath: '/2023/acs/acs1',
  seriesPath: '/2023/acs/acs1',
  defaultCountry: 'US',
  providerSchemaVersion: 'census/1',
});

export function createCensusGovFixtureTransport() {
  return createFixtureTransport(CENSUS_GOV_ADAPTER_CONFIG);
}

export function createCensusGovAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: CENSUS_GOV_ADAPTER_CONFIG });
}
