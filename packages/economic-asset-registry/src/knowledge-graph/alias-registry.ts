import { createHash } from 'node:crypto';

import type { UtcInstant } from '../../../domain/src/time.ts';
import { knowledgeAliasIdFor } from './ids.ts';
import type { CanonicalEntityId } from './ids.ts';
import type { EntityAlias, ExternalIdentifier } from './types.ts';

function aliasKey(identifier: ExternalIdentifier): string {
  return `${identifier.system}:${identifier.id}`;
}

export class AliasRegistry {
  readonly #aliasesByKey = new Map<string, EntityAlias>();
  readonly #aliasesByCanonical = new Map<CanonicalEntityId, EntityAlias[]>();

  registerAlias(input: {
    canonicalEntityId: CanonicalEntityId;
    externalIdentifier: ExternalIdentifier;
    preservedOriginalId: string;
    createdAt: UtcInstant;
    mergeStatus?: EntityAlias['mergeStatus'];
  }): EntityAlias {
    const key = aliasKey(input.externalIdentifier);
    const existing = this.#aliasesByKey.get(key);
    if (existing) {
      if (existing.canonicalEntityId !== input.canonicalEntityId) {
        throw new Error(`alias conflict: ${key} already maps to a different canonical entity`);
      }
      return existing;
    }
    const alias: EntityAlias = Object.freeze({
      aliasId: knowledgeAliasIdFor(`${key}:${input.canonicalEntityId}`),
      canonicalEntityId: input.canonicalEntityId,
      externalIdentifier: Object.freeze({ ...input.externalIdentifier }),
      preservedOriginalId: input.preservedOriginalId,
      createdAt: input.createdAt,
      mergeStatus: input.mergeStatus ?? 'ALIAS_ONLY',
    });
    this.#aliasesByKey.set(key, alias);
    const list = this.#aliasesByCanonical.get(input.canonicalEntityId) ?? [];
    list.push(alias);
    this.#aliasesByCanonical.set(input.canonicalEntityId, list);
    return alias;
  }

  resolveIdentifier(identifier: ExternalIdentifier): CanonicalEntityId | null {
    return this.#aliasesByKey.get(aliasKey(identifier))?.canonicalEntityId ?? null;
  }

  aliasesFor(canonicalEntityId: CanonicalEntityId): readonly EntityAlias[] {
    return Object.freeze([...(this.#aliasesByCanonical.get(canonicalEntityId) ?? [])]);
  }

  allAliases(): readonly EntityAlias[] {
    return Object.freeze([...this.#aliasesByKey.values()]);
  }

  snapshot(): readonly EntityAlias[] {
    return this.allAliases();
  }

  restore(aliases: readonly EntityAlias[]): void {
    this.#aliasesByKey.clear();
    this.#aliasesByCanonical.clear();
    for (const alias of aliases) {
      const key = aliasKey(alias.externalIdentifier);
      this.#aliasesByKey.set(key, alias);
      const list = this.#aliasesByCanonical.get(alias.canonicalEntityId) ?? [];
      list.push(alias);
      this.#aliasesByCanonical.set(alias.canonicalEntityId, list);
    }
  }
}

export function aliasRegistryDigest(aliases: readonly EntityAlias[]): string {
  const material = aliases
    .map((alias) => `${alias.aliasId}:${alias.canonicalEntityId}:${alias.externalIdentifier.system}:${alias.externalIdentifier.id}`)
    .sort()
    .join('|');
  return createHash('sha256').update(material).digest('hex');
}
