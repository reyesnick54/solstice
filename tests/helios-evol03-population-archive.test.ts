/**
 * HELIOS EVOL03 — population, lineage, and evolution archive (research ledger).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '@solstice/domain';
import { ratioPercent } from '@solstice/risk';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';
import { attachGenomeHash } from '../packages/strategy-lab/src/os05/hash.ts';
import { asStrategyGenomeId, asStrategyGenomeVersion, STRATEGY_GENOME_SCHEMA } from '../packages/strategy-lab/src/os05/ids.ts';
import { buildOs05ExampleStrategyGenome } from '../packages/strategy-lab/src/os05/fixtures.ts';
import type { StrategyGenome } from '../packages/strategy-lab/src/os05/types.ts';
import { calculateMetrics } from '../packages/strategy-lab/src/metrics.ts';
import { buildEvaluationEconomics, extendMetrics } from '../packages/strategy-lab/src/evaluation/cost-model.ts';
import { asEvaluationDatasetManifestId } from '../packages/strategy-lab/src/evaluation/ids.ts';
import {
  EvolutionArchive,
  StrategyPopulationStore,
  HELIOS_EVOL03_POPULATION_ARCHIVE_QUALIFIED,
  evaluateEvol03PopulationArchiveQualification,
  asStrategyEvolutionGenerationId,
  asStrategyEvolutionPopulationId,
  asStrategyGeneAttributionId,
} from '../packages/strategy-lab/src/evol03/index.ts';
import type { EvolutionTrial } from '../packages/strategy-lab/src/evol03/types.ts';

const NOW = asUtcInstant('2026-11-06T12:00:00.000Z');

function minimalTrialSlice(
  startMinor: bigint,
  endMinor: bigint,
): EvolutionTrial['evaluation'] {
  const baseMetrics = calculateMetrics({
    startingCapitalMinor: startMinor,
    endingCapitalMinor: endMinor,
    equity: Object.freeze([
      Object.freeze({ at: 't0', totalMinor: startMinor }),
      Object.freeze({ at: 't1', totalMinor: endMinor }),
    ]),
    feesMinor: 0n,
    tradedNotionalMinor: 0n,
    cashMinorSeries: Object.freeze([startMinor]),
    tradeCount: 0,
    winCount: 0,
    lossCount: 0,
    observationDays: 30,
  });
  const econ = buildEvaluationEconomics({
    startingCapitalMinor: startMinor,
    endingCapitalMinor: endMinor,
    feesMinor: 0n,
    spreadCostMinor: 0n,
    slippageCostMinor: 0n,
    operatingResearchCostMinor: 0n,
  });
  const ext = extendMetrics({
    base: baseMetrics,
    economics: econ,
    startingCapitalMinor: startMinor,
    averageHoldingDays: null,
    concentrationTopInstrumentBps: null,
    worstPeriodReturn: null,
  });
  const part = Object.freeze({ metrics: ext, evaluationId: 'seval_fixture_eval' });
  return Object.freeze({
    holdout: part,
    walkForward: null,
    shadow: null,
    paper: null,
  });
}

function childGenomeFrom(parent: StrategyGenome, genomeId: string): StrategyGenome {
  return attachGenomeHash(
    Object.freeze({
      ...parent,
      genomeId: asStrategyGenomeId(genomeId),
      version: asStrategyGenomeVersion('v2'),
      parameters: Object.freeze({
        ...parent.parameters,
        entryZScore: -2.5,
      }),
      lineage: Object.freeze({
        ...parent.lineage,
        parentGenomeIds: Object.freeze([parent.genomeId]),
        mutationReason: 'parameter_nudge',
        createdAt: NOW,
      }),
    }),
  );
}

function divergentGenomeFrom(parent: StrategyGenome, genomeId: string): StrategyGenome {
  const extraNode = Object.freeze({
    nodeId: 'feat_extra_div',
    kind: 'FEATURE' as const,
    catalogRef: 'feature.auxiliary_mark',
    outputRef: 'aux_mark',
    params: Object.freeze({ lookbackDays: 5 }),
  });
  return attachGenomeHash(
    Object.freeze({
      ...parent,
      genomeId: asStrategyGenomeId(genomeId),
      version: asStrategyGenomeVersion('v3'),
      nodes: Object.freeze([...parent.nodes, extraNode]),
      lineage: Object.freeze({
        ...parent.lineage,
        parentGenomeIds: Object.freeze([parent.genomeId]),
        mutationReason: 'structural_augmentation',
        createdAt: NOW,
      }),
    }),
  );
}

describe('HELIOS EVOL03 — Strategy population and evolution archive', () => {
  it('respects helios boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('append-only ledger retains failed trials, supports lineage and guards', () => {
    const parent = buildOs05ExampleStrategyGenome();
    const child = childGenomeFrom(parent, 'sgnm_evol03_child');
    const divergent = divergentGenomeFrom(parent, 'sgnm_evol03_divergent');

    const archive = new EvolutionArchive();
    assert.equal(archive.registerGenomeSnapshot(parent).ok, true);
    assert.equal(archive.registerGenomeSnapshot(child).ok, true);
    assert.equal(archive.registerGenomeSnapshot(divergent).ok, true);

    const pop = new StrategyPopulationStore();
    const populationId = asStrategyEvolutionPopulationId('sepop_evol03_fixture');
    pop.addGenome(populationId, parent.genomeId, 'fixture');
    pop.addGenome(populationId, child.genomeId, 'fixture');
    pop.addGenome(populationId, divergent.genomeId, 'fixture');

    const gen0 = asStrategyEvolutionGenerationId('segen_evol03_g0');
    archive.recordGeneration(
      Object.freeze({
        generationId: gen0,
        ordinal: 0,
        populationId,
        parentGenerationIds: Object.freeze([]),
        trialIds: Object.freeze([]),
        createdAt: NOW,
      }),
    );

    const manifest = Object.freeze({
      manifestId: asEvaluationDatasetManifestId('edmf_evol03_fixture'),
      hash: '0'.repeat(64),
      version: 'fixture-v1',
    });

    const costs = Object.freeze({
      mode: 'EXPLICIT_COSTS' as const,
      commissionMinorPerShare: 0n,
      spreadMinor: 0n,
      slippageMinor: 0n,
      otherCostMinor: 0n,
      namedExplicitly: true as const,
    });

    const twin = Object.freeze({
      twinSchemaVersion: 'os02-parity-v1',
      parityEnvironments: Object.freeze(['HISTORICAL_REPLAY', 'PAPER']),
      capsuleFingerprintUnchangedAcrossEnvironments: true,
      grantsExecutionAuthority: false as const,
      liveFlagsActive: false as const,
      notes: Object.freeze(['fixture execution twin assumptions']),
    });

    const dsr = Object.freeze({
      method: 'HELIOS_EVOL03_DSR_PLACEHOLDER' as const,
      value: null,
      notes: Object.freeze(['dsr placeholder until trial ensemble is wired']),
    });

    const pbo = Object.freeze({
      method: 'HELIOS_EVOL03_PBO_PLACEHOLDER' as const,
      value: null,
      notes: Object.freeze(['pbo placeholder']),
    });

    const aaf = Object.freeze({
      certificateId: 'aaf_evol03_cert',
      certificateHash: '1'.repeat(64),
      schemaVersion: 'aaf-v1',
    });

    const failed = archive.appendTrial(
      Object.freeze({
        genomeId: parent.genomeId,
        genomeHash: parent.lineage.genomeHash,
        parents: Object.freeze([]),
        operator: 'INITIAL',
        generationId: gen0,
        populationId,
        datasetManifest: manifest,
        aafCertificate: aaf,
        evaluation: minimalTrialSlice(1_000_000n, 900_000n),
        transactionCostAssumptions: costs,
        executionTwinAssumptions: twin,
        deflatedSharpeRatio: dsr,
        probabilityOfBacktestOverfitting: pbo,
        failure: Object.freeze({
          codes: Object.freeze(['UNDERPERFORMANCE']),
          messages: Object.freeze(['fixture negative net economics']),
        }),
        promotionState: 'RESEARCH',
        createdAt: NOW,
      }),
    );
    assert.equal(failed.ok, true);
    if (!failed.ok) {
      return;
    }

    const success = archive.appendTrial(
      Object.freeze({
        genomeId: child.genomeId,
        genomeHash: child.lineage.genomeHash,
        parents: Object.freeze([parent.genomeId]),
        operator: 'MUTATE_PARAMETERS',
        generationId: gen0,
        populationId,
        datasetManifest: manifest,
        aafCertificate: aaf,
        evaluation: minimalTrialSlice(1_000_000n, 1_050_000n),
        transactionCostAssumptions: costs,
        executionTwinAssumptions: twin,
        deflatedSharpeRatio: dsr,
        probabilityOfBacktestOverfitting: pbo,
        failure: null,
        promotionState: 'EVALUATED',
        createdAt: NOW,
      }),
    );
    assert.equal(success.ok, true);
    if (!success.ok) {
      return;
    }

    assert.equal(archive.listTrials().length, 2);
    assert.equal(archive.trialsForGenome(parent.genomeId).length, 1);

    assert.deepEqual([...new Set(archive.ancestors(child.genomeId))], [parent.genomeId]);
    assert.deepEqual([...new Set(archive.descendants(parent.genomeId))], [child.genomeId]);
    assert.equal(archive.commonAncestor(parent.genomeId, child.genomeId), parent.genomeId);
    const ancestry = archive.genomeAncestry(child.genomeId);
    assert.deepEqual([...new Set(ancestry.roots)], [parent.genomeId]);
    assert.ok(ancestry.depth >= 1);
    assert.ok(archive.lineageDepth(child.genomeId) >= 1);
    assert.deepEqual(archive.operatorHistory(child.genomeId), ['INITIAL', 'MUTATE_PARAMETERS']);

    const dup = archive.appendTrial(
      Object.freeze({
        genomeId: parent.genomeId,
        genomeHash: parent.lineage.genomeHash,
        parents: Object.freeze([]),
        operator: 'INITIAL',
        generationId: gen0,
        populationId,
        datasetManifest: manifest,
        aafCertificate: aaf,
        evaluation: minimalTrialSlice(1_000_000n, 800_000n),
        transactionCostAssumptions: costs,
        executionTwinAssumptions: twin,
        deflatedSharpeRatio: dsr,
        probabilityOfBacktestOverfitting: pbo,
        failure: Object.freeze({ codes: Object.freeze(['RERUN']), messages: Object.freeze(['second failure']) }),
        promotionState: 'RESEARCH',
        createdAt: NOW,
      }),
    );
    assert.equal(dup.ok, true);
    assert.equal(archive.trialsForGenome(parent.genomeId).length, 2);

    const clone = attachGenomeHash(
      Object.freeze({
        schema: STRATEGY_GENOME_SCHEMA,
        genomeId: asStrategyGenomeId('sgnm_evol03_clone_a'),
        version: asStrategyGenomeVersion('v1'),
        name: parent.name,
        hypothesis: parent.hypothesis,
        nodes: parent.nodes,
        parameters: parent.parameters,
        lineage: Object.freeze({
          ...parent.lineage,
          parentGenomeIds: Object.freeze([parent.genomeId]),
          createdAt: NOW,
        }),
      }),
    );
    const cloneB = attachGenomeHash(
      Object.freeze({
        ...clone,
        genomeId: asStrategyGenomeId('sgnm_evol03_clone_b'),
        lineage: Object.freeze({
          ...clone.lineage,
          createdAt: NOW,
        }),
      }),
    );
    archive.registerGenomeSnapshot(clone);
    archive.registerGenomeSnapshot(cloneB);

    const crossBlock = archive.rejectCrossNearIdenticalParents({
      parentA: clone.genomeId,
      parentB: cloneB.genomeId,
      nearIdenticalThreshold: ratioPercent(1n),
    });
    assert.equal(crossBlock.ok, false);
    if (crossBlock.ok) {
      return;
    }
    assert.equal(crossBlock.error.code, 'NEAR_IDENTICAL_PARENTS');

    const attr = archive.appendGeneAttribution(
      Object.freeze({
        attributionId: asStrategyGeneAttributionId('sgattr_exit_rule_1'),
        sourceGenomeId: parent.genomeId,
        sourceTrialId: failed.value.trialId,
        componentKind: 'EXIT',
        componentRef: 'exit.zscore_normalize_or_stop',
        notes: 'Exit rule looked stable in isolation; causality unproven.',
        causalityClaim: 'NONE_WITHOUT_CONTROLLED_TEST',
        createdAt: NOW,
      }),
    );
    assert.equal(attr.ok, true);

    const diversity = archive.lineageDiversityForPopulation(populationId, pop.genomesOf(populationId));
    assert.ok(diversity.meanPairwiseCombinedDissimilarity.units > 0n);

    const qual = evaluateEvol03PopulationArchiveQualification({
      appendOnlyTrials: true,
      failedTrialRetained: true,
      lineageQueriesImplemented: true,
      inbreedingGuardImplemented: crossBlock.ok === false,
      geneAttributionWithoutCausality: true,
    });
    assert.equal(qual.marker, HELIOS_EVOL03_POPULATION_ARCHIVE_QUALIFIED, qual.blockers.join('; '));
  });
});
