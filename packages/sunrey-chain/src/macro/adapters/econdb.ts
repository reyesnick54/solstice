import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const ECONDB_PROVIDER_ID = 'econdb' as const;

export const ECONDB_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'econdb',
  baseUrl: 'https://www.econdb.com/api',
  authorityClass: 'derived_data',
  providerCategory: 'macroeconomics',
  fixtureFile: 'econdb-indicator.json',
  indicatorPath: '/series/{series_id}',
  seriesPath: '/series/{series_id}',
  providerSchemaVersion: 'econdb/1',
});

export function createEcondbFixtureTransport() {
  return createFixtureTransport(ECONDB_ADAPTER_CONFIG);
}

export function createEcondbAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: ECONDB_ADAPTER_CONFIG });
}
