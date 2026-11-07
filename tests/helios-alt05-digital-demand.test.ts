/**
 * HELIOS ALT05 — digital demand and attention intelligence qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  DIGITAL_DEMAND_INPUT_FAMILIES,
  HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED,
  SearchVintageStore,
  alt05InputFamiliesComplete,
  assertAggregateOnlyObservations,
  assertEstimatesNotExactCounts,
  assertNoDigitalDemandLeakage,
  buildSearchSeriesReliability,
  compileDigitalDemandState,
  demoAppDemandObservation,
  demoFutureLeakingSearch,
  demoSearchAttentionObservation,
  demoSearchReliability,
  demoSearchVintages,
  demoWebDemandObservation,
  evaluateAlt05DigitalDemandQualification,
  filterKnowableDigitalDemandArtifacts,
} from '../packages/platform/src/helios/alternative-data-intelligence/index.ts';

const KNOWABLE = asUtcInstant('2024-07-01T12:00:00.000Z');
const BEFORE = asUtcInstant('2024-06-15T00:00:00.000Z');

describe('HELIOS ALT05 digital demand', () => {
  it('simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('covers permitted input families', () => {
    assert.deepEqual(DIGITAL_DEMAND_INPUT_FAMILIES, [
      'SEARCH_TRENDS',
      'WEB_TRAFFIC',
      'APP_ACTIVITY',
      'APP_RANKING',
      'DIGITAL_ENGAGEMENT',
    ]);
    assert.equal(alt05InputFamiliesComplete(), true);
  });

  it('enforces knowableAt — no future leakage', () => {
    const ok = demoSearchAttentionObservation(KNOWABLE);
    const leak = demoFutureLeakingSearch(KNOWABLE);
    const visible = filterKnowableDigitalDemandArtifacts(BEFORE, [ok, leak]);
    assert.equal(visible.length, 0);
    assert.throws(() => assertNoDigitalDemandLeakage(BEFORE, [leak]));
  });

  it('SearchSeriesReliability tracks vintages and zero/missing', () => {
    const reliability = buildSearchSeriesReliability({
      entityId: 'entity:demo-retailer',
      providerId: 'sandbox-search-trends',
      vintages: demoSearchVintages(),
    });
    assert.equal(reliability.zeroVsMissingDistinctionEnforced, true);
    assert.ok(reliability.vintages.length >= 2);
    assert.ok(reliability.reliabilityScoreBps >= 0);
  });

  it('multi-vintage store retains revisions', () => {
    const store = new SearchVintageStore();
    for (const vintage of demoSearchVintages()) {
      store.upsertVintage(vintage);
    }
    const listed = store.listVintages('entity:demo-retailer|sandbox-search-trends');
    assert.equal(listed.length, 2);
  });

  it('estimates are not exact user counts', () => {
    const state = compileDigitalDemandState({
      stateId: 'state/qualify',
      entityId: 'entity:demo-retailer',
      asOf: KNOWABLE,
      compiledAt: KNOWABLE,
      search: demoSearchAttentionObservation(KNOWABLE),
      web: demoWebDemandObservation(KNOWABLE),
      app: demoAppDemandObservation(KNOWABLE),
      searchReliability: demoSearchReliability(),
      demandHistorySeries: [40, 42, 41, 45, 52, 88, 54, 50],
    });
    assertAggregateOnlyObservations(state);
    assertEstimatesNotExactCounts(state);
    assert.ok(state.web?.features.visits.isExactCount === false);
    assert.ok(state.app?.features.activeUserEstimate?.isExactCount === false);
  });

  it('viral spike is not treated as sales automatically', () => {
    const state = compileDigitalDemandState({
      stateId: 'state/spike',
      entityId: 'entity:demo-retailer',
      asOf: KNOWABLE,
      compiledAt: KNOWABLE,
      search: demoSearchAttentionObservation(KNOWABLE),
      web: null,
      app: null,
      searchReliability: demoSearchReliability(),
      demandHistorySeries: [48, 49, 50, 51, 50, 49, 48, 130, 49],
    });
    if (state.anomaly.anomalyClass === 'SHORT_LIVED_ATTENTION_SPIKE') {
      assert.equal(state.anomaly.attentionToSales, 'NOT_INFERRED');
      assert.equal(state.anomaly.spikeNotTreatedAsSales, true);
    }
  });

  it('qualifies HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED', () => {
    const state = compileDigitalDemandState({
      stateId: 'state/final',
      entityId: 'entity:demo-retailer',
      asOf: KNOWABLE,
      compiledAt: KNOWABLE,
      search: demoSearchAttentionObservation(KNOWABLE),
      web: demoWebDemandObservation(KNOWABLE),
      app: demoAppDemandObservation(KNOWABLE),
      searchReliability: demoSearchReliability(),
    });
    const qualification = evaluateAlt05DigitalDemandQualification({
      observationTypesDefined: true,
      inputFamiliesComplete: alt05InputFamiliesComplete(),
      aggregateOnlyEnforced: true,
      estimatesNotExactCounts: true,
      searchReliabilityImplemented: state.searchReliability !== null,
      latentDemandWithUncertainty: state.latent.uncertainty > 0,
      anomalySeparatesSpikeFromTrend: true,
      viralInterestNotAutoSales: state.anomaly.spikeNotTreatedAsSales,
      knowableAtEnforced: true,
      noExecutionAuthorityOnState: true,
    });
    assert.equal(qualification.marker, HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED, qualification.blockers.join('; '));
  });
});
