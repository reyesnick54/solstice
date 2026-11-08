/**
 * HELIOS FORWARD ALPHA — ALPHA07 anytime-valid sequential evidence engine.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  ALPHA07_AUTOCORR_FIXTURE_OBSERVATIONS,
  ALPHA07_FIXTURE_BOUNDS,
  ALPHA07_FIXTURE_OBSERVATIONS,
  ALPHA07_FIXTURE_REGISTERED_AT,
  assessReturnDependence,
  evaluateAlpha07SequentialEvidenceQualification,
  evaluateSequentialAlphaEvidence,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED,
  HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA,
  selectSequentialMethod,
  validateObservationAgainstBounds,
} from '../packages/platform/src/helios/forward-alpha/alpha07-sequential-evidence/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS FORWARD ALPHA ALPHA07 sequential evidence', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('exports required domain types via evaluation', () => {
    const evidence = evaluateSequentialAlphaEvidence({
      config: {
        campaignId: 'alpha07-smoke',
        bounds: ALPHA07_FIXTURE_BOUNDS,
        subjectId: 'MODEL_A',
        benchmarkId: 'BMK_SPY',
        confidenceAlpha: 0.05,
      },
      observations: ALPHA07_FIXTURE_OBSERVATIONS,
      evaluatedAt: asUtcInstant('2026-11-08T12:00:00.000Z'),
    });

    assert.equal(evidence.schema, HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_SCHEMA);
    assert.equal(evidence.observationCount, ALPHA07_FIXTURE_OBSERVATIONS.length);
    assert.ok(evidence.confidenceSequence);
    assert.ok(evidence.eProcess);
    assert.ok(evidence.comparison);
    assert.ok(evidence.confidenceSet);
    assert.ok(evidence.lowerConfidenceBound !== null);
    assert.ok(evidence.upperConfidenceBound !== null);
    assert.ok(evidence.eValue >= 0);
    assert.equal(typeof evidence.evidenceStrength, 'number');
    assert.equal(evidence.metrics.activeReturnMean !== null, true);
    assert.equal(evidence.metrics.hitRate !== null, true);
    assert.equal(evidence.offlineDiagnostics.note, 'OFFLINE_POST_HOC_NOT_ANYTIME_VALID');
    assert.equal(evidence.sequentialInferenceActive, true);
    const fixtureAssumption = assessReturnDependence({
      returns: ALPHA07_FIXTURE_OBSERVATIONS.map((o) => o.activeReturn),
      bounds: ALPHA07_FIXTURE_BOUNDS,
    });
    assert.notEqual(fixtureAssumption, 'ASSUMPTIONS_FAILED');
    assert.notEqual(evidence.method, 'NONE');
  });

  it('does not apply IID sequences when autocorrelation requires blocks', () => {
    const returns = ALPHA07_AUTOCORR_FIXTURE_OBSERVATIONS.map((o) => o.activeReturn);
    const assumption = assessReturnDependence({ returns, bounds: ALPHA07_FIXTURE_BOUNDS });
    assert.equal(assumption, 'DEPENDENCE_REQUIRES_BLOCK_METHOD');
    assert.equal(selectSequentialMethod(assumption), 'BLOCK_CONFIDENCE_SEQUENCE');

    const evidence = evaluateSequentialAlphaEvidence({
      config: {
        campaignId: 'alpha07-autocorr',
        bounds: ALPHA07_FIXTURE_BOUNDS,
        blockSize: 4,
      },
      observations: ALPHA07_AUTOCORR_FIXTURE_OBSERVATIONS,
      evaluatedAt: asUtcInstant('2026-11-08T14:00:00.000Z'),
    });
    assert.equal(evidence.dependenceAssumption, 'DEPENDENCE_REQUIRES_BLOCK_METHOD');
    assert.equal(evidence.method, 'BLOCK_CONFIDENCE_SEQUENCE');
    assert.equal(evidence.sequentialInferenceActive, true);
  });

  it('fails closed when an observation violates predeclared bounds', () => {
    const bad = Object.freeze({
      at: asUtcInstant('2026-11-03T12:00:00.000Z'),
      activeReturn: 0.2,
      benchmarkReturn: 0,
    });
    assert.equal(validateObservationAgainstBounds(bad, ALPHA07_FIXTURE_BOUNDS), false);
    const evidence = evaluateSequentialAlphaEvidence({
      config: { campaignId: 'alpha07-bounds', bounds: ALPHA07_FIXTURE_BOUNDS },
      observations: [bad],
      evaluatedAt: asUtcInstant('2026-11-08T15:00:00.000Z'),
    });
    assert.equal(evidence.dependenceAssumption, 'ASSUMPTIONS_FAILED');
    assert.equal(evidence.sequentialInferenceActive, false);
    assert.equal(evidence.lowerConfidenceBound, null);
  });

  it('emits HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED when checks pass', () => {
    const evidence = evaluateSequentialAlphaEvidence({
      config: {
        campaignId: 'alpha07-qualify',
        bounds: ALPHA07_FIXTURE_BOUNDS,
      },
      observations: ALPHA07_FIXTURE_OBSERVATIONS,
      evaluatedAt: asUtcInstant('2026-11-08T16:00:00.000Z'),
    });
    const result = evaluateAlpha07SequentialEvidenceQualification({
      evidence,
      boundsPredeclared: evidence.bounds.registeredAt === ALPHA07_FIXTURE_REGISTERED_AT,
      offlineDiagnosticsPresent: true,
    });
    assert.equal(result.marker, HELIOS_ALPHA07_SEQUENTIAL_EVIDENCE_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.deepEqual(result.blockers, []);
  });

  it('optional peek: repeated evaluation stays valid under anytime-valid path', () => {
    const config = {
      campaignId: 'alpha07-peek',
      bounds: ALPHA07_FIXTURE_BOUNDS,
    };
    const evaluatedAt = asUtcInstant('2026-11-08T17:00:00.000Z');
    const snapshots = [];
    for (let k = 3; k <= ALPHA07_FIXTURE_OBSERVATIONS.length; k += 1) {
      snapshots.push(
        evaluateSequentialAlphaEvidence({
          config,
          observations: ALPHA07_FIXTURE_OBSERVATIONS.slice(0, k),
          evaluatedAt,
        }),
      );
    }
    for (const snap of snapshots) {
      assert.equal(snap.sequentialInferenceActive, true);
      assert.ok(snap.lowerConfidenceBound !== null);
      assert.ok(snap.upperConfidenceBound !== null);
    }
  });
});
