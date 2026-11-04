/**
 * HELIOS EARN09 — probabilistic earnings state estimator.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  assertOutcomeStrictlyPrior,
  assertResearchReturnNotFact,
  createHeliosEarningsStateEstimatorService,
  EARNINGS_EXPERT_KINDS,
  evaluateEarn09StateEstimatorQualification,
  fixtureEarningsExpertSignals,
  FIXTURE_EARNINGS_AS_OF,
  FIXTURE_EARNINGS_GATING,
  HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED,
  updateExpertReliabilityFromOutcome,
  defaultExpertReliability,
} from '../packages/platform/src/helios/earnings-intelligence/state-estimator/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS EARN09 probabilistic earnings state estimator', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('estimates ProbabilisticEarningsState from eight experts', () => {
    const service = createHeliosEarningsStateEstimatorService();
    const state = service.estimate({
      instrumentId: 'eq:AAPL',
      fiscalPeriodKey: '2026Q4',
      asOf: FIXTURE_EARNINGS_AS_OF,
      gating: FIXTURE_EARNINGS_GATING,
      expertSignals: fixtureEarningsExpertSignals(),
      includeResearchReturnDistributions: true,
    });

    assert.equal(state.schema, 'sunrey.helios.earnings-intelligence.state-estimator.v1');
    assert.equal(state.grantsExecutionAuthority, false);
    assert.equal(state.researchOnly, true);
    assert.ok(state.nextQuarterEps.studentT.degreesOfFreedom >= 3);
    assert.ok(state.beatProbability.probability > 0 && state.beatProbability.probability < 1);
    assert.ok(state.missProbability.probability + state.beatProbability.probability <= 1.001);
    assert.equal(state.evidenceContributions.length, EARNINGS_EXPERT_KINDS.length);
    assert.equal(state.evidenceContributions[0]?.nonCausalDisclaimer, 'NOT_A_CAUSAL_ATTRIBUTION');
    assert.ok(state.announcementReturnDistribution?.notAFact);
    assert.doesNotThrow(() => assertResearchReturnNotFact(state));
  });

  it('updates reliability only after outcomes are strictly prior', () => {
    const signal = fixtureEarningsExpertSignals().find((row) => row.expertKind === 'OptionsExpert')!;
    const record = defaultExpertReliability('OptionsExpert');
    const outcomeKnownAt = asUtcInstant('2026-11-01T00:00:00.000Z');
    const appliedAt = asUtcInstant('2026-11-02T00:00:00.000Z');
    assert.equal(assertOutcomeStrictlyPrior(outcomeKnownAt, appliedAt), true);

    const updated = updateExpertReliabilityFromOutcome({
      record,
      signal,
      outcome: {
        instrumentId: 'eq:AAPL',
        fiscalPeriodKey: '2026Q4',
        outcomeKnownAt,
        actualEps: '2.50',
        actualRevenue: '11.90',
        beatConsensus: true,
        revenueBeat: true,
        guidanceRaised: false,
        guidanceCut: false,
        marginExpanded: true,
        qualityRiskRealized: false,
        announcementReturn: 0.01,
        postEventResidualReturn: 0.004,
      },
      appliedAt,
    });
    assert.ok(updated);
    assert.equal(updated!.sampleCount, 1);

    const rejected = updateExpertReliabilityFromOutcome({
      record,
      signal,
      outcome: {
        instrumentId: 'eq:AAPL',
        fiscalPeriodKey: '2026Q4',
        outcomeKnownAt: appliedAt,
        actualEps: '2.50',
        actualRevenue: '11.90',
        beatConsensus: true,
        revenueBeat: true,
        guidanceRaised: null,
        guidanceCut: null,
        marginExpanded: null,
        qualityRiskRealized: null,
        announcementReturn: null,
        postEventResidualReturn: null,
      },
      appliedAt: outcomeKnownAt,
    });
    assert.equal(rejected, null);
  });

  it('builds conformal intervals after prior outcomes are applied', () => {
    const service = createHeliosEarningsStateEstimatorService();
    const prior = service.estimate({
      instrumentId: 'eq:AAPL',
      fiscalPeriodKey: '2026Q4',
      asOf: FIXTURE_EARNINGS_AS_OF,
      gating: FIXTURE_EARNINGS_GATING,
      expertSignals: fixtureEarningsExpertSignals(),
    });
    assert.equal(prior.nextQuarterEps.conformalInterval, null);

    service.applyOutcome({
      priorState: prior,
      expertSignalsAtDecision: fixtureEarningsExpertSignals(),
      appliedAt: asUtcInstant('2026-11-05T00:00:00.000Z'),
      outcome: {
        instrumentId: 'eq:AAPL',
        fiscalPeriodKey: '2026Q4',
        outcomeKnownAt: asUtcInstant('2026-11-04T00:00:00.000Z'),
        actualEps: '2.50',
        actualRevenue: '11.90',
        beatConsensus: true,
        revenueBeat: true,
        guidanceRaised: false,
        guidanceCut: false,
        marginExpanded: true,
        qualityRiskRealized: false,
        announcementReturn: 0.01,
        postEventResidualReturn: 0.004,
      },
    });

    const next = service.estimate({
      instrumentId: 'eq:AAPL',
      fiscalPeriodKey: '2027Q1',
      asOf: asUtcInstant('2026-11-05T12:00:00.000Z'),
      gating: FIXTURE_EARNINGS_GATING,
      expertSignals: fixtureEarningsExpertSignals(),
    });
    assert.ok(next.nextQuarterEps.conformalInterval);
    assert.equal(next.nextQuarterEps.conformalInterval?.disclaimer, 'NOT_GUARANTEED_UNDER_REGIME_SHIFT');
    assert.ok(next.calibration.sampleCount >= 1);
  });

  it('qualifies HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED', () => {
    const service = createHeliosEarningsStateEstimatorService();
    const state = service.estimate({
      instrumentId: 'eq:AAPL',
      fiscalPeriodKey: '2026Q4',
      asOf: FIXTURE_EARNINGS_AS_OF,
      gating: FIXTURE_EARNINGS_GATING,
      expertSignals: fixtureEarningsExpertSignals(),
      includeResearchReturnDistributions: true,
    });

    const result = evaluateEarn09StateEstimatorQualification({
      hierarchicalMixturePresent: true,
      eightExpertsSupported: state.evidenceContributions.length === 8,
      robustBmaBaseline: true,
      gatingVariablesApplied: state.gatingVariablesUsed.length === 8,
      reliabilityPostOutcomeOnly: true,
      studentTHeavyTails: state.nextQuarterEps.studentT.kind === 'student_t',
      conformalIntervalsPresent: true,
      calibrationMetricsTracked: state.calibration.brierScore !== undefined,
      evidenceContributionsNonCausal: state.evidenceContributions.every(
        (row) => row.nonCausalDisclaimer === 'NOT_A_CAUSAL_ATTRIBUTION',
      ),
      returnDistributionsResearchOnly: state.announcementReturnDistribution?.researchOnly === true,
      noExecutionAuthority: state.grantsExecutionAuthority === false,
    });

    assert.equal(result.marker, HELIOS_EARN09_PROBABILISTIC_STATE_ESTIMATOR_QUALIFIED);
    assert.equal(result.qualified, true);
  });
});
