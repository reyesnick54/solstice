/**
 * MD11 session and replay manifest builders.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import { sha256Hex, stableJson } from './fingerprint.ts';
import type {
  MarketDataPartitionKey,
  MarketReplayManifest,
  MarketReplayMode,
  MarketSessionManifest,
  NormalizedMarketEventRecord,
  RawMarketEventRecord,
  ReplayCheckpoint,
} from './types.ts';
import { MD11_BAR_BUILDER_VERSION } from './types.ts';

export function buildMarketSessionManifest(input: {
  readonly sessionId: string;
  readonly partition: MarketDataPartitionKey;
  readonly sessionOpenUtc: UtcInstant;
  readonly sessionCloseUtc: UtcInstant | null;
  readonly rawEvents: readonly RawMarketEventRecord[];
  readonly normalizedEvents: readonly NormalizedMarketEventRecord[];
}): MarketSessionManifest {
  const sequenceGapCount = input.rawEvents.filter((e) => e.rawKind === 'sequence_gap').length;
  const haltCount = input.rawEvents.filter((e) => e.rawKind === 'halt').length;
  const providerFailureCount = input.rawEvents.filter((e) => e.providerFailure).length;
  const exchangeTimes = input.rawEvents.map((e) => e.index.exchangeTime);
  const firstExchangeTime = exchangeTimes.length ? exchangeTimes.reduce((a, b) => (Date.parse(a) < Date.parse(b) ? a : b)) : null;
  const lastExchangeTime = exchangeTimes.length ? exchangeTimes.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b)) : null;
  const contentFingerprint = sha256Hex([
    stableJson(input.partition),
    stableJson(input.rawEvents.map((e) => e.eventId)),
    stableJson(input.normalizedEvents.map((e) => e.eventId)),
  ]);
  return Object.freeze({
    schema: 'sunrey.helios.market-data.md11.v1',
    sessionId: input.sessionId,
    partition: input.partition,
    sessionOpenUtc: input.sessionOpenUtc,
    sessionCloseUtc: input.sessionCloseUtc,
    rawEventCount: input.rawEvents.length,
    normalizedEventCount: input.normalizedEvents.length,
    firstExchangeTime,
    lastExchangeTime,
    sequenceGapCount,
    haltCount,
    providerFailureCount,
    contentFingerprint,
  });
}

export function buildReplayCheckpoint(input: {
  readonly checkpointId: string;
  readonly replayId: string;
  readonly mode: MarketReplayMode;
  readonly cursorInstant: UtcInstant;
  readonly cursorIngestSequence: bigint;
  readonly eventsEmitted: number;
  readonly recordedAt: UtcInstant;
  readonly priorFingerprint: string;
}): ReplayCheckpoint {
  const fingerprint = sha256Hex([
    input.replayId,
    input.mode,
    input.cursorInstant,
    input.cursorIngestSequence.toString(),
    String(input.eventsEmitted),
    input.priorFingerprint,
  ]);
  return Object.freeze({
    schema: 'sunrey.helios.market-data.md11.v1',
    checkpointId: input.checkpointId,
    replayId: input.replayId,
    mode: input.mode,
    cursorInstant: input.cursorInstant,
    cursorIngestSequence: input.cursorIngestSequence,
    eventsEmitted: input.eventsEmitted,
    fingerprint,
    recordedAt: input.recordedAt,
  });
}

export function buildMarketReplayManifest(input: {
  readonly replayId: string;
  readonly mode: MarketReplayMode;
  readonly partition: MarketDataPartitionKey;
  readonly windowFrom: UtcInstant;
  readonly windowTo: UtcInstant;
  readonly sessionManifestIds: readonly string[];
  readonly checkpointIds: readonly string[];
  readonly timelineFingerprint: string;
  readonly barBuilderVersion?: string;
}): MarketReplayManifest {
  const replayFingerprint = sha256Hex([
    input.replayId,
    input.mode,
    stableJson(input.partition),
    input.windowFrom,
    input.windowTo,
    stableJson(input.sessionManifestIds),
    stableJson(input.checkpointIds),
    input.timelineFingerprint,
    input.barBuilderVersion ?? MD11_BAR_BUILDER_VERSION,
  ]);
  return Object.freeze({
    schema: 'sunrey.helios.market-data.md11.v1',
    replayId: input.replayId,
    mode: input.mode,
    partition: input.partition,
    windowFrom: input.windowFrom,
    windowTo: input.windowTo,
    sessionManifestIds: Object.freeze([...input.sessionManifestIds]),
    barBuilderVersion: input.barBuilderVersion ?? MD11_BAR_BUILDER_VERSION,
    preservesSequenceGaps: true,
    preservesHalts: true,
    preservesLateMessages: true,
    preservesRevisions: true,
    preservesProviderFailures: true,
    replayFingerprint,
    checkpointIds: Object.freeze([...input.checkpointIds]),
  });
}
