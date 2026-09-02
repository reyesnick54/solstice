/**
 * Explicit actor types for fine-grained authorization.
 * Each type carries distinct authority boundaries; they must not be conflated.
 */
export const AUTHORIZATION_ACTOR_TYPES = [
  'HUMAN_USER',
  'HUMAN_GOVERNANCE',
  'ADMINISTRATOR',
  'AI_AGENT',
  'SERVICE_IDENTITY',
  'PROVIDER',
  'ENTERPRISE',
  'VALIDATOR',
  'WALLET_CONTROLLER',
  'AUDITOR',
] as const;

export type AuthorizationActorType = (typeof AUTHORIZATION_ACTOR_TYPES)[number];

/**
 * Authority classes that may never be inherited implicitly through delegation.
 */
export const NON_DELEGATABLE_AUTHORITY = [
  'HUMAN_GOVERNANCE',
  'ADMINISTRATOR',
  'VALIDATOR',
  'MONETARY_ISSUANCE',
  'CONSENT_MODIFICATION',
  'PRODUCTION_ACTIVATION',
] as const;

export type NonDelegatableAuthority = (typeof NON_DELEGATABLE_AUTHORITY)[number];

/**
 * Actor types that may hold governance authority.
 */
export const GOVERNANCE_ACTOR_TYPES: readonly AuthorizationActorType[] = ['HUMAN_GOVERNANCE'];

/**
 * Actor types that may hold validator authority.
 */
export const VALIDATOR_ACTOR_TYPES: readonly AuthorizationActorType[] = ['VALIDATOR'];

/**
 * Actor types that may hold administrative authority.
 */
export const ADMIN_ACTOR_TYPES: readonly AuthorizationActorType[] = ['ADMINISTRATOR', 'AUDITOR'];

/**
 * Actor types that may act on behalf of a human user when explicitly delegated.
 */
export const DELEGATABLE_ACTOR_TYPES: readonly AuthorizationActorType[] = ['AI_AGENT', 'SERVICE_IDENTITY'];

export function isAuthorizationActorType(value: unknown): value is AuthorizationActorType {
  return typeof value === 'string' && (AUTHORIZATION_ACTOR_TYPES as readonly string[]).includes(value);
}

export function actorMayHoldGovernanceAuthority(actorType: AuthorizationActorType): boolean {
  return GOVERNANCE_ACTOR_TYPES.includes(actorType);
}

export function actorMayHoldValidatorAuthority(actorType: AuthorizationActorType): boolean {
  return VALIDATOR_ACTOR_TYPES.includes(actorType);
}

export function actorMayHoldAdminAuthority(actorType: AuthorizationActorType): boolean {
  return ADMIN_ACTOR_TYPES.includes(actorType);
}

export function authorityIsNonDelegatable(authority: NonDelegatableAuthority): boolean {
  return (NON_DELEGATABLE_AUTHORITY as readonly string[]).includes(authority);
}
