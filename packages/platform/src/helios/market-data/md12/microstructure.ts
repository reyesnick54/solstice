/**
 * Microstructure feature extraction with lineage to source market events.
 */

import { HELIOS_MD12_AUTHORITY, HELIOS_MD12_SCHEMA, MD12_DEFAULT_POLICY } from './taxonomy.ts';
import type { Md12MarketEventRef, Md12MicrostructureFeature, MicrostructureState, Md12MarketEvent } from './types.ts';
import type { LiquidityState } from './types.ts';
import type { Md12LiquidityRegime } from './taxonomy.ts';

function eventRef(event: Md12MarketEvent): Md12MarketEventRef {
  return Object.freeze({
    eventId: event.eventId,
    kind: event.kind,
    sequence: event.sequence,
    venueId: event.venueId,
    providerId: event.providerId,
    sourceTimestamp: event.sourceTimestamp,
    knowableAt: event.knowableAt,
  });
}

function sumDepth(levels: readonly { readonly sizeUnits: bigint }[]): bigint {
  let total = 0n;
  for (const level of levels) {
    if (level.sizeUnits > 0n) {
      total += level.sizeUnits;
    }
  }
  return total;
}

function feature(
  name: Md12MicrostructureFeature['name'],
  input: {
    readonly knowableAt: Md12MarketEvent['knowableAt'];
    readonly lineage: readonly Md12MarketEventRef[];
    readonly valuePpm?: bigint | null;
    readonly valueMinorUnits?: bigint | null;
    readonly valueUnits?: bigint | null;
  },
): Md12MicrostructureFeature {
  return Object.freeze({
    name,
    valuePpm: input.valuePpm ?? null,
    valueMinorUnits: input.valueMinorUnits ?? null,
    valueUnits: input.valueUnits ?? null,
    knowableAt: input.knowableAt,
    lineage: Object.freeze([...input.lineage]),
  });
}

export function computeMicrostructureState(
  event: Md12MarketEvent,
  recentEvents: readonly Md12MarketEvent[],
): MicrostructureState {
  const ref = eventRef(event);
  const lineage = Object.freeze([ref]);
  const bid = event.bid?.priceMinorUnits ?? event.bookBidLevels[0]?.priceMinorUnits ?? null;
  const ask = event.ask?.priceMinorUnits ?? event.bookAskLevels[0]?.priceMinorUnits ?? null;
  const bidSize = event.bid?.sizeUnits ?? event.bookBidLevels[0]?.sizeUnits ?? 0n;
  const askSize = event.ask?.sizeUnits ?? event.bookAskLevels[0]?.sizeUnits ?? 0n;

  const spreadMinor = bid !== null && ask !== null && ask > bid ? ask - bid : null;
  const mid = bid !== null && ask !== null && ask > bid ? (bid + ask) / 2n : null;
  const relativeSpreadPpm =
    spreadMinor !== null && mid !== null && mid > 0n ? (spreadMinor * 1_000_000n) / mid : null;

  const bidDepth = sumDepth(event.bookBidLevels.length > 0 ? event.bookBidLevels : event.bid ? [event.bid] : []);
  const askDepth = sumDepth(event.bookAskLevels.length > 0 ? event.bookAskLevels : event.ask ? [event.ask] : []);
  const totalDepth = bidDepth + askDepth;
  const imbalancePpm =
    totalDepth > 0n ? ((bidDepth - askDepth) * 1_000_000n) / totalDepth : 0n;

  const micropriceMinor =
    bidSize + askSize > 0n && bid !== null && ask !== null
      ? (bid * askSize + ask * bidSize) / (bidSize + askSize)
      : mid;

  const tradeCount = recentEvents.filter((row) => row.kind === 'TRADE').length;
  const quoteCount = recentEvents.filter((row) => row.kind === 'QUOTE' || row.kind === 'BOOK_SNAPSHOT').length;
  const cancelCount = recentEvents.filter((row) => row.kind === 'CANCEL').length;
  const windowSize = BigInt(Math.max(recentEvents.length, 1));

  const tradePrices = recentEvents
    .map((row) => row.tradePriceMinorUnits)
    .filter((p): p is bigint => p !== null);
  let realizedVolPpm = 0n;
  if (tradePrices.length >= 2) {
    let max = tradePrices[0]!;
    let min = tradePrices[0]!;
    for (const px of tradePrices) {
      if (px > max) max = px;
      if (px < min) min = px;
    }
    const refPx = tradePrices[0]!;
    realizedVolPpm = refPx > 0n ? ((max - min) * 1_000_000n) / refPx : 0n;
  }

  const shortLiquidityUnits = sumDepth(
    event.bookBidLevels.slice(0, MD12_DEFAULT_POLICY.shortHorizonLiquidityDepthLevels).concat(
      event.bookAskLevels.slice(0, MD12_DEFAULT_POLICY.shortHorizonLiquidityDepthLevels),
    ),
  );

  const features = Object.freeze([
    feature('spread', { knowableAt: event.knowableAt, lineage, valueMinorUnits: spreadMinor }),
    feature('relativeSpread', { knowableAt: event.knowableAt, lineage, valuePpm: relativeSpreadPpm }),
    feature('depth', { knowableAt: event.knowableAt, lineage, valueUnits: totalDepth }),
    feature('imbalance', { knowableAt: event.knowableAt, lineage, valuePpm: imbalancePpm }),
    feature('microprice', { knowableAt: event.knowableAt, lineage, valueMinorUnits: micropriceMinor }),
    feature('orderFlowImbalance', { knowableAt: event.knowableAt, lineage, valuePpm: imbalancePpm }),
    feature('tradeIntensity', {
      knowableAt: event.knowableAt,
      lineage,
      valuePpm: (BigInt(tradeCount) * 1_000_000n) / windowSize,
    }),
    feature('quoteIntensity', {
      knowableAt: event.knowableAt,
      lineage,
      valuePpm: (BigInt(quoteCount) * 1_000_000n) / windowSize,
    }),
    feature('cancelIntensity', {
      knowableAt: event.knowableAt,
      lineage,
      valuePpm: (BigInt(cancelCount) * 1_000_000n) / windowSize,
    }),
    feature('realizedVolatility', { knowableAt: event.knowableAt, lineage, valuePpm: realizedVolPpm }),
    feature('shortHorizonLiquidity', {
      knowableAt: event.knowableAt,
      lineage,
      valueUnits: shortLiquidityUnits,
    }),
  ]);

  return Object.freeze({
    schema: HELIOS_MD12_SCHEMA,
    authority: HELIOS_MD12_AUTHORITY,
    instrumentId: event.instrumentId,
    asOf: event.knowableAt,
    features,
  });
}

export function computeLiquidityState(event: Md12MarketEvent, micro: MicrostructureState): LiquidityState {
  const ref = eventRef(event);
  const depthFeature = micro.features.find((row) => row.name === 'depth');
  const shortFeature = micro.features.find((row) => row.name === 'shortHorizonLiquidity');
  const spreadFeature = micro.features.find((row) => row.name === 'relativeSpread');

  const bidDepth = sumDepth(event.bookBidLevels.length > 0 ? event.bookBidLevels : event.bid ? [event.bid] : []);
  const askDepth = sumDepth(event.bookAskLevels.length > 0 ? event.bookAskLevels : event.ask ? [event.ask] : []);
  const depthUnits = depthFeature?.valueUnits ?? bidDepth + askDepth;
  const shortUnits = shortFeature?.valueUnits ?? 0n;
  const spreadPpm = spreadFeature?.valuePpm ?? 0n;

  let regime: Md12LiquidityRegime = 'UNKNOWN';
  if (depthUnits >= 10_000n && spreadPpm < 50_000n) {
    regime = 'DEEP';
  } else if (depthUnits >= 1_000n) {
    regime = 'NORMAL';
  } else if (depthUnits > 0n) {
    regime = 'THIN';
  } else if (spreadPpm > 200_000n) {
    regime = 'STRESSED';
  }

  const shortScorePpm =
    shortUnits > 0n && depthUnits > 0n ? (shortUnits * 1_000_000n) / depthUnits : 0n;

  return Object.freeze({
    schema: HELIOS_MD12_SCHEMA,
    authority: HELIOS_MD12_AUTHORITY,
    instrumentId: event.instrumentId,
    asOf: event.knowableAt,
    regime,
    visibleBidDepthUnits: bidDepth,
    visibleAskDepthUnits: askDepth,
    shortHorizonLiquidityScorePpm: shortScorePpm,
    lineage: Object.freeze([ref]),
  });
}
