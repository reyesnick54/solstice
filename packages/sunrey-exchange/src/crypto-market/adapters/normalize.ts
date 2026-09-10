/**
 * Normalize provider payloads into canonical crypto market quotes.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { providerNativeId, resolveCryptoAsset, type RegisteredCryptoAsset } from '../assets.ts';
import { bpsFromPercent, parseDecimalToMinorUnits, validateQuote, type ValidationResult } from '../validation.ts';
import type {
  CryptoMarketAssetMetadata,
  CryptoMarketHistoryCandle,
  CryptoMarketReferenceProvenance,
  CryptoMarketReferenceQuote,
} from '../types.ts';
import {
  parseCoingeckoQuote,
  parseCoincapQuote,
  parseCoinloreQuote,
  parseCoinpaprikaQuote,
  parseCryptocompareQuote,
} from './parsers.ts';
import { buildQuoteFromFields } from './quote-builder.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

export function loadCryptoFixture(fileName: string): unknown {
  const text = readFileSync(join(FIXTURES_DIR, fileName), 'utf8');
  return JSON.parse(text) as unknown;
}

export function normalizeCoingeckoBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  return parseCoingeckoQuote(loadCryptoFixture('coingecko-btc.json'), asset, nowUtc);
}

export function normalizeCoincapBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  return parseCoincapQuote(loadCryptoFixture('coincap-btc.json'), asset, nowUtc);
}

export function normalizeCoinpaprikaBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  return parseCoinpaprikaQuote(loadCryptoFixture('coinpaprika-btc.json'), asset, nowUtc);
}

export function normalizeCoinloreBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  return parseCoinloreQuote(loadCryptoFixture('coinlore-btc.json'), asset, nowUtc);
}

export function normalizeCryptocompareBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  return parseCryptocompareQuote(loadCryptoFixture('cryptocompare-btc.json'), asset, nowUtc);
}

export function normalizeCoinmarketcapBtc(asset: RegisteredCryptoAsset, nowUtc: UtcInstant): CryptoMarketReferenceQuote {
  const raw = loadCryptoFixture('coinmarketcap-btc.json') as {
    data: { BTC: { quote: { USD: { price: number; volume_24h: number; market_cap: number; percent_change_24h: number; percent_change_7d: number } }; last_updated: string } };
  };
  const usd = raw.data.BTC.quote.USD;
  return buildQuoteFromFields({
    asset,
    providerId: 'coinmarketcap',
    providerAssetId: providerNativeId(asset, 'coinmarketcap') ?? 'BTC',
    nowUtc,
    marketTimestamp: asUtcInstant(raw.data.BTC.last_updated),
    priceMinorUnits: parseDecimalToMinorUnits(usd.price, 2) ?? 0n,
    priceSourceType: 'GLOBAL_AGGREGATE',
    marketCapMinorUnits: parseDecimalToMinorUnits(usd.market_cap, 2),
    volume24hMinorUnits: parseDecimalToMinorUnits(usd.volume_24h, 2),
    change24hBps: bpsFromPercent(usd.percent_change_24h),
    change7dBps: bpsFromPercent(usd.percent_change_7d),
    rawMaterial: JSON.stringify(raw),
  });
}

const NORMALIZERS: Readonly<
  Record<string, (raw: unknown, asset: RegisteredCryptoAsset, nowUtc: UtcInstant) => CryptoMarketReferenceQuote>
> = Object.freeze({
  coingecko: parseCoingeckoQuote,
  coincap: parseCoincapQuote,
  coinpaprika: parseCoinpaprikaQuote,
  coinlore: parseCoinloreQuote,
  cryptocompare: parseCryptocompareQuote,
  coinmarketcap: (raw, asset, nowUtc) => {
    void raw;
    return normalizeCoinmarketcapBtc(asset, nowUtc);
  },
});

const FIXTURE_FILES: Readonly<Record<string, string>> = Object.freeze({
  coingecko: 'coingecko-btc.json',
  coincap: 'coincap-btc.json',
  coinpaprika: 'coinpaprika-btc.json',
  coinlore: 'coinlore-btc.json',
  cryptocompare: 'cryptocompare-btc.json',
  coinmarketcap: 'coinmarketcap-btc.json',
});

export function normalizeProviderQuote(
  providerId: string,
  raw: unknown,
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
  const quote = normalizer(raw, asset, nowUtc);
  const validation = validateQuote(quote);
  if (!validation.ok) {
    return { ok: false, validation };
  }
  return { ok: true, quote };
}

export function normalizeFixtureQuote(
  providerId: string,
  assetId: string,
  nowUtc: UtcInstant,
): { readonly ok: true; readonly quote: CryptoMarketReferenceQuote } | { readonly ok: false; readonly validation: ValidationResult } {
  const fixtureFile = FIXTURE_FILES[providerId];
  if (!fixtureFile) {
    return { ok: false, validation: { ok: false, code: 'UNKNOWN_PROVIDER', message: `no fixture for ${providerId}` } };
  }
  const raw = loadCryptoFixture(fixtureFile);
  return normalizeProviderQuote(providerId, raw, assetId, nowUtc);
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
  const provenance: CryptoMarketReferenceProvenance = base.ok
    ? Object.freeze({ ...base.quote.provenance, capability: 'crypto_market_history' })
    : Object.freeze({
        providerId,
        providerAssetId: providerNativeId(asset, providerId) ?? null,
        authorityClass: 'reference_data',
        sourceUrl: null,
        rawPayloadHash: null,
        observationId: `cmref_history_${providerId}`,
        capability: 'crypto_market_history',
        priceSourceType: 'GLOBAL_AGGREGATE',
      });
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
    provenance,
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
