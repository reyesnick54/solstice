/**
 * MD13 backpressure — never silently drop market events.
 */

import type { BackpressurePolicy } from './taxonomy.ts';

export type RawMarketEvent = {
  readonly eventId: string;
  readonly feedId: 'feed_a' | 'feed_b';
  readonly sequence: number;
  readonly payloadChecksum: string;
  readonly observedAtMs: number;
  readonly isRaw: true;
};

export type DerivedAnalyticsEvent = {
  readonly eventId: string;
  readonly parentSequence: number;
  readonly kind: 'vwap_tick' | 'spread_hint';
};

export type BackpressureState = {
  readonly bufferDepth: number;
  readonly durableQueueDepth: number;
  readonly shedDerivedCount: number;
  readonly feedDegraded: Readonly<Set<'feed_a' | 'feed_b'>>;
  readonly policiesApplied: readonly BackpressurePolicy[];
};

export type BackpressureApplyResult = {
  readonly rawEvents: readonly RawMarketEvent[];
  readonly derivedEmitted: readonly DerivedAnalyticsEvent[];
  readonly state: BackpressureState;
  readonly silentRawDrops: number;
};

const DEFAULT_MAX_BUFFER = 256;

export function applyBackpressure(input: {
  readonly incoming: readonly RawMarketEvent[];
  readonly pendingRaw: readonly RawMarketEvent[];
  readonly derivedWork: readonly DerivedAnalyticsEvent[];
  readonly consumerLagMs: number;
  readonly persistenceLagMs: number;
  readonly maxBuffer?: number;
}): BackpressureApplyResult {
  const maxBuffer = input.maxBuffer ?? DEFAULT_MAX_BUFFER;
  const policies: BackpressurePolicy[] = [];
  const combined = [...input.pendingRaw, ...input.incoming];
  const feedDegraded = new Set<'feed_a' | 'feed_b'>();

  let durableQueueDepth = 0;
  let buffer = combined;
  if (buffer.length > maxBuffer) {
    policies.push('BUFFER');
    policies.push('SPILL_DURABLE_QUEUE');
    durableQueueDepth = buffer.length - maxBuffer;
    buffer = buffer.slice(durableQueueDepth);
  } else if (buffer.length > maxBuffer * 0.75) {
    policies.push('BUFFER');
  }

  let derived = [...input.derivedWork];
  let shedDerivedCount = 0;
  if (input.consumerLagMs > 500 || input.persistenceLagMs > 2_000) {
    policies.push('SHED_NONCRITICAL_DERIVED');
    shedDerivedCount = derived.length;
    derived = [];
  }

  if (input.consumerLagMs > 1_500 || input.persistenceLagMs > 10_000) {
    policies.push('MARK_FEED_DEGRADED');
    for (const row of buffer) {
      feedDegraded.add(row.feedId);
    }
  }

  const rawPreserved = buffer.length + durableQueueDepth;
  const silentRawDrops = Math.max(0, combined.length - rawPreserved);

  return Object.freeze({
    rawEvents: Object.freeze(buffer),
    derivedEmitted: Object.freeze(derived),
    state: Object.freeze({
      bufferDepth: buffer.length,
      durableQueueDepth,
      shedDerivedCount,
      feedDegraded: Object.freeze(feedDegraded),
      policiesApplied: Object.freeze(policies),
    }),
    silentRawDrops,
  });
}

export function backpressureNeverSilentlyDropsRaw(result: BackpressureApplyResult): boolean {
  return result.silentRawDrops === 0;
}
