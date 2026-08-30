import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const SAUDI_OPEN_DATA_PROVIDER_ID = 'saudi-open-data' as const;

export const SAUDI_OPEN_DATA_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'saudi-open-data',
  baseUrl: 'https://data.gov.sa',
  authorityClass: 'authoritative_official',
  providerCategory: 'government_open_data',
  fixtureFile: 'saudi-open-data.json',
  indicatorPath: '/api/records',
  seriesPath: '/api/records',
  defaultCountry: 'SA',
  providerSchemaVersion: 'saudi-open-data/1',
});

export function createSaudiOpenDataFixtureTransport() {
  return createFixtureTransport(SAUDI_OPEN_DATA_ADAPTER_CONFIG);
}

export function createSaudiOpenDataAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: SAUDI_OPEN_DATA_ADAPTER_CONFIG });
}
