import type { IntentId } from './action-intent.ts';

/**
 * Six proof classes the Compliance Kernel evaluates. Named here so callers
 * share vocabulary. This package does not evaluate proofs.
 */
export const PROOF_CLASSES = [
  'IDENTITY',
  'AUTHORITY',
  'JURISDICTION',
  'COMPLIANCE',
  'RISK',
  'PURPOSE',
] as const;

export type ProofClass = (typeof PROOF_CLASSES)[number];

export const AUTHORIZATION_DECISION_STATUSES = [
  'ALLOW',
  'BLOCK',
  'DEFER',
  'REQUIRE_MANUAL_REVIEW',
] as const;

export type AuthorizationDecisionStatus =
  (typeof AUTHORIZATION_DECISION_STATUSES)[number];

/**
 * Kernel output for one ActionIntent. Domain code must not reinterpret these
 * statuses. This package does not produce decisions.
 */
export type AuthorizationDecision = {
  readonly intentId: IntentId;
  readonly actionType: string;
  readonly status: AuthorizationDecisionStatus;
  readonly decidedAt: string;
};

/**
 * Signed, short-lived permit the ledger (and account construction in services)
 * accepts. This package does not sign or verify authorities.
 */
export type ExecutionAuthority = {
  readonly authorityId: string;
  readonly intentId: IntentId;
  readonly actionType: string;
  readonly scope: { readonly [key: string]: string };
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly signature: string;
};
