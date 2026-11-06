/**
 * HELIOS CF06 — distributional off-policy evaluation (counterfactual learning).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED,
  HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED,
  buildCounterfactualOutcomeDistribution,
  compareFactualToEstimatedPolicyDistribution,
  estimateDistributionalPolicyKernelEmbedding,
  estimateDistributionalPolicyQuantileDoublyRobust,
  evaluateCf06DistributionalOpeQualification,
  type Cf06LoggedTrajectorySample,
} from '../packages/platform/src/helios/counterfactual-learning/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

function fixtureSamples(): Cf06LoggedTrajectorySample[] {
  const outcomes = ['-200', '0', '100', '150', '300', '400', '500', '650', '800', '950'];
  const base = outcomes.flatMap((o) =>
    Array.from({ length: 2 }, () => ({
      outcomeMinor: o,
      behaviorPolicyProbabilityBps: 1000,
      evalPolicyProbabilityBps: 1200,
      peakToTroughDrawdownMinor: o,
    })),
  );
  return base;
}

describe('HELIOS CF06 distributional OPE', () => {
  it('passes HELIOS boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('builds factual distribution and compares to quantile IPS estimate', () => {
    const outcomes = fixtureSamples().map((s) => s.outcomeMinor);
    const drawdowns = fixtureSamples().map((s) => s.peakToTroughDrawdownMinor!).filter(Boolean);
    const factual = buildCounterfactualOutcomeDistribution({
      outcomesMinor: outcomes,
      drawdownsMinor: drawdowns,
      drawdownThresholdMinor: '500',
    });
    assert.equal(factual.schema, 'sunrey.helios.cf06.counterfactual-outcome-distribution.v1');
    assert.ok(factual.sampleCount >= 20);
    assert.ok(factual.probabilityOfLossBps != null);

    const alt = estimateDistributionalPolicyQuantileDoublyRobust({
      samples: fixtureSamples(),
      validationStrength: 'WEAK',
      drawdownThresholdMinor: '500',
    });
    assert.equal(alt.estimatorKind, 'QUANTILE_DOUBLY_ROBUST_RESEARCH');
    assert.equal(alt.validationStrength, 'WEAK');

    const cmp = compareFactualToEstimatedPolicyDistribution({ factual, alternativePolicyEstimate: alt });
    assert.equal(cmp.schema, 'sunrey.helios.cf06.estimated-policy-outcome-difference.v1');
    assert.equal(cmp.factual.meanMinor, factual.meanMinor);
    // Naming: must not be profit-focused; schema is EstimatedPolicyOutcomeDifference
    assert.ok(!('profitMissed' in cmp));
  });

  it('kernel embedding path returns KERNEL_DISTRIBUTIONAL_EMBEDDING_RESEARCH', () => {
    const alt = estimateDistributionalPolicyKernelEmbedding({
      samples: fixtureSamples(),
      validationStrength: 'WEAK',
    });
    assert.equal(alt.estimatorKind, 'KERNEL_DISTRIBUTIONAL_EMBEDDING_RESEARCH');
  });

  it('qualifies only under STRONG validation and benign weights', () => {
    const weak = evaluateCf06DistributionalOpeQualification({
      samples: fixtureSamples(),
      declaredValidationStrength: 'WEAK',
    });
    assert.equal(weak.marker, HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED);

    const strong = evaluateCf06DistributionalOpeQualification({
      samples: fixtureSamples(),
      declaredValidationStrength: 'STRONG',
    });
    assert.equal(strong.marker, HELIOS_CF06_DISTRIBUTIONAL_OPE_QUALIFIED, strong.blockers.join('; '));

    const extreme = evaluateCf06DistributionalOpeQualification({
      samples: [
        {
          outcomeMinor: '100',
          behaviorPolicyProbabilityBps: 10,
          evalPolicyProbabilityBps: 900,
        },
      ],
      declaredValidationStrength: 'STRONG',
    });
    assert.equal(extreme.marker, HELIOS_CF06_DISTRIBUTIONAL_OPE_BLOCKED);
  });
});
