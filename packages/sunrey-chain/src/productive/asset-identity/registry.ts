/**
 * Canonical productive asset registry with alias resolution and persistence.
 */

import { commitDisplayName } from './commitment.ts';
import { deriveAssetFingerprint } from './fingerprint.ts';
import { createAlias, ProductiveAssetAliasRegistry } from './alias.ts';
import { hierarchyEdge, validateHierarchyAcyclic } from './hierarchy.ts';
import { lifecycleAllowsProduction, transitionLifecycle } from './lifecycle.ts';
import { resolveProductiveAssetIdentity } from './resolution.ts';
import type {
  AssetHierarchyEdge,
  AssetResolutionHint,
  AssetResolutionResult,
  CanonicalProductiveAsset,
  PartyReference,
  ProductiveAssetId,
  ProductiveAssetIdentitySnapshot,
  ProductionAttributionAssessment,
  RegisterProductiveAssetInput,
} from './types.ts';
import { PRODUCTIVE_ASSET_IDENTITY_SCHEMA } from './types.ts';

export function asProductiveAssetId(value: string): ProductiveAssetId {
  return value as ProductiveAssetId;
}

function formatAssetId(sequence: number): ProductiveAssetId {
  return asProductiveAssetId(`P-${String(sequence).padStart(6, '0')}`);
}

export class ProductiveAssetIdentityRegistry {
  readonly aliases = new ProductiveAssetAliasRegistry();
  readonly #assets = new Map<ProductiveAssetId, CanonicalProductiveAsset>();
  readonly #hierarchy: AssetHierarchyEdge[] = [];
  readonly #fingerprintIndex = new Map<string, ProductiveAssetId[]>();
  #sequence = 1;

  register(input: RegisterProductiveAssetInput): CanonicalProductiveAsset {
    const productiveAssetId = formatAssetId(this.#sequence);
    this.#sequence += 1;
    const fingerprint = deriveAssetFingerprint({
      assetClass: input.assetClass,
      jurisdiction: input.jurisdiction,
      geography: input.geography,
      ...(input.technologyMetadata !== undefined ? { technologyMetadata: input.technologyMetadata } : {}),
      ...(input.externalIdentifiers !== undefined ? { externalIdentifiers: input.externalIdentifiers } : {}),
      ...(input.commissionedAtUtc !== undefined ? { commissionedAtUtc: input.commissionedAtUtc } : {}),
    });
    const asset = Object.freeze({
      schemaVersion: PRODUCTIVE_ASSET_IDENTITY_SCHEMA,
      productiveAssetId,
      assetClass: input.assetClass,
      productiveCategory: input.productiveCategory,
      economyCategory: input.economyCategory ?? null,
      displayNameCommitment: input.displayName ? commitDisplayName(input.displayName) : null,
      parties: Object.freeze(input.parties ?? []),
      geography: Object.freeze({ ...input.geography }),
      jurisdiction: input.jurisdiction,
      commissionedAtUtc: input.commissionedAtUtc ?? null,
      retiredAtUtc: input.retiredAtUtc ?? null,
      lifecycle: input.lifecycle ?? 'UNKNOWN',
      capacityMetadata: Object.freeze({ ...(input.capacityMetadata ?? {}) }),
      technologyMetadata: Object.freeze({ ...(input.technologyMetadata ?? {}) }),
      externalIdentifiers: Object.freeze([...(input.externalIdentifiers ?? [])]),
      verificationStatus: input.verificationStatus ?? 'UNVERIFIED',
      sourceReferences: Object.freeze([...(input.sourceReferences ?? [])]),
      rightsReferences: Object.freeze([...(input.rightsReferences ?? [])]),
      parentAssetId: input.parentAssetId ?? null,
      rollupBehavior: input.rollupBehavior ?? 'INDEPENDENT',
      fingerprint,
      createdAtUtc: input.createdAtUtc,
      updatedAtUtc: input.createdAtUtc,
    }) satisfies CanonicalProductiveAsset;

    this.#assets.set(productiveAssetId, asset);
    this.#indexFingerprint(fingerprint, productiveAssetId);

    if (input.parentAssetId) {
      this.linkChild({
        parentAssetId: input.parentAssetId,
        childAssetId: productiveAssetId,
        rollupBehavior: input.rollupBehavior ?? 'ROLLS_UP_TO_PARENT',
      });
    }

    for (const alias of input.aliases ?? []) {
      this.aliases.register(
        createAlias({
          aliasKind: alias.aliasKind,
          aliasValue: alias.aliasValue,
          sourceSystem: alias.sourceSystem,
          ...(alias.providerId !== undefined ? { providerId: alias.providerId } : {}),
          productiveAssetId,
          registeredAtUtc: input.createdAtUtc,
        }),
      );
    }

    return asset;
  }

  registerAlias(input: {
    readonly productiveAssetId: ProductiveAssetId;
    readonly aliasKind: Parameters<typeof createAlias>[0]['aliasKind'];
    readonly aliasValue: string;
    readonly sourceSystem: string;
    readonly providerId?: string | null;
    readonly registeredAtUtc: string;
  }) {
    this.require(input.productiveAssetId);
    return this.aliases.register(
      createAlias({
        aliasKind: input.aliasKind,
        aliasValue: input.aliasValue,
        sourceSystem: input.sourceSystem,
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
        productiveAssetId: input.productiveAssetId,
        registeredAtUtc: input.registeredAtUtc,
      }),
    );
  }

  get(productiveAssetId: ProductiveAssetId): CanonicalProductiveAsset | undefined {
    return this.#assets.get(productiveAssetId);
  }

  require(productiveAssetId: ProductiveAssetId): CanonicalProductiveAsset {
    const asset = this.#assets.get(productiveAssetId);
    if (!asset) {
      throw new Error(`unknown productive asset ${productiveAssetId}`);
    }
    return asset;
  }

  list(): readonly CanonicalProductiveAsset[] {
    return [...this.#assets.values()];
  }

  linkChild(input: {
    readonly parentAssetId: ProductiveAssetId;
    readonly childAssetId: ProductiveAssetId;
    readonly rollupBehavior: CanonicalProductiveAsset['rollupBehavior'];
  }): AssetHierarchyEdge {
    this.require(input.parentAssetId);
    this.require(input.childAssetId);
    const edge = hierarchyEdge(input.parentAssetId, input.childAssetId, input.rollupBehavior);
    this.#hierarchy.push(edge);
    validateHierarchyAcyclic(this.#hierarchy);
    return edge;
  }

  hierarchy(): readonly AssetHierarchyEdge[] {
    return [...this.#hierarchy];
  }

  setLifecycle(productiveAssetId: ProductiveAssetId, lifecycle: CanonicalProductiveAsset['lifecycle'], atUtc: string) {
    const current = this.require(productiveAssetId);
    const nextLifecycle = transitionLifecycle(current.lifecycle, lifecycle);
    const updated = Object.freeze({
      ...current,
      lifecycle: nextLifecycle,
      retiredAtUtc: nextLifecycle === 'RETIRED' ? (current.retiredAtUtc ?? atUtc) : current.retiredAtUtc,
      updatedAtUtc: atUtc,
    });
    this.#assets.set(productiveAssetId, updated);
    return updated;
  }

  setParties(productiveAssetId: ProductiveAssetId, parties: readonly PartyReference[], atUtc: string) {
    const current = this.require(productiveAssetId);
    const updated = Object.freeze({
      ...current,
      parties: Object.freeze([...parties]),
      updatedAtUtc: atUtc,
    });
    this.#assets.set(productiveAssetId, updated);
    return updated;
  }

  resolve(hint: AssetResolutionHint): AssetResolutionResult {
    return resolveProductiveAssetIdentity({
      hint,
      aliases: this.aliases,
      assets: this.#assets,
      fingerprintIndex: this.#fingerprintIndex,
    });
  }

  assessProductionAttribution(
    productiveAssetId: ProductiveAssetId,
    eventAtUtc: string,
  ): ProductionAttributionAssessment {
    const asset = this.require(productiveAssetId);
    return lifecycleAllowsProduction(asset.lifecycle, eventAtUtc, asset);
  }

  snapshot(): ProductiveAssetIdentitySnapshot {
    return Object.freeze({
      schemaVersion: PRODUCTIVE_ASSET_IDENTITY_SCHEMA,
      nextSequence: this.#sequence,
      assets: Object.freeze([...this.#assets.values()]),
      aliases: Object.freeze(this.aliases.snapshot()),
      hierarchy: Object.freeze([...this.#hierarchy]),
    });
  }

  restore(snapshot: ProductiveAssetIdentitySnapshot): void {
    if (snapshot.schemaVersion !== PRODUCTIVE_ASSET_IDENTITY_SCHEMA) {
      throw new Error('unsupported productive asset identity snapshot schema');
    }
    this.#assets.clear();
    this.#hierarchy.length = 0;
    this.#fingerprintIndex.clear();
    this.#sequence = snapshot.nextSequence;
    for (const asset of snapshot.assets) {
      this.#assets.set(asset.productiveAssetId, asset);
      this.#indexFingerprint(asset.fingerprint, asset.productiveAssetId);
    }
    this.aliases.restore(snapshot.aliases);
    for (const edge of snapshot.hierarchy) {
      this.#hierarchy.push(edge);
    }
    validateHierarchyAcyclic(this.#hierarchy);
  }

  #indexFingerprint(fingerprint: string, productiveAssetId: ProductiveAssetId): void {
    const list = this.#fingerprintIndex.get(fingerprint) ?? [];
    if (!list.includes(productiveAssetId)) {
      list.push(productiveAssetId);
    }
    this.#fingerprintIndex.set(fingerprint, list);
  }
}
