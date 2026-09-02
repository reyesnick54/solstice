/**
 * Productive asset alias registry — extends Wave 3/4 entity alias architecture.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import type {
  ProductiveAliasKind,
  ProductiveAssetAlias,
  ProductiveAssetAliasId,
  ProductiveAssetId,
} from './types.ts';
import { aliasKey, commitValue } from './commitment.ts';

export function asAliasId(value: string): ProductiveAssetAliasId {
  return value as ProductiveAssetAliasId;
}

export function aliasValueCommitment(kind: ProductiveAliasKind, value: string): string {
  return commitValue(`alias:${kind}`, value);
}

export function deriveAliasId(input: {
  readonly aliasKind: ProductiveAliasKind;
  readonly aliasValueCommitment: string;
  readonly sourceSystem: string;
  readonly providerId: string | null;
}): ProductiveAssetAliasId {
  return asAliasId(
    sha256Hex(
      aliasKey([
        'productive-asset-alias',
        input.aliasKind,
        input.aliasValueCommitment,
        input.sourceSystem,
        input.providerId ?? '',
      ]),
    ),
  );
}

export function createAlias(input: {
  readonly aliasKind: ProductiveAliasKind;
  readonly aliasValue: string;
  readonly sourceSystem: string;
  readonly providerId?: string | null;
  readonly productiveAssetId: ProductiveAssetId;
  readonly registeredAtUtc: string;
}): ProductiveAssetAlias {
  const valueCommitment = aliasValueCommitment(input.aliasKind, input.aliasValue);
  return Object.freeze({
    aliasId: deriveAliasId({
      aliasKind: input.aliasKind,
      aliasValueCommitment: valueCommitment,
      sourceSystem: input.sourceSystem,
      providerId: input.providerId ?? null,
    }),
    aliasKind: input.aliasKind,
    aliasValueCommitment: valueCommitment,
    sourceSystem: input.sourceSystem,
    providerId: input.providerId ?? null,
    productiveAssetId: input.productiveAssetId,
    registeredAtUtc: input.registeredAtUtc,
  });
}

export class ProductiveAssetAliasRegistry {
  readonly #byId = new Map<ProductiveAssetAliasId, ProductiveAssetAlias>();
  readonly #byLookup = new Map<string, ProductiveAssetAliasId>();

  register(alias: ProductiveAssetAlias): ProductiveAssetAlias {
    const lookup = lookupKey(alias.aliasKind, alias.aliasValueCommitment, alias.sourceSystem, alias.providerId);
    const existingId = this.#byLookup.get(lookup);
    if (existingId && existingId !== alias.aliasId) {
      const existing = this.#byId.get(existingId);
      if (existing && existing.productiveAssetId !== alias.productiveAssetId) {
        throw new Error('alias collision: same source alias maps to different productive assets');
      }
    }
    this.#byId.set(alias.aliasId, alias);
    this.#byLookup.set(lookup, alias.aliasId);
    return alias;
  }

  get(aliasId: ProductiveAssetAliasId): ProductiveAssetAlias | undefined {
    return this.#byId.get(aliasId);
  }

  resolve(input: {
    readonly aliasKind: ProductiveAliasKind;
    readonly aliasValueCommitment: string;
    readonly sourceSystem: string;
    readonly providerId?: string | null;
  }): ProductiveAssetAlias | undefined {
    const aliasId = this.#byLookup.get(
      lookupKey(input.aliasKind, input.aliasValueCommitment, input.sourceSystem, input.providerId ?? null),
    );
    return aliasId ? this.#byId.get(aliasId) : undefined;
  }

  listForAsset(productiveAssetId: ProductiveAssetId): readonly ProductiveAssetAlias[] {
    return [...this.#byId.values()].filter((row) => row.productiveAssetId === productiveAssetId);
  }

  list(): readonly ProductiveAssetAlias[] {
    return [...this.#byId.values()];
  }

  snapshot(): readonly ProductiveAssetAlias[] {
    return this.list();
  }

  restore(aliases: readonly ProductiveAssetAlias[]): void {
    this.#byId.clear();
    this.#byLookup.clear();
    for (const alias of aliases) {
      this.register(alias);
    }
  }
}

function lookupKey(
  aliasKind: ProductiveAliasKind,
  aliasValueCommitment: string,
  sourceSystem: string,
  providerId: string | null,
): string {
  return aliasKey([aliasKind, aliasValueCommitment, sourceSystem, providerId ?? '']);
}
