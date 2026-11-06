import { attachGenomeHash } from '../os05/hash.ts';
import type { StrategyGenome } from '../os05/types.ts';
import { STRATEGY_ISLAND_IDS, type StrategyIslandId } from './taxonomy.ts';
import { copyStructureFromDonor, mutateGenomeParameters } from './evolution-genome.ts';
import { incrementResearchSpend, nextGenomeVersion, withNewGenome } from './evolution-worker.ts';
import { allocateResearchBudgetForWorker } from './research-budget-bridge.ts';
import type {
  EvolutionWorkerState,
  ExploitDecision,
  ExploreDecision,
  PopulationSchedulerConfig,
  PopulationSchedulerResult,
} from './types.ts';

function islandWorkers(workers: readonly EvolutionWorkerState[], island: StrategyIslandId): EvolutionWorkerState[] {
  return workers.filter((w) => w.niche.island === island);
}

function meanFitness(w: EvolutionWorkerState): number {
  return w.uncertainty.meanFitness;
}

function positiveSlope(w: EvolutionWorkerState): boolean {
  if (w.fitnessTrajectory.length < 2) return false;
  const first = w.fitnessTrajectory[0]!.fitness;
  const last = w.fitnessTrajectory[w.fitnessTrajectory.length - 1]!.fitness;
  return last > first;
}

function lateBloomerProtected(
  w: EvolutionWorkerState,
  cfg: PopulationSchedulerConfig,
  islandMedian: number,
): boolean {
  if (w.evaluationAge >= cfg.minimumEvaluationAge * 2) return false;
  if (w.fitnessTrajectory.length < 2) return false;
  if (!positiveSlope(w)) return false;
  return meanFitness(w) < islandMedian;
}

function adjustedCompare(
  a: EvolutionWorkerState,
  b: EvolutionWorkerState,
  cfg: PopulationSchedulerConfig,
): number {
  const pa = a.niche.island === b.niche.island ? 0 : cfg.crossIslandFitnessPenalty;
  const pb = b.niche.island === a.niche.island ? 0 : cfg.crossIslandFitnessPenalty;
  return meanFitness(a) - pa - (meanFitness(b) - pb);
}

function islandMedianFitness(workers: readonly EvolutionWorkerState[], island: StrategyIslandId): number {
  const xs = islandWorkers(workers, island)
    .map(meanFitness)
    .filter((x) => Number.isFinite(x))
    .sort((x, y) => x - y);
  if (xs.length === 0) return 0;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

function nichePopulationUncertainty(workers: readonly EvolutionWorkerState[], island: StrategyIslandId): number {
  const ws = islandWorkers(workers, island);
  if (ws.length === 0) return 0;
  let sum = 0;
  for (const w of ws) {
    sum += w.uncertainty.confidenceHalfWidth;
  }
  return sum / ws.length;
}

function nicheScarcity(workers: readonly EvolutionWorkerState[], island: StrategyIslandId): number {
  const n = islandWorkers(workers, island).length;
  const maxExpected = Math.max(1, workers.length / STRATEGY_ISLAND_IDS.length);
  return Math.max(0, 1 - n / maxExpected);
}

function historicalMutationProductivity(_island: StrategyIslandId): number {
  return 0.5;
}

function shouldSurviveLowFitness(
  w: EvolutionWorkerState,
  cfg: PopulationSchedulerConfig,
  islandMedian: number,
  workers: readonly EvolutionWorkerState[],
): boolean {
  if (w.evaluationAge < cfg.minimumEvaluationAge) return true;
  if (lateBloomerProtected(w, cfg, islandMedian)) return true;
  const betters = workers.filter(
    (o) =>
      o.workerId !== w.workerId &&
      adjustedCompare(o, w, cfg) > 0 &&
      o.evaluationAge >= cfg.minimumEvaluationAge,
  );
  if (betters.length === 0) return true;
  const highUncertainty = w.uncertainty.confidenceHalfWidth >= cfg.highUncertaintyHalfWidth;
  return highUncertainty;
}

function pickDonor(
  workers: readonly EvolutionWorkerState[],
  island: StrategyIslandId,
  cfg: PopulationSchedulerConfig,
  excludeId: string,
): EvolutionWorkerState | null {
  const pool = islandWorkers(workers, island).filter(
    (worker) => worker.workerId !== excludeId && worker.evaluationAge >= cfg.minimumEvaluationAge,
  );
  if (pool.length === 0) return null;
  return pool.reduce((best, worker) => (meanFitness(worker) > meanFitness(best) ? worker : best));
}

function rollExploreKind(r: () => number): 'PARAMETER_MUTATION' | 'STRUCTURE_MUTATION' {
  return r() < 0.85 ? 'PARAMETER_MUTATION' : 'STRUCTURE_MUTATION';
}

function shallowRelabelStructure(genome: StrategyGenome, salt: number): StrategyGenome {
  const nodes = genome.nodes.map((node, i) =>
    Object.freeze({
      ...node,
      nodeId: `${node.nodeId}_ev${salt}_${i}`,
    }),
  );
  return attachGenomeHash({
    schema: genome.schema,
    genomeId: genome.genomeId,
    version: nextGenomeVersion(genome.version),
    name: genome.name,
    hypothesis: genome.hypothesis,
    nodes: Object.freeze(nodes),
    parameters: Object.freeze({ ...genome.parameters }),
    lineage: {
      ...genome.lineage,
      parentGenomeIds: Object.freeze([genome.genomeId]),
      mutationReason: `EVOL06_STRUCTURE_PROBE:${salt}`,
    },
  });
}

/** All workers as an array from id → state map, stable order by first-seen ids. */
function mapToOrderedWorkers(ids: readonly string[], m: ReadonlyMap<string, EvolutionWorkerState>): EvolutionWorkerState[] {
  return ids.map((id) => m.get(id)!);
}

/**
 * Single scheduling step: exploit (inheritance), explore (mutation), controlled migration, and H20 research rows.
 */
export function runPopulationSchedulerTick(
  workers: readonly EvolutionWorkerState[],
  cfg: PopulationSchedulerConfig,
  budget: import('@solstice/platform').ResearchBudgetSnapshot,
): PopulationSchedulerResult {
  const exploitDecisions: ExploitDecision[] = [];
  const exploreDecisions: ExploreDecision[] = [];
  const allocations: ReturnType<typeof allocateResearchBudgetForWorker>[] = [];

  const order = workers.map((w) => w.workerId);
  const byId = new Map<string, EvolutionWorkerState>(workers.map((w) => [w.workerId, w]));

  const snapshotWorkers = (): EvolutionWorkerState[] => mapToOrderedWorkers(order, byId);

  for (const island of STRATEGY_ISLAND_IDS) {
    const pool = snapshotWorkers();
    const med = islandMedianFitness(pool, island);

    for (const workerId of order) {
      const w = byId.get(workerId)!;
      if (w.niche.island !== island) continue;
      if (!shouldSurviveLowFitness(w, cfg, med, pool)) continue;

      const donor = pickDonor(pool, island, cfg, w.workerId);
      if (!donor) continue;
      if (w.evaluationAge < cfg.minimumEvaluationAge) continue;
      if (lateBloomerProtected(w, cfg, med)) continue;
      if (meanFitness(w) >= meanFitness(donor)) continue;
      if (meanFitness(donor) - meanFitness(w) < 1e-9) continue;

      exploitDecisions.push(
        Object.freeze({
          kind: 'EXPLOIT',
          exploitKind: 'COPY_STRUCTURE_FROM_DONOR',
          recipientWorkerId: w.workerId,
          donorWorkerId: donor.workerId,
          island,
          reason: 'EVOL06_EXPLOIT_COPY_STRUCTURE',
        }),
      );

      const structural = copyStructureFromDonor(w.currentGenome, donor.currentGenome, {
        mutationReason: 'EVOL06_EXPLOIT_COPY_STRUCTURE',
        parentGenomeIds: Object.freeze([w.currentGenome.genomeId, donor.currentGenome.genomeId]),
      });

      byId.set(
        w.workerId,
        incrementResearchSpend(
          withNewGenome(w, structural, {
            parentWorkerIds: [donor.workerId],
            generationDelta: 1,
            mutationReason: 'exploit',
          }),
          cfg.estimatedResearchCostMinor,
        ),
      );
    }
  }

  for (const workerId of order) {
    const w = byId.get(workerId)!;
    if (w.evaluationAge < cfg.minimumEvaluationAge) continue;
    if (cfg.random() > 0.25) continue;

    const exploreKind = rollExploreKind(cfg.random);
    let newGenome: StrategyGenome;
    let detail: string;

    if (exploreKind === 'PARAMETER_MUTATION') {
      newGenome = mutateGenomeParameters(w.currentGenome, Math.floor(cfg.random() * 1_000_000));
      detail = 'parameter_perturbation';
    } else {
      newGenome = shallowRelabelStructure(w.currentGenome, Math.floor(cfg.random() * 1_000_000));
      detail = 'structure_probe_same_policy_family';
    }

    exploreDecisions.push(
      Object.freeze({
        kind: 'EXPLORE',
        exploreKind,
        workerId: w.workerId,
        island: w.niche.island,
        detail,
      }),
    );

    byId.set(
      workerId,
      incrementResearchSpend(
        withNewGenome(w, newGenome, {
          parentWorkerIds: [w.workerId],
          generationDelta: 1,
          mutationReason: 'explore',
        }),
        cfg.estimatedResearchCostMinor,
      ),
    );
  }

  const afterExplore = snapshotWorkers();

  for (const workerId of order) {
    const w = byId.get(workerId)!;
    if (w.migrationGeneration < cfg.migrationCooldownSteps) continue;
    if (cfg.random() >= cfg.migrationProbability) continue;

    const migrationDonorIslands = STRATEGY_ISLAND_IDS.filter((id) => id !== w.niche.island);
    if (migrationDonorIslands.length === 0) continue;
    const targetIsland = migrationDonorIslands[Math.floor(cfg.random() * migrationDonorIslands.length)]!;
    const donor = pickDonor(afterExplore, targetIsland, cfg, w.workerId);
    if (!donor) continue;

    exploitDecisions.push(
      Object.freeze({
        kind: 'EXPLOIT',
        exploitKind: 'COPY_STRUCTURE_FROM_DONOR',
        recipientWorkerId: w.workerId,
        donorWorkerId: donor.workerId,
        island: w.niche.island,
        reason: 'EVOL06_CONTROLLED_MIGRATION',
      }),
    );

    const migrated = copyStructureFromDonor(w.currentGenome, donor.currentGenome, {
      mutationReason: 'EVOL06_ISLAND_MIGRATION',
      parentGenomeIds: Object.freeze([w.currentGenome.genomeId, donor.currentGenome.genomeId]),
    });

    byId.set(
      workerId,
      incrementResearchSpend(
        withNewGenome(
          {
            ...w,
            niche: Object.freeze({ island: targetIsland, subNicheId: `mig_${w.niche.subNicheId}` }),
          },
          migrated,
          {
            parentWorkerIds: [donor.workerId],
            generationDelta: 1,
            mutationReason: 'migration',
            migrationGenerationDelta: -w.migrationGeneration,
          },
        ),
        cfg.estimatedResearchCostMinor,
      ),
    );
  }

  const afterMigrate = snapshotWorkers();

  for (const w of afterMigrate) {
    const scarcity = nicheScarcity(afterMigrate, w.niche.island);
    const popUnc = nichePopulationUncertainty(afterMigrate, w.niche.island);
    const prod = historicalMutationProductivity(w.niche.island);
    const evHint = Math.round(
      50_000 * (0.25 + scarcity * 0.25 + Math.min(1, popUnc / 10) * 0.25 + prod * 0.25),
    );
    const allocation = allocateResearchBudgetForWorker(w, budget, cfg, {
      estimatedOpportunitySizeMinor: String(evHint),
      opportunityHalfLifeHours: 72,
      timeRemainingHours: 48,
      nicheScarcity: scarcity,
      populationUncertainty: popUnc,
      historicalMutationProductivity: prod,
      computeCostMinor: cfg.estimatedResearchCostMinor,
    });
    allocations.push(allocation);
  }

  const withTick = afterMigrate.map((w) =>
    Object.freeze({
      ...w,
      migrationGeneration: w.migrationGeneration + 1,
    }),
  );

  return Object.freeze({
    updatedWorkers: Object.freeze(withTick),
    exploitDecisions: Object.freeze(exploitDecisions),
    exploreDecisions: Object.freeze(exploreDecisions),
    researchAllocations: Object.freeze(allocations),
  });
}
