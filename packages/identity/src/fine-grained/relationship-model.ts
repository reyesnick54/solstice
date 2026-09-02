import type { AuthorizationActorType } from './actor-types.ts';

/**
 * Canonical relationship tuples. Format is OpenFGA-compatible:
 *   subjectType:subjectId#relation@objectType:objectId
 *
 * Policy answers: "Is this action allowed?"
 * Authorization answers: "Does this principal possess the relationship?"
 */
export const RELATIONSHIP_TYPES = [
  'CONTROLS',
  'GRANTED',
  'OPERATES',
  'MAY_READ',
  'ACTS_FOR',
  'MANAGES',
  'MAY_AUTHORIZE',
  'MAY_VALIDATE',
  'MAY_WRITE',
  'MAY_ANALYZE',
  'MAY_WITHDRAW',
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const RESOURCE_TYPES = [
  'USER',
  'WALLET',
  'CONSENT',
  'PRODUCTIVE_ASSET',
  'DATASET',
  'DOMAIN',
  'MONETARY_PROPOSAL',
  'BLOCK',
  'ACCOUNT',
  'AGENT',
  'POLICY',
  'PROVIDER',
  'VALIDATOR_CONFIG',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const PERMISSION_VERBS = [
  'read',
  'write',
  'analyze',
  'withdraw',
  'approve',
  'validate',
  'manage',
  'operate',
  'authorize',
] as const;

export type PermissionVerb = (typeof PERMISSION_VERBS)[number];

/**
 * Canonical relationship definitions with subject and object type constraints.
 */
export const CANONICAL_RELATIONSHIPS: Readonly<
  Record<
    string,
    {
      readonly subjectType: AuthorizationActorType | ResourceType;
      readonly relation: RelationshipType;
      readonly objectType: ResourceType;
      readonly permittedVerbs: readonly PermissionVerb[];
    }
  >
> = Object.freeze({
  'USER_CONTROLS_WALLET': {
    subjectType: 'HUMAN_USER',
    relation: 'CONTROLS',
    objectType: 'WALLET',
    permittedVerbs: ['read', 'withdraw', 'operate'],
  },
  'USER_GRANTED_CONSENT': {
    subjectType: 'HUMAN_USER',
    relation: 'GRANTED',
    objectType: 'CONSENT',
    permittedVerbs: ['read', 'manage'],
  },
  'ORGANIZATION_OPERATES_PRODUCTIVE_ASSET': {
    subjectType: 'ENTERPRISE',
    relation: 'OPERATES',
    objectType: 'PRODUCTIVE_ASSET',
    permittedVerbs: ['read', 'operate', 'manage'],
  },
  'SERVICE_MAY_READ_DATASET': {
    subjectType: 'SERVICE_IDENTITY',
    relation: 'MAY_READ',
    objectType: 'DATASET',
    permittedVerbs: ['read', 'analyze'],
  },
  'AGENT_ACTS_FOR_USER': {
    subjectType: 'AI_AGENT',
    relation: 'ACTS_FOR',
    objectType: 'USER',
    permittedVerbs: ['read', 'analyze'],
  },
  'ADMIN_MANAGES_DOMAIN': {
    subjectType: 'ADMINISTRATOR',
    relation: 'MANAGES',
    objectType: 'DOMAIN',
    permittedVerbs: ['manage', 'operate'],
  },
  'HUMAN_GOVERNANCE_MAY_AUTHORIZE_MONETARY_PROPOSAL': {
    subjectType: 'HUMAN_GOVERNANCE',
    relation: 'MAY_AUTHORIZE',
    objectType: 'MONETARY_PROPOSAL',
    permittedVerbs: ['authorize', 'approve'],
  },
  'VALIDATOR_MAY_VALIDATE_BLOCK': {
    subjectType: 'VALIDATOR',
    relation: 'MAY_VALIDATE',
    objectType: 'BLOCK',
    permittedVerbs: ['validate'],
  },
});

export type RelationshipTuple = {
  readonly subjectType: AuthorizationActorType | ResourceType;
  readonly subjectId: string;
  readonly relation: RelationshipType;
  readonly objectType: ResourceType;
  readonly objectId: string;
};

export function tupleKey(tuple: RelationshipTuple): string {
  return `${tuple.subjectType}:${tuple.subjectId}#${tuple.relation}@${tuple.objectType}:${tuple.objectId}`;
}

export function parseTupleKey(key: string): RelationshipTuple | null {
  const match = /^([^:]+):([^#]+)#([^@]+)@([^:]+):(.+)$/.exec(key);
  if (!match) {
    return null;
  }
  return Object.freeze({
    subjectType: match[1] as AuthorizationActorType | ResourceType,
    subjectId: match[2]!,
    relation: match[3] as RelationshipType,
    objectType: match[4] as ResourceType,
    objectId: match[5]!,
  });
}

export function findCanonicalRelationship(
  subjectType: AuthorizationActorType | ResourceType,
  relation: RelationshipType,
  objectType: ResourceType,
): (typeof CANONICAL_RELATIONSHIPS)[string] | null {
  for (const def of Object.values(CANONICAL_RELATIONSHIPS)) {
    if (def.subjectType === subjectType && def.relation === relation && def.objectType === objectType) {
      return def;
    }
  }
  return null;
}

export function verbPermittedForRelationship(
  subjectType: AuthorizationActorType | ResourceType,
  relation: RelationshipType,
  objectType: ResourceType,
  verb: PermissionVerb,
): boolean {
  const def = findCanonicalRelationship(subjectType, relation, objectType);
  return def?.permittedVerbs.includes(verb) ?? false;
}
