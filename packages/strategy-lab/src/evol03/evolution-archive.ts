import { err, ok, type Result } from '@solstice/domain';
import { ratioFromUnits, ratioPercent, RATIO_UNIT, type Ratio } from '@solstice/risk';

import type { StrategyFailure } from '../types.ts';
import type { StrategyGenomeId } from '../os05/ids.ts';
import type { StrategyGenome } from '../os05/types.ts';

import { assessParentPairSimilarity } from './genome-diversity.ts';
import {
  ancestorsFromTrials,
  buildChildIndex,
  buildParentIndex,
  commonAncestor as lowestCommonAncestorFromWalk,
  descendantsFromTrials,
  lineageDepth as computeLineageDepth,
  operatorHistory as computeOperatorHistory,
  rootAncestors,
} from './lineage.ts';
import {
  asStrategyEvolutionTrialId,
  type StrategyEvolutionGenerationId,
  type StrategyEvolutionPopulationId,
  type StrategyEvolutionTrialId,
} from './ids.ts';
import type {
  EvolutionTrial,
  GenerationRecord,
  GenomeAncestry,
  GenomeFitnessEvidence,
  LineageDiversityMetrics,
  StrategyGeneAttribution,
} from './types.ts';

const DEFAULT_NEAR_IDENTICAL_THRESHOLD = ratioPercent(85n);

/** Append-only evolution research ledger (trials are never deleted). */
export class EvolutionArchive {
  readonly #trials = new Map<StrategyEvolutionTrialId, EvolutionTrial>();
  readonly #trialsByGenome = new Map<StrategyGenomeId, EvolutionTrial[]>();
  readonly #generations = new Map<StrategyEvolutionGenerationId, GenerationRecord>();
  readonly #genomes = new Map<StrategyGenomeId, StrategyGenome>();
  readonly #geneAttributions = new Map<string, StrategyGeneAttribution>();
  /** Synthetic ledger cursor for deterministic trial ids in tests. */
  #trialSeq = 0;

  public registerGenomeSnapshot(genome: StrategyGenome): Result<true, StrategyFailure> {
    const existing = this.#genomes.get(genome.genomeId);
    if (existing && existing.lineage.genomeHash !== genome.lineage.genomeHash) {
      return err({
        code: 'GENOME_HASH_CONFLICT',
        message: `genome ${genome.genomeId} already registered with a different hash`,
      });
    }
    this.#genomes.set(genome.genomeId, genome);
    return ok(true);
  }

  public getGenome(genomeId: StrategyGenomeId): StrategyGenome | undefined {
    return this.#genomes.get(genomeId);
  }

  public appendTrial(input: Omit<EvolutionTrial, 'trialId' | 'immutable'>): Result<EvolutionTrial, StrategyFailure> {
    const genome = this.#genomes.get(input.genomeId);
    if (!genome) {
      return err({
        code: 'UNKNOWN_GENOME',
        message: `register genome snapshot before appending trial for ${input.genomeId}`,
      });
    }
    if (genome.lineage.genomeHash !== input.genomeHash) {
      return err({
        code: 'GENOME_HASH_MISMATCH',
        message: 'trial genomeHash does not match registered snapshot',
      });
    }
    this.#trialSeq += 1;
    const trialId = asStrategyEvolutionTrialId(`sevt_${String(this.#trialSeq).padStart(8, '0')}`);
    const trial: EvolutionTrial = Object.freeze({
      ...input,
      trialId,
      immutable: true,
    });
    this.#trials.set(trialId, trial);
    const list = this.#trialsByGenome.get(input.genomeId) ?? [];
    this.#trialsByGenome.set(input.genomeId, [...list, trial]);
    return ok(trial);
  }

  public recordGeneration(record: GenerationRecord): Result<GenerationRecord, StrategyFailure> {
    if (this.#generations.has(record.generationId)) {
      return err({
        code: 'DUPLICATE_GENERATION',
        message: `generation ${record.generationId} already recorded`,
      });
    }
    this.#generations.set(record.generationId, record);
    return ok(record);
  }

  public getGeneration(id: StrategyEvolutionGenerationId): GenerationRecord | undefined {
    return this.#generations.get(id);
  }

  public listTrials(): readonly EvolutionTrial[] {
    return Object.freeze([...this.#trials.values()]);
  }

  public getTrial(id: StrategyEvolutionTrialId): EvolutionTrial | undefined {
    return this.#trials.get(id);
  }

  public trialsForGenome(genomeId: StrategyGenomeId): readonly EvolutionTrial[] {
    return Object.freeze([...(this.#trialsByGenome.get(genomeId) ?? [])]);
  }

  public appendGeneAttribution(row: StrategyGeneAttribution): Result<StrategyGeneAttribution, StrategyFailure> {
    if (this.#geneAttributions.has(row.attributionId)) {
      return err({
        code: 'DUPLICATE_ATTRIBUTION',
        message: `attribution ${row.attributionId} already stored`,
      });
    }
    this.#geneAttributions.set(row.attributionId, row);
    return ok(row);
  }

  public geneAttributionsForGenome(genomeId: StrategyGenomeId): readonly StrategyGeneAttribution[] {
    return Object.freeze(
      [...this.#geneAttributions.values()].filter((row) => row.sourceGenomeId === genomeId),
    );
  }

  public fitnessEvidenceFor(genomeId: StrategyGenomeId): GenomeFitnessEvidence {
    const trials = this.trialsForGenome(genomeId);
    const trialIds = trials.map((t) => t.trialId);
    let best: EvolutionTrial | null = null;
    for (const t of trials) {
      if (t.failure === null) {
        if (!best) {
          best = t;
          continue;
        }
        const a = t.evaluation.holdout?.metrics.netReturn.units ?? 0n;
        const b = best.evaluation.holdout?.metrics.netReturn.units ?? 0n;
        if (a > b) {
          best = t;
        }
      }
    }
    return Object.freeze({
      genomeId,
      trialIds: Object.freeze(trialIds),
      bestTrialId: best?.trialId ?? null,
    });
  }

  public ancestors(genomeId: StrategyGenomeId): readonly StrategyGenomeId[] {
    const parents = buildParentIndex(this.listTrials());
    return ancestorsFromTrials(genomeId, parents);
  }

  public descendants(genomeId: StrategyGenomeId): readonly StrategyGenomeId[] {
    const children = buildChildIndex(this.listTrials());
    return descendantsFromTrials(genomeId, children);
  }

  public commonAncestor(a: StrategyGenomeId, b: StrategyGenomeId): StrategyGenomeId | null {
    const parents = buildParentIndex(this.listTrials());
    return this.#lowestCommonAncestorDepth(a, b, parents);
  }

  /** Lowest common ancestor minimizing lineage depth (deterministic tie-break by id). */
  #lowestCommonAncestorDepth(
    a: StrategyGenomeId,
    b: StrategyGenomeId,
    parentIndex: ReturnType<typeof buildParentIndex>,
  ): StrategyGenomeId | null {
    const ancA = new Set<StrategyGenomeId>([a, ...ancestorsFromTrials(a, parentIndex)]);
    let best: StrategyGenomeId | null = null;
    let bestDepth = Number.POSITIVE_INFINITY;
    const queue: StrategyGenomeId[] = [b];
    const seen = new Set<StrategyGenomeId>();
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      if (ancA.has(current)) {
        const d = computeLineageDepth(current, parentIndex);
        if (
          best === null ||
          d < bestDepth ||
          (d === bestDepth && best !== null && current < best)
        ) {
          best = current;
          bestDepth = d;
        }
      }
      for (const p of parentIndex.get(current) ?? []) {
        queue.push(p);
      }
    }
    if (best === null) {
      return lowestCommonAncestorFromWalk(a, b, parentIndex);
    }
    return best;
  }

  public lineageDepth(genomeId: StrategyGenomeId): number {
    const parents = buildParentIndex(this.listTrials());
    return computeLineageDepth(genomeId, parents);
  }

  public genomeAncestry(genomeId: StrategyGenomeId): GenomeAncestry {
    const parents = buildParentIndex(this.listTrials());
    return Object.freeze({
      genomeId,
      roots: rootAncestors(genomeId, parents),
      depth: computeLineageDepth(genomeId, parents),
    });
  }

  public operatorHistory(genomeId: StrategyGenomeId): readonly EvolutionTrial['operator'][] {
    const map = this.#trialsByGenomeToLatest();
    return computeOperatorHistory(genomeId, map);
  }

  #trialsByGenomeToLatest(): ReadonlyMap<StrategyGenomeId, EvolutionTrial> {
    const map = new Map<StrategyGenomeId, EvolutionTrial>();
    for (const [gid, rows] of this.#trialsByGenome) {
      const last = rows[rows.length - 1];
      if (last) {
        map.set(gid, last);
      }
    }
    return map;
  }

  public assessSimilarity(
    parentA: StrategyGenomeId,
    parentB: StrategyGenomeId,
    nearIdenticalThreshold: Ratio = DEFAULT_NEAR_IDENTICAL_THRESHOLD,
  ): Result<ReturnType<typeof assessParentPairSimilarity>, StrategyFailure> {
    const ga = this.#genomes.get(parentA);
    const gb = this.#genomes.get(parentB);
    if (!ga || !gb) {
      return err({
        code: 'UNKNOWN_GENOME',
        message: 'both parent genomes must be registered as snapshots',
      });
    }
    return ok(
      assessParentPairSimilarity({
        parentA: ga,
        parentB: gb,
        nearIdenticalThreshold,
      }),
    );
  }

  /**
   * Mean pairwise dissimilarity (1 − combinedSimilarity) across genomes tracked in the population store.
   */
  public lineageDiversityForPopulation(
    populationId: StrategyEvolutionPopulationId,
    populationGenomes: ReadonlySet<StrategyGenomeId>,
    nearIdenticalThreshold: Ratio = DEFAULT_NEAR_IDENTICAL_THRESHOLD,
  ): LineageDiversityMetrics {
    const ids = [...populationGenomes];
    if (ids.length < 2) {
      return Object.freeze({
        populationId,
        genomeCount: ids.length,
        meanPairwiseCombinedDissimilarity: ratioFromUnits(RATIO_UNIT),
      });
    }
    let sumDissimilar = 0n;
    let pairs = 0n;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = this.#genomes.get(ids[i]!);
        const b = this.#genomes.get(ids[j]!);
        if (!a || !b) {
          continue;
        }
        const sim = assessParentPairSimilarity({
          parentA: a,
          parentB: b,
          nearIdenticalThreshold,
        });
        sumDissimilar += RATIO_UNIT - sim.combinedSimilarity.units;
        pairs += 1n;
      }
    }
    const mean =
      pairs > 0n ? ratioFromUnits(sumDissimilar / pairs) : ratioFromUnits(0n);
    return Object.freeze({
      populationId,
      genomeCount: ids.length,
      meanPairwiseCombinedDissimilarity: mean,
    });
  }

  public rejectCrossNearIdenticalParents(input: {
    readonly parentA: StrategyGenomeId;
    readonly parentB: StrategyGenomeId;
    readonly nearIdenticalThreshold?: Ratio;
  }): Result<true, StrategyFailure> {
    const assessed = this.assessSimilarity(
      input.parentA,
      input.parentB,
      input.nearIdenticalThreshold ?? DEFAULT_NEAR_IDENTICAL_THRESHOLD,
    );
    if (!assessed.ok) {
      return assessed;
    }
    if (assessed.value.nearIdenticalParents) {
      return err({
        code: 'NEAR_IDENTICAL_PARENTS',
        message: 'refusing crossover: parent genomes are overly similar for continued crossing',
      });
    }
    return ok(true);
  }
}
