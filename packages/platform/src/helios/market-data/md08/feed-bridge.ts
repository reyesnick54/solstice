/**
 * Wire MD08 derivatives transport through the canonical MD03 recovery machine.
 */

import type { UtcInstant } from '@solstice/domain';
import type { OrderBookSnapshot } from '../../market-observation/types.ts';
import { recoveryProfileFor } from '../md03/recovery-adapters.ts';
import {
  applyMarketFeedSnapshot,
  createMarketFeedSequenceState,
  ingestMarketFeedIncremental,
} from '../md03/recovery-machine.ts';
import type { MarketFeedSequenceState } from '../md03/types.ts';

const CME_POLICY = Object.freeze({
  maxBufferedIncrementals: 64,
  maxRecoveryAttempts: 4,
  snapshotMaxAgeMs: 120_000,
  adapter: recoveryProfileFor('CME_RECOVERY_FEED'),
});

export type Md08IncrementalBookPayload = {
  readonly book: OrderBookSnapshot;
};

export type Md08FeedTransportState = {
  readonly primary: MarketFeedSequenceState;
  readonly secondary: MarketFeedSequenceState;
  readonly booksByInstrument: Readonly<Record<string, OrderBookSnapshot>>;
};

export function createMd08DerivativesFeedTransport(input: {
  readonly primaryFeedId: string;
  readonly secondaryFeedId: string;
  readonly sessionId: string;
  readonly startedAt: UtcInstant;
}): Md08FeedTransportState {
  return Object.freeze({
    primary: createMarketFeedSequenceState({
      feedId: input.primaryFeedId,
      sessionId: input.sessionId,
      startedAt: input.startedAt,
      policy: CME_POLICY,
    }),
    secondary: createMarketFeedSequenceState({
      feedId: input.secondaryFeedId,
      sessionId: input.sessionId,
      startedAt: input.startedAt,
      policy: CME_POLICY,
    }),
    booksByInstrument: Object.freeze({}),
  });
}

export function applyMd08IncrementalBookUpdate(
  transport: Md08FeedTransportState,
  input: {
    readonly feedRole: 'PRIMARY' | 'SECONDARY';
    readonly instrumentId: string;
    readonly sequence: number;
    readonly knowableAt: UtcInstant;
    readonly book: OrderBookSnapshot;
    readonly sessionId: string;
  },
): Md08FeedTransportState {
  const update = Object.freeze({
    feedId: input.feedRole === 'PRIMARY' ? transport.primary.feedId : transport.secondary.feedId,
    sequence: input.sequence,
    sessionId: input.sessionId,
    sessionGeneration: 1,
    payloadId: `${input.instrumentId}:${input.sequence}`,
    observedAt: input.knowableAt,
    checksum: null,
  });
  const lane = input.feedRole === 'PRIMARY' ? transport.primary : transport.secondary;
  const ingested = ingestMarketFeedIncremental(lane, update, CME_POLICY);
  if (!ingested.applied) {
    return transport;
  }
  const nextLane = ingested.state;
  const nextBooks = Object.freeze({
    ...transport.booksByInstrument,
    [input.instrumentId]: input.book,
  });
  return Object.freeze({
    primary: input.feedRole === 'PRIMARY' ? nextLane : transport.primary,
    secondary: input.feedRole === 'SECONDARY' ? nextLane : transport.secondary,
    booksByInstrument: nextBooks,
  });
}

export function applyMd08RecoveryBookSnapshot(
  transport: Md08FeedTransportState,
  input: {
    readonly feedRole: 'PRIMARY' | 'SECONDARY';
    readonly instrumentId: string;
    readonly snapshotSequence: number;
    readonly knowableAt: UtcInstant;
    readonly book: OrderBookSnapshot;
    readonly sessionId: string;
    readonly checksum: string;
  },
): Md08FeedTransportState {
  const lane = input.feedRole === 'PRIMARY' ? transport.primary : transport.secondary;
  const snapshot = Object.freeze({
    feedId: lane.feedId,
    sequence: input.snapshotSequence,
    sessionId: input.sessionId,
    sessionGeneration: 1,
    observedAt: input.knowableAt,
    checksum: input.checksum,
    checksumValid: true,
    stale: false,
  });
  const applied = applyMarketFeedSnapshot(lane, snapshot, CME_POLICY, { evaluatedAtUtc: input.knowableAt });
  const nextBooks = Object.freeze({
    ...transport.booksByInstrument,
    [input.instrumentId]: input.book,
  });
  return Object.freeze({
    primary: input.feedRole === 'PRIMARY' ? applied.state : transport.primary,
    secondary: input.feedRole === 'SECONDARY' ? applied.state : transport.secondary,
    booksByInstrument: nextBooks,
  });
}
