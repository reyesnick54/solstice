/**
 * Deterministic anomaly detection for MD12 market events.
 */

import type { UtcInstant } from '@solstice/domain';

import { HELIOS_MD12_AUTHORITY, HELIOS_MD12_SCHEMA, MD12_DEFAULT_POLICY } from './taxonomy.ts';
import type {
  Md12AnomalyClassification,
  Md12AnomalyKind,
} from './taxonomy.ts';
import { md12AnomalyId } from './store.ts';
import type { MarketDataAnomaly, Md12MarketEvent } from './types.ts';

export type Md12DetectionContext = {
  readonly now: UtcInstant;
  readonly priorSequence: bigint | null;
  readonly priorSourceTimestamp: UtcInstant | null;
  readonly priorKnowableAt: UtcInstant | null;
  readonly priorTradeFingerprints: ReadonlySet<string>;
  readonly referenceMidMinorUnits: bigint | null;
  readonly alternateProviderMidMinorUnits?: bigint | null;
  readonly alternateVenueMidMinorUnits?: bigint | null;
  readonly staleQuoteMs?: number;
};

const DEFAULT_CLASSIFICATION: Record<Md12AnomalyKind, Md12AnomalyClassification> = {
  STALE_QUOTE: 'LIKELY_DATA_ERROR',
  CROSSED_BOOK: 'LIKELY_DATA_ERROR',
  LOCKED_BOOK: 'AMBIGUOUS',
  ZERO_SIZE: 'LIKELY_DATA_ERROR',
  IMPOSSIBLE_PRICE: 'UNTRUSTED',
  PRICE_SPIKE: 'AMBIGUOUS',
  DUPLICATE_TRADE: 'LIKELY_DATA_ERROR',
  TRADE_OUTSIDE_PLAUSIBLE_MARKET: 'LIKELY_DATA_ERROR',
  SEQUENCE_DISCONTINUITY: 'LIKELY_DATA_ERROR',
  LATENCY_SPIKE: 'AMBIGUOUS',
  TIMESTAMP_REVERSAL: 'UNTRUSTED',
  PROVIDER_DIVERGENCE: 'AMBIGUOUS',
  VENUE_DIVERGENCE: 'AMBIGUOUS',
};

function buildAnomaly(
  event: Md12MarketEvent,
  kind: Md12AnomalyKind,
  summary: string,
  detectedAt: UtcInstant,
  relatedEventIds: readonly string[] = [],
  classification?: Md12AnomalyClassification,
): MarketDataAnomaly {
  const anomalyId = md12AnomalyId(`${kind}|${event.eventId}|${summary}`);
  return Object.freeze({
    schema: HELIOS_MD12_SCHEMA,
    authority: HELIOS_MD12_AUTHORITY,
    anomalyId,
    kind,
    classification: classification ?? DEFAULT_CLASSIFICATION[kind],
    instrumentId: event.instrumentId,
    detectedAt,
    knowableAt: event.knowableAt,
    summary,
    sourceEvent: Object.freeze({
      eventId: event.eventId,
      kind: event.kind,
      sequence: event.sequence,
      venueId: event.venueId,
      providerId: event.providerId,
      sourceTimestamp: event.sourceTimestamp,
      knowableAt: event.knowableAt,
    }),
    relatedEventIds: Object.freeze([...relatedEventIds]),
    superseded: false,
    retired: false,
  });
}

function instantMs(iso: UtcInstant): number {
  return Date.parse(iso);
}

function crossedOrLocked(
  bid: bigint | null,
  ask: bigint | null,
): 'CROSSED_BOOK' | 'LOCKED_BOOK' | null {
  if (bid === null || ask === null) {
    return null;
  }
  if (bid > ask) {
    return 'CROSSED_BOOK';
  }
  if (bid === ask) {
    return 'LOCKED_BOOK';
  }
  return null;
}

function ppmDelta(a: bigint, b: bigint): bigint {
  if (b <= 0n) {
    return 0n;
  }
  const diff = a >= b ? a - b : b - a;
  return (diff * 1_000_000n) / b;
}

export function detectMarketDataAnomalies(
  event: Md12MarketEvent,
  ctx: Md12DetectionContext,
): readonly MarketDataAnomaly[] {
  const staleMs = ctx.staleQuoteMs ?? MD12_DEFAULT_POLICY.staleQuoteMs;
  const out: MarketDataAnomaly[] = [];

  const ageMs = instantMs(ctx.now) - instantMs(event.sourceTimestamp);
  if (event.kind === 'QUOTE' && ageMs > staleMs) {
    out.push(buildAnomaly(event, 'STALE_QUOTE', `quote age ${ageMs}ms exceeds ${staleMs}ms`, ctx.now));
  }

  const bidPx = event.bid?.priceMinorUnits ?? event.bookBidLevels[0]?.priceMinorUnits ?? null;
  const askPx = event.ask?.priceMinorUnits ?? event.bookAskLevels[0]?.priceMinorUnits ?? null;
  const bookKind = crossedOrLocked(bidPx, askPx);
  if (bookKind !== null) {
    out.push(buildAnomaly(event, bookKind, `bid ${bidPx} / ask ${askPx}`, ctx.now));
  }

  const zeroBid = event.bid !== null && event.bid.sizeUnits <= 0n;
  const zeroAsk = event.ask !== null && event.ask.sizeUnits <= 0n;
  const zeroTrade = event.kind === 'TRADE' && (event.tradeSizeUnits ?? 0n) <= 0n;
  if (zeroBid || zeroAsk || zeroTrade) {
    out.push(buildAnomaly(event, 'ZERO_SIZE', 'non-positive size on quote/trade', ctx.now));
  }

  const prices = [
    bidPx,
    askPx,
    event.tradePriceMinorUnits,
    ...event.bookBidLevels.map((l) => l.priceMinorUnits),
    ...event.bookAskLevels.map((l) => l.priceMinorUnits),
  ].filter((p): p is bigint => p !== null);
  if (prices.some((p) => p <= 0n)) {
    out.push(buildAnomaly(event, 'IMPOSSIBLE_PRICE', 'non-positive price', ctx.now));
  }

  const refMid = ctx.referenceMidMinorUnits ?? event.referenceMidMinorUnits ?? event.priorMidMinorUnits;
  const spikePx = event.tradePriceMinorUnits ?? bidPx ?? askPx;
  if (refMid !== null && spikePx !== null && refMid > 0n) {
    const deltaPpm = ppmDelta(spikePx, refMid);
    if (deltaPpm >= BigInt(MD12_DEFAULT_POLICY.priceSpikePpm)) {
      out.push(
        buildAnomaly(
          event,
          'PRICE_SPIKE',
          `move ${deltaPpm}ppm vs reference mid`,
          ctx.now,
        ),
      );
    }
  }

  if (event.kind === 'TRADE' && event.duplicateTradeFingerprint) {
    if (ctx.priorTradeFingerprints.has(event.duplicateTradeFingerprint)) {
      out.push(buildAnomaly(event, 'DUPLICATE_TRADE', 'duplicate trade fingerprint', ctx.now));
    }
  }

  if (event.kind === 'TRADE' && event.tradePriceMinorUnits !== null && bidPx !== null && askPx !== null) {
    const px = event.tradePriceMinorUnits;
    const outside = px < bidPx || px > askPx;
    if (outside) {
      out.push(
        buildAnomaly(
          event,
          'TRADE_OUTSIDE_PLAUSIBLE_MARKET',
          `trade ${px} outside [${bidPx}, ${askPx}]`,
          ctx.now,
        ),
      );
    }
  }

  if (event.sequence !== null && ctx.priorSequence !== null && event.sequence !== ctx.priorSequence + 1n) {
    out.push(
      buildAnomaly(
        event,
        'SEQUENCE_DISCONTINUITY',
        `sequence ${event.sequence} after ${ctx.priorSequence}`,
        ctx.now,
      ),
    );
  }

  if (event.ingestLatencyMs > MD12_DEFAULT_POLICY.latencySpikeMs) {
    out.push(
      buildAnomaly(
        event,
        'LATENCY_SPIKE',
        `ingest latency ${event.ingestLatencyMs}ms`,
        ctx.now,
      ),
    );
  }

  if (ctx.priorSourceTimestamp !== null && instantMs(event.sourceTimestamp) < instantMs(ctx.priorSourceTimestamp)) {
    out.push(buildAnomaly(event, 'TIMESTAMP_REVERSAL', 'source timestamp moved backward', ctx.now));
  }
  if (ctx.priorKnowableAt !== null && instantMs(event.knowableAt) < instantMs(ctx.priorKnowableAt)) {
    out.push(buildAnomaly(event, 'TIMESTAMP_REVERSAL', 'knowableAt moved backward', ctx.now));
  }

  const eventMid =
    bidPx !== null && askPx !== null && askPx > bidPx ? (bidPx + askPx) / 2n : spikePx ?? refMid;
  const altProviderMid = ctx.alternateProviderMidMinorUnits ?? null;
  const altVenueMid = ctx.alternateVenueMidMinorUnits ?? null;
  if (eventMid !== null && eventMid > 0n) {
    if (altProviderMid !== null) {
      const div = ppmDelta(eventMid, altProviderMid);
      if (div >= 50_000n) {
        out.push(buildAnomaly(event, 'PROVIDER_DIVERGENCE', `provider mid divergence ${div}ppm`, ctx.now));
      }
    }
    if (altVenueMid !== null) {
      const div = ppmDelta(eventMid, altVenueMid);
      if (div >= 50_000n) {
        out.push(buildAnomaly(event, 'VENUE_DIVERGENCE', `venue mid divergence ${div}ppm`, ctx.now));
      }
    }
  }

  return Object.freeze(out);
}
