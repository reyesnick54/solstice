import type {
  AttributionEntryId,
  AttributionGroupId,
  CounterfactualBaselineId,
  DataContributionReferenceId,
  EconomicValueModelVersion,
  EconomicValueSnapshotId,
  ValuationFormulaVersion,
} from './ids.ts';
import type {
  AttributionEntry,
  CounterfactualBaseline,
  DataContributionReference,
  EconomicValueSnapshot,
  FormulaModel,
  ModelComparison,
} from './types.ts';

export type PeveStoreSnapshot = {
  readonly snapshots: readonly EconomicValueSnapshot[];
  readonly attributions: readonly AttributionEntry[];
  readonly baselines: readonly CounterfactualBaseline[];
  readonly formulas: readonly FormulaModel[];
  readonly contributions: readonly DataContributionReference[];
  readonly comparisons: readonly ModelComparison[];
};

export class InMemoryPeveStore {
  private readonly snapshots = new Map<string, EconomicValueSnapshot>();
  private readonly attributions = new Map<string, AttributionEntry>();
  private readonly baselines = new Map<string, CounterfactualBaseline>();
  private readonly formulas = new Map<string, FormulaModel>();
  private readonly contributions = new Map<string, DataContributionReference>();
  private readonly comparisons: ModelComparison[] = [];

  putSnapshot(snapshot: EconomicValueSnapshot): EconomicValueSnapshot {
    const existing = this.snapshots.get(snapshot.snapshotId);
    if (existing) {
      throw new Error(`EconomicValueSnapshot ${snapshot.snapshotId} is immutable`);
    }
    this.snapshots.set(snapshot.snapshotId, snapshot);
    return snapshot;
  }

  putAttribution(entry: AttributionEntry): AttributionEntry {
    if (this.attributions.has(entry.entryId)) {
      throw new Error(`AttributionEntry ${entry.entryId} is immutable`);
    }
    this.attributions.set(entry.entryId, entry);
    return entry;
  }

  putBaseline(baseline: CounterfactualBaseline): CounterfactualBaseline {
    if (this.baselines.has(baseline.baselineId)) {
      throw new Error(`CounterfactualBaseline ${baseline.baselineId} is immutable`);
    }
    this.baselines.set(baseline.baselineId, baseline);
    return baseline;
  }

  putFormula(model: FormulaModel): FormulaModel {
    const key = `${model.formulaVersion}:${model.modelVersion}`;
    const existing = this.formulas.get(key);
    if (existing && existing.lifecycle !== model.lifecycle) {
      this.formulas.set(key, model);
      return model;
    }
    if (existing && JSON.stringify(existing.weights) !== JSON.stringify(model.weights)) {
      throw new Error(`formula ${key} weights are immutable once used`);
    }
    this.formulas.set(key, model);
    return model;
  }

  putContribution(reference: DataContributionReference): DataContributionReference {
    this.contributions.set(reference.referenceId, reference);
    return reference;
  }

  putComparison(comparison: ModelComparison): ModelComparison {
    this.comparisons.push(comparison);
    return comparison;
  }

  getSnapshot(snapshotId: EconomicValueSnapshotId): EconomicValueSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  snapshotsFor(subjectId: string): readonly EconomicValueSnapshot[] {
    return Object.freeze(
      [...this.snapshots.values()]
        .filter((item) => item.subjectId === subjectId)
        .sort((left, right) => left.generatedAt.localeCompare(right.generatedAt)),
    );
  }

  latestSnapshotFor(subjectId: string): EconomicValueSnapshot | undefined {
    const rows = this.snapshotsFor(subjectId);
    return rows[rows.length - 1];
  }

  snapshotByFormula(
    subjectId: string,
    formulaVersion: ValuationFormulaVersion,
    modelVersion: EconomicValueModelVersion,
    generatedAt: string,
  ): EconomicValueSnapshot | undefined {
    return [...this.snapshots.values()].find(
      (item) =>
        item.subjectId === subjectId &&
        item.formulaVersion === formulaVersion &&
        item.modelVersion === modelVersion &&
        item.generatedAt === generatedAt,
    );
  }

  attributionsFor(subjectId: string): readonly AttributionEntry[] {
    return Object.freeze([...this.attributions.values()].filter((item) => item.subjectId === subjectId));
  }

  getAttribution(entryId: AttributionEntryId): AttributionEntry | undefined {
    return this.attributions.get(entryId);
  }

  groupEntries(groupId: AttributionGroupId): readonly AttributionEntry[] {
    return Object.freeze([...this.attributions.values()].filter((item) => item.groupId === groupId));
  }

  getBaseline(baselineId: CounterfactualBaselineId): CounterfactualBaseline | undefined {
    return this.baselines.get(baselineId);
  }

  baselinesFor(subjectId: string): readonly CounterfactualBaseline[] {
    return Object.freeze([...this.baselines.values()].filter((item) => item.subjectId === subjectId));
  }

  getContribution(referenceId: DataContributionReferenceId): DataContributionReference | undefined {
    return this.contributions.get(referenceId);
  }

  exportState(): PeveStoreSnapshot {
    return {
      snapshots: Object.freeze([...this.snapshots.values()]),
      attributions: Object.freeze([...this.attributions.values()]),
      baselines: Object.freeze([...this.baselines.values()]),
      formulas: Object.freeze([...this.formulas.values()]),
      contributions: Object.freeze([...this.contributions.values()]),
      comparisons: Object.freeze([...this.comparisons]),
    };
  }

  loadState(state: PeveStoreSnapshot): void {
    this.snapshots.clear();
    this.attributions.clear();
    this.baselines.clear();
    this.formulas.clear();
    this.contributions.clear();
    this.comparisons.length = 0;
    for (const snapshot of state.snapshots) {
      this.snapshots.set(snapshot.snapshotId, snapshot);
    }
    for (const entry of state.attributions) {
      this.attributions.set(entry.entryId, entry);
    }
    for (const baseline of state.baselines) {
      this.baselines.set(baseline.baselineId, baseline);
    }
    for (const formula of state.formulas) {
      this.formulas.set(`${formula.formulaVersion}:${formula.modelVersion}`, formula);
    }
    for (const contribution of state.contributions) {
      this.contributions.set(contribution.referenceId, contribution);
    }
    for (const comparison of state.comparisons) {
      this.comparisons.push(comparison);
    }
  }
}
