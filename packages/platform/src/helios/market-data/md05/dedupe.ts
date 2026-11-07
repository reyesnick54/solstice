/**
 * A/B identical-exchange feed deduplication — earliest valid arrival wins; no double-count.
 */

import type { FeedReplica, InboundMarketTick } from './types.ts';

export type ReplicaDedupeKey = {
  readonly feedId: string;
  readonly nativeSequence: string;
  readonly nativeMessageId: string;
};

export function replicaDedupeKey(tick: InboundMarketTick, feedId: string): ReplicaDedupeKey {
  return Object.freeze({
    feedId,
    nativeSequence: tick.nativeSequence,
    nativeMessageId: tick.nativeMessageId,
  });
}

export function dedupeKeyString(key: ReplicaDedupeKey): string {
  return `${key.feedId}|${key.nativeSequence}|${key.nativeMessageId}`;
}

export type DedupeWinner = {
  readonly tick: InboundMarketTick;
  readonly dedupeKey: string;
  readonly duplicate: boolean;
  readonly suppressedReplicaIds: readonly string[];
};

export function deduplicateAbReplicas(input: {
  readonly feedId: string;
  readonly ticks: readonly InboundMarketTick[];
  readonly replicas: readonly FeedReplica[];
  readonly priorKeys: ReadonlySet<string>;
}): { readonly winners: readonly DedupeWinner[]; readonly keysSeen: ReadonlySet<string> } {
  const replicaById = new Map(input.replicas.map((replica) => [replica.replicaId, replica]));
  const groups = new Map<string, InboundMarketTick[]>();

  for (const tick of input.ticks) {
    const replica = replicaById.get(tick.replicaId);
    if (!replica) {
      continue;
    }
    const key = dedupeKeyString(replicaDedupeKey(tick, input.feedId));
    const bucket = groups.get(key) ?? [];
    bucket.push(tick);
    groups.set(key, bucket);
  }

  const keysSeen = new Set(input.priorKeys);
  const winners: DedupeWinner[] = [];

  for (const [key, bucket] of groups) {
    if (keysSeen.has(key)) {
      winners.push(
        Object.freeze({
          tick: bucket[0]!,
          dedupeKey: key,
          duplicate: true,
          suppressedReplicaIds: Object.freeze(bucket.map((t) => t.replicaId)),
        }),
      );
      continue;
    }

    const sorted = [...bucket].sort(
      (left, right) => Date.parse(left.arrivalTimestamp) - Date.parse(right.arrivalTimestamp),
    );
    const winner = sorted[0]!;
    const suppressed = sorted.slice(1).map((t) => t.replicaId);
    keysSeen.add(key);
    winners.push(
      Object.freeze({
        tick: winner,
        dedupeKey: key,
        duplicate: false,
        suppressedReplicaIds: Object.freeze(suppressed),
      }),
    );
  }

  return Object.freeze({ winners: Object.freeze(winners), keysSeen });
}
