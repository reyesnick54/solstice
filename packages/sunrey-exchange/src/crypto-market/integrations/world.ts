/**
 * World integration — aggregate crypto market context.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { KEY_CRYPTO_ASSET_IDS } from '../cache-policies.ts';
import type { CryptoMarketReferenceService } from '../service.ts';

export type WorldCryptoMarketSnapshot = {
  readonly schema: 'sunrey.world.crypto-market.v1';
  readonly generatedAt: UtcInstant;
  readonly authorityClass: 'reference_data';
  readonly officialEconomicStatistic: false;
  readonly btcPriceMinorUnits: string | null;
  readonly btcQuoteCurrency: string | null;
  readonly majorAssets: readonly {
    readonly assetId: string;
    readonly symbol: string;
    readonly priceMinorUnits: string;
    readonly marketCapMinorUnits: string | null;
    readonly volume24hMinorUnits: string | null;
    readonly providerId: string;
  }[];
  readonly totalMarketContext: string;
};

export async function buildWorldCryptoMarketSnapshot(
  service: CryptoMarketReferenceService,
  nowUtc: UtcInstant,
  assetIds: readonly string[] = KEY_CRYPTO_ASSET_IDS,
): Promise<WorldCryptoMarketSnapshot> {
  const majorAssets: WorldCryptoMarketSnapshot['majorAssets'][number][] = [];
  let btcPrice: string | null = null;
  let btcCurrency: string | null = null;
  for (const assetId of assetIds) {
    const result = await service.getQuote(assetId, nowUtc);
    if (!result.ok) continue;
    if (result.value.symbol === 'BTC') {
      btcPrice = result.value.priceMinorUnits.toString();
      btcCurrency = result.value.quoteCurrency;
    }
    majorAssets.push(
      Object.freeze({
        assetId,
        symbol: result.value.symbol,
        priceMinorUnits: result.value.priceMinorUnits.toString(),
        marketCapMinorUnits: result.value.marketCapMinorUnits?.toString() ?? null,
        volume24hMinorUnits: result.value.volume24hMinorUnits?.toString() ?? null,
        providerId: result.value.providerId,
      }),
    );
  }
  return Object.freeze({
    schema: 'sunrey.world.crypto-market.v1',
    generatedAt: nowUtc,
    authorityClass: 'reference_data',
    officialEconomicStatistic: false,
    btcPriceMinorUnits: btcPrice,
    btcQuoteCurrency: btcCurrency,
    majorAssets: Object.freeze(majorAssets),
    totalMarketContext: 'public_crypto_reference_not_official_statistics',
  });
}
