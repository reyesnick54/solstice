/**
 * HELIOS MD05 redundant feed arbitration engine.
 */

import type { UtcInstant } from '@solstice/domain';
import { deduplicateAbReplicas } from './dedupe.ts';
import { buildMarketObservationConsensus } from './consensus.ts';
import { applyFailoverDecision, decideReadOnlyFailover } from './failover.ts';
import { createProviderTrustState, recordProviderTick } from './trust.ts';
import { HELIOS_MD05_SCHEMA } from './taxonomy.ts';
import type {
  FailoverDecision,
  FeedArbitrationState,
  FeedReplica,
  InboundMarketTick,
  MarketObservationConsensus,
  MarketSourceAttribution,
  ProviderTrustState,
} from './types.ts';

export type RedundantFeedArbitrationEngineOptions = {
  readonly feedId: string;
  readonly symbol: string;
  readonly venueId: string;
  readonly replicas: readonly FeedReplica[];
  readonly initialActiveReplicaId?: string;
};

export type ArbitrationIngestResult = {
  readonly consensus: MarketObservationConsensus;
  readonly state: FeedArbitrationState;
  readonly failover: FailoverDecision | null;
  readonly dedupedCount: number;
  readonly suppressedReplicaIds: readonly string[];
};

export class RedundantFeedArbitrationEngine {
  readonly #feedId: string;
  #state: FeedArbitrationState;

  constructor(options: RedundantFeedArbitrationEngineOptions) {
    const active =
      options.initialActiveReplicaId ??
      options.replicas.find((replica) => replica.role === 'PRIMARY_A')?.replicaId ??
      options.replicas[0]?.replicaId ??
      null;
    const activeReplica = options.replicas.find((replica) => replica.replicaId === active) ?? null;
    const providerTrust: Record<string, ProviderTrustState> = {};
    for (const replica of options.replicas) {
      providerTrust[replica.providerId] ??= createProviderTrustState({
        providerId: replica.providerId,
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }
    this.#feedId = options.feedId;
    this.#state = Object.freeze({
      schema: HELIOS_MD05_SCHEMA,
      symbol: options.symbol,
      venueId: options.venueId,
      activeReadReplicaId: active,
      activeReadRole: activeReplica?.role ?? null,
      replicas: Object.freeze(options.replicas.map((replica) => Object.freeze({ ...replica }))),
      providerTrust: Object.freeze({ ...providerTrust }),
      lastFailoverAt: null,
      dedupeKeysSeen: Object.freeze([]),
    });
  }

  snapshot(): FeedArbitrationState {
    return this.#state;
  }

  ingest(ticks: readonly InboundMarketTick[], now: UtcInstant): ArbitrationIngestResult {
    const trust = { ...this.#state.providerTrust };
    for (const tick of ticks) {
      const prior = trust[tick.providerId] ?? createProviderTrustState({ providerId: tick.providerId, updatedAt: now });
      trust[tick.providerId] = recordProviderTick(prior, tick, now);
    }

    const priorKeys = new Set(this.#state.dedupeKeysSeen);
    const dedupe = deduplicateAbReplicas({
      feedId: this.#feedId,
      ticks,
      replicas: this.#state.replicas,
      priorKeys,
    });

    const attribution: MarketSourceAttribution[] = [];
    const uniqueTicks: InboundMarketTick[] = [];
    const suppressed: string[] = [];

    for (const winner of dedupe.winners) {
      if (winner.duplicate) {
        suppressed.push(...winner.suppressedReplicaIds);
        continue;
      }
      uniqueTicks.push(winner.tick);
      attribution.push(
        Object.freeze({
          providerId: winner.tick.providerId,
          replicaId: winner.tick.replicaId,
          role: winner.tick.role,
          nativeSequence: winner.tick.nativeSequence,
          nativeMessageId: winner.tick.nativeMessageId,
          arrivalTimestamp: winner.tick.arrivalTimestamp,
        }),
      );
      suppressed.push(...winner.suppressedReplicaIds);
    }

    const consensus = buildMarketObservationConsensus({
      symbol: this.#state.symbol,
      venueId: this.#state.venueId,
      ticks: uniqueTicks,
      trustByProvider: trust,
      decidedAt: now,
      dedupeAttribution: Object.freeze(attribution),
    });

    let nextState: FeedArbitrationState = Object.freeze({
      ...this.#state,
      providerTrust: Object.freeze(trust),
      dedupeKeysSeen: Object.freeze([...dedupe.keysSeen]),
    });

    const failover = decideReadOnlyFailover({
      state: nextState,
      now,
      reason: consensus.outcome === 'INCOMPATIBLE' ? 'incompatible_provider_consensus' : 'read_path_health',
    });

    if (failover) {
      nextState = applyFailoverDecision(nextState, failover);
    }

    this.#state = nextState;

    return Object.freeze({
      consensus,
      state: nextState,
      failover,
      dedupedCount: dedupe.winners.filter((row) => !row.duplicate).length,
      suppressedReplicaIds: Object.freeze(suppressed),
    });
  }
}
