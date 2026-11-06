import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ratioFromUnits } from '@solstice/risk';

import {
  attemptInsertElite,
  binDescriptorValue,
  compareNicheFitness,
  computeQualityDiversityScore,
  createEmptyNicheArchive,
  defaultNicheDescriptor,
  emptyBehaviorDescriptors,
  evaluateEvol04QualityDiversityQualification,
  nicheArchiveStats,
  strategyNicheFromDescriptor,
} from './index.ts';

describe('quality-diversity (EVOL04)', () => {
  it('assigns distinct niches for value vs momentum style descriptors', () => {
    const base = emptyBehaviorDescriptors();
    const valueDesc = defaultNicheDescriptor({
      ...base,
      assetClass: 'EQUITY',
      signalFamily: 'VALUE',
      holdingHorizonBin: 7,
      turnoverBin: 0,
    });
    const momentumDesc = defaultNicheDescriptor({
      ...base,
      assetClass: 'EQUITY',
      signalFamily: 'MOMENTUM',
      holdingHorizonBin: 0,
      turnoverBin: 7,
    });
    const k1 = strategyNicheFromDescriptor(valueDesc);
    const k2 = strategyNicheFromDescriptor(momentumDesc);
    assert.notEqual(k1, k2);
  });

  it('keeps only the niche-best qualified elite (MAP-Elites)', () => {
    let archive = createEmptyNicheArchive();
    const descriptor = defaultNicheDescriptor({
      ...emptyBehaviorDescriptors(),
      assetClass: 'CRYPTO',
      signalFamily: 'MOMENTUM',
      turnoverBin: 2,
      holdingHorizonBin: 1,
    });
    const fitnessBase = {
      riskAdjustedPerformance: ratioFromUnits(10_000_000n),
      maxDrawdown: ratioFromUnits(5_000_000n),
      stabilityScore: 0.5,
      transactionCostsMinor: 100n,
      capacityScore: 0.7,
      turnoverBps: 5000n,
      aafIntegrityScore: 0.8,
      holdoutRobustnessScore: 0.6,
      walkForwardRobustnessScore: 0.65,
      probabilityOfOverfitting: 0.1,
      deflatedSharpeRatio: 0.5,
    };
    const t = new Date().toISOString();
    const r1 = attemptInsertElite({
      archive,
      descriptor,
      candidate: { candidateId: 'a', genomeHash: 'h1' },
      fitness: fitnessBase,
      qualified: true,
      updatedAt: t,
    });
    assert.equal(r1.result.accepted, true);
    archive = r1.archive;

    const r2 = attemptInsertElite({
      archive,
      descriptor,
      candidate: { candidateId: 'b', genomeHash: 'h2' },
      fitness: {
        ...fitnessBase,
        riskAdjustedPerformance: ratioFromUnits(50_000_000n),
      },
      qualified: true,
      updatedAt: t,
    });
    assert.equal(r2.result.accepted, true);
    assert.equal(r2.result.replaced, true);
    assert.equal(r2.archive.elites.size, 1);

    const r3 = attemptInsertElite({
      archive: r2.archive,
      descriptor,
      candidate: { candidateId: 'c', genomeHash: 'h3' },
      fitness: {
        ...fitnessBase,
        riskAdjustedPerformance: ratioFromUnits(5_000_000n),
      },
      qualified: true,
      updatedAt: t,
    });
    assert.equal(r3.result.accepted, false);
    assert.equal(r3.result.reason, 'inferior_within_niche');
  });

  it('compareNicheFitness prefers higher risk-adjusted performance lexicographically', () => {
    const low = {
      riskAdjustedPerformance: ratioFromUnits(10_000_000n),
      maxDrawdown: ratioFromUnits(5_000_000n),
      stabilityScore: 0.5,
      transactionCostsMinor: 0n,
      capacityScore: 0.5,
      turnoverBps: 0n,
      aafIntegrityScore: 0.5,
      holdoutRobustnessScore: 0.5,
      walkForwardRobustnessScore: 0.5,
      probabilityOfOverfitting: null,
      deflatedSharpeRatio: null,
    };
    const high = { ...low, riskAdjustedPerformance: ratioFromUnits(20_000_000n) };
    assert.equal(compareNicheFitness(high, low), 1);
  });

  it('research budget scales with empty niche fraction', () => {
    const archive = createEmptyNicheArchive();
    const stats = nicheArchiveStats(archive, 100, {
      researchBudgetTotal: 1,
      maxGeneticSimilarityMass: 0.9,
      maxBehavioralSimilarityMean: 0.95,
    });
    assert.equal(stats.filledNicheCount, 0);
    assert.equal(stats.emptyNicheFraction, 1);
    assert.equal(stats.researchBudgetForEmptyNiches, 1);
  });

  it('binDescriptorValue maps range to bins', () => {
    assert.equal(binDescriptorValue(0, 0, 1, 4), 0);
    assert.equal(binDescriptorValue(1, 0, 1, 4), 3);
  });

  it('qualification passes when EVOL04 invariants hold', () => {
    const q = evaluateEvol04QualityDiversityQualification({
      mapElitesArchiveUsed: true,
      nicheLocalFitnessOnly: true,
      multiDimensionalFitness: true,
      behaviorDescriptorsComplete: true,
      emptyNicheExplorationBudgeted: true,
      diversityCollapseMonitored: true,
      qualificationMarkerPresent: true,
    });
    assert.equal(q.qualified, true);
    assert.equal(q.marker, 'HELIOS_EVOL04_QUALITY_DIVERSITY_QUALIFIED');
  });

  it('computeQualityDiversityScore is non-negative', () => {
    const s = computeQualityDiversityScore({
      riskAdjustedPerformance: ratioFromUnits(1n),
      maxDrawdown: ratioFromUnits(1n),
      stabilityScore: 0.5,
      transactionCostsMinor: 0n,
      capacityScore: 0.5,
      turnoverBps: 1000n,
      aafIntegrityScore: 0.5,
      holdoutRobustnessScore: 0.5,
      walkForwardRobustnessScore: 0.5,
      probabilityOfOverfitting: 0.2,
      deflatedSharpeRatio: 0.1,
    });
    assert.ok(s >= 0);
  });
});
