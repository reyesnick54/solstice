/**
 * OHLCV bars derived from immutable underlying observations (never replaces ticks).
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { sha256Hex } from './fingerprint.ts';
import type { DerivedOhlcvBar, NormalizedMarketEventRecord } from './types.ts';
import { MD11_BAR_BUILDER_VERSION } from './types.ts';

export type BarBuildRegistry = ReadonlyMap<string, DerivedOhlcvBar>;

export type BarBuildResult = Readonly<{
  readonly bars: readonly DerivedOhlcvBar[];
  readonly barBuilderVersion: typeof MD11_BAR_BUILDER_VERSION;
  readonly registry: BarBuildRegistry;
}>;

type ParsedTrade = Readonly<{
  readonly eventId: string;
  readonly instrument: string;
  readonly venue: string;
  readonly exchangeTime: UtcInstant;
  readonly priceMinorUnits: bigint;
  readonly quantityMinorUnits: bigint;
}>;

function parseTrade(event: NormalizedMarketEventRecord): ParsedTrade | null {
  if (event.heliosKind !== 'trade') return null;
  try {
    const body = JSON.parse(event.normalizedBody) as {
      priceMinorUnits?: string;
      quantityMinorUnits?: string;
    };
    if (!body.priceMinorUnits || !body.quantityMinorUnits) return null;
    return Object.freeze({
      eventId: event.eventId,
      instrument: event.index.instrument,
      venue: event.index.venue,
      exchangeTime: event.index.exchangeTime,
      priceMinorUnits: BigInt(body.priceMinorUnits),
      quantityMinorUnits: BigInt(body.quantityMinorUnits),
    });
  } catch {
    return null;
  }
}

function minuteBucketStart(exchangeTime: UtcInstant): UtcInstant {
  const ms = Date.parse(exchangeTime);
  const floored = Math.floor(ms / 60_000) * 60_000;
  return new Date(floored).toISOString() as UtcInstant;
}

function minuteBucketEnd(start: UtcInstant): UtcInstant {
  const ms = Date.parse(start) + 60_000 - 1;
  return new Date(ms).toISOString() as UtcInstant;
}

export function buildOhlcvBarsFromTrades(input: {
  readonly trades: readonly NormalizedMarketEventRecord[];
  readonly barRegistry?: BarBuildRegistry;
  readonly barBuilderVersion?: typeof MD11_BAR_BUILDER_VERSION;
}): BarBuildResult {
  const version = input.barBuilderVersion ?? MD11_BAR_BUILDER_VERSION;
  const registry = new Map<string, DerivedOhlcvBar>(input.barRegistry ?? []);

  const groups = new Map<string, ParsedTrade[]>();
  for (const tradeEvent of input.trades) {
    const trade = parseTrade(tradeEvent);
    if (!trade) continue;
    const periodStart = minuteBucketStart(trade.exchangeTime);
    const key = `${trade.instrument}|${trade.venue}|${periodStart}`;
    const list = groups.get(key) ?? [];
    list.push(trade);
    groups.set(key, list);
  }

  const newBars: DerivedOhlcvBar[] = [];

  for (const [key, trades] of groups) {
    if (registry.has(key)) {
      continue;
    }
    trades.sort((a, b) => Date.parse(a.exchangeTime) - Date.parse(b.exchangeTime));
    const periodStart = minuteBucketStart(trades[0]!.exchangeTime);
    const periodEnd = minuteBucketEnd(periodStart);
    let high = trades[0]!.priceMinorUnits;
    let low = trades[0]!.priceMinorUnits;
    let volume = 0n;
    for (const t of trades) {
      if (t.priceMinorUnits > high) high = t.priceMinorUnits;
      if (t.priceMinorUnits < low) low = t.priceMinorUnits;
      volume += t.quantityMinorUnits;
    }
    const barId = sha256Hex([key, version, trades.map((t) => t.eventId).join(',')]);
    const bar: DerivedOhlcvBar = Object.freeze({
      schema: 'sunrey.helios.market-data.md11.v1',
      barId,
      instrument: trades[0]!.instrument,
      venue: trades[0]!.venue,
      timeframe: '1m',
      periodStart,
      periodEnd,
      openMinorUnits: trades[0]!.priceMinorUnits,
      highMinorUnits: high,
      lowMinorUnits: low,
      closeMinorUnits: trades[trades.length - 1]!.priceMinorUnits,
      volumeMinorUnits: volume,
      barBuilderVersion: version,
      sourceObservationIds: Object.freeze(trades.map((t) => t.eventId)),
      immutable: true,
    });
    registry.set(key, bar);
    newBars.push(bar);
  }

  return Object.freeze({
    bars: Object.freeze(newBars),
    barBuilderVersion: version,
    registry,
  });
}

/** Revised bar-builder versions do not rewrite bars already pinned in the registry. */
export function barRegistryBlocksSilentRewrite(
  priorRegistry: BarBuildRegistry,
  revisedBuild: BarBuildResult,
): boolean {
  for (const [key, prior] of priorRegistry) {
    const next = revisedBuild.registry.get(key);
    if (!next) continue;
    if (prior.barBuilderVersion !== next.barBuilderVersion) {
      if (prior.barId !== next.barId) {
        return false;
      }
    }
  }
  return true;
}
