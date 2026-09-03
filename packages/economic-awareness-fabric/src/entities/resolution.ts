import {
  deriveCanonicalEntityId,
  entityCommitmentFromRefs,
  resolveEntityAlias,
} from '../../../sunrey-chain/src/economic-proof/entity-identity.ts';
import type {
  CanonicalEntityMaterial,
  EntityAliasRef,
  EntityAliasResolver,
  EntityKind,
} from '../../../sunrey-chain/src/economic-proof/types.ts';

export type EntityResolutionInput = {
  readonly material: CanonicalEntityMaterial;
  readonly aliases: readonly EntityAliasRef[];
  readonly resolver?: EntityAliasResolver;
};

export type EntityResolutionResult = {
  readonly canonicalEntityId: string;
  readonly resolvedAliases: readonly string[];
  readonly unresolvedAliases: readonly string[];
};

export function resolveEntity(input: EntityResolutionInput): EntityResolutionResult {
  const canonicalEntityId = deriveCanonicalEntityId(input.material);

  const resolved: string[] = [];
  const unresolved: string[] = [];

  for (const alias of input.aliases) {
    const resolvedId = resolveEntityAlias(input.resolver, alias, input.material);
    if (resolvedId !== canonicalEntityId || input.resolver?.resolveAlias(alias)) {
      resolved.push(alias.aliasValueCommitment);
    } else {
      unresolved.push(alias.aliasValueCommitment);
    }
  }

  return Object.freeze({
    canonicalEntityId,
    resolvedAliases: Object.freeze(resolved),
    unresolvedAliases: Object.freeze(unresolved),
  });
}

export function materialFromRefs(
  economy: CanonicalEntityMaterial['economy'],
  entityKind: EntityKind,
  refs: readonly string[],
  jurisdiction?: string,
): CanonicalEntityMaterial {
  return Object.freeze({
    economy,
    entityKind,
    entityCommitment: entityCommitmentFromRefs(refs),
    ...(jurisdiction !== undefined ? { jurisdiction } : {}),
  });
}
