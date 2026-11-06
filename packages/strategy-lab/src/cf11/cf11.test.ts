import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CF11_RESEARCH_POLICY_KNOB_KINDS,
  HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED,
  HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED,
  type BaselinePolicyComparison,
} from './types.ts';
import {
  assertCf11SafetyEnvelopeComplete,
  createCf11PolicySafetyEnvelope,
  evaluateCf11SafePolicyImprovementQualification,
  routeCf11QualifiedToEvol11,
} from './qualification.ts';

function minimalPassingComparison(): BaselinePolicyComparison {
  const env = createCf11PolicySafetyEnvelope();
  assert.equal(assertCf11SafetyEnvelopeComplete(env), true);
  return Object.freeze({
    comparisonId: 'cf11-cmp-fixture',
    candidate: Object.freeze({
      candidateId: 'candidate-a',
      baselinePolicyId: 'baseline-incumbent',
      proposedKnobKinds: [CF11_RESEARCH_POLICY_KNOB_KINDS[0]!],
      safetyEnvelope: env,
    }),
    conservativeBound: Object.freeze({
      lowerConfidenceBoundMinor: 100n,
      meanEstimateMinor: 500n,
      decisionUsesLowerBound: true,
    }),
    overlapScoreBps: 4500n,
    overlapAdequate: true,
    effectiveSampleSize: 200n,
    sufficientEffectiveSample: true,
    opeAgreement: Object.freeze({ estimatorsAgree: true, disagreementReason: null }),
    regimeRobustnessHolds: true,
    executionRealismHolds: true,
  });
}

test('CF11 qualify when conservative gate and diagnostics pass', () => {
  const q = evaluateCf11SafePolicyImprovementQualification(minimalPassingComparison());
  assert.equal(q.qualified, true, q.blockers.join('; '));
  assert.equal(q.marker, HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_QUALIFIED);
  assert.equal(q.route?.nextStage, 'EVOL11_CHAMPION_CHALLENGER');
  assert.equal(q.route?.liveExecution, false);
});

test('CF11 blocks when lower confidence bound below baseline', () => {
  const base = minimalPassingComparison();
  const cmp = Object.freeze({
    ...base,
    conservativeBound: Object.freeze({
      ...base.conservativeBound,
      lowerConfidenceBoundMinor: -1n,
    }),
  });
  const q = evaluateCf11SafePolicyImprovementQualification(cmp);
  assert.equal(q.qualified, false);
  assert.equal(q.marker, HELIOS_CF11_SAFE_POLICY_IMPROVEMENT_BLOCKED);
  assert.ok(q.blockers.includes('lower_confidence_bound_below_baseline'));
});

test('routeCf11QualifiedToEvol11 documents champion/challenger-only path', () => {
  const r = routeCf11QualifiedToEvol11();
  assert.equal(r.strategyLabChampionChallengerOnly, true);
  assert.equal(r.liveExecution, false);
});
