/**
 * HELIOS counterfactual learning — CF04 direct counterfactual outcome model.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CF04_ENGINEERING_TRUTH_CHECKS,
  evaluateCf04OutcomeModelQualification,
  fitCrossFitOutcomeModel,
  fixtureCf04TrainingRows,
  HELIOS_CF04_OUTCOME_MODEL_QUALIFIED,
  HELIOS_CF04_OUTCOME_MODEL_SCHEMA,
  OUTCOME_DIMENSION_KEYS,
} from '../packages/platform/src/helios/counterfactual-learning/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

describe('HELIOS CF04 counterfactual outcome model', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('fits cross-fit model with multi-dimensional quantile output and calibration slices', () => {
    const rows = fixtureCf04TrainingRows(28);
    const model = fitCrossFitOutcomeModel(rows, {
      baselineKind: 'LINEAR_RIDGE',
      constraints: Object.freeze({
        requireChronologicalSplits: true,
        requireCrossFitting: true,
        blockIssuerInstrumentLeakage: true,
        requireAafCertifiedFeatures: true,
        requireRegimeAwareValidation: true,
        splitPolicy: Object.freeze({ foldCount: 4, minTrainRows: 3 }),
      }),
    });

    assert.ok(model.oofRowCount > 0);
    assert.equal(model.describe().schema, HELIOS_CF04_OUTCOME_MODEL_SCHEMA);
    assert.deepEqual(model.describe().outcomeDimensions, OUTCOME_DIMENSION_KEYS);

    const pred = model.predict({
      alternativeActionId: 'act_demo',
      evaluationAsOfUtcMs: 1_710_000_000_000,
      features: {
        featureId: 'aaf_demo',
        certifiedAtUtcMs: 1_710_000_000_000,
        certificationMarker: 'AAF_CERT',
        values: [0.1, -0.2, 0.05],
      },
      regime: 'NEUTRAL',
      liquidityBucket: 'NORMAL',
    });
    assert.equal(pred.grantsExecutionAuthority, false);
    assert.equal(pred.researchOnly, true);
    assert.equal(pred.distribution.kind, 'QUANTILES');
    for (const dim of OUTCOME_DIMENSION_KEYS) {
      assert.ok(pred.distribution.quantiles[dim] !== undefined);
      const q = pred.distribution.quantiles[dim]!;
      assert.ok(q[0.5] !== undefined);
    }

    const cal = model.calibration;
    assert.ok('mae' in cal.global && 'rmse' in cal.global);
    assert.ok('quantileCoverage' in cal.global);
    assert.equal(cal.byRegime.length >= 1, true);
    assert.equal(cal.byAction.length >= 1, true);
    assert.equal(cal.byLiquidityBucket.length >= 1, true);
    assert.equal(cal.certifiedMarker, undefined);
  });

  it('qualifies engineering checklist', () => {
    const q = evaluateCf04OutcomeModelQualification(CF04_ENGINEERING_TRUTH_CHECKS);
    assert.equal(q.marker, HELIOS_CF04_OUTCOME_MODEL_QUALIFIED);
    assert.equal(q.qualified, true);
    assert.equal(q.blockers.length, 0);
  });
});
