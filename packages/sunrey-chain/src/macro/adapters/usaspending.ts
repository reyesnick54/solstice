import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const USASPENDING_PROVIDER_ID = 'usaspending' as const;

export const USASPENDING_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'usaspending',
  baseUrl: 'https://api.usaspending.gov',
  authorityClass: 'authoritative_official',
  providerCategory: 'government_open_data',
  fixtureFile: 'usaspending.json',
  indicatorPath: '/api/v2/search/spending_by_category',
  seriesPath: '/api/v2/search/spending_by_category',
  defaultCountry: 'US',
  providerSchemaVersion: 'usaspending/1',
});

export function createUsaspendingFixtureTransport() {
  return createFixtureTransport(USASPENDING_ADAPTER_CONFIG);
}

export function createUsaspendingAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: USASPENDING_ADAPTER_CONFIG });
}
