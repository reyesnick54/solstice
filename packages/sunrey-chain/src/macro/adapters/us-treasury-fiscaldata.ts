import {
  createFixtureTransport,
  createStandardMacroAdapter,
  type MacroAdapter,
  type MacroAdapterContext,
  type MacroAdapterConfig,
} from './base.ts';

export const US_TREASURY_FISCALDATA_PROVIDER_ID = 'us-treasury-fiscaldata' as const;

export const US_TREASURY_FISCALDATA_ADAPTER_CONFIG: MacroAdapterConfig = Object.freeze({
  providerId: 'us-treasury-fiscaldata',
  baseUrl: 'https://api.fiscaldata.treasury.gov',
  authorityClass: 'authoritative_official',
  providerCategory: 'macroeconomics',
  fixtureFile: 'us-treasury-fiscaldata.json',
  indicatorPath: '/services/api/fiscal_service/v1/accounting/od/avg_interest_rates',
  seriesPath: '/services/api/fiscal_service/v1/accounting/od/avg_interest_rates',
  defaultCountry: 'US',
  providerSchemaVersion: 'treasury-fiscaldata/1',
});

export function createUsTreasuryFiscaldataFixtureTransport() {
  return createFixtureTransport(US_TREASURY_FISCALDATA_ADAPTER_CONFIG);
}

export function createUsTreasuryFiscaldataAdapter(context: MacroAdapterContext): MacroAdapter {
  return createStandardMacroAdapter({ context, config: US_TREASURY_FISCALDATA_ADAPTER_CONFIG });
}
