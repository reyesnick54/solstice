import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const FEDERAL_REGISTER_PROVIDER_ID = 'federal-register' as const;

export const FEDERAL_REGISTER_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'federal-register',
  baseUrl: 'https://www.federalregister.gov/api/v1',
  authorityClass: 'authoritative_official',
  providerCategory: 'government_open_data',
  fixtureFile: 'federal-register.json',
  indicatorPath: '/documents.json',
  seriesPath: '/documents.json',
  defaultCountry: 'US',
  providerSchemaVersion: 'federal-register/1',
});

export function createFederalRegisterFixtureTransport() {
  return createFixtureTransport(FEDERAL_REGISTER_ADAPTER_CONFIG);
}

export function createFederalRegisterAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: FEDERAL_REGISTER_ADAPTER_CONFIG });
}
