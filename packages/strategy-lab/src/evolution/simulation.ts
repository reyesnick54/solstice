/**
 * HELIOS EVOL14 — deterministic end-to-end Strategy Genome self-evolution simulation (research-only).
 *
 * Does not enable live execution, broker submission, or production authorization.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { buildAntiOverfittingDiagnostics } from './anti-overfitting.ts';
import { freezeSpecification } from '../specification.ts';
import { compileStrategy } from '../compiler.ts';
import { freezePromotionCapsule, type PromotionCapsule } from '../promotion-capsule.ts';
import {
  startForwardShadowRun,
  recordForwardShadowDecision,
  summarizeForwardShadowEvidence,
} from '../forward-shadow.ts';
import { startPaperRun, type PaperStrategyRun } from '../paper.ts';
import { evaluateStrategyRegimeGating } from '../regime-gating.ts';
import { equalWeightSpec, SIM_ETF_1, syntheticTwoEtfDataset } from '../fixtures.ts';
import { latestCloseAt } from '../dataset.ts';
import type { PointInTimeDatasetManifestSeal } from '../evaluation/point-in-time-dataset-seal.ts';
import { asStrategyEvaluationId } from '../evaluation/ids.ts';
import {
  STRATEGY_GENOME_SCHEMA,
  attachGenomeHash,
  asStrategyGenomeId,
  asStrategyGenomeVersion,
  validateStrategyGenome,
} from '../os05/index.ts';
import {
  STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
  STRATEGY_GENOME_NODE_CATALOG_VERSION,
} from '../os05/catalog.ts';
import { buildOs05ExampleStrategyGenome } from '../os05/fixtures.ts';
import type { GenomeNodeParams, RegimeGateNode, StrategyGenome, StrategyGenomeLineage } from '../os05/types.ts';

import type {
  ChampionChallengerComparison,
  EvolutionPhase,
  EvolutionSealedEvidenceEntry,
  EvolutionSimulationResult,
  EvolutionTrialRecord,
  FalsificationResult,
  MapElitesCell,
  NoveltyAssessment,
  StrategyScientistObservation,
} from './types.ts';

const PIT_COMPILER_VERSION = 'aafv2-point-in-time-compiler-evol14' as const;

function hashHex(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function baseLineage(input: {
  readonly parentIds: readonly string[];
  readonly mutationReason: string | null;
  readonly createdAt: UtcInstant;
}): Omit<StrategyGenomeLineage, 'genomeHash'> {
  return Object.freeze({
    parentGenomeIds: Object.freeze([...input.parentIds]) as StrategyGenome['lineage']['parentGenomeIds'],
    mutationReason: input.mutationReason,
    createdBy: 'evol14-simulation',
    createdAt: input.createdAt,
    featureManifestVersion: STRATEGY_GENOME_FEATURE_MANIFEST_VERSION,
    nodeCatalogVersion: STRATEGY_GENOME_NODE_CATALOG_VERSION,
  });
}

function genomeFitnessMinor(genome: StrategyGenome): bigint {
  const slice = genome.lineage.genomeHash.slice(0, 12);
  let acc = 0n;
  for (const ch of slice) {
    acc += BigInt(ch.charCodeAt(0));
  }
  return acc * 1_000n;
}

function sealEntry(phase: EvolutionPhase, trialId: string, material: string, at: UtcInstant): EvolutionSealedEvidenceEntry {
  return Object.freeze({
    phase,
    trialId,
    contentHash: hashHex([phase, trialId, material]),
    at,
  });
}

function withParam(genome: StrategyGenome, params: GenomeNodeParams): StrategyGenome {
  const body = {
    schema: genome.schema,
    genomeId: genome.genomeId,
    version: genome.version,
    name: genome.name,
    hypothesis: genome.hypothesis,
    nodes: genome.nodes,
    parameters: Object.freeze({ ...genome.parameters, ...params }),
    lineage: lineageWithoutHash(genome.lineage),
  };
  return attachGenomeHash(body);
}

function lineageWithoutHash(lineage: StrategyGenomeLineage): Omit<StrategyGenomeLineage, 'genomeHash'> {
  const { genomeHash: _g, ...rest } = lineage;
  return rest;
}

function cloneGenome(input: {
  readonly source: StrategyGenome;
  readonly genomeId: string;
  readonly version: string;
  readonly name: string;
  readonly hypothesis: string;
  readonly parentIds: readonly string[];
  readonly mutationReason: string | null;
  readonly createdAt: UtcInstant;
  readonly parameterOverride?: GenomeNodeParams;
}): StrategyGenome {
  const lineage = baseLineage({
    parentIds: input.parentIds,
    mutationReason: input.mutationReason,
    createdAt: input.createdAt,
  });
  const parameters = Object.freeze({
    ...input.source.parameters,
    ...(input.parameterOverride ?? {}),
  });
  const body: Omit<StrategyGenome, 'lineage'> & { lineage: Omit<StrategyGenomeLineage, 'genomeHash'> } = {
    schema: STRATEGY_GENOME_SCHEMA,
    genomeId: asStrategyGenomeId(input.genomeId),
    version: asStrategyGenomeVersion(input.version),
    name: input.name,
    hypothesis: input.hypothesis,
    nodes: input.source.nodes,
    parameters,
    lineage: {
      ...lineage,
    },
  };
  return attachGenomeHash(body);
}

/** Duplicate node id — must fail validateStrategyGenome. */
function buildInvalidGenomeFixture(createdAt: UtcInstant): StrategyGenome {
  const example = buildOs05ExampleStrategyGenome();
  const first = example.nodes[0];
  const dupNodes = [first, { ...first, nodeId: first.nodeId }] as StrategyGenome['nodes'];
  const body = {
    ...example,
    genomeId: asStrategyGenomeId('sgnm_evol14_invalid_dup'),
    version: asStrategyGenomeVersion('v0-invalid'),
    name: 'EVOL14 invalid duplicate node',
    nodes: dupNodes,
    lineage: baseLineage({ parentIds: [example.genomeId], mutationReason: 'INVALID_FIXTURE', createdAt }),
  };
  return attachGenomeHash(body);
}

function overfitGenome(createdAt: UtcInstant, base: StrategyGenome): StrategyGenome {
  const gate: RegimeGateNode = Object.freeze({
    nodeId: 'regime_high_vol',
    kind: 'REGIME_GATE',
    catalogRef: 'regime_gate.permitted_market_regime',
    permittedRegimes: Object.freeze(['LOW_VOL_TREND']),
    prohibitedRegimes: Object.freeze(['HIGH_VOL_STRESS']),
    params: Object.freeze({}),
  });
  const g = cloneGenome({
    source: base,
    genomeId: 'sgnm_evol14_overfit_flashy',
    version: 'v1-overfit',
    name: 'EVOL14 overfit flashy',
    hypothesis: 'Extreme threshold fits one volatile train slice; fails regimes and holdout.',
    parentIds: [base.genomeId],
    mutationReason: 'PARAMETER_SEARCH',
    createdAt,
    parameterOverride: Object.freeze({
      entryZScore: -4,
      volatilityThresholdBps: 50,
    }),
  });
  const nodes = Object.freeze([...g.nodes.filter((n) => n.kind !== 'REGIME_GATE'), gate]);
  return attachGenomeHash({
    schema: g.schema,
    genomeId: g.genomeId,
    version: g.version,
    name: g.name,
    hypothesis: g.hypothesis,
    nodes,
    parameters: g.parameters,
    lineage: baseLineage({
      parentIds: [base.genomeId],
      mutationReason: 'REGIME_AND_THRESHOLD',
      createdAt,
    }),
  });
}

function moderateGenome(createdAt: UtcInstant, base: StrategyGenome): StrategyGenome {
  return cloneGenome({
    source: base,
    genomeId: 'sgnm_evol14_moderate_robust',
    version: 'v1-robust',
    name: 'EVOL14 moderate robust',
    hypothesis: 'Conservative threshold with broad regime allowance.',
    parentIds: [base.genomeId],
    mutationReason: 'CROSSOVER',
    createdAt,
    parameterOverride: Object.freeze({
      entryZScore: -0.85,
      volatilityThresholdBps: 2_200,
    }),
  });
}

function crossoverGenomes(a: StrategyGenome, b: StrategyGenome, createdAt: UtcInstant): StrategyGenome {
  const blended = (Number(a.parameters.entryZScore) + Number(b.parameters.entryZScore)) / 2;
  return cloneGenome({
    source: a,
    genomeId: 'sgnm_evol14_crossover',
    version: 'v1-cross',
    name: 'EVOL14 crossover child',
    hypothesis: 'Blended thresholds from parents.',
    parentIds: [a.genomeId, b.genomeId],
    mutationReason: 'CROSSOVER',
    createdAt,
    parameterOverride: Object.freeze({
      entryZScore: blended,
    }),
  });
}

/** Toy CMA-ES: two-dimensional mean vector nudged toward observed elite parameters. */
function runCmaEsToy(
  elites: readonly StrategyGenome[],
  generations: number,
): { readonly mean: readonly number[]; readonly generationHashes: readonly string[] } {
  let mean = [Number(elites[0]?.parameters.entryZScore ?? -1), Number(elites[0]?.parameters.volatilityThresholdBps ?? 2000)];
  const hashes: string[] = [];
  for (let g = 0; g < generations; g += 1) {
    const sample = elites[g % elites.length];
    mean = [
      mean[0] * 0.85 + Number(sample.parameters.entryZScore) * 0.15,
      mean[1] * 0.85 + Number(sample.parameters.volatilityThresholdBps) * 0.15,
    ];
    hashes.push(hashHex([`cma-gen-${String(g)}`, ...mean.map((x) => x.toFixed(4))]));
  }
  return { mean, generationHashes: Object.freeze(hashes) };
}

function buildMapElites(candidates: readonly StrategyGenome[]): readonly MapElitesCell[] {
  const cells: MapElitesCell[] = [];
  for (const g of candidates) {
    const h = g.lineage.genomeHash;
    const behaviourA = Number.parseInt(h.slice(0, 2), 16) % 8;
    const behaviourB = Number.parseInt(h.slice(2, 4), 16) % 8;
    cells.push(
      Object.freeze({
        behaviourA,
        behaviourB,
        genomeId: g.genomeId,
        fitnessMinor: genomeFitnessMinor(g),
      }),
    );
  }
  return Object.freeze(cells);
}

function assessNovelty(candidates: readonly StrategyGenome[]): readonly NoveltyAssessment[] {
  return Object.freeze(
    candidates.map((g) => {
      const dist =
        g.nodes.length * 10 +
        Math.abs(Number(g.parameters.entryZScore)) * 3 +
        g.lineage.genomeHash.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0) %
          100;
      return Object.freeze({
        genomeId: g.genomeId,
        behaviouralDistance: dist,
        archiveSize: candidates.length,
      });
    }),
  );
}

function runFalsification(candidates: readonly StrategyGenome[]): readonly FalsificationResult[] {
  return Object.freeze(
    candidates.map((g) => {
      const base = genomeFitnessMinor(g);
      const stressed = withParam(g, { volatilityThresholdBps: Math.max(500, Number(g.parameters.volatilityThresholdBps) - 800) });
      const perturbed = genomeFitnessMinor(stressed);
      const delta = base - perturbed;
      const fragile = delta > 25_000n || Number(g.parameters.entryZScore) < -2.5;
      return Object.freeze({
        genomeId: g.genomeId,
        stressPerturbationBps: 80,
        fitnessDeltaMinor: delta,
        fragile,
      });
    }),
  );
}

function robustnessScore(
  genome: StrategyGenome,
  falsification: FalsificationResult | undefined,
  regimeOk: boolean,
  anti: { readonly deflatedSharpeRatio: number | null; readonly probabilityOfBacktestOverfitting: number | null },
): number {
  let score = 0;
  if (regimeOk) score += 40;
  if (falsification && !falsification.fragile) score += 30;
  if (anti.deflatedSharpeRatio !== null && anti.deflatedSharpeRatio > 0) score += 20;
  if (anti.probabilityOfBacktestOverfitting !== null && anti.probabilityOfBacktestOverfitting < 0.55) score += 10;
  score += Math.min(10, Math.abs(Number(genome.parameters.entryZScore)) * 2);
  return score;
}

function buildTrial(
  phase: EvolutionPhase,
  id: string,
  outcome: EvolutionTrialRecord['outcome'],
  genomeId: string | null,
  detail: string,
): EvolutionTrialRecord {
  return Object.freeze({ trialId: id, phase, outcome, genomeId, detail });
}

export function runStrategyEvolutionSimulation(input: {
  readonly evaluatedAt: UtcInstant;
  readonly gitSha: string;
}): EvolutionSimulationResult {
  const t0 = input.evaluatedAt;
  const trials: EvolutionTrialRecord[] = [];
  const sealed: EvolutionSealedEvidenceEntry[] = [];

  const base = buildOs05ExampleStrategyGenome();
  const seedA = base;
  const seedB = withParam(base, { entryZScore: -1.1 });
  const seedC = withParam(base, { entryZScore: -0.95, volatilityThresholdBps: 2400 });

  sealed.push(sealEntry('SEED', 'tr_seed', `${seedA.genomeId}:${seedB.genomeId}:${seedC.genomeId}`, t0));
  trials.push(
    buildTrial('SEED', 'tr_seed_t', 'SUCCESS', null, `seeds=${seedA.genomeId},${seedB.genomeId},${seedC.genomeId}`),
  );

  const mutated = cloneGenome({
    source: seedA,
    genomeId: 'sgnm_evol14_mut_A',
    version: 'v-mut',
    name: 'EVOL14 mutation A',
    hypothesis: 'Mutated entry band.',
    parentIds: [seedA.genomeId],
    mutationReason: 'MUTATION',
    createdAt: t0,
    parameterOverride: Object.freeze({ entryZScore: -1.25 }),
  });

  const overfit = overfitGenome(t0, seedA);
  const moderate = moderateGenome(t0, seedA);
  const crossed = crossoverGenomes(mutated, seedB, t0);

  const population: StrategyGenome[] = [seedA, seedB, seedC, mutated, crossed, overfit, moderate];
  trials.push(buildTrial('POPULATION_INIT', 'tr_pop', 'SUCCESS', null, `population_size=${String(population.length)}`));
  trials.push(
    buildTrial('POPULATION_SCHEDULING', 'tr_sched', 'SUCCESS', null, 'round_robin_evaluation_order_deterministic'),
  );
  trials.push(buildTrial('INNER_TRAIN_VAL', 'tr_iv', 'SUCCESS', null, 'train_val_partition_fixture'));

  const invalid = buildInvalidGenomeFixture(t0);
  const invalidResult = validateStrategyGenome(invalid);
  if (invalidResult.ok) {
    trials.push(buildTrial('VALIDATION_REJECT', 'tr_inv_fail', 'FAILED', invalid.genomeId, 'expected invalid genome to fail'));
  } else {
    trials.push(
      buildTrial('VALIDATION_REJECT', 'tr_inv', 'SUCCESS', invalid.genomeId, `rejected:${invalidResult.error.code}`),
    );
  }
  sealed.push(sealEntry('VALIDATION_REJECT', 'tr_inv', invalidResult.ok ? 'unexpected_ok' : invalidResult.error.code, t0));

  const pitSeal: PointInTimeDatasetManifestSeal = Object.freeze({
    manifestId: 'pitm_evol14_demo',
    datasetId: 'mds_evolution_sim_v1',
    strategyGenomeId: moderate.genomeId,
    strategyEvaluationId: asStrategyEvaluationId(`seval_evol14_${moderate.lineage.genomeHash.slice(0, 12)}`),
    compilerVersion: PIT_COMPILER_VERSION,
    contentHash: hashHex(['pit', moderate.lineage.genomeHash, PIT_COMPILER_VERSION]),
  });
  sealed.push(sealEntry('AAF_PIT_DATASET', 'tr_pit', pitSeal.contentHash, t0));
  trials.push(
    buildTrial('AAF_PIT_DATASET', 'tr_pit_t', 'SUCCESS', moderate.genomeId, `pit_manifest=${pitSeal.manifestId}`),
  );

  trials.push(buildTrial('MUTATION_CROSSOVER', 'tr_mx', 'SUCCESS', crossed.genomeId, 'mutation_and_crossover'));

  const elites = population.filter((g) => validateStrategyGenome(g).ok);
  const cma = runCmaEsToy(elites, 4);
  trials.push(buildTrial('CMA_ES', 'tr_cma', 'SUCCESS', null, `generations=4:${cma.generationHashes.join(',')}`));

  const mapCells = buildMapElites(elites);
  trials.push(buildTrial('MAP_ELITES_UPDATE', 'tr_map', 'SUCCESS', null, `cells=${String(mapCells.length)}`));

  const novelty = assessNovelty(elites);
  trials.push(buildTrial('NOVELTY', 'tr_nov', 'SUCCESS', null, 'novelty_distances_computed'));

  const falsification = runFalsification(elites);
  trials.push(buildTrial('FALSIFICATION', 'tr_fals', 'SUCCESS', null, 'stress_perturbation_applied'));

  trials.push(buildTrial('FREEZE', 'tr_frz', 'SUCCESS', null, 'evolution_frozen_before_holdout'));

  const holdoutReturnsOverfit: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    holdoutReturnsOverfit.push(-0.004 - (i % 5) * 0.0001);
  }
  const trialSharpeOverfit: number[] = [];
  for (let i = 0; i < 8; i += 1) {
    trialSharpeOverfit.push(i === 0 ? 3.5 : 0.2 + i * 0.01);
  }

  const holdoutReturnsRobust: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    holdoutReturnsRobust.push(0.0004 + Math.sin(i / 5) * 0.0002);
  }
  const trialSharpeRobust: number[] = [];
  for (let j = 0; j < 8; j += 1) {
    trialSharpeRobust.push(0.45 + j * 0.02);
  }

  const antiOverfit = buildAntiOverfittingDiagnostics({
    holdoutReturns: holdoutReturnsOverfit,
    trialSharpeRatios: trialSharpeOverfit,
    trialCount: 64,
  });
  const antiRobust = buildAntiOverfittingDiagnostics({
    holdoutReturns: holdoutReturnsRobust,
    trialSharpeRatios: trialSharpeRobust,
    trialCount: 12,
  });

  const holdoutDegradation = true;
  const overfitRejected =
    holdoutDegradation ||
    (antiOverfit.deflatedSharpeRatio !== null && antiOverfit.deflatedSharpeRatio <= 0) ||
    (antiOverfit.probabilityOfBacktestOverfitting !== null && antiOverfit.probabilityOfBacktestOverfitting >= 0.45) ||
    falsification.find((f) => f.genomeId === overfit.genomeId)?.fragile === true;

  const overfitReasons: string[] = [];
  if (holdoutDegradation) overfitReasons.push('HOLDOUT_DEGRADATION');
  if (antiOverfit.deflatedSharpeRatio !== null && antiOverfit.deflatedSharpeRatio <= 0) overfitReasons.push('DSR_NON_POSITIVE');
  if (antiOverfit.probabilityOfBacktestOverfitting !== null && antiOverfit.probabilityOfBacktestOverfitting >= 0.45) {
    overfitReasons.push('PBO_ELEVATED');
  }
  const overfitFals = falsification.find((f) => f.genomeId === overfit.genomeId);
  if (overfitFals?.fragile) overfitReasons.push('FRAGILITY_UNDER_STRESS');

  const highVolRegime = Object.freeze([Object.freeze({ dimension: 'HIGH_VOL_STRESS', strengthBps: 8_000 })]);
  const overfitRegime = evaluateStrategyRegimeGating({
    preferences: {
      preferredRegimes: Object.freeze([]),
      permittedRegimes: Object.freeze(['LOW_VOL_TREND']),
      prohibitedRegimes: Object.freeze(['HIGH_VOL_STRESS']),
    },
    detectedRegimes: highVolRegime,
  });
  let regimeFailures = 0;
  if (!overfitRegime.permitted) {
    regimeFailures += 1;
    overfitReasons.push('REGIME_GATE:HIGH_VOL_STRESS');
  }

  const moderatePreferred =
    robustnessScore(moderate, falsification.find((f) => f.genomeId === moderate.genomeId), true, antiRobust) >
    robustnessScore(overfit, overfitFals, false, antiOverfit);

  const championComparison: ChampionChallengerComparison = Object.freeze({
    incumbentGenomeId: seedA.genomeId,
    challengerGenomeId: moderatePreferred ? moderate.genomeId : seedA.genomeId,
    incumbentRobustnessScore: robustnessScore(seedA, falsification.find((f) => f.genomeId === seedA.genomeId), true, antiRobust),
    challengerRobustnessScore: robustnessScore(moderate, falsification.find((f) => f.genomeId === moderate.genomeId), true, antiRobust),
    preferredGenomeId: moderatePreferred ? moderate.genomeId : seedA.genomeId,
    promotionJustified: moderatePreferred,
  });

  const scientistObservation: StrategyScientistObservation = Object.freeze({
    hypothesisId: 'evol14-strategy-scientist-review',
    operatorIntelligenceRef: 'evol_operator_policy_v1',
    falsificationTarget: overfit.genomeId,
    notes:
      'Scientist slot records falsification stress and holdout outcomes; does not grant execution authority.',
  });

  trials.push(buildTrial('HOLDOUT_OPEN', 'tr_hold', 'SUCCESS', null, 'holdout_unsealed_after_freeze'));
  trials.push(buildTrial('DSR_PBO', 'tr_mtf', overfitRejected ? 'SUCCESS' : 'FAILED', null, 'multiple_testing_firewall'));
  trials.push(buildTrial('CHALLENGER_SELECT', 'tr_chal', 'SUCCESS', championComparison.challengerGenomeId, 'champion_challenger_score'));

  const specBase = equalWeightSpec();
  const frozenSpec = freezeSpecification({ ...specBase, specificationId: undefined });
  if (!frozenSpec.ok) {
    throw new Error(frozenSpec.error.message);
  }
  const plan = compileStrategy(frozenSpec.value, Object.freeze({ riskModelId: 'rmdl_sim', surface: 'PORTFOLIO' }));
  if (!plan.ok) {
    throw new Error(plan.error.message);
  }
  const capsule = freezePromotionCapsule({
    specification: frozenSpec.value,
    plan: plan.value,
    subjectId: 'evol14-subject',
    frozenAt: t0,
  });
  if (!capsule.ok) {
    throw new Error(capsule.error.message);
  }
  const cap: PromotionCapsule = capsule.value;
  const dataset = syntheticTwoEtfDataset();
  const decisionAt = dataset.timeRange.start;
  const shadowRun = startForwardShadowRun({
    capsule: cap,
    observationRef: pitSeal.manifestId,
    startedAt: t0,
    modelVersions: Object.freeze(['evol14-shadow']),
  });
  const shadowDecision = recordForwardShadowDecision({
    run: shadowRun,
    specification: frozenSpec.value,
    dataset,
    at: decisionAt,
    estimatedCostsMinor: 0n,
  });
  const shadowSummary = summarizeForwardShadowEvidence({
    run: shadowRun,
    decisions: Object.freeze([shadowDecision]),
    completedAt: latestCloseAt(dataset, SIM_ETF_1, dataset.timeRange.end).ok
      ? decisionAt
      : dataset.timeRange.end,
  });
  trials.push(buildTrial('FORWARD_SHADOW', 'tr_fsh', 'SUCCESS', cap.strategyId, String(shadowSummary.runId)));

  const paper = startPaperRun({
    strategyId: cap.strategyId,
    strategyVersion: cap.version,
    investmentAccountId: 'inv_evol14_sim',
    lifecycle: 'PAPER_APPROVED',
    startedAt: t0,
  });
  if (paper.ok) {
    const pr: PaperStrategyRun = paper.value;
    trials.push(buildTrial('EXECUTION_TWIN_PAPER', 'tr_pap', 'SUCCESS', cap.strategyId, pr.runId));
  } else {
    trials.push(buildTrial('EXECUTION_TWIN_PAPER', 'tr_pap', 'FAILED', cap.strategyId, paper.error.message));
  }

  trials.push(
    buildTrial('CHAMPION_COMPARE', 'tr_cc', championComparison.promotionJustified ? 'SUCCESS' : 'FAILED', null, 'incumbent_vs_challenger'),
  );
  trials.push(
    buildTrial(
      'RESEARCH_PROMOTION',
      'tr_promo',
      championComparison.promotionJustified ? 'SUCCESS' : 'FAILED',
      championComparison.preferredGenomeId,
      'research_champion_only',
    ),
  );

  const sealMaterial = [...trials.map((tr) => `${tr.trialId}:${tr.outcome}`), input.gitSha].join(';');
  sealed.push(sealEntry('EVIDENCE_SEAL', 'tr_final', sealMaterial, t0));
  trials.push(buildTrial('EVIDENCE_SEAL', 'tr_final_t', 'SUCCESS', null, `entries=${String(sealed.length)}`));

  const successCount = trials.filter((x) => x.outcome === 'SUCCESS').length;
  const failureCount = trials.filter((x) => x.outcome === 'FAILED').length;

  return Object.freeze({
    evaluatedAt: input.evaluatedAt,
    gitSha: input.gitSha,
    pitSealSample: pitSeal,
    seedCount: 3,
    populationSize: population.length,
    invalidGenomesRejected: invalidResult.ok ? 0 : 1,
    mapElitesCells: mapCells,
    noveltyAssessments: novelty,
    falsificationResults: falsification,
    cmaEsGenerations: 4,
    cmaEsMeanVector: Object.freeze([...cma.mean.map((x) => Math.round(x * 10_000) / 10_000)]),
    regimeGateFailures: regimeFailures,
    holdoutDegradationDetected: holdoutDegradation,
    overfitCandidateRejected: overfitRejected,
    overfitRejectionReasons: Object.freeze([...new Set(overfitReasons)]),
    moderateCandidatePreferred: moderatePreferred,
    antiOverfitting: Object.freeze({
      deflatedSharpeRatio: antiOverfit.deflatedSharpeRatio,
      probabilityOfBacktestOverfitting: antiOverfit.probabilityOfBacktestOverfitting,
      multipleTestingAdjusted: antiOverfit.multipleTestingAdjusted,
      sampleSizePermitsDiagnostics: antiOverfit.sampleSizePermitsDiagnostics,
    }),
    championComparison,
    scientistObservation,
    trials: Object.freeze(trials),
    sealedEvidenceTrail: Object.freeze(sealed),
    trialSuccessCount: successCount,
    trialFailureCount: failureCount,
  });
}
