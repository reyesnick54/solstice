import { computeQualityDiversityScore, compareNicheFitness } from './scoring.ts';
import { strategyNicheFromDescriptor } from './niche-key.ts';
import type {
  EvolutionCandidateRef,
  NicheArchive,
  NicheArchiveStats,
  NicheDescriptor,
  NicheElite,
  NicheFitnessComponents,
  StrategyNiche,
} from './types.ts';
import { assessDiversityCollapse, researchBudgetForEmptyNiches } from './diversity.ts';

export function createEmptyNicheArchive(): NicheArchive {
  return Object.freeze({ elites: new Map() });
}

export type AttemptInsertResult =
  | {
      readonly accepted: true;
      readonly replaced: boolean;
      readonly niche: StrategyNiche;
      readonly elite: NicheElite;
    }
  | {
      readonly accepted: false;
      readonly replaced: false;
      readonly niche: StrategyNiche;
      readonly reason: 'unqualified' | 'inferior_within_niche';
    };

export function attemptInsertElite(input: {
  readonly archive: NicheArchive;
  readonly descriptor: NicheDescriptor;
  readonly candidate: EvolutionCandidateRef;
  readonly fitness: NicheFitnessComponents;
  readonly qualified: boolean;
  readonly updatedAt: string;
}): { readonly archive: NicheArchive; readonly result: AttemptInsertResult } {
  const niche = strategyNicheFromDescriptor(input.descriptor);
  const qds = computeQualityDiversityScore(input.fitness);

  if (!input.qualified) {
    return {
      archive: input.archive,
      result: {
        accepted: false,
        replaced: false,
        niche,
        reason: 'unqualified',
      },
    };
  }

  const next = new Map(input.archive.elites);
  const prev = next.get(niche);

  if (prev !== undefined && compareNicheFitness(input.fitness, prev.fitness) <= 0) {
    return {
      archive: input.archive,
      result: {
        accepted: false,
        replaced: false,
        niche,
        reason: 'inferior_within_niche',
      },
    };
  }

  const elite: NicheElite = Object.freeze({
    niche,
    descriptor: input.descriptor,
    candidate: input.candidate,
    fitness: input.fitness,
    qualityDiversityScore: qds,
    qualified: true,
    updatedAt: input.updatedAt,
  });
  next.set(niche, elite);

  return {
    archive: Object.freeze({ elites: next }),
    result: {
      accepted: true,
      replaced: prev !== undefined,
      niche,
      elite,
    },
  };
}

export function nicheArchiveStats(
  archive: NicheArchive,
  totalNichesEstimate: number,
  config: { readonly researchBudgetTotal: number; readonly maxGeneticSimilarityMass: number; readonly maxBehavioralSimilarityMean: number },
): NicheArchiveStats {
  const filled = archive.elites.size;
  const total = Math.max(1, totalNichesEstimate);
  const emptyFrac = Math.max(0, 1 - filled / total);
  const budget = researchBudgetForEmptyNiches({
    emptyNicheFraction: emptyFrac,
    totalResearchBudget: config.researchBudgetTotal,
  });
  const diversity = assessDiversityCollapse(archive, {
    maxGeneticSimilarityMass: config.maxGeneticSimilarityMass,
    maxBehavioralSimilarityMean: config.maxBehavioralSimilarityMean,
  });
  return {
    nicheCount: total,
    filledNicheCount: filled,
    emptyNicheFraction: emptyFrac,
    researchBudgetForEmptyNiches: budget,
    diversity,
  };
}
