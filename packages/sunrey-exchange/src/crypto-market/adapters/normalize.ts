/**
 * Normalize provider fixture payloads into canonical crypto market quotes.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import { providerNativeId, resolveCryptoAsset, type RegisteredCryptoAsset } from '../assets.ts';
import {
  bpsFromPercent,
  parseDecimalToMinorUnits,
  validateQuote,
  type ValidationResult,
} from '../validation.ts';
import type {
  CryptoMarketAssetMetadata,
  CryptoMarketHistoryCandle,
  CryptoMarketReferenceProvenance,
  CryptoMarketReferenceQuote,
  CryptoPriceSourceType,
} from '../types.ts';
import { CRYPTO_MARKET_REFERENCE_AUTHORITY, CRYPTO_MARKET_REFERENCE_SCHEMA } from '../types.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function loadCryptoFixture(fileName: string): unknown {
  const text = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(text) as unknown;
}

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

function baseQuote(
  asset: RegisteredCryptoAsset,
  providerId: string,
  providerAssetId: string,
  nowUtc: UtcInstant,
  marketTimestamp: UtcInstant,
  priceMinorUnits: bigint,
  priceSourceType: CryptoPriceSourceType,
  extras: Partial<CryptoMarketReferenceQuote> = {},
): CryptoMarketReferenceQuote {
  const quoteCurrency = asset.assetId.split(':').at(-1) ?? 'USD';
  const pairId = `${asset.symbol}/${quoteCurrency}`;
  const obsId = observationId(providerId, `${asset.assetId}|${priceMinorUnits.toString()}`);
  return Object.freeze({
    schema: CRYPTO_MARKET_REFERENCE_SCHEMA,
    authority: CRYPTO_MARKET_REFERENCE_AUTHORITY,
    assetId: asset.assetId,
    asset,
    symbol: asset.symbol,
    pair: Object.freeze({
      pairId,
      baseAssetId: asset.assetId,
      quoteAssetId: quoteCurrency,
      baseSymbol: asset.symbol,
      quoteSymbol: quoteCurrency,
      venue: priceSourceType === 'EXCHANGE_SPECIFIC' ? providerId : null,
      providerId,
    }),
    priceMinorUnits,
    quoteCurrency,
    priceScale: 2,
    marketCapMinorUnits: null,
    circulatingSupplyMinorUnits: null,
    totalSupplyMinorUnits: null,
    maxSupplyMinorUnits: null,
    volume24hMinorUnits: null,
    change1hBps: null,
    change24hBps: null,
    change7dBps: null,
    high24hMinorUnits: null,
    low24hMinorUnits: null,
    marketTimestamp,
    retrievedAt: nowUtc,
    providerId,
    providerAssetId,
    freshness: freshness(nowUtc, marketTimestamp),
    provenance: provenance(providerId, providerAssetId, 'crypto_prices', priceSourceType, obsId),
    observationId: obsId,
    ...extras,
  });
}

export function normalizeCoingeckoBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  const raw = loadCryptoFixture('coingecko-btc.json') as {
    market_data: {
      current_price: { usd: number };
      market_cap: { usd: number };
      total_volume: { usd: number };
      price_change_percentage_24h: number;
      price_change_percentage_7d_in_currency: { usd: number };
      high_24h: { usd: number };
      low_24h: { usd: number };
      circulating_supply: number;
      total_supply: number;
      max_supply: number;
      last_updated: string;
    };
  };
  const md = raw.market_data;
  const marketTimestamp = asUtcInstant(md.last_updated);
  return baseQuote(
    asset,
    'coingecko',
    providerNativeId(asset, 'coingecko') ?? 'bitcoin',
    nowUtc,
    marketTimestamp,
    parseDecimalToMinorUnits(md.current_price.usd, 2) ?? 0n,
    'GLOBAL_AGGREGATE',
    {
      marketCapMinorUnits: parseDecimalToMinorUnits(md.market_cap.usd, 2),
      volume24hMinorUnits: parseDecimalToMinorUnits(md.total_volume.usd, 2),
      change24hBps: bpsFromPercent(md.price_change_percentage_24h),
      change7dBps: bpsFromPercent(md.price_change_percentage_7d_in_currency.usd),
      high24hMinorUnits: parseDecimalToMinorUnits(md.high_24h.usd, 2),
      low24hMinorUnits: parseDecimalToMinorUnits(md.low_24h.usd, 2),
      circulatingSupplyMinorUnits: parseDecimalToMinorUnits(md.circulating_supply, 8),
      totalSupplyMinorUnits: parseDecimalToMinorUnits(md.total_supply, 8),
      maxSupplyMinorUnits: parseDecimalToMinorUnits(md.max_supply, 8),
    },
  );
}

export function normalizeCoincapBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  const raw = loadCryptoFixture('coincap-btc.json') as {
    data: {
      priceUsd: string;
      marketCapUsd: string;
      volumeUsd24Hr: string;
      changePercent24Hr: string;
      supply: string;
      maxSupply: string;
    };
    timestamp: number;
  };
  const marketTimestamp = asUtcInstant(new Date(raw.timestamp).toISOString());
  return baseQuote(
    asset,
    'coincap',
    providerNativeId(asset, 'coincap') ?? 'bitcoin',
    nowUtc,
    marketTimestamp,
    parseDecimalToMinorUnits(raw.data.priceUsd, 2) ?? 0n,
    'GLOBAL_AGGREGATE',
    {
      marketCapMinorUnits: parseDecimalToMinorUnits(raw.data.marketCapUsd, 2),
      volume24hMinorUnits: parseDecimalToMinorUnits(raw.data.volumeUsd24Hr, 2),
      change24hBps: bpsFromPercent(Number(raw.data.changePercent24Hr)),
      circulatingSupplyMinorUnits: parseDecimalToMinorUnits(raw.data.supply, 8),
      maxSupplyMinorUnits: parseDecimalToMinorUnits(raw.data.maxSupply, 8),
    },
  );
}

export function normalizeCoinpaprikaBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  const raw = loadCryptoFixture('coinpaprika-btc.json') as {
    quotes: { USD: { price: number; volume_24h: number; market_cap: number; percent_change_24h: number; percent_change_7d: number } };
    last_updated: string;
  };
  const usd = raw.quotes.USD;
  return baseQuote(
    asset,
    'coinpaprika',
    providerNativeId(asset, 'coinpaprika') ?? 'btc-bitcoin',
    nowUtc,
    asUtcInstant(raw.last_updated),
    parseDecimalToMinorUnits(usd.price, 2) ?? 0n,
    'GLOBAL_AGGREGATE',
    {
      marketCapMinorUnits: parseDecimalToMinorUnits(usd.market_cap, 2),
      volume24hMinorUnits: parseDecimalToMinorUnits(usd.volume_24h, 2),
      change24hBps: bpsFromPercent(usd.percent_change_24h),
      change7dBps: bpsFromPercent(usd.percent_change_7d),
    },
  );
}

export function normalizeCoinloreBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  const raw = loadCryptoFixture('coinlore-btc.json') as {
    data: Array<{ price_usd: string; market_cap_usd: string; percent_change_24h: string; percent_change_7d: string; volume24: number }>;
  };
  const row = raw.data[0]!;
  return baseQuote(
    asset,
    'coinlore',
    providerNativeId(asset, 'coinlore') ?? '90',
    nowUtc,
    nowUtc,
    parseDecimalToMinorUnits(row.price_usd, 2) ?? 0n,
    'GLOBAL_AGGREGATE',
    {
      marketCapMinorUnits: parseDecimalToMinorUnits(row.market_cap_usd, 2),
      volume24hMinorUnits: parseDecimalToMinorUnits(row.volume24, 2),
      change24hBps: bpsFromPercent(Number(row.percent_change_24h)),
      change7dBps: bpsFromPercent(Number(row.percent_change_7d)),
    },
  );
}

export function normalizeCryptocompareBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  const raw = loadCryptoFixture('cryptocompare-btc.json') as {
    BTC: { USD: { MKTCAP: number; SUPPLY: number; TOTALVOLUME24H: number; CHANGEPCT24HOUR: number; HIGH24HOUR: number; LOW24HOUR: number } };
  };
  const usd = raw.BTC.USD;
  return baseQuote(
    asset,
    'cryptocompare',
    providerNativeId(asset, 'cryptocompare') ?? 'BTC',
    nowUtc,
    nowUtc,
    parseDecimalToMinorUnits('67234.56', 2) ?? 0n,
    'EXCHANGE_SPECIFIC',
    {
      marketCapMinorUnits: parseDecimalToMinorUnits(usd.MKTCAP, 2),
      volume24hMinorUnits: parseDecimalToMinorUnits(usd.TOTALVOLUME24H, 2),
      change24hBps: bpsFromPercent(usd.CHANGEPCT24HOUR),
      high24hMinorUnits: parseDecimalToMinorUnits(usd.HIGH24HOUR, 2),
      low24hMinorUnits: parseDecimalToMinorUnits(usd.LOW24HOUR, 2),
      circulatingSupplyMinorUnits: parseDecimalToMinorUnits(usd.SUPPLY, 8),
    },
  );
}

export function normalizeCoinmarketcapBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  const raw = loadCryptoFixture('coinmarketcap-btc.json') as {
    data: { BTC: { quote: { USD: { price: number; volume_24h: number; market_cap: number; percent_change_24h: number; percent_change_7d: number } }; last_updated: string } };
  };
  const usd = raw.data.BTC.quote.USD;
  return baseQuote(
    asset,
    'coinmarketcap',
    providerNativeId(asset, 'coinmarketcap') ?? 'BTC',
    nowUtc,
    asUtcInstant(raw.data.BTC.last_updated),
    parseDecimalToMinorUnits(usd.price, 2) ?? 0n,
    'GLOBAL_AGGREGATE',
    {
      marketCapMinorUnits: parseDecimalToMinorUnits(usd.market_cap, 2),
      volume24hMinorUnits: parseDecimalToMinorUnits(usd.volume_24h, 2),
      change24hBps: bpsFromPercent(usd.percent_change_24h),
      change7dBps: bpsFromPercent(usd.percent_change_7d),
    },
  );
}

const NORMALIZERS: Readonly<
  Record<string, (asset: RegisteredCryptoAsset, nowUtc: UtcInstant) => CryptoMarketReferenceQuote>
> = Object.freeze({
  coingecko: normalizeCoingeckoBtc,
  coincap: normalizeCoincapBtc,
  coinpaprika: normalizeCoinpaprikaBtc,
  coinlore: normalizeCoinloreBtc,
  cryptocompare: normalizeCryptocompareBtc,
  coinmarketcap: normalizeCoinmarketcapBtc,
});

export function normalizeFixtureQuote(
  providerId: string,
  assetId: string,
  nowUtc: UtcInstant,
): { readonly ok: true; readonly quote: CryptoMarketReferenceQuote } | { readonly ok: false; readonly validation: ValidationResult } {
  const asset = resolveCryptoAsset(assetId);
  if (!asset) {
    return { ok: false, validation: { ok: false, code: 'UNKNOWN_ASSET', message: `unknown asset ${assetId}` } };
  }
  const normalizer = NORMALIZERS[providerId];
  if (!normalizer) {
    return { ok: false, validation: { ok: false, code: 'UNKNOWN_PROVIDER', message: `no normalizer for ${providerId}` } };
  }
  const quote = normalizer(asset, nowUtc);
  const validation = validateQuote(quote);
  if (!validation.ok) {
    return { ok: false, validation };
  }
  return { ok: true, quote };
}

export function buildFixtureHistory(
  asset: RegisteredCryptoAsset,
  providerId: string,
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
  from: UtcInstant,
  to: UtcInstant,
  nowUtc: UtcInstant,
): readonly CryptoMarketHistoryCandle[] {
  const quoteCurrency = asset.assetId.split(':').at(-1) ?? 'USD';
  const base = normalizeFixtureQuote(providerId, asset.assetId, nowUtc);
  const close = base.ok ? base.quote.priceMinorUnits : 67_234_56n;
  const candle: CryptoMarketHistoryCandle = Object.freeze({
    assetId: asset.assetId,
    interval,
    openMinorUnits: close - 100n,
    highMinorUnits: close + 200n,
    lowMinorUnits: close - 300n,
    closeMinorUnits: close,
    volumeMinorUnits: 1_000_000_00n,
    marketCapMinorUnits: base.ok ? base.quote.marketCapMinorUnits : null,
    quoteCurrency,
    priceScale: 2,
    periodStart: from,
    periodEnd: to,
    marketTimestamp: nowUtc,
    providerId,
    provenance: provenance(providerId, providerNativeId(asset, providerId) ?? null, 'crypto_market_history', 'GLOBAL_AGGREGATE', `${asset.assetId}|${interval}`),
  });
  return Object.freeze([candle]);
}

export function buildFixtureMetadata(asset: RegisteredCryptoAsset, providerId: string, nowUtc: UtcInstant): CryptoMarketAssetMetadata {
  return Object.freeze({
    asset,
    displayName: asset.name,
    description: `${asset.name} on ${asset.network}`,
    providerId,
    retrievedAt: nowUtc,
  });
}
