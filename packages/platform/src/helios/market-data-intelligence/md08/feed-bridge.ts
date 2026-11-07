/**
 * Wire MD08 derivatives transport through the generic MD03 feed coordinator.
 */

import type { UtcInstant } from '@solstice/domain';
import type { OrderBookSnapshot } from '../../market-observation/types.ts';
import {
  createMd03FeedCoordinator,
  ingestMd03Incremental,
  ingestMd03Recovery,
  snapshotMd03FeedCoordinator,
} from '../md03/index.ts';
import type { Md03FeedCoordinator, Md03FeedCoordinatorSnapshot } from '../md03/index.ts';

export type Md08IncrementalBookPayload = {
  readonly book: OrderBookSnapshot;
};

export type Md08FeedTransportState = {
  readonly booksByInstrument: Readonly<Record<string, OrderBookSnapshot>>;
};

export function createMd08DerivativesFeedTransport(input: {
  readonly instrumentId: string;
  readonly initialBooks?: Readonly<Record<string, OrderBookSnapshot>>;
}): Md03FeedCoordinator<Md08FeedTransportState, Md08IncrementalBookPayload> {
  return createMd03FeedCoordinator({
    instrumentId: input.instrumentId,
    initialState: Object.freeze({
      booksByInstrument: input.initialBooks ?? Object.freeze({}),
    }),
    merge: (prior, payload, _at) =>
      Object.freeze({
        booksByInstrument: Object.freeze({
          ...prior.booksByInstrument,
          [input.instrumentId]: payload.book,
        }),
      }),
    replace: (_prior, payload, _at) =>
      Object.freeze({
        booksByInstrument: Object.freeze({
          [input.instrumentId]: payload.book,
        }),
      }),
  });
}

export function applyMd08IncrementalBookUpdate(
  coordinator: Md03FeedCoordinator<Md08FeedTransportState, Md08IncrementalBookPayload>,
  input: {
    readonly instrumentId: string;
    readonly sequence: bigint;
    readonly knowableAt: UtcInstant;
    readonly book: OrderBookSnapshot;
    readonly feedRole: 'PRIMARY' | 'SECONDARY';
  },
): Md03FeedCoordinator<Md08FeedTransportState, Md08IncrementalBookPayload> {
  return ingestMd03Incremental(coordinator, {
    schema: 'sunrey.helios.market-data.md03-feed.v1',
    authority: 'REFERENCE_ONLY',
    mode: 'INCREMENTAL',
    feed: Object.freeze({
      schema: 'sunrey.helios.market-data.md03-feed.v1',
      feedId: `md08-${input.feedRole.toLowerCase()}`,
      venueId: 'XCME',
      role: input.feedRole,
      channel: 'MDP3',
    }),
    instrumentId: input.instrumentId,
    sequence: input.sequence,
    sourceTimestamp: input.knowableAt,
    knowableAt: input.knowableAt,
    payload: Object.freeze({ book: input.book }),
    grantsExecutionAuthority: false,
  });
}

export function applyMd08RecoveryBookSnapshot(
  coordinator: Md03FeedCoordinator<Md08FeedTransportState, Md08IncrementalBookPayload>,
  input: {
    readonly instrumentId: string;
    readonly snapshotSequence: bigint;
    readonly knowableAt: UtcInstant;
    readonly book: OrderBookSnapshot;
    readonly recoveryToken: string;
  },
): Md03FeedCoordinator<Md08FeedTransportState, Md08IncrementalBookPayload> {
  return ingestMd03Recovery(coordinator, {
    schema: 'sunrey.helios.market-data.md03-feed.v1',
    authority: 'REFERENCE_ONLY',
    mode: 'RECOVERY',
    feed: Object.freeze({
      schema: 'sunrey.helios.market-data.md03-feed.v1',
      feedId: 'md08-recovery',
      venueId: 'XCME',
      role: 'PRIMARY',
      channel: 'MDP3-RECOVERY',
    }),
    instrumentId: input.instrumentId,
    recoveryToken: input.recoveryToken,
    snapshotSequence: input.snapshotSequence,
    sourceTimestamp: input.knowableAt,
    knowableAt: input.knowableAt,
    payload: Object.freeze({ book: input.book }),
    grantsExecutionAuthority: false,
  });
}

export function snapshotMd08FeedTransport(
  coordinator: Md03FeedCoordinator<Md08FeedTransportState, Md08IncrementalBookPayload>,
  evaluatedAt: UtcInstant,
): Md03FeedCoordinatorSnapshot<Md08FeedTransportState> {
  return snapshotMd03FeedCoordinator(coordinator, evaluatedAt);
}
