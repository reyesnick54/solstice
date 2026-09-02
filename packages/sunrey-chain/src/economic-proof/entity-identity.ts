import { economicProofDigest } from './hash.ts';
import type {
  CanonicalEntityId,
  CanonicalEntityMaterial,
  EntityAliasRef,
  EntityAliasResolver,
} from './types.ts';

export function asCanonicalEntityId(value: string): CanonicalEntityId {
  return value as CanonicalEntityId;
}

/**
 * Deterministic canonical entity identity from committed fields.
 * Raw personal identifiers must be pre-hashed into `entityCommitment`.
 */
export function deriveCanonicalEntityId(material: CanonicalEntityMaterial): CanonicalEntityId {
  return asCanonicalEntityId(
    economicProofDigest([
      'entity',
      material.economy,
      material.entityKind,
      material.entityCommitment,
      material.jurisdiction ?? '',
    ]),
  );
}

/**
 * Wave 3 alias boundary. Wave 4 expands resolution; this interface only
 * maps known alias commitments to an existing canonical entity id.
 */
export function resolveEntityAlias(
  resolver: EntityAliasResolver | undefined,
  alias: EntityAliasRef,
  fallbackMaterial: CanonicalEntityMaterial,
): CanonicalEntityId {
  const resolved = resolver?.resolveAlias(alias);
  if (resolved) {
    return resolved;
  }
  return deriveCanonicalEntityId({
    ...fallbackMaterial,
    entityCommitment: alias.aliasValueCommitment,
  });
}

export function entityCommitmentFromRefs(refs: readonly string[]): string {
  return economicProofDigest(['entity-commitment', ...refs]);
}
