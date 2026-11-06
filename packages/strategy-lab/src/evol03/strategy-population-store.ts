import { err, ok, type Result } from '@solstice/domain';

import type { StrategyFailure } from '../types.ts';
import type { StrategyGenomeId } from '../os05/ids.ts';

import type { StrategyEvolutionPopulationId } from './ids.ts';

export type StrategyPopulationRecord = {
  readonly populationId: StrategyEvolutionPopulationId;
  readonly label: string;
  readonly genomeIds: ReadonlySet<StrategyGenomeId>;
};

/** Tracks which genomes belong to an evolution population (separate from the append-only trial ledger). */
export class StrategyPopulationStore {
  readonly #rows = new Map<StrategyEvolutionPopulationId, Set<StrategyGenomeId>>();

  public ensurePopulation(
    populationId: StrategyEvolutionPopulationId,
    label: string,
  ): Result<StrategyPopulationRecord, StrategyFailure> {
    if (!this.#rows.has(populationId)) {
      this.#rows.set(populationId, new Set());
    }
    return ok(this.snapshot(populationId, label));
  }

  public addGenome(
    populationId: StrategyEvolutionPopulationId,
    genomeId: StrategyGenomeId,
    label: string,
  ): Result<StrategyPopulationRecord, StrategyFailure> {
    const ens = this.ensurePopulation(populationId, label);
    if (!ens.ok) {
      return ens;
    }
    this.#rows.get(populationId)!.add(genomeId);
    return ok(this.snapshot(populationId, label));
  }

  public genomesOf(populationId: StrategyEvolutionPopulationId): ReadonlySet<StrategyGenomeId> {
    return new Set(this.#rows.get(populationId) ?? []);
  }

  snapshot(populationId: StrategyEvolutionPopulationId, label: string): StrategyPopulationRecord {
    return Object.freeze({
      populationId,
      label,
      genomeIds: Object.freeze(new Set(this.#rows.get(populationId) ?? [])),
    });
  }
}
