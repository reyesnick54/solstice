import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { asUtcInstant } from '@solstice/domain';
import { createOptionsEarningsResearchAgent } from './agent.ts';
import { assertPreEventEvaluation } from './certification.ts';
import { computeOptionsPreEventMetrics } from './compute.ts';
import { FIXTURE_HISTORICAL_IV, fixturePreEventOptionChainSnapshot } from './fixtures.ts';
import {
  evaluateEarn07OptionsIntelligenceQualification,
  HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED,
} from './qualification.ts';
import { computeRealizedComparison } from './realized.ts';
import { createHeliosOptionsEarningsIntelligenceService } from './service.ts';
import { OPTIONS_EXECUTION_MODE } from './taxonomy.ts';

describe('HELIOS EARN07 options earnings intelligence', () => {
  it('computes pre-event metrics from AAF-certified chain', () => {
    const snapshot = fixturePreEventOptionChainSnapshot();
    const evaluationTime = asUtcInstant('2026-01-15T20:00:00.000Z');
    const pit = assertPreEventEvaluation(snapshot, evaluationTime);
    assert.equal(pit.ok, true);
    const metrics = computeOptionsPreEventMetrics({
      snapshot,
      evaluationTime,
      historicalIv: FIXTURE_HISTORICAL_IV,
      volumeBaseline: { medianDailyVolume: 10_000n, sampleDays: 20 },
    });
    assert.ok(metrics.ATMStraddleImpliedMoveBps !== null && metrics.ATMStraddleImpliedMoveBps > 0);
    assert.ok(metrics.NearTermIVBps !== null);
    assert.ok(metrics.PutCallVolumeRatioScaled !== null);
    assert.equal(metrics.grantsExecutionAuthority, false);
    assert.equal(metrics.dealerGammaProxy?.label, 'DealerGammaProxy');
  });

  it('rejects post-event chain for pre-event evaluation', () => {
    const snapshot = fixturePreEventOptionChainSnapshot();
    const evaluationTime = asUtcInstant('2026-01-17T22:00:00.000Z');
    const pit = assertPreEventEvaluation(snapshot, evaluationTime);
    assert.equal(pit.ok, false);
  });

  it('isolates realized comparison after the event', () => {
    const snapshot = fixturePreEventOptionChainSnapshot();
    const evaluationTime = asUtcInstant('2026-01-15T20:00:00.000Z');
    const metrics = computeOptionsPreEventMetrics({ snapshot, evaluationTime });
    const realized = computeRealizedComparison({
      earningsEventId: snapshot.earningsEventId,
      eventScheduledAt: snapshot.eventScheduledAt,
      preEventMetrics: metrics,
      preEventSpotMinor: snapshot.underlyingSpotMinor,
      postEventSpotMinor: 186_0000n,
      postEventNearTermIvBps: 3200,
      realizedAt: asUtcInstant('2026-01-17T02:00:00.000Z'),
    });
    assert.ok(Math.abs(realized.realizedMoveBps) > 0);
    assert.ok(realized.volatilityCrushBps !== null);
    assert.equal(realized.grantsExecutionAuthority, false);
    assert.equal('realizedMoveBps' in (metrics as object), false);
  });

  it('builds expectation state and research brief without execution', () => {
    const service = createHeliosOptionsEarningsIntelligenceService();
    const snapshot = fixturePreEventOptionChainSnapshot();
    const state = service.buildPreEventExpectation({
      snapshot,
      evaluationTime: asUtcInstant('2026-01-15T20:00:00.000Z'),
      historicalIv: FIXTURE_HISTORICAL_IV,
    });
    assert.equal(state.executionMode, OPTIONS_EXECUTION_MODE);
    assert.equal(state.grantsExecutionAuthority, false);
    const agent = createOptionsEarningsResearchAgent();
    const brief = agent.explain(state);
    assert.equal(brief.optionsExecutionEnabled, false);
    assert.ok(brief.summary.includes('instrument.AAPL'));
    assert.equal(agent.assertNoOptionsExecution(), true);
  });

  it('qualifies HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED', () => {
    const result = evaluateEarn07OptionsIntelligenceQualification({
      providerNeutralInputsPresent: true,
      pitTimestampAndAafCertified: true,
      preEventMetricsComputed: true,
      expectationStateBuilt: true,
      realizedComparisonIsolated: true,
      researchAgentNoExecution: true,
      optionsExecutionDisabled: true,
      dealerGammaProxyLabeled: true,
    });
    assert.equal(result.marker, HELIOS_EARN07_OPTIONS_INTELLIGENCE_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
