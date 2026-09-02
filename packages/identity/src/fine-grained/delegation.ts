import type { UtcInstant } from '../../../domain/src/time.ts';
import { isExpired } from '../../../config/src/clock.ts';
import type { NonDelegatableAuthority } from './actor-types.ts';
import { authorityIsNonDelegatable } from './actor-types.ts';
import type { PermissionVerb } from './relationship-model.ts';

export const DELEGATION_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type DelegationStatus = (typeof DELEGATION_STATUSES)[number];

export type DelegationScope = {
  readonly resourceType: string;
  readonly resourceIds: readonly string[] | 'ALL';
  readonly permittedVerbs: readonly PermissionVerb[];
  readonly dataCategories: readonly string[];
};

export type DelegationRecord = {
  readonly delegationId: string;
  readonly delegatorId: string;
  readonly delegateeId: string;
  readonly delegateeType: 'AI_AGENT' | 'SERVICE_IDENTITY' | 'HUMAN_USER';
  readonly scope: DelegationScope;
  readonly purpose: string;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly revokedAt: UtcInstant | null;
  readonly nonDelegatableAuthorities: readonly NonDelegatableAuthority[];
};

export type DelegationCheck = {
  readonly delegation: DelegationRecord;
  readonly requestedVerb: PermissionVerb;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly now: UtcInstant;
};

export type DelegationDecision =
  | { readonly allowed: true; readonly delegationId: string }
  | { readonly allowed: false; readonly code: DelegationDenialCode; readonly reason: string };

export const DELEGATION_DENIAL_CODES = [
  'DELEGATION_REVOKED',
  'DELEGATION_EXPIRED',
  'SCOPE_MISMATCH',
  'VERB_NOT_DELEGATED',
  'NON_DELEGATABLE_AUTHORITY',
  'PURPOSE_MISMATCH',
] as const;

export type DelegationDenialCode = (typeof DELEGATION_DENIAL_CODES)[number];

export function delegationStatus(delegation: DelegationRecord, now: UtcInstant): DelegationStatus {
  if (delegation.revokedAt !== null) {
    return 'REVOKED';
  }
  if (isExpired(delegation.expiresAt, now)) {
    return 'EXPIRED';
  }
  return 'ACTIVE';
}

export function evaluateDelegation(check: DelegationCheck): DelegationDecision {
  const status = delegationStatus(check.delegation, check.now);
  if (status === 'REVOKED') {
    return {
      allowed: false,
      code: 'DELEGATION_REVOKED',
      reason: `delegation '${check.delegation.delegationId}' was revoked`,
    };
  }
  if (status === 'EXPIRED') {
    return {
      allowed: false,
      code: 'DELEGATION_EXPIRED',
      reason: `delegation '${check.delegation.delegationId}' expired at ${check.delegation.expiresAt}`,
    };
  }

  const verbToAuthority: Partial<Record<PermissionVerb, NonDelegatableAuthority>> = {
    withdraw: 'MONETARY_ISSUANCE',
    authorize: 'MONETARY_ISSUANCE',
    manage: 'CONSENT_MODIFICATION',
  };
  const blockedAuthority = verbToAuthority[check.requestedVerb];
  if (blockedAuthority && authorityIsNonDelegatable(blockedAuthority)) {
    return {
      allowed: false,
      code: 'NON_DELEGATABLE_AUTHORITY',
      reason: `verb '${check.requestedVerb}' maps to non-delegatable authority '${blockedAuthority}'`,
    };
  }

  if (check.delegation.scope.resourceType !== check.resourceType) {
    return {
      allowed: false,
      code: 'SCOPE_MISMATCH',
      reason: `resource type '${check.resourceType}' not in delegation scope`,
    };
  }
  if (
    check.delegation.scope.resourceIds !== 'ALL' &&
    !check.delegation.scope.resourceIds.includes(check.resourceId)
  ) {
    return {
      allowed: false,
      code: 'SCOPE_MISMATCH',
      reason: `resource '${check.resourceId}' not in delegation scope`,
    };
  }
  if (!check.delegation.scope.permittedVerbs.includes(check.requestedVerb)) {
    return {
      allowed: false,
      code: 'VERB_NOT_DELEGATED',
      reason: `verb '${check.requestedVerb}' was not delegated`,
    };
  }
  return { allowed: true, delegationId: check.delegation.delegationId };
}

export function createDelegationRecord(input: {
  readonly delegationId: string;
  readonly delegatorId: string;
  readonly delegateeId: string;
  readonly delegateeType: DelegationRecord['delegateeType'];
  readonly scope: DelegationScope;
  readonly purpose: string;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
}): DelegationRecord {
  return Object.freeze({
    ...input,
    revokedAt: null,
    nonDelegatableAuthorities: Object.freeze([
      'HUMAN_GOVERNANCE',
      'ADMINISTRATOR',
      'VALIDATOR',
      'MONETARY_ISSUANCE',
      'CONSENT_MODIFICATION',
      'PRODUCTION_ACTIVATION',
    ] as const),
  });
}

export function revokeDelegation(
  delegation: DelegationRecord,
  revokedAt: UtcInstant,
): DelegationRecord {
  return Object.freeze({ ...delegation, revokedAt });
}
