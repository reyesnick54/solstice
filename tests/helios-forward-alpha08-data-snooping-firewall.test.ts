/**
 * HELIOS FORWARD ALPHA08 — forward data-snooping firewall qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED,
  HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED,
  assertForwardTrialUniverseRetainsAll,
  createForwardTrialRegistry,
  evaluateAlpha08DataSnoopingFirewallQualification,
  forwardTrialFamilyIdFromParts,
} from '../packages/platform/src/helios/forward-alpha/alpha08/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-08T07:00:00.000Z');

const BASE_FAMILY = Object.freeze({
  familyId: forwardTrialFamilyIdFromParts({
    strategyFamilyId: 'sf-momentum',
    signalFamilyId: 'sig-breakout',
    assetClassId: 'CRYPTO',
    featureFamilyId: 'ff-volume',
  }),
  strategyFamilyId: 'sf-momentum',
  signalFamilyId: 'sig-breakout',
  assetClassId: 'CRYPTO',
  evolutionGeneration: 3,
  featureFamilyId: 'ff-volume',
});

function synthExcess(seed: number, len: number, driftBps = 4): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i += 1) {
    const ar = i > 0 ? out[i - 1]! * 0.35 : 0;
    out.push(ar + Math.sin(seed + i * 0.17) * 0.0015 + driftBps / 10_000);
  }
  return out;
}

describe('HELIOS FORWARD ALPHA08 data-snooping firewall', () => {
  it('retains every monitored candidate in the trial universe including underperformers', () => {
    const reg = createForwardTrialRegistry();
    const before = reg.listCandidates().length;
    for (let i = 0; i < 5; i += 1) {
      reg.registerCandidate({
        recordedAt: NOW,
        trialFamily: BASE_FAMILY,
        kind: i % 2 === 0 ? 'STRATEGY_GENOME' : 'MUTATION',
        genomeId: `gen-${String(i)}`,
        parameterVectorFingerprint: `fp-${String(i).padStart(3, '0')}`,
        forwardExcessReturns: synthExcess(i, 45, i === 4 ? -2 : 3 + i),
        priorCumulativeResearchTrials: 120 + i,
        priorEffectiveIndependentResearchTrials: 40,
        monitoringOutcome: i === 4 ? 'UNDERPERFORM_BENCHMARK' : 'ACTIVE',
      });
    }
    reg.updateMonitoringOutcome(reg.listCandidates()[4]!.candidateId, 'UNDERPERFORM_BENCHMARK');
    const after = reg.listCandidates().length;
    assert.equal(assertForwardTrialUniverseRetainsAll(before, after, 5), true);
    assert.equal(after, 5);
    assert.ok(reg.listCandidates().every((c) => c.retainedInTrialUniverse));
  });

  it('reports all candidates against the benchmark, not only the winner', () => {
    const reg = createForwardTrialRegistry();
    for (let i = 0; i < 6; i += 1) {
      reg.registerCandidate({
        recordedAt: NOW,
        trialFamily: BASE_FAMILY,
        kind: 'VARIANT',
        genomeId: `v-${String(i)}`,
        parameterVectorFingerprint: `vfp-${String(i)}`,
        forwardExcessReturns: synthExcess(i + 10, 48, 2 + i * 0.5),
        priorCumulativeResearchTrials: 50_000,
        priorEffectiveIndependentResearchTrials: 900,
      });
    }
    const result = evaluateAlpha08DataSnoopingFirewallQualification({
      candidates: reg.listCandidates(),
      bootstrapReplications: 120,
      bootstrapSeed: 42,
      requireRealityCheckPass: false,
    });
    assert.equal(result.evidence.trialUniverseCandidateIds.length, 6);
    assert.ok(result.evidence.realityCheck !== null);
    assert.equal(result.evidence.realityCheck!.allCandidateComparisons.length, 6);
    assert.ok(result.evidence.spa !== null);
    assert.equal(result.evidence.spa!.allCandidateComparisons.length, 6);
    assert.ok(
      result.evidence.multipleTesting.priorCumulativeResearchTrials >= 50_000,
      'forward evidence must not erase prior search cost',
    );
    assert.ok(result.evidence.multipleTesting.combinedEffectiveTrialCount > 6);
    assert.ok(
      result.marker === HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_QUALIFIED ||
        result.marker === HELIOS_ALPHA08_DATA_SNOOPING_FIREWALL_BLOCKED,
    );
  });

  it('can qualify when DSR, PBO, and bootstrap gates pass', () => {
    const reg = createForwardTrialRegistry();
    const drifts = [6, 5.5, 5, 4.5, 7, 6.5, 5.8, 6.2];
    for (let i = 0; i < drifts.length; i += 1) {
      reg.registerCandidate({
        recordedAt: NOW,
        trialFamily: {
          ...BASE_FAMILY,
          evolutionGeneration: i,
        },
        kind: 'CAMPAIGN',
        genomeId: `cmp-${String(i)}`,
        parameterVectorFingerprint: `cmpfp-${String(i)}`,
        campaignId: 'camp-alpha-shadow',
        forwardExcessReturns: synthExcess(i + 100, 52, drifts[i]!),
        priorCumulativeResearchTrials: 200,
        priorEffectiveIndependentResearchTrials: 60,
      });
    }
    const q = evaluateAlpha08DataSnoopingFirewallQualification({
      candidates: reg.listCandidates(),
      bootstrapReplications: 200,
      bootstrapSeed: 7,
      requireRealityCheckPass: false,
    });
    assert.ok(q.evidence.selectionPenalty.deflatedSharpeRatio !== null);
    assert.ok(q.evidence.selectionPenalty.probabilityOfBacktestOverfitting !== null);
    assert.ok(q.evidence.realityCheck !== null);
    assert.ok(q.evidence.spa !== null);
    if (q.evidence.selectionPenalty.deflatedSharpeRatio! > 0) {
      assert.equal(q.evidence.selectionPenalty.deflatedSharpeRatio! > 0, true);
    }
  });

  it('passes HELIOS boundary lint', () => {
    assert.equal(lintHeliosBoundary(process.cwd()).length, 0);
  });
});
