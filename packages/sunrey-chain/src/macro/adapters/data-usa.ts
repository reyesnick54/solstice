import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const DATA_USA_PROVIDER_ID = 'data-usa' as const;

export const DATA_USA_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'data-usa',
  baseUrl: 'https://datausa.io/api',
  authorityClass: 'derived_data',
  providerCategory: 'government_open_data',
  fixtureFile: 'data-usa.json',
  indicatorPath: '/data',
  seriesPath: '/data',
  defaultCountry: 'US',
  providerSchemaVersion: 'datausa/1',
});

export function createDataUsaFixtureTransport() {
  return createFixtureTransport(DATA_USA_ADAPTER_CONFIG);
}

export function createDataUsaAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: DATA_USA_ADAPTER_CONFIG });
}
