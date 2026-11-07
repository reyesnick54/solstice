import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import {
  HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED,
  assessDigitalDemandAnomaly,
  compileDigitalDemandState,
  demoSearchAttentionObservation,
  evaluateAlt05DigitalDemandQualification,
} from './index.ts';

describe('ALT05 digital demand unit', () => {
  it('flags short-lived spike without sales inference', () => {
    const series = [50, 52, 51, 49, 48, 47, 46, 120, 51];
    const anomaly = assessDigitalDemandAnomaly({
      demandSeries: series,
      latestLevel: series[series.length - 1]!,
      periodEnds: [],
    });
    assert.equal(anomaly.spikeNotTreatedAsSales, true);
    assert.notEqual(anomaly.attentionToSales, 'REQUIRES_CORROBORATION');
  });

  it('qualification marker when checks pass', () => {
    const result = evaluateAlt05DigitalDemandQualification({
      observationTypesDefined: true,
      inputFamiliesComplete: true,
      aggregateOnlyEnforced: true,
      estimatesNotExactCounts: true,
      searchReliabilityImplemented: true,
      latentDemandWithUncertainty: true,
      anomalySeparatesSpikeFromTrend: true,
      viralInterestNotAutoSales: true,
      knowableAtEnforced: true,
      noExecutionAuthorityOnState: true,
    });
    assert.equal(result.marker, HELIOS_ALT05_DIGITAL_DEMAND_QUALIFIED);
  });

  it('latent demand exposes uncertainty', () => {
    const knowableAt = asUtcInstant('2024-06-20T00:00:00.000Z');
    const state = compileDigitalDemandState({
      stateId: 'state/test',
      entityId: 'entity:demo-retailer',
      asOf: knowableAt,
      compiledAt: knowableAt,
      search: demoSearchAttentionObservation(knowableAt),
      web: null,
      app: null,
      searchReliability: null,
    });
    assert.ok(state.latent.uncertainty >= 0);
  });
});
