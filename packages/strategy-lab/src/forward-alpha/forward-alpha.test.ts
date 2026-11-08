import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';

import { asUtcInstant } from '@solstice/domain';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

import {
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED,
  FORWARD_ALPHA_EVIDENCE_LANES,
  FORWARD_ALPHA_SYNTHETIC_FIXTURE_FORBIDDEN_STATUSES,
} from './taxonomy.ts';
import { assertEvidenceLanesDisjoint, assertCannotRelabelBacktestAsForward } from './lane-separation.ts';
import { evaluateForwardAlphaDecisionIntegrity } from './forward-requirements.ts';
import {
  alpha01EngineeringQualificationChecks,
  evaluateAlpha01ForwardEvidenceDomainEngineering,
  resolveForwardAlphaStatus,
} from './qualification.ts';
import { buildAlpha01SyntheticFixtureManifest } from './fixtures.ts';
import { forwardAlphaLaneForEvaluationMode } from '../evaluation/evidence-lanes.ts';
import { assertEvolTrialLanesSeparated } from '../evolution/forward-alpha-bridge.ts';

test('ALPHA01 engineering qualification', () => {
  const checks = alpha01EngineeringQualificationChecks(REPO_ROOT);
  const result = evaluateAlpha01ForwardEvidenceDomainEngineering(checks);
  assert.equal(result.qualified, true, result.blockers.join('; '));
  assert.equal(result.marker, HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED);
});

test('evidence lanes are pairwise non-mergeable across historical and forward', () => {
  const violations = assertEvidenceLanesDisjoint(['HISTORICAL_BACKTEST', 'FORWARD_SHADOW']);
  assert.ok(violations.length > 0);
  assert.equal(
    assertCannotRelabelBacktestAsForward({
      fromLane: 'HISTORICAL_BACKTEST',
      toLane: 'FORWARD_SHADOW',
    }),
    false,
  );
});

test('forward decision integrity requires seal before knowable outcome', () => {
  const decisionAt = asUtcInstant('2026-01-02T12:00:00.000Z');
  const outcomeKnowable = asUtcInstant('2026-01-02T13:00:00.000Z');
  const pass = evaluateForwardAlphaDecisionIntegrity({
    decisionAt,
    earliestOutcomeKnowableAt: outcomeKnowable,
    sealedAt: decisionAt,
    immutableAfterSeal: true,
    strategyVersionFrozen: true,
    featureVersionsKnown: true,
    marketDataChronological: true,
    outcomeAttachedAt: asUtcInstant('2026-01-02T14:00:00.000Z'),
    evidenceLane: 'FORWARD_SHADOW',
    attemptedRelabelFromLane: null,
    syntheticHistoricalReplay: false,
  });
  assert.equal(pass.qualifiesAsForward, true, pass.failures.join('; '));
});

test('REPLAY evaluation mode does not map to a forward lane', () => {
  assert.equal(forwardAlphaLaneForEvaluationMode('REPLAY'), null);
  assert.equal(forwardAlphaLaneForEvaluationMode('SHADOW_FORWARD'), 'FORWARD_SHADOW');
});

test('synthetic fixture cannot mint FORWARD_ALPHA_SUPPORTED', () => {
  const manifest = buildAlpha01SyntheticFixtureManifest();
  assert.equal(manifest.syntheticFixture, true);
  assert.ok(!FORWARD_ALPHA_SYNTHETIC_FIXTURE_FORBIDDEN_STATUSES.includes(manifest.campaign.status));
  const { status } = resolveForwardAlphaStatus({
    architectureQualified: true,
    campaignConfigured: true,
    accumulatingForwardEvidence: true,
    edgeCandidateMetricsPass: true,
    forwardAlphaSupportedEvidence: true,
    forwardRobustnessSupported: true,
    paperImplementationSupported: true,
    liveCapitalEvidence: true,
    syntheticFixture: true,
    architectureTestOnly: false,
  });
  assert.notEqual(status, 'LIVE_ALPHA_SUPPORTED');
  assert.notEqual(status, 'FORWARD_ALPHA_SUPPORTED');
});

test('EVOL trial lane bindings stay separated', () => {
  assert.equal(assertEvolTrialLanesSeparated(['HISTORICAL_TRIAL', 'FORWARD_SHADOW_TRIAL']), false);
  assert.equal(assertEvolTrialLanesSeparated(['WALK_FORWARD_TRIAL', 'NESTED_HOLDOUT']), true);
});

test('forward alpha evidence lane catalog is complete', () => {
  assert.equal(FORWARD_ALPHA_EVIDENCE_LANES.length, 6);
});
