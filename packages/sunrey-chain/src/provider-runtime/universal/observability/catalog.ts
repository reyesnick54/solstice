/**
 * External provider catalog metadata for Wave 1 operations.
 * Controls provider metadata without live API integration.
 */

import type { ProviderCategory, ProviderCapabilityId } from '../types.ts';

export type ProviderCatalogEntry = {
  readonly providerId: string;
  readonly displayName: string;
  readonly category: ProviderCategory;
  readonly capabilities: readonly ProviderCapabilityId[];
  readonly credentialRequired: boolean;
  readonly launchTierDefault: 'SANDBOX' | 'PREVIEW' | 'PRODUCTION_BLOCKED';
};

export const WAVE1_PROVIDER_CATALOG: readonly ProviderCatalogEntry[] = Object.freeze([
  entry('coingecko', 'CoinGecko', 'MARKET_DATA', ['MARKET_DATA.QUOTE'], false, 'PREVIEW'),
  entry('coinmarketcap', 'CoinMarketCap', 'MARKET_DATA', ['MARKET_DATA.QUOTE'], true, 'PRODUCTION_BLOCKED'),
  entry('open-meteo', 'Open-Meteo', 'ORACLE', ['ORACLE.FACT_INGEST'], false, 'PREVIEW'),
  entry('fred', 'FRED', 'ORACLE', ['ORACLE.FACT_INGEST'], true, 'PRODUCTION_BLOCKED'),
  entry('sim-payments', 'SunRey simulated payments', 'PAYMENTS', ['PAYMENT.ACH', 'PAYMENT.WIRE'], false, 'SANDBOX'),
  entry('sim-fx', 'SunRey simulated FX', 'FX', ['FX.QUOTE', 'FX.EXECUTE'], false, 'SANDBOX'),
  entry('sim-cards', 'SunRey simulated cards', 'CARDS', ['CARD.VIRTUAL_ISSUING'], false, 'SANDBOX'),
  entry('sim-investments', 'SunRey simulated investments', 'INVESTMENTS', ['INVESTMENT.PAPER_ORDER'], false, 'SANDBOX'),
]);

/** Planned catalog capacity for bulk provider integrations (Wave 2). */
export const WAVE1_CATALOG_CAPACITY = 126 as const;

export function catalogEntry(providerId: string): ProviderCatalogEntry | undefined {
  return WAVE1_PROVIDER_CATALOG.find((row) => row.providerId === providerId);
}

export function catalogByCategory(category: ProviderCategory): readonly ProviderCatalogEntry[] {
  return Object.freeze(WAVE1_PROVIDER_CATALOG.filter((row) => row.category === category));
}

export function catalogTotal(): number {
  return WAVE1_CATALOG_CAPACITY;
}

function entry(
  providerId: string,
  displayName: string,
  category: ProviderCategory,
  capabilities: readonly ProviderCapabilityId[],
  credentialRequired: boolean,
  launchTierDefault: ProviderCatalogEntry['launchTierDefault'],
): ProviderCatalogEntry {
  return Object.freeze({
    providerId,
    displayName,
    category,
    capabilities,
    credentialRequired,
    launchTierDefault,
  });
}
