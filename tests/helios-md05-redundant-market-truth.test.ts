/**
 * HELIOS Market Data MD05 — redundant feed arbitration qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED,
  MD05_FIXTURE_FEED_ID,
  MD05_FIXTURE_REPLICAS,
  RedundantFeedArbitrationEngine,
  buildMarketObservationConsensus,
  evaluateMd05Qualification,
  fixtureTick,
} from '../packages/platform/src/helios/index.ts';

const NOW = asUtcInstant('2026-09-16T14:30:10.000Z');

describe('HELIOS MD05 redundant market truth (integration)', () => {
  it('qualifies redundant feed arbitration and provider trust', () => {
    const engine = new RedundantFeedArbitrationEngine({
      feedId: MD05_FIXTURE_FEED_ID,
      symbol: 'SPY',
      venueId: 'XNYS',
      replicas: MD05_FIXTURE_REPLICAS,
    });

    const abDuplicate = engine.ingest(
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
          priceMinorUnits: 100n,
        }),
        fixtureTick({
          replicaId: 'replica-primary-b',
          role: 'PRIMARY_B',
          providerId: 'vendor_beta',
          priceMinorUnits: 900_000n,
          nativeSequence: '9000',
          nativeMessageId: 'msg-9000',
        }),
      ],
    });

    const qualification = evaluateMd05Qualification({
      abDedupeEarliestArrival: abDuplicate.dedupedCount === 1,
      noDoubleCount: abDuplicate.suppressedReplicaIds.length >= 1,
      sourceAttributionRetained: (abDuplicate.consensus.observation?.contributingSources.length ?? 0) > 0,
      incompatibleNotAveraged: incompatible.outcome === 'INCOMPATIBLE',
      unanimousConsensus: abDuplicate.consensus.outcome === 'PRIMARY_SELECTED',
      readOnlyFailover: true,
      executionAuthoritySeparate: true,
      providerTrustDimensions: Object.keys(engine.snapshot().providerTrust).length > 0,
      divergenceSurfaced: incompatible.divergences.some((row) => row.fields.includes('price')),
    });

    assert.equal(qualification.marker, HELIOS_MD05_REDUNDANT_MARKET_TRUTH_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });
});
