/**
 * HELIOS EVOL09 — evolutionary multiple-testing firewall qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED,
  HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED,
  assertEveryGenomeEvaluationCounts,
  benjaminiHochbergFdr,
  createEvolutionTrialRegistry,
  evaluateEvol09MultipleTestingFirewallQualification,
  freezeResearchProgram,
  unsealHoldoutAfterFreeze,
} from '../packages/platform/src/helios/strategy-evolution/evol09/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-06T11:00:00.000Z');

function synthReturns(seed: number, len: number, driftBps = 3): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i += 1) {
    out.push(Math.sin(seed + i * 0.2) * 0.002 + driftBps / 10_000);
  }
  return out;
}

describe('HELIOS EVOL09 multiple-testing firewall', () => {
  it('counts every genome evaluation as a trial including failures and aborts', () => {
    const reg = createEvolutionTrialRegistry();
    const before = reg.listTrials().length;
    const baseReturns = synthReturns(1, 40, 5);
    reg.recordTrial({
      recordedAt: NOW,
      genomeId: 'g1',
      generation: 0,
      origin: 'MUTATION',
      outcome: 'COMPLETED',
      strategyFamilyId: 'sf-a',
      featureFamilyId: 'ff-x',
      parameterVectorFingerprint: 'fp-a1',
      researchReturns: baseReturns,
      behavioralSignature: baseReturns.slice(0, 12),
    });
    reg.recordTrial({
      recordedAt: NOW,
      genomeId: 'g2',
      generation: 0,
      origin: 'FAILED_COMPILE',
      outcome: 'FAILED',
      strategyFamilyId: 'sf-a',
      featureFamilyId: 'ff-x',
      parameterVectorFingerprint: 'fp-b2',
      researchReturns: [],
      behavioralSignature: null,
    });
    reg.recordTrial({
      recordedAt: NOW,
      genomeId: 'g3',
      generation: 1,
      origin: 'CMA_ES_SAMPLE',
      outcome: 'ABORTED',
      strategyFamilyId: 'sf-b',
      featureFamilyId: 'ff-y',
      parameterVectorFingerprint: 'fp-c3',
      researchReturns: synthReturns(3, 40, 4),
      behavioralSignature: null,
    });
    const after = reg.listTrials().length;
    assert.equal(assertEveryGenomeEvaluationCounts(before, after, 3), true);
    assert.equal(after, 3);
  });

  it('produces qualification evidence with DSR, PSR, PBO, FDR, and sealed holdout', () => {
    const reg = createEvolutionTrialRegistry();
    for (let i = 0; i < 10; i += 1) {
      const r = synthReturns(i + 1, 40, 4 + (i % 3));
      reg.recordTrial({
        recordedAt: NOW,
        genomeId: `gen-${String(i)}`,
        generation: Math.floor(i / 4),
        origin: i % 2 === 0 ? 'CROSSOVER' : 'PARAMETER_SEARCH',
        outcome: i === 7 ? 'FAILED' : 'COMPLETED',
        strategyFamilyId: i < 6 ? 'sf-1' : 'sf-2',
        featureFamilyId: 'ff-q',
        parameterVectorFingerprint: `fp-${String(i).padStart(4, '0')}`,
        researchReturns: r,
        behavioralSignature: r.slice(0, 15),
      });
    }
    const trials = reg.listTrials();
    const result = evaluateEvol09MultipleTestingFirewallQualification({
      trials,
      budget: Object.freeze({
        maxTrialsPerStrategyFamily: 20,
        maxTrialsPerFeatureFamily: 200,
        maxParameterTrials: 200,
        maxTotalTrials: 200,
      }),
    });
    assert.ok(result.evidence.multipleTesting.totalTrials === 10);
    assert.ok(result.evidence.multipleTesting.effectiveIndependentTrials >= 1);
    assert.ok(result.evidence.multipleTesting.parameterTrials === 10);
    assert.ok(result.evidence.deflatedSharpeRatio !== undefined);
    assert.ok(result.evidence.probabilisticSharpeRatio !== undefined);
    assert.ok(result.evidence.probabilityOfBacktestOverfitting !== undefined);
    assert.equal(result.evidence.holdoutStillSealed, true);

    const fdr = benjaminiHochbergFdr({
      pValues: [0.01, 0.04, 0.03, 0.05, 0.02],
      q: 0.05,
    });
    assert.equal(fdr.applicable, true);
    assert.equal(fdr.adjustedPValues.length, 5);
    assert.equal(fdr.rejected.length, 5);

    assert.ok(
      result.marker === HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_QUALIFIED ||
        result.marker === HELIOS_EVOL09_MULTIPLE_TESTING_FIREWALL_BLOCKED,
    );
  });

  it('keeps holdout sealed until freeze, then allows unseal for audit only', () => {
    const reg = createEvolutionTrialRegistry();
    for (let i = 0; i < 12; i += 1) {
      reg.recordTrial({
        recordedAt: NOW,
        genomeId: `x-${String(i)}`,
        generation: 0,
        origin: 'LLM_GENERATED',
        outcome: 'COMPLETED',
        strategyFamilyId: 'sf',
        featureFamilyId: 'ff',
        parameterVectorFingerprint: `zz-${String(i)}`,
        researchReturns: synthReturns(i, 40, 6),
        behavioralSignature: null,
      });
    }
    const q = evaluateEvol09MultipleTestingFirewallQualification({
      trials: reg.listTrials(),
      budget: Object.freeze({
        maxTrialsPerStrategyFamily: 100,
        maxTrialsPerFeatureFamily: 100,
        maxParameterTrials: 100,
        maxTotalTrials: 100,
      }),
    });
    const vault = q.evidence.holdoutVault;
    assert.throws(
      () =>
        unsealHoldoutAfterFreeze(vault, {
          holdoutScore: 1,
          holdoutGradient: [0.1],
          holdoutRejectionReason: null,
        }),
      /frozen/,
    );
    const frozen = freezeResearchProgram(vault);
    const unsealed = unsealHoldoutAfterFreeze(frozen, {
      holdoutScore: 0.42,
      holdoutGradient: [0.01, -0.02],
      holdoutRejectionReason: null,
    });
    assert.equal(unsealed.unsealedHoldoutScore, 0.42);
    assert.equal(unsealed.unsealedHoldoutGradient?.length, 2);
  });

  it('passes HELIOS boundary lint', () => {
    assert.equal(lintHeliosBoundary(process.cwd()).length, 0);
  });
});
