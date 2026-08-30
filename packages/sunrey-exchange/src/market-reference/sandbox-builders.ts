/**
 * Pure synchronous quote builders for sandbox/BFF use.
 */

import { createHash } from 'node:crypto';

import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { MOONREY_COIN_NATIVE_ASSET_ID, SUNREY_COIN_NATIVE_ASSET_ID } from '../ids.ts';
import { commodityAssetId, resolveMarketAsset, type RegisteredMarketAsset } from './assets.ts';
import { defaultCommodityUnit } from './units.ts';
import type {
  CommodityCode,
  CommodityPriceObservation,
  HistoryInterval,
  MarketHistoryCandle,
  MarketReferenceAssetMetadata,
  MarketReferenceFreshness,
  MarketReferenceProvenance,
  MarketReferenceQuote,
} from './types.ts';
import { MARKET_REFERENCE_AUTHORITY, MARKET_REFERENCE_SCHEMA } from './types.ts';

export const SANDBOX_PROVIDER_ID = 'sunrey-market-reference-simulation';

const COMMODITY_BASE_PRICES: Readonly<Record<CommodityCode, bigint>> = Object.freeze({
  gold: 2_350_00n,
  silver: 28_50n,
  copper: 4_12n,
});

const SECURITY_BASE_PRICES: Readonly<Record<string, bigint>> = Object.freeze({
  'SIM-ETF-1': 125_43n,
  [SUNREY_COIN_NATIVE_ASSET_ID]: 1_00n,
  [MOONREY_COIN_NATIVE_ASSET_ID]: 50n,
});

function observationId(material: string): string {
  return `mref_${createHash('sha256').update(`${SANDBOX_PROVIDER_ID}|${material}`).digest('hex').slice(0, 24)}`;
}

function freshness(nowUtc: UtcInstant, marketTimestamp: UtcInstant): MarketReferenceFreshness {
  const ageMs = BigInt(Math.max(0, Date.parse(nowUtc) - Date.parse(marketTimestamp)));
  let status: MarketReferenceFreshness['status'] = 'fresh';
  if (ageMs > 600_000n) status = 'expired';
  else if (ageMs > 120_000n) status = 'stale';
  else if (ageMs > 30_000n) status = 'aging';
  return Object.freeze({ status, ageMs, assessedAt: nowUtc });
}

function provenance(capability: string, material: string): MarketReferenceProvenance {
  return Object.freeze({
    providerId: SANDBOX_PROVIDER_ID,
    authorityClass: 'reference_data',
    sourceUrl: null,
    rawPayloadHash: null,
    observationId: observationId(material),
    capability,
  });
}

export function buildSandboxQuote(asset: RegisteredMarketAsset, nowUtc: UtcInstant): MarketReferenceQuote {
  const base =
    asset.commodityCode !== null
      ? COMMODITY_BASE_PRICES[asset.commodityCode]
      : (SECURITY_BASE_PRICES[asset.assetId] ?? 100_00n);
  const priceMinorUnits = base + BigInt(nowUtc.slice(17, 19));
  return Object.freeze({
    schema: MARKET_REFERENCE_SCHEMA,
    authority: MARKET_REFERENCE_AUTHORITY,
    assetId: asset.assetId,
    asset,
    symbol: asset.symbol,
    venue: asset.venue,
    priceMinorUnits,
    currency: asset.currency ?? 'USD',
    priceScale: 2,
    bidMinorUnits: priceMinorUnits - 1n,
    askMinorUnits: priceMinorUnits + 1n,
    midMinorUnits: priceMinorUnits,
    openMinorUnits: base,
    highMinorUnits: priceMinorUnits + 5n,
    lowMinorUnits: priceMinorUnits - 5n,
    closeMinorUnits: priceMinorUnits,
    volumeUnits: 1_000_000n,
    previousCloseMinorUnits: base,
    changeMinorUnits: priceMinorUnits - base,
    changePercentBps: base > 0n ? ((priceMinorUnits - base) * 10_000n) / base : 0n,
    marketTimestamp: nowUtc,
    retrievedAt: nowUtc,
    providerId: SANDBOX_PROVIDER_ID,
    freshness: freshness(nowUtc, nowUtc),
    provenance: provenance('market_prices', asset.assetId),
  });
}

export function buildSandboxCommodityObservation(commodity: CommodityCode, nowUtc: UtcInstant): CommodityPriceObservation {
  const assetId = commodityAssetId(commodity);
  if (!assetId) {
    throw new Error(`unknown commodity ${commodity}`);
  }
  const asset = resolveMarketAsset(assetId)!;
  const quote = buildSandboxQuote(asset, nowUtc);
  const unit = defaultCommodityUnit(commodity);
  return Object.freeze({
    schema: MARKET_REFERENCE_SCHEMA,
    authority: MARKET_REFERENCE_AUTHORITY,
    commodity,
    priceMinorUnits: quote.priceMinorUnits,
    currency: quote.currency,
    priceScale: quote.priceScale,
    unit,
    normalizedUnit: null,
    normalizedPriceMinorUnits: null,
    unitTransformation: null,
    marketReference: asset.venue?.displayName ?? 'reference',
    effectiveTime: quote.marketTimestamp,
    retrievedAt: nowUtc,
    providerId: SANDBOX_PROVIDER_ID,
    freshness: quote.freshness,
    provenance: provenance('commodity_prices', commodity),
  });
}

export function buildSandboxHistory(
  assetId: string,
  interval: HistoryInterval,
  from: UtcInstant,
  to: UtcInstant,
  nowUtc: UtcInstant,
): readonly MarketHistoryCandle[] {
  const asset = resolveMarketAsset(assetId);
  if (!asset) {
    throw new Error(`unknown asset ${assetId}`);
  }
  const quote = buildSandboxQuote(asset, nowUtc);
  return Object.freeze([
    Object.freeze({
      assetId,
      interval,
      timezone: 'UTC',
      openMinorUnits: quote.openMinorUnits ?? quote.priceMinorUnits,
      highMinorUnits: quote.highMinorUnits ?? quote.priceMinorUnits,
      lowMinorUnits: quote.lowMinorUnits ?? quote.priceMinorUnits,
      closeMinorUnits: quote.closeMinorUnits ?? quote.priceMinorUnits,
      volumeUnits: quote.volumeUnits,
      currency: quote.currency,
      priceScale: quote.priceScale,
      adjustmentStatus: 'unadjusted' as const,
      periodStart: from,
      periodEnd: to,
      marketTimestamp: quote.marketTimestamp,
      providerId: SANDBOX_PROVIDER_ID,
      provenance: provenance('market_history', `${assetId}|${interval}`),
    }),
  ]);
}

export function buildSandboxAssetMetadata(assetId: string, nowUtc: UtcInstant): MarketReferenceAssetMetadata {
  const asset = resolveMarketAsset(assetId);
  if (!asset) {
    throw new Error(`unknown asset ${assetId}`);
  }
  return Object.freeze({
    asset,
    displayName: asset.displayName,
    assetClass: asset.assetClass,
    description: null,
    providerId: SANDBOX_PROVIDER_ID,
    retrievedAt: nowUtc,
  });
}

export const DEFAULT_MARKET_REFERENCE_NOW = asUtcInstant('2026-08-21T09:00:00.000Z');

export function syncExecutionSeparationProof() {
  return Object.freeze({
    referenceOnly: true,
    mutatesExchangeOrderBook: false,
    mutatesLedger: false,
    issuesExecutionAuthority: false,
    mutatesMoonReyIssuance: false,
    agentCanTradeDirectly: false,
  });
}
