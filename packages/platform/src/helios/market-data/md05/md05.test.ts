import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import {
  RedundantFeedArbitrationEngine,
  buildMarketObservationConsensus,
  createProviderTrustState,
  deduplicateAbReplicas,
  evaluateMd05Qualification,
  HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED,
  MD05_FIXTURE_FEED_ID,
  MD05_FIXTURE_REPLICAS,
  fixtureTick,
} from './index.ts';

const NOW = asUtcInstant('2026-09-16T14:30:10.000Z');

describe('HELIOS MD05 redundant market truth', () => {
  it('deduplicates identical A/B messages by earliest arrival', () => {
    const ticks = [
      fixtureTick({
        replicaId: 'replica-primary-a',
        role: 'PRIMARY_A',
        providerId: 'vendor_alpha',
        arrivalTimestamp: asUtcInstant('2026-09-16T14:30:00.080Z'),
      }),
      fixtureTick({
        replicaId: 'replica-primary-b',
        role: 'PRIMARY_B',
        providerId: 'vendor_beta',
        arrivalTimestamp: asUtcInstant('2026-09-16T14:30:00.050Z'),
      }),
    ];
    const dedupe = deduplicateAbReplicas({
      feedId: MD05_FIXTURE_FEED_ID,
      ticks,
      replicas: MD05_FIXTURE_REPLICAS,
      priorKeys: new Set(),
    });
    assert.equal(dedupe.winners.length, 1);
    assert.equal(dedupe.winners[0]!.tick.replicaId, 'replica-primary-b');
    assert.deepEqual(dedupe.winners[0]!.suppressedReplicaIds, ['replica-primary-a']);
  });

  it('retains all contributing sources on unanimous consensus', () => {
    const engine = new RedundantFeedArbitrationEngine({
      feedId: MD05_FIXTURE_FEED_ID,
      symbol: 'SPY',
      venueId: 'XNYS',
      replicas: MD05_FIXTURE_REPLICAS,
    });
    const result = engine.ingest(
      [
        fixtureTick({
          replicaId: 'replica-primary-a',
          role: 'PRIMARY_A',
          providerId: 'vendor_alpha',
          nativeMessageId: 'msg-2001',
          nativeSequence: '2001',
        }),
        fixtureTick({
          replicaId: 'replica-sip',
          role: 'SIP_OR_CONSOLIDATED',
          providerId: 'sip_consolidated',
          nativeMessageId: 'msg-2002',
          nativeSequence: '2002',
        }),
      ],
      NOW,
    );
    assert.equal(result.consensus.outcome, 'UNANIMOUS');
    assert.ok(result.consensus.observation);
    assert.equal(result.consensus.averaged, false);
    assert.ok(result.consensus.observation!.contributingSources.length >= 1);
  });

  it('refuses to average incompatible observations', () => {
    const trust = {
      vendor_alpha: createProviderTrustState({ providerId: 'vendor_alpha', updatedAt: NOW }),
      vendor_beta: createProviderTrustState({ providerId: 'vendor_beta', updatedAt: NOW }),
    };
    const consensus = buildMarketObservationConsensus({
      symbol: 'SPY',
      venueId: 'XNYS',
      decidedAt: NOW,
      trustByProvider: trust,
      dedupeAttribution: [],
      ticks: [
        fixtureTick({
          replicaId: 'replica-primary-a',
          role: 'PRIMARY_A',
          providerId: 'vendor_alpha',
          priceMinorUnits: 450_25n,
        }),
        fixtureTick({
          replicaId: 'replica-primary-b',
          role: 'PRIMARY_B',
          providerId: 'vendor_beta',
          priceMinorUnits: 500_00n,
          nativeSequence: '3002',
          nativeMessageId: 'msg-3002',
        }),
      ],
    });
    assert.equal(consensus.outcome, 'INCOMPATIBLE');
    assert.equal(consensus.observation, null);
    assert.equal(consensus.averaged, false);
    assert.ok(consensus.divergences.length > 0);
  });

  it('issues read-only failover without execution authority', () => {
    const degradedReplicas = MD05_FIXTURE_REPLICAS.map((replica) => {
      if (replica.replicaId === 'replica-primary-a') {
        return Object.freeze({ ...replica, health: 'UNAVAILABLE' as const });
      }
      if (replica.replicaId === 'replica-primary-b') {
        return Object.freeze({ ...replica, active: true });
      }
      return replica;
    });
    const engine = new RedundantFeedArbitrationEngine({
      feedId: MD05_FIXTURE_FEED_ID,
      symbol: 'SPY',
      venueId: 'XNYS',
      replicas: degradedReplicas,
      initialActiveReplicaId: 'replica-primary-a',
    });
    const result = engine.ingest(
      [
        fixtureTick({
          replicaId: 'replica-primary-b',
          role: 'PRIMARY_B',
          providerId: 'vendor_beta',
        }),
      ],
      NOW,
    );
    assert.ok(result.failover);
    assert.equal(result.failover!.scope, 'READ_ONLY_MARKET_DATA');
    assert.equal(result.failover!.executionAuthorityImplicated, false);
  });

  it('qualifies MD05 redundant market truth', () => {
    const engine = new RedundantFeedArbitrationEngine({
      feedId: MD05_FIXTURE_FEED_ID,
      symbol: 'SPY',
      venueId: 'XNYS',
      replicas: MD05_FIXTURE_REPLICAS,
    });
    const ingest = engine.ingest(
      [
        fixtureTick({
          replicaId: 'replica-primary-a',
          role: 'PRIMARY_A',
          providerId: 'vendor_alpha',
        }),
        fixtureTick({
          replicaId: 'replica-primary-b',
          role: 'PRIMARY_B',
          providerId: 'vendor_beta',
          arrivalTimestamp: asUtcInstant('2026-09-16T14:30:00.120Z'),
        }),
      ],
      NOW,
    );
    const incompatible = buildMarketObservationConsensus({
      symbol: 'SPY',
      venueId: 'XNYS',
      decidedAt: NOW,
      trustByProvider: engine.snapshot().providerTrust,
      dedupeAttribution: [],
      ticks: [
        fixtureTick({
          replicaId: 'replica-primary-a',
          role: 'PRIMARY_A',
          providerId: 'vendor_alpha',
          priceMinorUnits: 1n,
        }),
        fixtureTick({
          replicaId: 'replica-primary-b',
          role: 'PRIMARY_B',
          providerId: 'vendor_beta',
          priceMinorUnits: 999_999n,
          nativeSequence: '4002',
          nativeMessageId: 'msg-4002',
        }),
      ],
    });
    const qualification = evaluateMd05Qualification({
      abDedupeEarliestArrival: ingest.dedupedCount === 1,
      noDoubleCount: ingest.suppressedReplicaIds.length >= 1,
      sourceAttributionRetained: Boolean(ingest.consensus.observation?.contributingSources.length),
      incompatibleNotAveraged: incompatible.observation === null && !incompatible.averaged,
      unanimousConsensus: ingest.consensus.outcome === 'PRIMARY_SELECTED',
      readOnlyFailover: ingest.failover == null || ingest.failover.scope === 'READ_ONLY_MARKET_DATA',
      executionAuthoritySeparate: ingest.failover == null || ingest.failover.executionAuthorityImplicated === false,
      providerTrustDimensions: Object.keys(engine.snapshot().providerTrust.vendor_alpha!.quality).length === 8,
      divergenceSurfaced: incompatible.divergences.length > 0,
    });
    assert.equal(qualification.marker, HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
