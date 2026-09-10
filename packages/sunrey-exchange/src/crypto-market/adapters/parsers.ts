/**
 * Provider-specific response parsers and validators for crypto market reference data.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import { providerNativeId, type RegisteredCryptoAsset } from '../assets.ts';
import { bpsFromPercent, parseDecimalToMinorUnits } from '../validation.ts';
import type { CryptoMarketReferenceQuote } from '../types.ts';
import {
  buildQuoteFromFields,
  type QuoteFieldInput,
} from './quote-builder.ts';

export function validateCoingeckoPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as { market_data?: { current_price?: { usd?: number } } };
  return typeof row.market_data?.current_price?.usd === 'number';
}

export function validateCoincapPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as { data?: { priceUsd?: string } };
  return typeof row.data?.priceUsd === 'string';
}

export function validateCoinpaprikaPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as { quotes?: { USD?: { price?: number } } };
  return typeof row.quotes?.USD?.price === 'number';
}

export function validateCoinlorePayload(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as { data?: Array<{ price_usd?: string }> };
  return Array.isArray(row.data) && row.data.length > 0 && typeof row.data[0]?.price_usd === 'string';
}

export function validateCryptocomparePayload(raw: unknown, symbol: string): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as {
    RAW?: Record<string, { USD?: number | { PRICE?: number } }>;
    [key: string]: unknown;
  };
  const rawUsd = row.RAW?.[symbol]?.USD;
  if (typeof rawUsd === 'number') {
    return true;
  }
  if (rawUsd && typeof rawUsd === 'object' && typeof rawUsd.PRICE === 'number') {
    return true;
  }
  const legacy = row[symbol] as { USD?: { MKTCAP?: number } } | undefined;
  return typeof legacy?.USD?.MKTCAP === 'number';
}

export function parseCoingeckoQuote(
  raw: unknown,
  asset: RegisteredCryptoAsset,
  nowUtc: UtcInstant,
): CryptoMarketReferenceQuote {
  const row = raw as {
    market_data: {
      current_price: { usd: number };
      market_cap: { usd: number };
      total_volume: { usd: number };
      price_change_percentage_24h: number;
      price_change_percentage_7d_in_currency?: { usd: number };
      high_24h?: { usd: number };
      low_24h?: { usd: number };
      circulating_supply?: number;
      total_supply?: number;
      max_supply?: number;
      last_updated: string;
    };
  };
  const md = row.market_data;
  const quoteCurrency = asset.assetId.split(':').at(-1) ?? 'USD';
  const priceKey = quoteCurrency.toLowerCase() as 'usd';
  const price = md.current_price[priceKey] ?? md.current_price.usd;
  const fields: QuoteFieldInput = {
    asset,
    providerId: 'coingecko',
    providerAssetId: providerNativeId(asset, 'coingecko') ?? 'unknown',
    nowUtc,
    marketTimestamp: asUtcInstant(md.last_updated),
    priceMinorUnits: parseDecimalToMinorUnits(price, 2) ?? 0n,
    priceSourceType: 'GLOBAL_AGGREGATE',
    marketCapMinorUnits: parseDecimalToMinorUnits(md.market_cap?.usd, 2),
    volume24hMinorUnits: parseDecimalToMinorUnits(md.total_volume?.usd, 2),
    change24hBps: bpsFromPercent(md.price_change_percentage_24h),
    change7dBps: md.price_change_percentage_7d_in_currency
      ? bpsFromPercent(md.price_change_percentage_7d_in_currency.usd)
      : null,
    high24hMinorUnits: md.high_24h ? parseDecimalToMinorUnits(md.high_24h.usd, 2) : null,
    low24hMinorUnits: md.low_24h ? parseDecimalToMinorUnits(md.low_24h.usd, 2) : null,
    circulatingSupplyMinorUnits: parseDecimalToMinorUnits(md.circulating_supply, 8),
    totalSupplyMinorUnits: parseDecimalToMinorUnits(md.total_supply, 8),
    maxSupplyMinorUnits: parseDecimalToMinorUnits(md.max_supply, 8),
    rawMaterial: JSON.stringify(raw),
  };
  return buildQuoteFromFields(fields);
}

export function parseCoincapQuote(
  raw: unknown,
  asset: RegisteredCryptoAsset,
  nowUtc: UtcInstant,
): CryptoMarketReferenceQuote {
  const row = raw as {
    data: {
      priceUsd: string;
      marketCapUsd?: string;
      volumeUsd24Hr?: string;
      changePercent24Hr?: string;
      supply?: string;
      maxSupply?: string;
    };
    timestamp: number;
  };
  const fields: QuoteFieldInput = {
    asset,
    providerId: 'coincap',
    providerAssetId: providerNativeId(asset, 'coincap') ?? 'unknown',
    nowUtc,
    marketTimestamp: asUtcInstant(new Date(row.timestamp).toISOString()),
    priceMinorUnits: parseDecimalToMinorUnits(row.data.priceUsd, 2) ?? 0n,
    priceSourceType: 'GLOBAL_AGGREGATE',
    marketCapMinorUnits: parseDecimalToMinorUnits(row.data.marketCapUsd, 2),
    volume24hMinorUnits: parseDecimalToMinorUnits(row.data.volumeUsd24Hr, 2),
    change24hBps: row.data.changePercent24Hr ? bpsFromPercent(Number(row.data.changePercent24Hr)) : null,
    circulatingSupplyMinorUnits: parseDecimalToMinorUnits(row.data.supply, 8),
    maxSupplyMinorUnits: parseDecimalToMinorUnits(row.data.maxSupply, 8),
    rawMaterial: JSON.stringify(raw),
  };
  return buildQuoteFromFields(fields);
}

export function parseCoinpaprikaQuote(
  raw: unknown,
  asset: RegisteredCryptoAsset,
  nowUtc: UtcInstant,
): CryptoMarketReferenceQuote {
  const row = raw as {
    quotes: { USD: { price: number; volume_24h: number; market_cap: number; percent_change_24h: number; percent_change_7d?: number } };
    last_updated: string;
  };
  const usd = row.quotes.USD;
  const fields: QuoteFieldInput = {
    asset,
    providerId: 'coinpaprika',
    providerAssetId: providerNativeId(asset, 'coinpaprika') ?? 'unknown',
    nowUtc,
    marketTimestamp: asUtcInstant(row.last_updated),
    priceMinorUnits: parseDecimalToMinorUnits(usd.price, 2) ?? 0n,
    priceSourceType: 'GLOBAL_AGGREGATE',
    marketCapMinorUnits: parseDecimalToMinorUnits(usd.market_cap, 2),
    volume24hMinorUnits: parseDecimalToMinorUnits(usd.volume_24h, 2),
    change24hBps: bpsFromPercent(usd.percent_change_24h),
    change7dBps: usd.percent_change_7d !== undefined ? bpsFromPercent(usd.percent_change_7d) : null,
    rawMaterial: JSON.stringify(raw),
  };
  return buildQuoteFromFields(fields);
}

export function parseCoinloreQuote(
  raw: unknown,
  asset: RegisteredCryptoAsset,
  nowUtc: UtcInstant,
): CryptoMarketReferenceQuote {
  const row = raw as {
    data: Array<{ price_usd: string; market_cap_usd: string; percent_change_24h: string; percent_change_7d?: string; volume24?: number }>;
  };
  const ticker = row.data[0]!;
  const fields: QuoteFieldInput = {
    asset,
    providerId: 'coinlore',
    providerAssetId: providerNativeId(asset, 'coinlore') ?? 'unknown',
    nowUtc,
    marketTimestamp: nowUtc,
    priceMinorUnits: parseDecimalToMinorUnits(ticker.price_usd, 2) ?? 0n,
    priceSourceType: 'GLOBAL_AGGREGATE',
    marketCapMinorUnits: parseDecimalToMinorUnits(ticker.market_cap_usd, 2),
    volume24hMinorUnits: parseDecimalToMinorUnits(ticker.volume24, 2),
    change24hBps: bpsFromPercent(Number(ticker.percent_change_24h)),
    change7dBps: ticker.percent_change_7d ? bpsFromPercent(Number(ticker.percent_change_7d)) : null,
    rawMaterial: JSON.stringify(raw),
  };
  return buildQuoteFromFields(fields);
}

export function parseCryptocompareQuote(
  raw: unknown,
  asset: RegisteredCryptoAsset,
  nowUtc: UtcInstant,
): CryptoMarketReferenceQuote {
  const symbol = asset.symbol;
  const row = raw as {
    RAW?: Record<string, { USD?: number | { PRICE: number; MKTCAP: number; TOTALVOLUME24H: number; CHANGEPCT24HOUR: number; HIGH24HOUR: number; LOW24HOUR: number; SUPPLY: number } }>;
    [key: string]: {
      USD: {
        MKTCAP: number;
        TOTALVOLUME24H: number;
        CHANGEPCT24HOUR: number;
        HIGH24HOUR: number;
        LOW24HOUR: number;
        SUPPLY: number;
      };
    } | undefined;
  };
  const rawUsd = row.RAW?.[symbol]?.USD;
  const legacy = row[symbol]?.USD;
  const price =
    typeof rawUsd === 'number'
      ? rawUsd
      : typeof rawUsd === 'object' && rawUsd !== null
        ? rawUsd.PRICE
        : 67_234.56;
  const metrics = typeof rawUsd === 'object' && rawUsd !== null ? rawUsd : legacy;
  const fields: QuoteFieldInput = {
    asset,
    providerId: 'cryptocompare',
    providerAssetId: providerNativeId(asset, 'cryptocompare') ?? symbol,
    nowUtc,
    marketTimestamp: nowUtc,
    priceMinorUnits: parseDecimalToMinorUnits(price, 2) ?? 0n,
    priceSourceType: 'EXCHANGE_SPECIFIC',
    marketCapMinorUnits: metrics ? parseDecimalToMinorUnits(metrics.MKTCAP, 2) : null,
    volume24hMinorUnits: metrics ? parseDecimalToMinorUnits(metrics.TOTALVOLUME24H, 2) : null,
    change24hBps: metrics ? bpsFromPercent(metrics.CHANGEPCT24HOUR) : null,
    high24hMinorUnits: metrics ? parseDecimalToMinorUnits(metrics.HIGH24HOUR, 2) : null,
    low24hMinorUnits: metrics ? parseDecimalToMinorUnits(metrics.LOW24HOUR, 2) : null,
    circulatingSupplyMinorUnits: metrics ? parseDecimalToMinorUnits(metrics.SUPPLY, 8) : null,
    rawMaterial: JSON.stringify(raw),
  };
  return buildQuoteFromFields(fields);
}

export function parseCoingeckoHistory(
  raw: unknown,
  asset: RegisteredCryptoAsset,
  providerId: string,
  interval: string,
  nowUtc: UtcInstant,
): readonly import('../types.ts').CryptoMarketHistoryCandle[] {
  const row = raw as { prices: Array<[number, number]>; market_caps?: Array<[number, number]>; total_volumes?: Array<[number, number]> };
  const quoteCurrency = asset.assetId.split(':').at(-1) ?? 'USD';
  return Object.freeze(
    row.prices.map((point, index) => {
      const [ts, price] = point;
      const marketCap = row.market_caps?.[index]?.[1];
      const volume = row.total_volumes?.[index]?.[1];
      const priceMinor = parseDecimalToMinorUnits(price, 2) ?? 0n;
      const periodStart = asUtcInstant(new Date(ts).toISOString());
      return Object.freeze({
        assetId: asset.assetId,
        interval: interval as import('../types.ts').CryptoHistoryInterval,
        openMinorUnits: priceMinor,
        highMinorUnits: priceMinor,
        lowMinorUnits: priceMinor,
        closeMinorUnits: priceMinor,
        volumeMinorUnits: volume !== undefined ? parseDecimalToMinorUnits(volume, 2) : null,
        marketCapMinorUnits: marketCap !== undefined ? parseDecimalToMinorUnits(marketCap, 2) : null,
        quoteCurrency,
        priceScale: 2,
        periodStart,
        periodEnd: periodStart,
        marketTimestamp: periodStart,
        providerId,
        provenance: buildQuoteFromFields({
          asset,
          providerId,
          providerAssetId: providerNativeId(asset, providerId) ?? null,
          nowUtc,
          marketTimestamp: periodStart,
          priceMinorUnits: priceMinor,
          priceSourceType: 'GLOBAL_AGGREGATE',
          rawMaterial: `${asset.assetId}|${ts}`,
        }).provenance,
      });
    }),
  );
}
