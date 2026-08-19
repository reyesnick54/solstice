import type {
  AssetId,
  CanonicalOwnerRef,
  ContentCommitment,
  ControllerRef,
  ValuationMethodRef,
} from './ids.ts';
import type {
  AssetLifecycleState,
  EconomicAssetClass,
  EconomicAssetDomain,
  EconomicCategory,
  FreshnessState,
  QualityClass,
  SensitivityClass,
  SourceClass,
} from './taxonomy.ts';
import type { EconomicAssetDescriptor, EconomicAssetQuery } from './types.ts';

/**
 * Rebuildable query indexes. Clearing these does not delete canonical
 * descriptors. Callers rebuild from the authoritative registry.
 */
export class EconomicAssetQueryIndex {
  private readonly byId = new Map<AssetId, AssetId[]>();
  private readonly byClass = new Map<EconomicAssetClass, AssetId[]>();
  private readonly byDomain = new Map<EconomicAssetDomain, AssetId[]>();
  private readonly byOwner = new Map<CanonicalOwnerRef, AssetId[]>();
  private readonly byController = new Map<ControllerRef, AssetId[]>();
  private readonly byJurisdiction = new Map<string, AssetId[]>();
  private readonly byCategory = new Map<EconomicCategory, AssetId[]>();
  private readonly bySensitivity = new Map<SensitivityClass, AssetId[]>();
  private readonly byQuality = new Map<QualityClass, AssetId[]>();
  private readonly byFreshness = new Map<FreshnessState, AssetId[]>();
  private readonly bySource = new Map<SourceClass, AssetId[]>();
  private readonly byStatus = new Map<AssetLifecycleState, AssetId[]>();
  private readonly byAnchor = new Map<ContentCommitment, AssetId[]>();
  private readonly byLineageParent = new Map<AssetId, AssetId[]>();
  private readonly byValuation = new Map<ValuationMethodRef, AssetId[]>();

  clear(): void {
    this.byId.clear();
    this.byClass.clear();
    this.byDomain.clear();
    this.byOwner.clear();
    this.byController.clear();
    this.byJurisdiction.clear();
    this.byCategory.clear();
    this.bySensitivity.clear();
    this.byQuality.clear();
    this.byFreshness.clear();
    this.bySource.clear();
    this.byStatus.clear();
    this.byAnchor.clear();
    this.byLineageParent.clear();
    this.byValuation.clear();
  }

  rebuild(descriptors: readonly EconomicAssetDescriptor[]): void {
    this.clear();
    for (const descriptor of descriptors) {
      this.index(descriptor);
    }
  }

  index(descriptor: EconomicAssetDescriptor): void {
    push(this.byId, descriptor.assetId, descriptor.assetId);
    push(this.byClass, descriptor.assetClass, descriptor.assetId);
    push(this.byDomain, descriptor.domain, descriptor.assetId);
    push(this.byOwner, descriptor.canonicalOwner, descriptor.assetId);
    push(this.byController, descriptor.controllerRef, descriptor.assetId);
    push(this.byJurisdiction, descriptor.jurisdiction, descriptor.assetId);
    push(this.byCategory, descriptor.economicCategory, descriptor.assetId);
    push(this.bySensitivity, descriptor.sensitivityClass, descriptor.assetId);
    push(this.byQuality, descriptor.qualityClass, descriptor.assetId);
    push(this.byFreshness, descriptor.freshness, descriptor.assetId);
    push(this.bySource, descriptor.sourceClass, descriptor.assetId);
    push(this.byStatus, descriptor.status, descriptor.assetId);
    if (descriptor.chainAnchor) {
      push(this.byAnchor, descriptor.chainAnchor.contentCommitment, descriptor.assetId);
    }
    for (const edge of descriptor.lineage) {
      push(this.byLineageParent, edge.toAssetId, descriptor.assetId);
    }
    for (const method of descriptor.permittedValuationMethodRefs) {
      push(this.byValuation, method, descriptor.assetId);
    }
  }

  matchingIds(criteria: EconomicAssetQuery): readonly AssetId[] | null {
    const sets: AssetId[][] = [];
    if (criteria.assetId) {
      sets.push(this.byId.get(criteria.assetId) ?? []);
    }
    if (criteria.assetClass) {
      sets.push(this.byClass.get(criteria.assetClass) ?? []);
    }
    if (criteria.domain) {
      sets.push(this.byDomain.get(criteria.domain) ?? []);
    }
    if (criteria.canonicalOwner) {
      sets.push(this.byOwner.get(criteria.canonicalOwner) ?? []);
    }
    if (criteria.controller) {
      sets.push(this.byController.get(criteria.controller) ?? []);
    }
    if (criteria.jurisdiction) {
      sets.push(this.byJurisdiction.get(criteria.jurisdiction) ?? []);
    }
    if (criteria.economicCategory) {
      sets.push(this.byCategory.get(criteria.economicCategory) ?? []);
    }
    if (criteria.sensitivity) {
      sets.push(this.bySensitivity.get(criteria.sensitivity) ?? []);
    }
    if (criteria.quality) {
      sets.push(this.byQuality.get(criteria.quality) ?? []);
    }
    if (criteria.freshness) {
      sets.push(this.byFreshness.get(criteria.freshness) ?? []);
    }
    if (criteria.sourceClass) {
      sets.push(this.bySource.get(criteria.sourceClass) ?? []);
    }
    if (criteria.status) {
      sets.push(this.byStatus.get(criteria.status) ?? []);
    }
    if (criteria.chainAnchor) {
      sets.push(this.byAnchor.get(criteria.chainAnchor) ?? []);
    }
    if (criteria.lineageParent) {
      sets.push(this.byLineageParent.get(criteria.lineageParent) ?? []);
    }
    if (criteria.permittedValuationMethod) {
      sets.push(this.byValuation.get(criteria.permittedValuationMethod) ?? []);
    }
    if (sets.length === 0) {
      return null;
    }
    return intersect(sets);
  }
}

function push<K>(map: Map<K, AssetId[]>, key: K, id: AssetId): void {
  const list = map.get(key);
  if (list) {
    if (!list.includes(id)) {
      list.push(id);
    }
    return;
  }
  map.set(key, [id]);
}

function intersect(sets: AssetId[][]): readonly AssetId[] {
  const [first, ...rest] = sets;
  if (!first) {
    return [];
  }
  return Object.freeze(
    first.filter((id) => rest.every((set) => set.includes(id))).sort(),
  );
}
