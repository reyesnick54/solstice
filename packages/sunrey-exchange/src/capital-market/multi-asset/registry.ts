/**
 * HELIOS M01 canonical multi-asset instrument registry.
 */

import type { CapitalMarketAssetClass } from '../types.ts';
import { buildCanonicalInstrumentId } from './id.ts';
import { ENGINEERING_UNIVERSE_INSTRUMENTS } from './universe.ts';
import {
  type CanonicalMultiAssetInstrument,
  type InstrumentCapability,
  type InstrumentCapabilityLevel,
  type MultiAssetClass,
  type MultiAssetInstrumentSearchFilter,
  type ProviderInstrumentMapping,
} from './types.ts';
import { validateMultiAssetInstrument } from './validation.ts';

const byId = new Map<string, CanonicalMultiAssetInstrument>();
const byTickerVenue = new Map<string, CanonicalMultiAssetInstrument>();
const byProvider = new Map<string, CanonicalMultiAssetInstrument>();
const byAssetClass = new Map<MultiAssetClass, CanonicalMultiAssetInstrument[]>();
const byUnderlying = new Map<string, CanonicalMultiAssetInstrument[]>();

for (const record of ENGINEERING_UNIVERSE_INSTRUMENTS) {
  const validation = validateMultiAssetInstrument(record);
  if (!validation.ok) {
    throw new Error(`invalid engineering universe instrument ${record.instrumentId}: ${validation.message}`);
  }
  byId.set(record.instrumentId, record);
  byTickerVenue.set(`${record.symbol}@${record.venue.venueId}`, record);
  for (const mapping of record.providerMappings) {
    byProvider.set(`${mapping.providerId}:${mapping.symbol}`, record);
    if (mapping.nativeId) {
      byProvider.set(`${mapping.providerId}:native:${mapping.nativeId}`, record);
    }
  }
  const classRows = byAssetClass.get(record.assetClass) ?? [];
  classRows.push(record);
  byAssetClass.set(record.assetClass, classRows);
  if (record.underlyingInstrumentId) {
    const underlyingRows = byUnderlying.get(record.underlyingInstrumentId) ?? [];
    underlyingRows.push(record);
    byUnderlying.set(record.underlyingInstrumentId, underlyingRows);
  }
}

export const REGISTERED_MULTI_ASSET_INSTRUMENTS: readonly CanonicalMultiAssetInstrument[] =
  ENGINEERING_UNIVERSE_INSTRUMENTS;

export function resolveMultiAssetInstrument(instrumentId: string): CanonicalMultiAssetInstrument | undefined {
  return byId.get(instrumentId);
}

export function resolveMultiAssetInstrumentByTickerVenue(
  ticker: string,
  venueId: string,
): CanonicalMultiAssetInstrument | undefined {
  return byTickerVenue.get(`${ticker.toUpperCase()}@${venueId.toUpperCase()}`);
}

export function resolveMultiAssetProviderMapping(
  providerId: string,
  providerSymbol: string,
): CanonicalMultiAssetInstrument | undefined {
  return byProvider.get(`${providerId}:${providerSymbol}`);
}

export function resolveMultiAssetProviderNativeId(
  providerId: string,
  nativeId: string,
): CanonicalMultiAssetInstrument | undefined {
  return byProvider.get(`${providerId}:native:${nativeId}`);
}

export function filterMultiAssetInstrumentsByAssetClass(
  assetClass: MultiAssetClass | readonly MultiAssetClass[],
): readonly CanonicalMultiAssetInstrument[] {
  const classes = Array.isArray(assetClass) ? assetClass : [assetClass];
  return Object.freeze(classes.flatMap((row) => byAssetClass.get(row) ?? []));
}

export function resolveMultiAssetUnderlyingDependents(
  underlyingInstrumentId: string,
): readonly CanonicalMultiAssetInstrument[] {
  return Object.freeze(byUnderlying.get(underlyingInstrumentId) ?? []);
}

export function resolveMultiAssetUnderlyingChain(
  instrumentId: string,
): readonly CanonicalMultiAssetInstrument[] {
  const chain: CanonicalMultiAssetInstrument[] = [];
  let current = resolveMultiAssetInstrument(instrumentId);
  while (current?.underlyingInstrumentId) {
    const underlying = resolveMultiAssetInstrument(current.underlyingInstrumentId);
    if (!underlying) {
      break;
    }
    chain.push(underlying);
    current = underlying;
  }
  return Object.freeze(chain);
}

export function determineMultiAssetMarketDataCapability(
  instrumentId: string,
): InstrumentCapabilityLevel | null {
  const record = resolveMultiAssetInstrument(instrumentId);
  if (!record || record.status === 'INACTIVE') {
    return null;
  }
  return record.capability.marketData;
}

export function determineMultiAssetExecutionCapability(
  instrumentId: string,
): InstrumentCapabilityLevel | null {
  const record = resolveMultiAssetInstrument(instrumentId);
  if (!record || record.status === 'INACTIVE') {
    return null;
  }
  return record.capability.execution;
}

export function hasMultiAssetMarketDataCapability(instrumentId: string): boolean {
  const level = determineMultiAssetMarketDataCapability(instrumentId);
  return level !== null && level !== 'NONE';
}

export function hasMultiAssetExecutionCapability(instrumentId: string): boolean {
  const level = determineMultiAssetExecutionCapability(instrumentId);
  return level !== null && level !== 'NONE';
}

export function searchMultiAssetInstruments(
  filter: MultiAssetInstrumentSearchFilter = {},
): readonly CanonicalMultiAssetInstrument[] {
  const limit = filter.limit ?? 50;
  let rows = [...REGISTERED_MULTI_ASSET_INSTRUMENTS];

  if (filter.assetClass !== undefined) {
    const classes = Array.isArray(filter.assetClass) ? filter.assetClass : [filter.assetClass];
    rows = rows.filter((row) => classes.includes(row.assetClass));
  }
  if (filter.jurisdiction) {
    const jurisdiction = filter.jurisdiction.toUpperCase();
    rows = rows.filter((row) => row.jurisdiction === jurisdiction);
  }
  if (filter.venueId) {
    const venueId = filter.venueId.toUpperCase();
    rows = rows.filter((row) => row.venue.venueId === venueId);
  }
  if (filter.status) {
    rows = rows.filter((row) => row.status === filter.status);
  }
  if (filter.query?.trim()) {
    const normalized = filter.query.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.instrumentId.toLowerCase().includes(normalized) ||
        row.symbol.toLowerCase().includes(normalized) ||
        row.displayName.toLowerCase().includes(normalized) ||
        row.venue.venueId.toLowerCase().includes(normalized) ||
        (row.baseAsset?.toLowerCase().includes(normalized) ?? false) ||
        (row.quoteAsset?.toLowerCase().includes(normalized) ?? false),
    );
  }

  return Object.freeze(rows.slice(0, limit));
}

export function serializeMultiAssetInstrument(record: CanonicalMultiAssetInstrument): string {
  return JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
}

export function providerSymbolsRecord(
  mappings: readonly ProviderInstrumentMapping[],
): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(mappings.map((row) => [row.providerId, row.symbol])));
}

export function toCapitalMarketAssetClass(assetClass: MultiAssetClass): CapitalMarketAssetClass {
  switch (assetClass) {
    case 'EQUITY':
      return 'equity';
    case 'ETF':
      return 'etf';
    case 'INDEX':
      return 'index';
    case 'COMMODITY':
      return 'commodity';
    case 'FX_SPOT':
      return 'fx';
    case 'CRYPTO_SPOT':
      return 'other';
    case 'FUTURE':
      return 'other';
    case 'CASH':
      return 'other';
    default:
      return 'other';
  }
}

export function buildMultiAssetInstrumentId(input: Parameters<typeof buildCanonicalInstrumentId>[0]): string {
  return buildCanonicalInstrumentId(input);
}

export function getMultiAssetInstrumentCapability(instrumentId: string): InstrumentCapability | null {
  const record = resolveMultiAssetInstrument(instrumentId);
  return record ? record.capability : null;
}
