import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AuthorizationActorType } from './actor-types.ts';
import type { DelegationRecord } from './delegation.ts';
import type { PermissionVerb, RelationshipTuple, ResourceType } from './relationship-model.ts';

export const AUTHORIZATION_DECISION_CODES = [
  'ALLOWED',
  'RELATIONSHIP_MISSING',
  'VERB_NOT_PERMITTED',
  'ACTOR_TYPE_MISMATCH',
  'GOVERNANCE_AUTHORITY_REQUIRED',
  'VALIDATOR_AUTHORITY_REQUIRED',
  'ADMIN_AUTHORITY_REQUIRED',
  'DELEGATION_REQUIRED',
  'DELEGATION_DENIED',
  'SERVICE_IDENTITY_DENIED',
  'CROSS_TENANT_DENIED',
  'MONETARY_BYPASS_FORBIDDEN',
] as const;

export type AuthorizationDecisionCode = (typeof AUTHORIZATION_DECISION_CODES)[number];

export type AuthorizationSubject = {
  readonly actorType: AuthorizationActorType;
  readonly actorId: string;
  readonly authenticationIdentityId: string | null;
  readonly economicIdentityId: string | null;
};

export type AuthorizationResource = {
  readonly type: ResourceType;
  readonly id: string;
};

export type AuthorizationCheck = {
  readonly subject: AuthorizationSubject;
  readonly relation: RelationshipTuple['relation'];
  readonly resource: AuthorizationResource;
  readonly permission: PermissionVerb;
  readonly purpose: string | null;
  readonly delegation: DelegationRecord | null;
  readonly now: UtcInstant;
};

export type AuthorizationDecision = {
  readonly allowed: boolean;
  readonly code: AuthorizationDecisionCode;
  readonly reason: string;
  readonly tuple: RelationshipTuple | null;
};

/**
 * Fine-grained authorization port. Compatible with OpenFGA tuple/check semantics
 * without requiring an OpenFGA runtime dependency.
 *
 * Policy (Kernel, consent, purpose registry) answers "Is this action allowed?"
 * Authorization answers "Does this principal possess the relationship?"
 */
export interface FineGrainedAuthorization {
  readonly engineKind: 'SIMULATION' | 'OPENFGA';

  check(input: AuthorizationCheck): AuthorizationDecision;

  writeTuple(tuple: RelationshipTuple): void;

  deleteTuple(tuple: RelationshipTuple): void;

  hasTuple(tuple: RelationshipTuple): boolean;

  listTuplesForSubject(subjectId: string): readonly RelationshipTuple[];
}

/**
 * OpenFGA adapter contract for future integration.
 * Implementations translate SunRey tuples to OpenFGA store/check API calls.
 */
export type OpenFgaAdapterConfig = {
  readonly apiUrl: string;
  readonly storeId: string;
  readonly authorizationModelId: string;
};

export interface OpenFgaAuthorizationAdapter extends FineGrainedAuthorization {
  readonly engineKind: 'OPENFGA';
  readonly config: OpenFgaAdapterConfig;
}

export function isOpenFgaAdapter(
  engine: FineGrainedAuthorization,
): engine is OpenFgaAuthorizationAdapter {
  return engine.engineKind === 'OPENFGA';
}
