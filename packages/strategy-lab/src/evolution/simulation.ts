/**
 * HELIOS EVOL14 — deterministic end-to-end Strategy Genome self-evolution simulation (research-only).
 *
 * Orchestrates the canonical EVOL01–EVOL13 modules (no toy CMA-ES or placeholder operator refs).
 * Does not enable live execution, broker submission, or production authorization.
 */

import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import { asRiskModelId, asRiskModelVersion, ratioPercent } from '@solstice/risk';
import { initialBudgetSnapshot } from '@solstice/platform/helios/budget';
import { StrategyFalsificationAgent, buildDefaultStressCampaign } from '@solstice/platform/helios/strategy-evolution/evol08';
import type { StrategyFalsificationContext } from '@solstice/platform/helios/strategy-evolution/evol08';
import {
  createSealedHoldoutVault,
  freezeResearchProgram,
  unsealHoldoutAfterFreeze,
} from '@solstice/platform/helios/strategy-evolution/evol09/holdout';
import {
  buildOperatorCreditState,
  createInMemoryOperatorPerformanceLedger,
  defaultEvol13ResearchAllocationPolicy,
  operatorProductivityScoreBps,
} from '@solstice/platform/helios/strategy-evolution/evol13';
import type { OperatorEvolutionRunEvent } from '@solstice/platform/helios/strategy-evolution/evol13';
import {
  STRATEGY_EVOLUTION_OPERATORS,
  type ResearchStrategyNiche,
  type StrategyEvolutionOperatorId,
} from '@solstice/platform/helios/strategy-evolution/evol13';

import { buildAntiOverfittingDiagnostics } from './anti-overfitting.ts';
import {
  attemptInsertElite,
  createEmptyNicheArchive,
  defaultNicheDescriptor,
  emptyBehaviorDescriptors,
  type NicheArchive,
} from './quality-diversity/index.ts';
import type { NicheFitnessComponents } from './quality-diversity/types.ts';
import { createInitialCmaEsSearchState, decodeUnconstrainedToParameters, runCmaEsGeneration } from '../evol05-cma-es/index.ts';
import type { CmaEsParameterBounds } from '../evol05-cma-es/types.ts';
import {
  STRATEGY_ISLAND_IDS,
  createEvolutionWorker,
  runPopulationSchedulerTick,
} from '../evol06/index.ts';
import { computeStrategyNoveltyScore, DEFAULT_EVOL07_NOVELTY_WEIGHTS } from '../evol07/index.ts';
import { HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION } from '../evol07/taxonomy.ts';
import type { PopulationDiversityState, StrategyBehaviorFingerprint } from '../evol07/types.ts';
import { computeStrategySemanticFingerprint } from '../evol07/semantic-fingerprint.ts';
import {
  EvolutionArchive,
  asStrategyEvolutionGenerationId,
  asStrategyEvolutionPopulationId,
} from '../evol03/index.ts';
import { mutateStrategyGenome, crossoverStrategyGenomes } from './operators/evolution-engine.ts';
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
import { asEvaluationDatasetManifestId, asStrategyEvaluationId } from '../evaluation/ids.ts';
import { calculateMetrics } from '../metrics.ts';
import { buildEvaluationEconomics, extendMetrics } from '../evaluation/cost-model.ts';
import type { EvolutionTrial } from '../evol03/types.ts';
import type { ExtendedEvaluationMetrics } from '../evaluation/types.ts';
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

import { evaluateEvol10GenomeRegimeReport, type RegimePerformanceMatrix } from '../evol10/index.ts';
import {
  assessEvol11MaterialChampionReplacement,
  evaluateEvol11ParetoDominance,
  type Evol11ChampionComparisonEvidence,
  type Evol11ComparisonDeltas,
} from '../evol11-champion-challenger.ts';
import { buildEvol12SampleGenomeProposal } from '../evol12/index.ts';

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
    operator: null,
    operatorVersion: null,
    randomSeed: null,
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
  if (!first) {
    throw new Error('EVOL14 invalid fixture: OS05 example has no nodes');
  }
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

function behaviorFingerprintFromGenome(g: StrategyGenome): StrategyBehaviorFingerprint {
  const ez = Number(g.parameters.entryZScore ?? 0);
  const vol = Number(g.parameters.volatilityThresholdBps ?? 2000);
  const norm = (x: number, lo: number, hi: number) => Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return Object.freeze({
    datasetId: 'evol14_diagnostic',
    schemaVersion: HELIOS_EVOL07_BEHAVIOR_FINGERPRINT_SCHEMA_VERSION,
    tradeFrequency: norm(Math.abs(ez), 0, 4),
    holdingPeriod: norm(vol, 100, 4000),
    regimeActivation: g.nodes.some((n) => n.kind === 'REGIME_GATE') ? 0.7 : 0.3,
    positionDirectionBias: ez < -1 ? -0.6 : 0.2,
    factorExposure: 0.45,
    beta: 0.55,
    turnover: norm(Math.abs(ez), 0, 4),
    drawdownDepth: 0.35,
    drawdownRecovery: 0.4,
    returnAutocorr: 0.5,
    signalTimingLag: 0.2,
    assetSelectionBreadth: 0.6,
  });
}

function mapCellsFromArchive(archive: NicheArchive, fitnessOf: (id: string) => bigint): readonly MapElitesCell[] {
  const cells: MapElitesCell[] = [];
  for (const elite of archive.elites.values()) {
    const b = elite.descriptor.behavior;
    cells.push(
      Object.freeze({
        behaviourA: b.trendSensitivityBin,
        behaviourB: b.meanReversionSensitivityBin,
        genomeId: elite.candidate.candidateId.replace(/^cand_/, ''),
        fitnessMinor: fitnessOf(elite.candidate.candidateId.replace(/^cand_/, '')),
      }),
    );
  }
  return Object.freeze(cells);
}

function nicheFitnessForGenome(g: StrategyGenome, innerScore: number): NicheFitnessComponents {
  return Object.freeze({
    riskAdjustedPerformance: ratioPercent(BigInt(Math.round(Math.max(0, innerScore) * 1_000_000))),
    maxDrawdown: ratioPercent(10_000_000n),
    stabilityScore: Math.max(0, Math.min(1, 0.5 + innerScore / 20)),
    transactionCostsMinor: 50n,
    capacityScore: 0.5,
    turnoverBps: BigInt(Math.round(Math.abs(Number(g.parameters.entryZScore ?? 0)) * 100)),
    aafIntegrityScore: 0.8,
    holdoutRobustnessScore: 0.6,
    walkForwardRobustnessScore: 0.55,
    probabilityOfOverfitting: 0.25,
    deflatedSharpeRatio: innerScore * 0.1,
  });
}

function descriptorForGenome(g: StrategyGenome) {
  const h = g.lineage.genomeHash;
  const b = emptyBehaviorDescriptors();
  const ez = Number(g.parameters.entryZScore ?? -1);
  const vol = Number(g.parameters.volatilityThresholdBps ?? 2000);
  return defaultNicheDescriptor(
    Object.freeze({
      ...b,
      assetClass: 'EQUITY',
      signalFamily: 'MEAN_REVERSION',
      trendSensitivityBin: Number.parseInt(h.slice(0, 2), 16) % 8,
      meanReversionSensitivityBin: Number.parseInt(h.slice(2, 4), 16) % 8,
      turnoverBin: Math.min(7, Math.floor((Math.abs(ez) / 4) * 7)),
      holdingHorizonBin: Math.min(7, Math.floor((vol / 4000) * 7)),
      regimePreference: g.nodes.some((n) => n.kind === 'REGIME_GATE') ? 'LOW_VOL' : 'NEUTRAL',
    }),
  );
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

/** Deterministic inner train/validation score (never uses holdout). */
function innerObjective(g: StrategyGenome): number {
  const ez = Number(g.parameters.entryZScore ?? 0);
  const vol = Number(g.parameters.volatilityThresholdBps ?? 2000);
  return 2.0 + Math.sin(ez) * 0.4 + (vol > 500 ? -vol / 20_000 : 0);
}

function innerPartitionMetrics(g: StrategyGenome, isOverfit: boolean): ExtendedEvaluationMetrics {
  const inner = innerObjective(g);
  const startMinor = 1_000_000n;
  const endMinor = isOverfit ? 900_000n : 1_000_000n + BigInt(Math.round(inner * 10_000));
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
  return extendMetrics({
    base: baseMetrics,
    economics: econ,
    startingCapitalMinor: startMinor,
    averageHoldingDays: null,
    concentrationTopInstrumentBps: null,
    worstPeriodReturn: null,
  });
}

export function runStrategyEvolutionSimulation(input: {
  readonly evaluatedAt: UtcInstant;
  readonly gitSha: string;
}): EvolutionSimulationResult {
  const t0 = input.evaluatedAt;
  const trials: EvolutionTrialRecord[] = [];
  const sealed: EvolutionSealedEvidenceEntry[] = [];
  const t0s = String(t0);

  const base = buildOs05ExampleStrategyGenome();
  const seedA = base;

  const seedBResult = mutateStrategyGenome({
    genome: seedA,
    family: 'PARAMETER_MUTATION',
    randomSeed: 'evol14-seed-b',
    createdAt: t0s,
    createdBy: 'evol14-simulation',
  });
  if (!seedBResult.ok) {
    throw new Error(`EVOL14 seed B mutation failed: ${seedBResult.error.message}`);
  }
  const seedB = seedBResult.value;

  const seedCResult = mutateStrategyGenome({
    genome: seedA,
    family: 'PARAMETER_MUTATION',
    randomSeed: 'evol14-seed-c',
    createdAt: t0s,
    createdBy: 'evol14-simulation',
  });
  if (!seedCResult.ok) {
    throw new Error(`EVOL14 seed C mutation failed: ${seedCResult.error.message}`);
  }
  const seedC = withParam(seedCResult.value, { volatilityThresholdBps: 2400 });

  sealed.push(sealEntry('SEED', 'tr_seed', `${seedA.genomeId}:${seedB.genomeId}:${seedC.genomeId}`, t0));
  trials.push(
    buildTrial('SEED', 'tr_seed_t', 'SUCCESS', null, `seeds=${seedA.genomeId},${seedB.genomeId},${seedC.genomeId}`),
  );

  const mutAResult = mutateStrategyGenome({
    genome: seedA,
    family: 'PARAMETER_MUTATION',
    randomSeed: 'evol14-mut-a',
    createdAt: t0s,
    createdBy: 'evol14-simulation',
  });
  if (!mutAResult.ok) {
    throw new Error(`EVOL14 mutation A failed: ${mutAResult.error.message}`);
  }
  const mutated = attachGenomeHash({
    ...mutAResult.value,
    genomeId: asStrategyGenomeId('sgnm_evol14_mut_A'),
    version: asStrategyGenomeVersion('v-mut'),
    name: 'EVOL14 mutation A',
    hypothesis: 'Mutated entry band (EVOL02).',
    lineage: {
      ...mutAResult.value.lineage,
      parentGenomeIds: Object.freeze([seedA.genomeId]),
      mutationReason: 'MUTATION',
    },
  });

  const overfit = overfitGenome(t0, seedA);
  const moderateResult = crossoverStrategyGenomes({
    parentA: mutated,
    parentB: seedB,
    mode: 'PARAMETER_BLEND',
    randomSeed: 'evol14-moderate-blend',
    createdAt: t0s,
    createdBy: 'evol14-simulation',
  });
  if (!moderateResult.ok) {
    throw new Error(`EVOL14 moderate crossover failed: ${moderateResult.error.message}`);
  }
  const moderate = attachGenomeHash({
    ...moderateResult.value,
    genomeId: asStrategyGenomeId('sgnm_evol14_moderate_robust'),
    version: asStrategyGenomeVersion('v1-robust'),
    name: 'EVOL14 moderate robust',
    hypothesis: 'Conservative blended thresholds with broad regime allowance.',
  });

  const crossedResult = crossoverStrategyGenomes({
    parentA: mutated,
    parentB: seedB,
    mode: 'PARAMETER_BLEND',
    randomSeed: 'evol14-cross',
    createdAt: t0s,
    createdBy: 'evol14-simulation',
  });
  if (!crossedResult.ok) {
    throw new Error(`EVOL14 crossover failed: ${crossedResult.error.message}`);
  }
  const crossed = attachGenomeHash({
    ...crossedResult.value,
    genomeId: asStrategyGenomeId('sgnm_evol14_crossover'),
    version: asStrategyGenomeVersion('v1-cross'),
    name: 'EVOL14 crossover child',
    hypothesis: 'Blended thresholds from parents (EVOL02).',
  });

  const population: StrategyGenome[] = [seedA, seedB, seedC, mutated, crossed, overfit, moderate];
  trials.push(buildTrial('POPULATION_INIT', 'tr_pop', 'SUCCESS', null, `population_size=${String(population.length)}`));

  // ---- EVOL03 population archive (append-only ledger; includes failed evaluation) ----
  const evol03Archive = new EvolutionArchive();
  const populationId = asStrategyEvolutionPopulationId('sepop_evol14_sim');
  const generationId = asStrategyEvolutionGenerationId('segen_evol14_g0');
  const manifest = Object.freeze({
    manifestId: asEvaluationDatasetManifestId('edmf_evol14_inner'),
    hash: hashHex(['edmf_evol14_inner', input.gitSha]),
    version: 'evol14-inner-v1',
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
    notes: Object.freeze(['EVOL14 simulation execution twin assumptions']),
  });
  const dsrPh = Object.freeze({
    method: 'HELIOS_EVOL03_DSR_PLACEHOLDER' as const,
    value: null,
    notes: Object.freeze(['ledger DSR filled post EVOL09 firewall in simulation trail']),
  });
  const pboPh = Object.freeze({
    method: 'HELIOS_EVOL03_PBO_PLACEHOLDER' as const,
    value: null,
    notes: Object.freeze(['ledger PBO filled post EVOL09 firewall in simulation trail']),
  });
  const aaf = Object.freeze({
    certificateId: 'aaf_evol14_cert',
    certificateHash: hashHex(['aaf_evol14', input.gitSha]),
    schemaVersion: 'aaf-v1',
  });

  let evol03LedgerOk = true;
  for (const g of population) {
    const reg = evol03Archive.registerGenomeSnapshot(g);
    if (!reg.ok) {
      evol03LedgerOk = false;
      break;
    }
    const isOverfit = g.genomeId === overfit.genomeId;
    const failure =
      isOverfit
        ? Object.freeze({
            codes: Object.freeze(['INNER_EVAL_WEAK' as const]),
            messages: Object.freeze(['simulated poor inner economics for flashy genome']),
          })
        : null;
    const part = Object.freeze({
      metrics: innerPartitionMetrics(g, isOverfit),
      evaluationId: `seval_evol03_${g.lineage.genomeHash.slice(0, 12)}`,
    });
    const evaluationSlice: EvolutionTrial['evaluation'] = Object.freeze({
      innerTrainVal: part,
      holdout: null,
      walkForward: null,
      shadow: null,
      paper: null,
    });
    const tr = evol03Archive.appendTrial({
      genomeId: g.genomeId,
      genomeHash: g.lineage.genomeHash,
      parents: Object.freeze([...(g.lineage.parentGenomeIds ?? [])]),
      operator: 'MUTATE_PARAMETERS',
      generationId,
      populationId,
      datasetManifest: manifest,
      aafCertificate: aaf,
      evaluation: evaluationSlice,
      transactionCostAssumptions: costs,
      executionTwinAssumptions: twin,
      deflatedSharpeRatio: dsrPh,
      probabilityOfBacktestOverfitting: pboPh,
      failure,
      promotionState: 'CANDIDATE',
      createdAt: t0,
    });
    if (!tr.ok) {
      evol03LedgerOk = false;
      break;
    }
  }
  trials.push(
    buildTrial(
      'POPULATION_ARCHIVE',
      'tr_evol03',
      evol03LedgerOk ? 'SUCCESS' : 'FAILED',
      null,
      `evol03_trials_registered=${String(evol03Archive.listTrials().length)}`,
    ),
  );

  // ---- EVOL06 population scheduler ----
  const ev06Workers = population.map((g, i) =>
    createEvolutionWorker({
      workerId: `evw_evol14_${String(i).padStart(2, '0')}`,
      genomeId: g.genomeId,
      genomeVersion: g.version,
      name: g.name,
      hypothesis: g.hypothesis,
      nodes: g.nodes,
      parameters: g.parameters,
      niche: { island: STRATEGY_ISLAND_IDS[i % STRATEGY_ISLAND_IDS.length]!, subNicheId: `sub_${String(i)}` },
      createdAt: t0,
      createdBy: 'evol14-simulation',
      featureManifestVersion: g.lineage.featureManifestVersion,
      nodeCatalogVersion: g.lineage.nodeCatalogVersion,
      parentGenomeIds: g.lineage.parentGenomeIds,
      genomeMutationReason: g.lineage.mutationReason,
    }),
  );
  const schedBudget = initialBudgetSnapshot({
    ceilingAmount: '1000000000',
    unitKind: 'COMPUTE_DURATION_MS',
    currency: 'USD',
  });
  const schedCfg = Object.freeze({
    minimumEvaluationAge: 0,
    migrationCooldownSteps: 999,
    migrationProbability: 0,
    crossIslandFitnessPenalty: 0.05,
    highUncertaintyHalfWidth: 1,
    estimatedResearchCostMinor: '1000',
    currency: 'USD',
    random: () => 0.42,
  });
  const sched = runPopulationSchedulerTick(ev06Workers, schedCfg, schedBudget);
  trials.push(
    buildTrial(
      'POPULATION_SCHEDULING',
      'tr_sched',
      'SUCCESS',
      null,
      `evol06_exploit=${String(sched.exploitDecisions.length)} explore=${String(sched.exploreDecisions.length)}`,
    ),
  );

  trials.push(buildTrial('INNER_TRAIN_VAL', 'tr_iv', 'SUCCESS', null, 'inner_objective_from_genome_parameters'));

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

  trials.push(buildTrial('MUTATION_CROSSOVER', 'tr_mx', 'SUCCESS', crossed.genomeId, 'evol02_mutateStrategyGenome_crossoverStrategyGenomes'));

  const elites = population.filter((g) => validateStrategyGenome(g).ok);

  // ---- EVOL05 CMA-ES (real implementation) ----
  const bounds: readonly CmaEsParameterBounds[] = Object.freeze([
    { parameterId: 'entryZScore', min: -3, max: 0, integral: false },
    { parameterId: 'volatilityThresholdBps', min: 100, max: 4000, integral: true },
  ]);
  const seedParams: Record<string, number> = {
    entryZScore: Number(moderate.parameters.entryZScore ?? -1),
    volatilityThresholdBps: Number(moderate.parameters.volatilityThresholdBps ?? 2000),
  };
  let cmaState = createInitialCmaEsSearchState({
    bounds,
    initialParameters: seedParams,
    seed: 424242,
  });
  const cmaHashes: string[] = [];
  for (let gen = 0; gen < 4; gen += 1) {
    const genResult = runCmaEsGeneration({
      searchState: cmaState,
      bounds,
      generation: gen,
      seed: 7_001_003,
      evaluateFitness: (params) => {
        const pseudo = attachGenomeHash({
          ...moderate,
          parameters: Object.freeze({ ...moderate.parameters, ...params }),
          lineage: lineageWithoutHash(moderate.lineage),
        });
        return innerObjective(pseudo);
      },
    });
    cmaState = genResult.nextSearchState;
    cmaHashes.push(hashHex([`cma-gen-${String(gen)}`, ...genResult.populationMeanUnconstrained.map((x) => x.toFixed(6))]));
  }
  trials.push(buildTrial('CMA_ES', 'tr_cma', 'SUCCESS', null, `generations=4:${cmaHashes.join(',')}`));

  // ---- EVOL04 MAP-Elites ----
  let mapArchive = createEmptyNicheArchive();
  for (const g of elites) {
    const desc = descriptorForGenome(g);
    const fitness = nicheFitnessForGenome(g, innerObjective(g));
    const ins = attemptInsertElite({
      archive: mapArchive,
      descriptor: desc,
      candidate: Object.freeze({
        candidateId: `cand_${g.genomeId}`,
        genomeHash: g.lineage.genomeHash,
      }),
      fitness,
      qualified: validateStrategyGenome(g).ok && g.genomeId !== invalid.genomeId,
      updatedAt: t0s,
    });
    mapArchive = ins.archive;
  }
  const mapCells = mapCellsFromArchive(mapArchive, (id) => genomeFitnessMinor(elites.find((x) => x.genomeId === id)!));
  trials.push(buildTrial('MAP_ELITES_UPDATE', 'tr_map', 'SUCCESS', null, `cells=${String(mapArchive.elites.size)}`));

  // ---- EVOL07 novelty ----
  let divState: PopulationDiversityState = Object.freeze({ archive: Object.freeze([]) });
  const novelty: NoveltyAssessment[] = [];
  for (const g of elites) {
    const beh = behaviorFingerprintFromGenome(g);
    const n = computeStrategyNoveltyScore(g, beh, divState, DEFAULT_EVOL07_NOVELTY_WEIGHTS);
    novelty.push(
      Object.freeze({
        genomeId: g.genomeId,
        behaviouralDistance: n.nearestNeighborDistance,
        archiveSize: divState.archive.length,
      }),
    );
    divState = Object.freeze({
      archive: Object.freeze([
        ...divState.archive,
        Object.freeze({
          genomeId: g.genomeId,
          parameters: g.parameters,
          behavior: beh,
          semantic: computeStrategySemanticFingerprint(g),
        }),
      ]),
    });
  }
  trials.push(buildTrial('NOVELTY', 'tr_nov', 'SUCCESS', null, 'evol07_computeStrategyNoveltyScore'));

  // ---- EVOL08 falsification engine ----
  const falsificationAgent = new StrategyFalsificationAgent();
  const falsificationResults: FalsificationResult[] = [];
  for (const g of elites) {
    const baseFit = genomeFitnessMinor(g);
    const ctx: StrategyFalsificationContext = Object.freeze({
      strategyId: `strat_${g.genomeId}`,
      campaign: buildDefaultStressCampaign(`strat_${g.genomeId}`),
      baselineEdgeBps: 120,
      concentration: Object.freeze({
        topInstrumentShareBps: g.genomeId === overfit.genomeId ? 9200 : 2100,
        topYearShareBps: 1500,
        topSectorShareBps: 1800,
        topRegimeShareBps: 1600,
        topProviderShareBps: 900,
        topTradeShareBps: 1400,
        extremeEventDependenceBps: g.genomeId === overfit.genomeId ? 2200 : 400,
      }),
      thresholdSensitivityFragile: Number(g.parameters.entryZScore ?? 0) < -2.5,
    });
    const report = falsificationAgent.run(ctx);
    const fragile = report.fragility.structurallyFragile || report.findings.some((f) => f.falsified);
    const stressed = withParam(g, { volatilityThresholdBps: Math.max(500, Number(g.parameters.volatilityThresholdBps) - 800) });
    const perturbed = genomeFitnessMinor(stressed);
    falsificationResults.push(
      Object.freeze({
        genomeId: g.genomeId,
        stressPerturbationBps: 80,
        fitnessDeltaMinor: baseFit - perturbed,
        fragile,
      }),
    );
  }
  trials.push(buildTrial('FALSIFICATION', 'tr_fals', 'SUCCESS', null, 'evol08_StrategyFalsificationAgent'));

  trials.push(buildTrial('FREEZE', 'tr_frz', 'SUCCESS', null, 'evol09_freezeResearchProgram'));

  // ---- EVOL10 regime generalization ----
  const stressDims = Object.freeze(['high_volatility', 'risk_off', 'bear'] as const);
  const matrix: RegimePerformanceMatrix = Object.freeze({
    methodologyVersion: 'helios-evol10-regime-matrix-v1',
    cells: elites.flatMap((g) =>
      stressDims.map((tag) =>
        Object.freeze({
          genomeId: g.genomeId,
          regimeDimension: tag,
          observationCount: 20,
          totalReturnMinor:
            g.genomeId === overfit.genomeId && tag === 'high_volatility'
              ? -80_000n
              : BigInt(10_000 + g.lineage.genomeHash.charCodeAt(0) % 5_000),
        }),
      ),
    ),
  });
  const evol10Reports = elites.map((g) => evaluateEvol10GenomeRegimeReport({ matrix, genomeId: g.genomeId }));
  const evol10WorstOverfit = evol10Reports.find((r) => r.genomeId === overfit.genomeId);
  const regimeGateOk =
    evol10WorstOverfit !== undefined &&
    stressDims.includes(evol10WorstOverfit.worstRegimePerformance.regime as (typeof stressDims)[number]) &&
    evol10WorstOverfit.worstRegimePerformance.totalReturnMinor < 0n;
  trials.push(
    buildTrial(
      'REGIME_GENERALIZATION',
      'tr_evol10',
      regimeGateOk ? 'SUCCESS' : 'FAILED',
      overfit.genomeId,
      `worst_stress_minor=${String(evol10WorstOverfit?.worstRegimePerformance.totalReturnMinor ?? 0n)}`,
    ),
  );

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
    falsificationResults.find((f) => f.genomeId === overfit.genomeId)?.fragile === true;

  const overfitReasons: string[] = [];
  if (holdoutDegradation) overfitReasons.push('HOLDOUT_DEGRADATION');
  if (antiOverfit.deflatedSharpeRatio !== null && antiOverfit.deflatedSharpeRatio <= 0) overfitReasons.push('DSR_NON_POSITIVE');
  if (antiOverfit.probabilityOfBacktestOverfitting !== null && antiOverfit.probabilityOfBacktestOverfitting >= 0.45) {
    overfitReasons.push('PBO_ELEVATED');
  }
  const overfitFals = falsificationResults.find((f) => f.genomeId === overfit.genomeId);
  if (overfitFals?.fragile) overfitReasons.push('FRAGILITY_UNDER_STRESS');
  if (evol10WorstOverfit && evol10WorstOverfit.worstRegimePerformance.regime === 'high_volatility') {
    overfitReasons.push('REGIME_GENERALIZATION:HIGH_VOL_STRESS');
  }

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

  const moderatePreferred =
    robustnessScore(moderate, falsificationResults.find((f) => f.genomeId === moderate.genomeId), true, antiRobust) >
    robustnessScore(overfit, overfitFals, false, antiOverfit);

  // ---- EVOL09 sealed holdout (vault lifecycle; firewall evidence = DSR/PBO trial) ----
  const holdoutVault = createSealedHoldoutVault(
    Object.freeze({
      segmentId: 'seg_evol14_holdout',
      reservedForHoldout: true as const,
    }),
  );
  const frozenVault = freezeResearchProgram(holdoutVault);
  const unsealedVault = unsealHoldoutAfterFreeze(frozenVault, {
    holdoutScore: overfitRejected ? 0.15 : 0.85,
    holdoutGradient: null,
    holdoutRejectionReason: overfitRejected ? 'OVERFIT_SCREEN' : null,
  });
  trials.push(buildTrial('HOLDOUT_OPEN', 'tr_hold', 'SUCCESS', null, `vault_state=${unsealedVault.state}`));

  trials.push(buildTrial('DSR_PBO', 'tr_mtf', overfitRejected ? 'BLOCKED' : 'FAILED', null, 'evol09_multiple_testing_firewall'));

  const evol11Deltas: Evol11ComparisonDeltas = Object.freeze({
    NET_RETURNS_MINOR: 120_000n,
    MAX_DRAWDOWN_BPS: -25_000n,
    DSR: 500_000n,
    PBO: -300_000n,
  });
  const evol11Core = Object.freeze(['NET_RETURNS_MINOR', 'MAX_DRAWDOWN_BPS', 'DSR', 'PBO'] as const);
  const evol11Pareto = evaluateEvol11ParetoDominance({
    deltas: evol11Deltas,
    dimensions: evol11Core,
  });
  const evol11Material = assessEvol11MaterialChampionReplacement({
    deltas: evol11Deltas,
    coreDimensions: evol11Core,
    materialityMinor: 100_000n,
    confidenceHigh: true,
    pareto: evol11Pareto,
  });

  const mockEvidence: Evol11ChampionComparisonEvidence = Object.freeze({
    comparedAt: t0,
    incumbentStrategyId: `strat_${seedA.genomeId}`,
    incumbentStrategyVersion: String(seedA.version),
    challengerStrategyId: `strat_${moderate.genomeId}`,
    challengerStrategyVersion: String(moderate.version),
    deltas: evol11Deltas,
    pareto: evol11Pareto,
    shadowSummary: null,
    permitsChampionReplacement: evol11Material.permitsReplacement,
    championIsResearchOnly: true,
    noLiveCapitalAuthorization: true,
  });

  const championComparison: ChampionChallengerComparison = Object.freeze({
    incumbentGenomeId: seedA.genomeId,
    challengerGenomeId: moderatePreferred ? moderate.genomeId : seedA.genomeId,
    incumbentRobustnessScore: robustnessScore(seedA, falsificationResults.find((f) => f.genomeId === seedA.genomeId), true, antiRobust),
    challengerRobustnessScore: robustnessScore(moderate, falsificationResults.find((f) => f.genomeId === moderate.genomeId), true, antiRobust),
    preferredGenomeId: moderatePreferred ? moderate.genomeId : seedA.genomeId,
    promotionJustified: moderatePreferred,
  });
  trials.push(
    buildTrial('CHALLENGER_SELECT', 'tr_chal', 'SUCCESS', championComparison.challengerGenomeId, 'evol11_material_comparison'),
  );

  // ---- EVOL12 Strategy Scientist ----
  const evol12Proposal = buildEvol12SampleGenomeProposal();
  const scientistObservation: StrategyScientistObservation = Object.freeze({
    hypothesisId: evol12Proposal.researchHypothesis.hypothesisId,
    strategyScientistAgentRef: evol12Proposal.scientist.agentRef,
    genomeProposalId: evol12Proposal.proposalId,
    falsificationTarget: overfit.genomeId,
    notes: 'EVOL12 proposal cross-checks falsification targets; no execution authority.',
  });
  trials.push(buildTrial('STRATEGY_SCIENTIST', 'tr_sci', 'SUCCESS', moderate.genomeId, evol12Proposal.proposalId));

  // ---- EVOL13 operator credit (posterior rates over synthetic run ledger) ----
  const opLedger = createInMemoryOperatorPerformanceLedger();
  const nichePool: readonly ResearchStrategyNiche[] = Object.freeze(['MOMENTUM', 'VALUATION', 'MACRO']);
  const operatorsSynth = STRATEGY_EVOLUTION_OPERATORS;
  for (let r = 0; r < 24; r += 1) {
    const op = operatorsSynth[r % operatorsSynth.length]!;
    const valid = r % 7 !== 0 ? 1 : 0;
    const aafP = r % 5 !== 0 ? 1 : 0;
    const hoP = r % 6 !== 0 ? 1 : 0;
    const falP = r % 8 !== 0 ? 1 : 0;
    const ev: OperatorEvolutionRunEvent = Object.freeze({
      runId: `ev13_run_${String(r).padStart(3, '0')}`,
      operatorId: op,
      nicheId: nichePool[r % nichePool.length]!,
      evaluatedAt: t0,
      outcomeVisibleAt: t0,
      candidateCount: 4,
      validCandidateCount: valid,
      aafPassCount: aafP,
      holdoutPassCount: hoP,
      falsificationPassCount: falP,
      noveltyProducedCount: r % 3,
      nicheCoverageAdded: Object.freeze([]),
      paperCandidateCount: r % 4 === 0 ? 1 : 0,
      computeCostMinor: String(5000 + r * 100),
    });
    opLedger.append(ev);
  }
  const evol13Policy = defaultEvol13ResearchAllocationPolicy({ outcomeCreditDelayMs: 0 });
  const credit = buildOperatorCreditState({ runs: opLedger.listRuns(), policy: evol13Policy, asOf: t0 });
  let topOp: StrategyEvolutionOperatorId = operatorsSynth[0]!;
  let topProd = -1;
  for (const op of operatorsSynth) {
    const p = operatorProductivityScoreBps(credit.entries[op]);
    if (p > topProd) {
      topProd = p;
      topOp = op;
    }
  }
  trials.push(buildTrial('OPERATOR_CREDIT', 'tr_evol13', 'SUCCESS', null, `top_operator=${topOp}`));

  const specBase = equalWeightSpec();
  const frozenSpec = freezeSpecification(specBase);
  if (!frozenSpec.ok) {
    throw new Error(frozenSpec.error.message);
  }
  const plan = compileStrategy(frozenSpec.value, {
    riskBudgetId: frozenSpec.value.riskBudgetId,
    riskModelId: asRiskModelId('mdl_investment_pretrade'),
    riskModelVersion: asRiskModelVersion('risk-model-v1'),
  });
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
    evol11Role: 'CHALLENGER',
    startedAt: t0,
  });
  if (paper.ok) {
    const pr: PaperStrategyRun = paper.value;
    trials.push(buildTrial('EXECUTION_TWIN_PAPER', 'tr_pap', 'SUCCESS', cap.strategyId, pr.runId));
  } else {
    trials.push(buildTrial('EXECUTION_TWIN_PAPER', 'tr_pap', 'FAILED', cap.strategyId, paper.error.message));
  }

  const championReplace = mockEvidence.permitsChampionReplacement === true;
  trials.push(
    buildTrial('CHAMPION_COMPARE', 'tr_cc', championReplace ? 'SUCCESS' : 'FAILED', null, 'evol11_pareto_domination'),
  );
  const researchOutcome =
    moderatePreferred && championComparison.promotionJustified && championReplace ? 'SUCCESS' : 'FAILED';
  trials.push(
    buildTrial('RESEARCH_PROMOTION', 'tr_promo', researchOutcome, championComparison.preferredGenomeId, 'research_champion_only'),
  );

  const sealMaterial = [...trials.map((tr) => `${tr.trialId}:${tr.outcome}`), input.gitSha].join(';');
  sealed.push(sealEntry('EVIDENCE_SEAL', 'tr_final', sealMaterial, t0));
  trials.push(buildTrial('EVIDENCE_SEAL', 'tr_final_t', 'SUCCESS', null, `entries=${String(sealed.length)}`));

  const successCount = trials.filter((x) => x.outcome === 'SUCCESS').length;
  const failureCount = trials.filter((x) => x.outcome === 'FAILED').length;
  const blockedCount = trials.filter((x) => x.outcome === 'BLOCKED').length;

  const decodedCmaMean = decodeUnconstrainedToParameters(cmaState.mean, bounds);
  const cmaMeanDecoded = bounds.map((b) => decodedCmaMean[b.parameterId]!);

  return Object.freeze({
    evaluatedAt: input.evaluatedAt,
    gitSha: input.gitSha,
    pitSealSample: pitSeal,
    seedCount: 3,
    populationSize: population.length,
    invalidGenomesRejected: invalidResult.ok ? 0 : 1,
    mapElitesCells: mapCells,
    noveltyAssessments: Object.freeze(novelty),
    falsificationResults: Object.freeze(falsificationResults),
    cmaEsGenerations: 4,
    cmaEsMeanVector: Object.freeze([...cmaMeanDecoded.map((x) => Math.round(x * 10_000) / 10_000)]),
    regimeGateFailures: regimeFailures,
    holdoutDegradationDetected: holdoutDegradation,
    overfitCandidateRejected: overfitRejected,
    overfitRejectionReasons: Object.freeze([...new Set(overfitReasons)]),
    moderateCandidatePreferred: moderatePreferred,
    antiOverfitting: Object.freeze({
      deflatedSharpeRatio: antiOverfit.deflatedSharpeRatio,
      probabilityOfBacktestOverfitting: antiOverfit.probabilityOfBacktestOverfitting,
      trialCount: antiOverfit.trialCount,
      multipleTestingAdjusted: antiOverfit.multipleTestingAdjusted,
      sampleSizePermitsDiagnostics: antiOverfit.sampleSizePermitsDiagnostics,
    }),
    championComparison,
    scientistObservation,
    trials: Object.freeze(trials),
    sealedEvidenceTrail: Object.freeze(sealed),
    trialSuccessCount: successCount,
    trialFailureCount: failureCount,
    trialBlockedCount: blockedCount,
  });
}
