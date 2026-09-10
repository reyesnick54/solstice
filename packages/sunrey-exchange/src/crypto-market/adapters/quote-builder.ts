/**
 * Shared quote builder for crypto market reference normalization.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { RegisteredCryptoAsset } from '../assets.ts';
import type {
  CryptoMarketReferenceProvenance,
  CryptoMarketReferenceQuote,
  CryptoPriceSourceType,
} from '../types.ts';
import { CRYPTO_MARKET_REFERENCE_AUTHORITY, CRYPTO_MARKET_REFERENCE_SCHEMA } from '../types.ts';

export type QuoteFieldInput = {
  readonly asset: RegisteredCryptoAsset;
  readonly providerId: string;
  readonly providerAssetId: string | null;
  readonly nowUtc: UtcInstant;
  readonly marketTimestamp: UtcInstant;
  readonly priceMinorUnits: bigint;
  readonly priceSourceType: CryptoPriceSourceType;
  readonly marketCapMinorUnits?: bigint | null;
  readonly circulatingSupplyMinorUnits?: bigint | null;
  readonly totalSupplyMinorUnits?: bigint | null;
  readonly maxSupplyMinorUnits?: bigint | null;
  readonly volume24hMinorUnits?: bigint | null;
  readonly change1hBps?: bigint | null;
  readonly change24hBps?: bigint | null;
  readonly change7dBps?: bigint | null;
  readonly high24hMinorUnits?: bigint | null;
  readonly low24hMinorUnits?: bigint | null;
  readonly rawMaterial: string;
};

function observationId(providerId: string, material: string): string {
  return `cmref_${createHash('sha256').update(`${providerId}|${material}`).digest('hex').slice(0, 24)}`;
}

function freshness(nowUtc: UtcInstant, marketTimestamp: UtcInstant) {
  const ageMs = BigInt(Math.max(0, Date.parse(nowUtc) - Date.parse(marketTimestamp)));
  let status: 'fresh' | 'aging' | 'stale' | 'expired' | 'unknown' = 'fresh';
  if (ageMs > 300_000n) status = 'expired';
  else if (ageMs > 120_000n) status = 'stale';
  else if (ageMs > 30_000n) status = 'aging';
  return Object.freeze({ status, ageMs, assessedAt: nowUtc });
}

function provenance(
  providerId: string,
  providerAssetId: string | null,
  capability: string,
  priceSourceType: CryptoPriceSourceType,
  material: string,
): CryptoMarketReferenceProvenance {
  return Object.freeze({
    providerId,
    providerAssetId,
    authorityClass: 'reference_data',
    sourceUrl: null,
    rawPayloadHash: createHash('sha256').update(material).digest('hex'),
    observationId: observationId(providerId, material),
    capability,
    priceSourceType,
  });
}

export function buildQuoteFromFields(input: QuoteFieldInput): CryptoMarketReferenceQuote {
  const quoteCurrency = input.asset.assetId.split(':').at(-1) ?? 'USD';
  const pairId = `${input.asset.symbol}/${quoteCurrency}`;
  const obsId = observationId(input.providerId, input.rawMaterial);
  return Object.freeze({
    schema: CRYPTO_MARKET_REFERENCE_SCHEMA,
    authority: CRYPTO_MARKET_REFERENCE_AUTHORITY,
    assetId: input.asset.assetId,
    asset: input.asset,
    symbol: input.asset.symbol,
    pair: Object.freeze({
      pairId,
      baseAssetId: input.asset.assetId,
      quoteAssetId: quoteCurrency,
      baseSymbol: input.asset.symbol,
      quoteSymbol: quoteCurrency,
      venue: input.priceSourceType === 'EXCHANGE_SPECIFIC' ? input.providerId : null,
      providerId: input.providerId,
    }),
    priceMinorUnits: input.priceMinorUnits,
    quoteCurrency,
    priceScale: 2,
    marketCapMinorUnits: input.marketCapMinorUnits ?? null,
    circulatingSupplyMinorUnits: input.circulatingSupplyMinorUnits ?? null,
    totalSupplyMinorUnits: input.totalSupplyMinorUnits ?? null,
    maxSupplyMinorUnits: input.maxSupplyMinorUnits ?? null,
    volume24hMinorUnits: input.volume24hMinorUnits ?? null,
    change1hBps: input.change1hBps ?? null,
    change24hBps: input.change24hBps ?? null,
    change7dBps: input.change7dBps ?? null,
    high24hMinorUnits: input.high24hMinorUnits ?? null,
    low24hMinorUnits: input.low24hMinorUnits ?? null,
    marketTimestamp: input.marketTimestamp,
    retrievedAt: input.nowUtc,
    providerId: input.providerId,
    providerAssetId: input.providerAssetId,
    freshness: freshness(input.nowUtc, input.marketTimestamp),
    provenance: provenance(input.providerId, input.providerAssetId, 'crypto_prices', input.priceSourceType, obsId),
    observationId: obsId,
  });
}
