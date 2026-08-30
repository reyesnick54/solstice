import type { MacroCatalogProviderId } from '../catalog-entries.ts';
import { createCensusGovAdapter, createCensusGovFixtureTransport } from './census-gov.ts';
import { createDataUsaAdapter, createDataUsaFixtureTransport } from './data-usa.ts';
import { createEcondbAdapter, createEcondbFixtureTransport } from './econdb.ts';
import { createFederalRegisterAdapter, createFederalRegisterFixtureTransport } from './federal-register.ts';
import { createFredAdapter, createFredFixtureTransport } from './fred.ts';
import { createSaudiOpenDataAdapter, createSaudiOpenDataFixtureTransport } from './saudi-open-data.ts';
import { createUsaspendingAdapter, createUsaspendingFixtureTransport } from './usaspending.ts';
import { createUsTreasuryFiscaldataAdapter, createUsTreasuryFiscaldataFixtureTransport } from './us-treasury-fiscaldata.ts';
import { createWorldBankAdapter, createWorldBankFixtureTransport } from './world-bank.ts';
import type { MacroAdapter, MacroAdapterContext } from './base.ts';

export const MACRO_ADAPTER_IDS = [
  'fred',
  'world-bank',
  'econdb',
  'us-treasury-fiscaldata',
  'data-usa',
  'census-gov',
  'saudi-open-data',
  'usaspending',
  'federal-register',
] as const satisfies readonly MacroCatalogProviderId[];

export type MacroAdapterId = (typeof MACRO_ADAPTER_IDS)[number];

export function createMacroAdapter(providerId: MacroAdapterId, context: MacroAdapterContext): MacroAdapter {
  switch (providerId) {
    case 'fred':
      return createFredAdapter(context);
    case 'world-bank':
      return createWorldBankAdapter(context);
    case 'econdb':
      return createEcondbAdapter(context);
    case 'us-treasury-fiscaldata':
      return createUsTreasuryFiscaldataAdapter(context);
    case 'data-usa':
      return createDataUsaAdapter(context);
    case 'census-gov':
      return createCensusGovAdapter(context);
    case 'saudi-open-data':
      return createSaudiOpenDataAdapter(context);
    case 'usaspending':
      return createUsaspendingAdapter(context);
    case 'federal-register':
      return createFederalRegisterAdapter(context);
    default: {
      const exhaustive: never = providerId;
      throw new Error(`unsupported macro adapter ${exhaustive}`);
    }
  }
}

export function createMacroFixtureTransport(providerId: MacroAdapterId) {
  switch (providerId) {
    case 'fred':
      return createFredFixtureTransport();
    case 'world-bank':
      return createWorldBankFixtureTransport();
    case 'econdb':
      return createEcondbFixtureTransport();
    case 'us-treasury-fiscaldata':
      return createUsTreasuryFiscaldataFixtureTransport();
    case 'data-usa':
      return createDataUsaFixtureTransport();
    case 'census-gov':
      return createCensusGovFixtureTransport();
    case 'saudi-open-data':
      return createSaudiOpenDataFixtureTransport();
    case 'usaspending':
      return createUsaspendingFixtureTransport();
    case 'federal-register':
      return createFederalRegisterFixtureTransport();
    default: {
      const exhaustive: never = providerId;
      throw new Error(`unsupported macro adapter ${exhaustive}`);
    }
  }
}

export * from './base.ts';
export * from './fred.ts';
export * from './world-bank.ts';
export * from './econdb.ts';
export * from './us-treasury-fiscaldata.ts';
export * from './data-usa.ts';
export * from './census-gov.ts';
export * from './saudi-open-data.ts';
export * from './usaspending.ts';
export * from './federal-register.ts';
