/**
 * HELIOS CF05 — multi-estimator off-policy evaluation (doubly robust OPE).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED,
  evaluateOffPolicyMultiEstimator,
} from '../packages/platform/src/helios/counterfactual-learning/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import type { HeliosOpeLogRow } from '../packages/platform/src/helios/counterfactual-learning/index.ts';

function row(over: Partial<HeliosOpeLogRow> = {}): HeliosOpeLogRow {
  return {
    blockId: 'b0',
    timeBucketId: 't0',
    observedActionId: 'act',
    outcome: 1,
    behaviorPropensity: 0.5,
    targetPropensity: 0.5,
    outcomeModel: { meanUnderObservedAction: 1, meanUnderTargetPolicy: 1 },
    ...over,
  };
}

describe('HELIOS CF05 off-policy evaluation', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((f) => f.message).join('; '));
  });

  it('qualifies a stable multi-block log', () => {
    const rows: HeliosOpeLogRow[] = [];
    for (let b = 0; b < 5; b += 1) {
      for (let i = 0; i < 4; i += 1) {
        rows.push(
          row({
            blockId: `B${b}`,
            timeBucketId: `${b}-${i}`,
            outcome: 1 + i * 0.1,
            behaviorPropensity: 0.5,
            targetPropensity: 0.48 + i * 0.01,
            outcomeModel: {
              meanUnderObservedAction: 1 + i * 0.1,
              meanUnderTargetPolicy: 1.05 + i * 0.05,
            },
          }),
        );
      }
    }
    const out = evaluateOffPolicyMultiEstimator(rows, {
      bootstrap: { confidenceLevel: 0.95, bootstrapReplicates: 120, rngSeed: 42 },
      minimumEffectiveSampleSize: 5,
      maximumImportanceRatio: 5,
      inconclusiveCovThreshold: 0.9,
      switchImportanceCap: 3,
    });
    assert.equal(out.qualification.marker, HELIOS_CF05_DOUBLY_ROBUST_OPE_QUALIFIED);
    assert.equal(out.status, 'OK');
    assert.equal(out.estimates.length, 5);
  });
});
