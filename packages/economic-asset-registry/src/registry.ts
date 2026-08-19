import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import { createEconomicAssetDescriptor, replaceDescriptor } from './descriptor.ts';
import { assetIdFor, type AssetId } from './ids.ts';
import { refuseNativeMonetaryAsset } from './invariants.ts';
import { EconomicAssetQueryIndex } from './projections.ts';
import type { EconomicAssetRegistryStore } from './store.ts';
import { isNativeMonetaryAssetClass } from './taxonomy.ts';
import type {
  EconomicAssetDescriptor,
  EconomicAssetQuery,
  EconomicAssetRegistrySnapshot,
  ExecutionRefusal,
  MintRefusal,
  RegisterAssetInput,
  RegistryAudit,
  RegistryFailure,
} from './types.ts';

const TERMINAL = new Set(['SUPERSEDED', 'RETIRED']);

function failure(code: RegistryFailure['code'], message: string): RegistryFailure {
  return Object.freeze({ code, message });
}

/**
 * Canonical SunRey Dataset & Economic Asset Registry.
 *
 * Metadata, rights, provenance, lineage, and policy sit above
 * source-specific systems. This owner does not store raw datasets,
 * value assets, mint, or replace HIN, PDV, PEG, the Human
 * Contribution Registry, oracles, productive engines, or the
 * monetary supply book.
 */
export class EconomicAssetRegistry {
  private readonly descriptors = new Map<AssetId, EconomicAssetDescriptor>();
  private readonly indexes = new EconomicAssetQueryIndex();
  private readonly store: EconomicAssetRegistryStore | undefined;
  private projectionsReady = true;

  constructor(store?: EconomicAssetRegistryStore) {
    this.store = store;
  }

  register(input: RegisterAssetInput): Result<EconomicAssetDescriptor, RegistryFailure> {
    if (isNativeMonetaryAssetClass(input.assetClass as string)) {
      return err(refuseNativeMonetaryAsset(input.assetClass));
    }
    const created = createEconomicAssetDescriptor(input, this.allLineage());
    if (!created.ok) {
      return created;
    }
    if (this.descriptors.has(created.value.assetId)) {
      return err(failure('ALREADY_REGISTERED', `asset ${created.value.assetId} already exists; updates use supersession`));
    }
    this.put(created.value);
    return ok(created.value);
  }

  get(assetId: AssetId): EconomicAssetDescriptor | undefined {
    return this.descriptors.get(assetId);
  }

  updateMetadata(assetId: AssetId, input: RegisterAssetInput): Result<EconomicAssetDescriptor, RegistryFailure> {
    return this.supersede(assetId, input);
  }

  supersede(priorId: AssetId, input: RegisterAssetInput): Result<EconomicAssetDescriptor, RegistryFailure> {
    const prior = this.descriptors.get(priorId);
    if (!prior) {
      return err(failure('ASSET_NOT_FOUND', `asset ${priorId} was not registered`));
    }
    if (TERMINAL.has(prior.status) || prior.supersededBy) {
      return err(failure('ALREADY_SUPERSEDED', `asset ${priorId} is already superseded and remains historically traceable`));
    }
    const successorId = input.assetId ?? assetIdFor(`supersede:${priorId}:${input.createdAt}:${input.contentCommitmentMaterial}`);
    const next = this.register({
      ...input,
      assetId: successorId,
      supersedes: priorId,
      lineage: [
        ...(input.lineage ?? []),
        { kind: 'SUPERSEDES', fromAssetId: successorId, toAssetId: priorId },
      ],
    });
    if (!next.ok) {
      return next;
    }
    const successor = next.value;
    this.put(
      replaceDescriptor(
        prior,
        { status: 'SUPERSEDED', freshness: 'SUPERSEDED', supersededBy: successor.assetId },
        successor.createdAt,
      ),
    );
    return ok(this.descriptors.get(successor.assetId) ?? successor);
  }

  correct(priorId: AssetId, input: RegisterAssetInput): Result<EconomicAssetDescriptor, RegistryFailure> {
    const prior = this.descriptors.get(priorId);
    if (!prior) {
      return err(failure('ASSET_NOT_FOUND', `asset ${priorId} was not registered`));
    }
    if (TERMINAL.has(prior.status) || prior.supersededBy) {
      return err(failure('ALREADY_SUPERSEDED', `asset ${priorId} is already corrected or superseded`));
    }
    if (input.supersedes && input.supersedes !== priorId) {
      return err(failure('CORRECTION_TARGET_REQUIRED', 'a correction must explicitly reference the record it supersedes'));
    }
    const successorId = input.assetId ?? assetIdFor(`correct:${priorId}:${input.createdAt}:${input.contentCommitmentMaterial}`);
    const next = this.supersede(priorId, {
      ...input,
      assetId: successorId,
      corrects: priorId,
      lineage: [
        ...(input.lineage ?? []),
        { kind: 'CORRECTS', fromAssetId: successorId, toAssetId: priorId },
      ],
    });
    if (!next.ok) {
      return next;
    }
    const corrected = replaceDescriptor(next.value, { corrects: priorId }, next.value.updatedAt);
    const priorNow = this.descriptors.get(priorId);
    if (priorNow) {
      this.put(replaceDescriptor(priorNow, { correctedBy: corrected.assetId }, corrected.updatedAt));
    }
    this.put(corrected);
    return ok(corrected);
  }

  verify(assetId: AssetId, verifiedAt: UtcInstant): Result<EconomicAssetDescriptor, RegistryFailure> {
    const current = this.descriptors.get(assetId);
    if (!current) {
      return err(failure('ASSET_NOT_FOUND', `asset ${assetId} was not registered`));
    }
    if (current.status === 'VERIFIED') {
      return ok(current);
    }
    if (TERMINAL.has(current.status) || current.status === 'SUSPENDED') {
      return err(failure('INVALID_LIFECYCLE', `asset ${assetId} cannot be verified from ${current.status}`));
    }
    const next = replaceDescriptor(
      current,
      {
        status: 'VERIFIED',
        qualityClass: current.qualityClass === 'AUTHORITATIVE' ? 'AUTHORITATIVE' : 'VERIFIED',
        freshness: current.freshness === 'SUPERSEDED' ? current.freshness : 'CURRENT',
      },
      verifiedAt,
    );
    this.put(next);
    return ok(next);
  }

  query(criteria: EconomicAssetQuery): readonly EconomicAssetDescriptor[] {
    const indexed = this.projectionsReady ? this.indexes.matchingIds(criteria) : null;
    const candidates = indexed
      ? indexed.map((id) => this.descriptors.get(id)).filter((item): item is EconomicAssetDescriptor => item !== undefined)
      : [...this.descriptors.values()];
    return Object.freeze(
      candidates.sort((left, right) => (left.createdAt < right.createdAt ? -1 : left.assetId < right.assetId ? -1 : 1)),
    );
  }

  snapshot(): EconomicAssetRegistrySnapshot {
    return Object.freeze({
      descriptors: Object.freeze([...this.descriptors.values()]),
      rawDataStored: false,
      automaticValuation: false,
      automaticSunReyMint: false,
      automaticMoonReyMint: false,
      isNativeMonetarySupply: false,
    });
  }

  restore(snapshot: EconomicAssetRegistrySnapshot): void {
    this.descriptors.clear();
    for (const descriptor of snapshot.descriptors) {
      this.descriptors.set(descriptor.assetId, descriptor);
    }
    this.rebuildProjections();
  }

  rebuildProjections(): void {
    this.indexes.rebuild([...this.descriptors.values()]);
    this.projectionsReady = true;
  }

  clearProjections(): void {
    this.indexes.clear();
    this.projectionsReady = false;
  }

  persist(): void {
    this.store?.persist(this.snapshot());
  }

  loadFromStore(): void {
    const loaded = this.store?.load();
    if (loaded) {
      this.restore(loaded);
    }
  }

  audit(): RegistryAudit {
    const descriptors = [...this.descriptors.values()];
    const byClass = new Map<EconomicAssetDescriptor['assetClass'], number>();
    let registered = 0;
    let verified = 0;
    let superseded = 0;
    let corrected = 0;
    for (const descriptor of descriptors) {
      byClass.set(descriptor.assetClass, (byClass.get(descriptor.assetClass) ?? 0) + 1);
      if (descriptor.status === 'REGISTERED' || descriptor.status === 'DRAFT') {
        registered += 1;
      }
      if (descriptor.status === 'VERIFIED') {
        verified += 1;
      }
      if (descriptor.status === 'SUPERSEDED') {
        superseded += 1;
      }
      if (descriptor.corrects) {
        corrected += 1;
      }
    }
    return Object.freeze({
      registered,
      verified,
      superseded,
      corrected,
      countsByClass: Object.freeze(
        [...byClass.entries()]
          .map(([assetClass, count]) => Object.freeze({ assetClass, count }))
          .sort((left, right) => left.assetClass.localeCompare(right.assetClass)),
      ),
      valuationTotals: null,
      sunReyTotals: null,
      moonReyTotals: null,
    });
  }

  authorizeExecution(descriptor: EconomicAssetDescriptor): ExecutionRefusal {
    return Object.freeze({
      authorized: false,
      issuesExecutionAuthority: false,
      reason: 'ECONOMIC_ASSET_CANNOT_AUTHORIZE_EXECUTION',
      assetId: descriptor.assetId,
    });
  }

  authorizeMint(descriptor: EconomicAssetDescriptor): MintRefusal {
    return Object.freeze({
      authorized: false,
      sunReyQuantity: null,
      moonReyQuantity: null,
      reason: 'ECONOMIC_ASSET_CANNOT_AUTHORIZE_MINT',
      assetId: descriptor.assetId,
    });
  }

  private put(descriptor: EconomicAssetDescriptor): void {
    this.descriptors.set(descriptor.assetId, descriptor);
    this.rebuildProjections();
  }

  private allLineage() {
    return [...this.descriptors.values()].flatMap((descriptor) => [...descriptor.lineage]);
  }
}

export { EconomicAssetRegistry as CanonicalEconomicAssetRegistry };
