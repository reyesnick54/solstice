/**
 * HELIOS EVOL06 — Population-based research scheduler (research compute only, not live PBT trading).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { initialBudgetSnapshot } from '../packages/platform/src/helios/index.ts';
import {
  HELIOS_EVOL06_POPULATION_SCHEDULER_QUALIFIED,
  allocateResearchBudgetForWorker,
  asStrategyGenomeId,
  asStrategyGenomeVersion,
  buildOs05ExampleStrategyGenome,
  createEvolutionWorker,
  evaluateEvol06PopulationSchedulerQualification,
  recordFitnessObservation,
  runPopulationSchedulerTick,
} from '../packages/strategy-lab/src/index.ts';
import { STRATEGY_GENOME_FEATURE_MANIFEST_VERSION, STRATEGY_GENOME_NODE_CATALOG_VERSION } from '../packages/strategy-lab/src/os05/catalog.ts';

const NOW = asUtcInstant('2026-11-03T06:00:00.000Z');

function detRandom(seq: number[]) {
  let i = 0;
  return () => {
    const v = seq[i];
    i = (i + 1) % seq.length;
    return v ?? 0;
  };
}

describe('HELIOS EVOL06 — Population research scheduler', () => {
  it('tracks fitness trajectory, uncertainty, and lineage on EvolutionWorker', () => {
    const base = buildOs05ExampleStrategyGenome();
    let w = createEvolutionWorker({
      workerId: 'evw_mr_1',
      genomeId: base.genomeId,
      genomeVersion: base.version,
      name: base.name,
      hypothesis: base.hypothesis,
      nodes: base.nodes,
      parameters: base.parameters,
      niche: Object.freeze({ island: 'MEAN_REVERSION', subNicheId: 'niche_a' }),
      createdAt: NOW,
      createdBy: 'evol06_test',
      featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
      nodeCatalogVersion: STRATEGY_GENOME_NODE_CATALOG_VERSION,
      parentGenomeIds: Object.freeze([]),
      genomeMutationReason: null,
    });
    w = recordFitnessObservation(w, { fitness: 0.2 });
    w = recordFitnessObservation(w, { fitness: 0.35 });
    assert.equal(w.evaluationAge, 2);
    assert.equal(w.lineage.island, 'MEAN_REVERSION');
    assert.equal(w.uncertainty.sampleCount, 2);
    assert.ok(w.uncertainty.confidenceHalfWidth < Number.POSITIVE_INFINITY);
  });

  it('runPopulationSchedulerTick produces explore or exploit with grantsInvestmentCapital false', () => {
    const base = buildOs05ExampleStrategyGenome();

    let strong = createEvolutionWorker({
      workerId: 'evw_strong',
      genomeId: asStrategyGenomeId('sgnm_evol06_strong'),
      genomeVersion: asStrategyGenomeVersion('v1'),
      name: base.name,
      hypothesis: base.hypothesis,
      nodes: base.nodes,
      parameters: base.parameters,
      niche: Object.freeze({ island: 'TREND', subNicheId: 't1' }),
      createdAt: NOW,
      createdBy: 'evol06_test',
      featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
      nodeCatalogVersion: STRATEGY_GENOME_NODE_CATALOG_VERSION,
      parentGenomeIds: Object.freeze([]),
      genomeMutationReason: null,
    });
    strong = recordFitnessObservation(strong, { fitness: 0.8 });
    strong = recordFitnessObservation(strong, { fitness: 0.85 });

    let weak = createEvolutionWorker({
      workerId: 'evw_weak',
      genomeId: asStrategyGenomeId('sgnm_evol06_weak'),
      genomeVersion: asStrategyGenomeVersion('v1'),
      name: base.name,
      hypothesis: base.hypothesis,
      nodes: base.nodes,
      parameters: base.parameters,
      niche: Object.freeze({ island: 'TREND', subNicheId: 't2' }),
      createdAt: NOW,
      createdBy: 'evol06_test',
      featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
      nodeCatalogVersion: STRATEGY_GENOME_NODE_CATALOG_VERSION,
      parentGenomeIds: Object.freeze([]),
      genomeMutationReason: null,
    });
    weak = recordFitnessObservation(weak, { fitness: 0.1 });
    weak = recordFitnessObservation(weak, { fitness: 0.12 });

    const cfg = Object.freeze({
      minimumEvaluationAge: 1,
      migrationCooldownSteps: 100,
      migrationProbability: 0,
      crossIslandFitnessPenalty: 0.05,
      highUncertaintyHalfWidth: 0.25,
      estimatedResearchCostMinor: '500',
      currency: 'USD',
      random: detRandom([0.1, 0.1, 0.1, 0.1]),
    });

    const budget = initialBudgetSnapshot({
      ceilingAmount: '500000',
      unitKind: 'MONETARY_MINOR',
      currency: 'USD',
    });

    const result = runPopulationSchedulerTick([strong, weak], cfg, budget);
    assert.ok(result.exploitDecisions.length + result.exploreDecisions.length > 0);
    for (const row of result.researchAllocations) {
      assert.equal(row.grantsInvestmentCapital, false);
      assert.ok(typeof row.populationUncertainty === 'number');
      assert.ok(typeof row.nicheScarcity === 'number');
      assert.equal(row.computeCostMinor, cfg.estimatedResearchCostMinor);
    }
  });

  it('ResearchBudgetAllocation bridges H20 and carries EVOL06 signals', () => {
    const base = buildOs05ExampleStrategyGenome();
    let w = createEvolutionWorker({
      workerId: 'evw_h20',
      genomeId: base.genomeId,
      genomeVersion: base.version,
      name: base.name,
      hypothesis: base.hypothesis,
      nodes: base.nodes,
      parameters: base.parameters,
      niche: Object.freeze({ island: 'MACRO', subNicheId: 'm1' }),
      createdAt: NOW,
      createdBy: 'evol06_test',
      featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
      nodeCatalogVersion: STRATEGY_GENOME_NODE_CATALOG_VERSION,
      parentGenomeIds: Object.freeze([]),
      genomeMutationReason: null,
    });
    w = recordFitnessObservation(w, { fitness: 0.4 });

    const cfg = Object.freeze({
      minimumEvaluationAge: 1,
      migrationCooldownSteps: 10,
      migrationProbability: 0,
      crossIslandFitnessPenalty: 0.05,
      highUncertaintyHalfWidth: 0.3,
      estimatedResearchCostMinor: '1000',
      currency: 'USD',
      random: () => 0.5,
    });

    const budget = initialBudgetSnapshot({
      ceilingAmount: '100000',
      unitKind: 'MONETARY_MINOR',
      currency: 'USD',
    });

    const alloc = allocateResearchBudgetForWorker(w, budget, cfg, {
      estimatedOpportunitySizeMinor: '25000',
      opportunityHalfLifeHours: 48,
      timeRemainingHours: 24,
      nicheScarcity: 0.4,
      populationUncertainty: 0.2,
      historicalMutationProductivity: 0.6,
      computeCostMinor: cfg.estimatedResearchCostMinor,
    });

    assert.equal(alloc.grantsInvestmentCapital, false);
    assert.ok(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(alloc.expectedInformationValueTier));
  });

  it('qualification marker HELIOS_EVOL06_POPULATION_SCHEDULER_QUALIFIED', () => {
    const q = evaluateEvol06PopulationSchedulerQualification({
      populationSchedulerPresent: true,
      evolutionWorkerTracksLineage: true,
      lateBloomerGuardActive: true,
      islandTaxonomyComplete: true,
      researchAllocationsNeverGrantCapital: true,
    });
    assert.equal(q.marker, HELIOS_EVOL06_POPULATION_SCHEDULER_QUALIFIED);
  });
});
