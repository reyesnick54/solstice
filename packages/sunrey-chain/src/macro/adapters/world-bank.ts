import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const WORLD_BANK_PROVIDER_ID = 'world-bank' as const;

export const WORLD_BANK_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'world-bank',
  baseUrl: 'https://api.worldbank.org',
  authorityClass: 'authoritative_official',
  providerCategory: 'macroeconomics',
  fixtureFile: 'world-bank-indicator.json',
  indicatorPath: '/v2/country/{country}/indicator/{indicator}',
  seriesPath: '/v2/country/{country}/indicator/{indicator}',
  defaultCountry: 'US',
  providerSchemaVersion: 'worldbank/2',
});

export function createWorldBankFixtureTransport() {
  return createFixtureTransport(WORLD_BANK_ADAPTER_CONFIG);
}

export function createWorldBankAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: WORLD_BANK_ADAPTER_CONFIG });
}
