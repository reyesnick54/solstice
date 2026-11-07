/**
 * MD02 latency — wall-clock segments plus optional monotonic internal measurement.
 */

import type { MarketTimeEnvelope, MarketTimeLatencyResult } from './types.ts';

function wallDeltaMs(startMs: number, endMs: number): number | { readonly negative: true; readonly value: number } {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { negative: true, value: NaN };
  }
  const delta = endMs - startMs;
  if (delta < 0) {
    return { negative: true, value: delta };
  }
  return delta;
}

function monotonicDeltaMs(startNs: bigint, endNs: bigint): number | { readonly negative: true; readonly value: number } {
  const deltaNs = endNs - startNs;
  const deltaMs = Number(deltaNs) / 1_000_000;
  if (deltaMs < 0) {
    return { negative: true, value: deltaMs };
  }
  return deltaMs;
}

export function computeMarketTimeLatencies(
  envelope: MarketTimeEnvelope,
  processMonotonicNs?: Readonly<{
    readonly networkReceive: bigint;
    readonly decode: bigint;
    readonly normalize: bigint;
    readonly persist: bigint;
  }>,
): MarketTimeLatencyResult {
  const negativeSegments: MarketTimeLatencyResult['negativeSegments'][number][] = [];

  let wireProviderLatencyMs: number | null = null;
  const wireStart =
    envelope.exchangeSendTime !== null
      ? Date.parse(envelope.exchangeSendTime)
      : envelope.providerReceiveTime !== null
        ? Date.parse(envelope.providerReceiveTime)
        : envelope.providerPublishTime !== null
          ? Date.parse(envelope.providerPublishTime)
          : NaN;
  const wireEnd = Date.parse(envelope.sunreyNetworkReceiveTime);
  if (Number.isFinite(wireStart)) {
    const wire = wallDeltaMs(wireStart, wireEnd);
    if (typeof wire === 'number') {
      wireProviderLatencyMs = wire;
    } else {
      negativeSegments.push('wire_provider');
    }
  }

  let ingestionLatencyMs: number | null = null;
  const ingest = wallDeltaMs(
    Date.parse(envelope.sunreyNetworkReceiveTime),
    Date.parse(envelope.sunreyDecodeTime),
  );
  if (typeof ingest === 'number') {
    ingestionLatencyMs = ingest;
  } else {
    negativeSegments.push('ingestion');
  }

  let normalizationLatencyMs: number | null = null;
  const normalize = wallDeltaMs(
    Date.parse(envelope.sunreyDecodeTime),
    Date.parse(envelope.sunreyNormalizeTime),
  );
  if (typeof normalize === 'number') {
    normalizationLatencyMs = normalize;
  } else {
    negativeSegments.push('normalization');
  }

  let persistenceLatencyMs: number | null = null;
  const persist = wallDeltaMs(
    Date.parse(envelope.sunreyNormalizeTime),
    Date.parse(envelope.sunreyPersistTime),
  );
  if (typeof persist === 'number') {
    persistenceLatencyMs = persist;
  } else {
    negativeSegments.push('persistence');
  }

  if (
    processMonotonicNs &&
    processMonotonicNs.decode !== undefined &&
    processMonotonicNs.normalize !== undefined &&
    processMonotonicNs.persist !== undefined
  ) {
    const decode = monotonicDeltaMs(processMonotonicNs.networkReceive, processMonotonicNs.decode);
    if (typeof decode !== 'number') {
      negativeSegments.push('ingestion');
    }
    const norm = monotonicDeltaMs(processMonotonicNs.decode, processMonotonicNs.normalize);
    if (typeof norm !== 'number') {
      negativeSegments.push('normalization');
    }
    const persistMono = monotonicDeltaMs(processMonotonicNs.normalize, processMonotonicNs.persist);
    if (typeof persistMono !== 'number') {
      negativeSegments.push('persistence');
    }
  }

  return Object.freeze({
    wireProviderLatencyMs,
    ingestionLatencyMs,
    normalizationLatencyMs,
    persistenceLatencyMs,
    negativeSegments: Object.freeze([...new Set(negativeSegments)]),
  });
}
