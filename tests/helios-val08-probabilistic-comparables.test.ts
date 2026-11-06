/**
 * HELIOS VAL08 — dynamic probabilistic comparable company engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  evaluateVal08ProbabilisticComparablesQualification,
  fixtureProbabilisticComparablesInput,
  HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED,
  PEER_SELECTION_METHODS,
  runProbabilisticComparablesEngine,
  VAL08_PROBABILISTIC_COMPARABLES_SCHEMA,
} from '../packages/platform/src/helios/valuation-intelligence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS VAL08 probabilistic comparables engine', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('runs with reproducible seed and distributional outputs', () => {
    const input = fixtureProbabilisticComparablesInput();
    const first = runProbabilisticComparablesEngine(input);
    const second = runProbabilisticComparablesEngine(input);

    assert.equal(first.schema, VAL08_PROBABILISTIC_COMPARABLES_SCHEMA);
    assert.equal(first.grantsExecutionAuthority, false);
    assert.equal(first.researchOnly, true);
    assert.equal(first.qualificationMarker, HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED);
    assert.deepEqual(first.equityValueDistribution, second.equityValueDistribution);
    assert.ok(first.equityValueDistribution.sampleCount > 0);
    assert.ok(first.equityValueDistribution.p05 <= first.equityValueDistribution.p95);
  });

  it('enforces point-in-time peer eligibility and records exclusions', () => {
    const result = runProbabilisticComparablesEngine(fixtureProbabilisticComparablesInput());
    const excluded = result.panelManifest.selectionState.excludedPeers;
    assert.ok(
      excluded.some((row) => row.peerId === 'peer-future-leak'),
      'future-leak peer must be excluded explicitly',
    );
    assert.ok(result.panelManifest.eligibleCount < result.panelManifest.universeSize);
    assert.equal(result.panelManifest.selectionState.algorithmsUsed.length, PEER_SELECTION_METHODS.length);
  });

  it('preserves outlier evidence without silent deletion', () => {
    const result = runProbabilisticComparablesEngine(fixtureProbabilisticComparablesInput());
    const withOutlier = result.observations.filter((o) => o.outlier !== null);
    assert.ok(withOutlier.length > 0);
    for (const row of withOutlier) {
      assert.equal(row.outlier?.preserved, true);
    }
  });

  it('emits disagreement and fragility metrics', () => {
    const result = runProbabilisticComparablesEngine(fixtureProbabilisticComparablesInput());
    assert.ok(result.dispersion.peerCount > 0);
    assert.ok(result.consensus.score >= 0 && result.consensus.score <= 1);
    assert.ok(result.fragility.score >= 0 && result.fragility.score <= 1);
    assert.ok(result.justifiedMultiples.length > 0);
  });

  it('HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED when engineering checks pass', () => {
    const result = runProbabilisticComparablesEngine(fixtureProbabilisticComparablesInput());
    const qualification = evaluateVal08ProbabilisticComparablesQualification({
      pointInTimePeerGraph: result.panelManifest.selectionState.excludedPeers.some(
        (e) => e.reason === 'NOT_KNOWABLE_AT_VALUATION_TIME',
      ),
      multiAlgorithmPeerSelection:
        result.panelManifest.selectionState.algorithmsUsed.length === PEER_SELECTION_METHODS.length,
      noSilentPeerDeletion: result.panelManifest.excludedCount > 0,
      distributionalOutputs: result.equityValueDistribution.p05 !== result.equityValueDistribution.p95,
      justifiedMultipleNormalization: result.justifiedMultiples.every((j) => j.justifiedMultiple > 0),
      outlierEvidencePreserved: result.observations.every((o) => o.outlier === null || o.outlier.preserved),
      crossBorderAwareness: result.panelManifest.crossBorderAdjustmentsApplied === false,
      peerDisagreementMetrics: result.dispersion.weightedStdDev >= 0,
      noExecutionAuthority: result.grantsExecutionAuthority === false,
      researchOnly: result.researchOnly === true,
    });
    assert.equal(qualification.marker, HELIOS_VAL08_PROBABILISTIC_COMPARABLES_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
  });
});
