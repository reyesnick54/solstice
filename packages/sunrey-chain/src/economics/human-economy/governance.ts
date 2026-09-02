/**
 * Wave 6 — Canonical governance authorization for SunRey human-economy issuance.
 *
 * Explicitly rejects AI, PEVE, HIN, ContributionVerifier, ConsentService,
 * IdentityService, Exchange, database, API, and validator acting alone.
 */

export const FORBIDDEN_MONETARY_AUTHORITIES = [
  'AI',
  'PEVE',
  'HIN',
  'CONTRIBUTION_VERIFIER',
  'CONSENT_SERVICE',
  'IDENTITY_SERVICE',
  'EXCHANGE',
  'DATABASE',
  'API',
  'VALIDATOR',
  'AGENT',
  'FINANCIAL_AGENT',
  'S3M',
  'GROK',
  'MODEL',
] as const;
export type ForbiddenMonetaryAuthority = (typeof FORBIDDEN_MONETARY_AUTHORITIES)[number];

export const REQUIRED_GOVERNANCE_APPROVALS = [
  'HUMAN_GOVERNANCE',
  'MONETARY_ISSUANCE_AUTHORITY',
] as const;

export type GovernanceActor = ForbiddenMonetaryAuthority | 'HUMAN_GOVERNANCE' | 'PROTOCOL';

export type GovernanceAuthorizationInput = {
  readonly authorizationId: string;
  readonly authorizedQuantity: string;
  readonly governancePolicyVersion: string;
  readonly authorizedBy: GovernanceActor;
  readonly aiApproved?: boolean;
};

export type GovernanceValidation =
  | { readonly ok: true; readonly authorizationId: string }
  | {
      readonly ok: false;
      readonly code: 'FORBIDDEN_MONETARY_AUTHORITY' | 'GOVERNANCE_AUTHORIZATION_MISSING' | 'AI_GOVERNANCE_REJECTED';
    };

export function rejectForbiddenAuthority(actor: GovernanceActor): GovernanceValidation {
  if ((FORBIDDEN_MONETARY_AUTHORITIES as readonly string[]).includes(actor)) {
    return { ok: false, code: 'FORBIDDEN_MONETARY_AUTHORITY' };
  }
  return { ok: false, code: 'GOVERNANCE_AUTHORIZATION_MISSING' };
}

export function validateGovernanceAuthorization(
  input: GovernanceAuthorizationInput | null | undefined,
): GovernanceValidation {
  if (!input?.authorizationId) {
    return { ok: false, code: 'GOVERNANCE_AUTHORIZATION_MISSING' };
  }
  if (input.aiApproved === true) {
    return { ok: false, code: 'AI_GOVERNANCE_REJECTED' };
  }
  const forbidden = rejectForbiddenAuthority(input.authorizedBy);
  if (!forbidden.ok && forbidden.code === 'FORBIDDEN_MONETARY_AUTHORITY') {
    return forbidden;
  }
  if (input.authorizedBy !== 'HUMAN_GOVERNANCE' && input.authorizedBy !== 'PROTOCOL') {
    return { ok: false, code: 'FORBIDDEN_MONETARY_AUTHORITY' };
  }
  return { ok: true, authorizationId: input.authorizationId };
}

export function governanceRequirements(): readonly string[] {
  return Object.freeze([...REQUIRED_GOVERNANCE_APPROVALS]);
}
