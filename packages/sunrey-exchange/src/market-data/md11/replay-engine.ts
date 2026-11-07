/**
 * Deterministic historical replay — reproduces HELIOS knowledge at a past instant.
 */

import type { UtcInstant } from '@solstice/domain';
import { compareUtc } from './indexes.ts';
import { buildMarketReplayManifest, buildReplayCheckpoint } from './manifests.ts';
import { sha256Hex, stableJson } from './fingerprint.ts';
import type { NormalizedMarketEventStore } from './normalized-market-event-store.ts';
import type { RawMarketEventStore } from './raw-market-event-store.ts';
import type {
  MarketDataPartitionKey,
  MarketReplayMode,
  NormalizedMarketEventRecord,
  RawMarketEventRecord,
  ReplayEmitResult,
  ReplayTimelineEntry,
} from './types.ts';
import { buildOhlcvBarsFromTrades, type BarBuildRegistry } from './bar-builder.ts';

function orderingInstant(record: RawMarketEventRecord | NormalizedMarketEventRecord, mode: MarketReplayMode): UtcInstant {
  const { index } = record;
  if (mode === 'SOURCE_TIME') return index.exchangeTime;
  if (mode === 'ARRIVAL_TIME') return index.sunreyReceiveTime;
  return index.knowableAt;
}

function withinWindow(instant: UtcInstant, from: UtcInstant, to: UtcInstant): boolean {
  const ms = Date.parse(instant);
  return ms >= Date.parse(from) && ms <= Date.parse(to);
}

function mergeTimeline(
  rawEvents: readonly RawMarketEventRecord[],
  normalizedEvents: readonly NormalizedMarketEventRecord[],
  mode: MarketReplayMode,
  from: UtcInstant,
  to: UtcInstant,
): ReplayTimelineEntry[] {
  const normalizedByRaw = new Map<string, NormalizedMarketEventRecord>();
  for (const row of normalizedEvents) {
    normalizedByRaw.set(row.rawEventId, row);
  }

  const entries: ReplayTimelineEntry[] = [];
  for (const raw of rawEvents) {
    const ordering = orderingInstant(raw, mode);
    if (!withinWindow(ordering, from, to)) continue;
    const normalized = normalizedByRaw.get(raw.eventId) ?? null;
    entries.push(
      Object.freeze({
        orderingInstant: ordering,
        ingestSequence: raw.ingestSequence,
        packetOrder: raw.packetOrder,
        raw,
        normalized,
      }),
    );
  }

  entries.sort((a, b) => {
    const t = compareUtc(a.orderingInstant, b.orderingInstant);
    if (t !== 0) return t;
    if (a.packetOrder !== b.packetOrder) return a.packetOrder - b.packetOrder;
    const seq = a.ingestSequence < b.ingestSequence ? -1 : a.ingestSequence > b.ingestSequence ? 1 : 0;
    return seq;
  });

  return entries;
}

export type MarketReplayEngine = Readonly<{
  readonly replay: (input: {
    readonly replayId: string;
    readonly mode: MarketReplayMode;
    readonly partition: MarketDataPartitionKey;
    readonly windowFrom: UtcInstant;
    readonly windowTo: UtcInstant;
    readonly sessionManifestIds: readonly string[];
    readonly checkpointEvery?: number;
    readonly barRegistry?: BarBuildRegistry;
    readonly recordedAt: UtcInstant;
  }) => ReplayEmitResult;
}>;

export function createMarketReplayEngine(
  rawStore: RawMarketEventStore,
  normalizedStore: NormalizedMarketEventStore,
): MarketReplayEngine {
  return Object.freeze({
    replay(input) {
      const rawEvents = rawStore.listByPartition(input.partition);
      const normalizedEvents = normalizedStore.listByPartition(input.partition);
      const entries = Object.freeze(mergeTimeline(rawEvents, normalizedEvents, input.mode, input.windowFrom, input.windowTo));

      const timelineFingerprint = sha256Hex(
        entries.map((e) =>
          stableJson({
            ordering: e.orderingInstant,
            packetOrder: e.packetOrder,
            ingestSequence: e.ingestSequence.toString(),
            rawId: e.raw?.eventId ?? null,
            normalizedId: e.normalized?.eventId ?? null,
            rawKind: e.raw?.rawKind ?? null,
            late: e.raw?.isLate ?? false,
            revision: e.raw?.isRevision ?? false,
            failure: e.raw?.providerFailure ?? false,
          }),
        ),
      );

      const checkpoints = [];
      const every = input.checkpointEvery ?? 0;
      let priorFp = timelineFingerprint;
      if (every > 0) {
        for (let i = 0; i < entries.length; i += every) {
          const entry = entries[i]!;
          const checkpoint = buildReplayCheckpoint({
            checkpointId: `${input.replayId}_ck_${i}`,
            replayId: input.replayId,
            mode: input.mode,
            cursorInstant: entry.orderingInstant,
            cursorIngestSequence: entry.ingestSequence,
            eventsEmitted: i + 1,
            recordedAt: input.recordedAt,
            priorFingerprint: priorFp,
          });
          priorFp = checkpoint.fingerprint;
          checkpoints.push(checkpoint);
        }
      }

      const trades = entries
        .map((e) => e.normalized)
        .filter((n): n is NormalizedMarketEventRecord => n !== null && n.heliosKind === 'trade');

      const barResult = buildOhlcvBarsFromTrades({
        trades,
        barRegistry: input.barRegistry,
      });

      const manifest = buildMarketReplayManifest({
        replayId: input.replayId,
        mode: input.mode,
        partition: input.partition,
        windowFrom: input.windowFrom,
        windowTo: input.windowTo,
        sessionManifestIds: input.sessionManifestIds,
        checkpointIds: checkpoints.map((c) => c.checkpointId),
        timelineFingerprint,
        barBuilderVersion: barResult.barBuilderVersion,
      });

      return Object.freeze({
        entries,
        manifest,
        checkpoints: Object.freeze(checkpoints),
        derivedBars: barResult.bars,
      });
    },
  });
}

export function replayOrderingDiffersByMode(
  rawStore: RawMarketEventStore,
  normalizedStore: NormalizedMarketEventStore,
  partition: MarketDataPartitionKey,
  from: UtcInstant,
  to: UtcInstant,
): boolean {
  const engine = createMarketReplayEngine(rawStore, normalizedStore);
  const source = engine.replay({
    replayId: 'mode_cmp_source',
    mode: 'SOURCE_TIME',
    partition,
    windowFrom: from,
    windowTo: to,
    sessionManifestIds: [],
    recordedAt: from,
  });
  const arrival = engine.replay({
    replayId: 'mode_cmp_arrival',
    mode: 'ARRIVAL_TIME',
    partition,
    windowFrom: from,
    windowTo: to,
    sessionManifestIds: [],
    recordedAt: from,
  });
  return source.manifest.replayFingerprint !== arrival.manifest.replayFingerprint;
}
