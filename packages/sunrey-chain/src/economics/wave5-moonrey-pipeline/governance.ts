/**
 * Wave 5 — Governance boundary for MoonRey issuance.
 *
 * Only HUMAN_GOVERNANCE (via PROTOCOL application) may authorize supply.
 */

import {
  FORBIDDEN_MONETARY_AUTHORIZATION_SOURCES,
  PERMITTED_GOVERNANCE_ACTORS,
  type ForbiddenMonetaryAuthorizationSource,
  type MoonReyPipelineRejection,
  type PermittedGovernanceActor,
} from './types.ts';

export const AI_CANNOT_AUTHORIZE_MOONREY = true as const;
export const ORACLE_CANNOT_AUTHORIZE_MOONREY = true as const;

export function isForbiddenAuthorizationSource(
  source: string,
): source is ForbiddenMonetaryAuthorizationSource {
  return (FORBIDDEN_MONETARY_AUTHORIZATION_SOURCES as readonly string[]).includes(source);
}

export function validateGovernanceActor(input: {
  readonly actor: string;
  readonly authorizationId: string;
  readonly aiApproved?: boolean;
  readonly network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET';
}): MoonReyPipelineRejection | null {
  if (!input.authorizationId || input.authorizationId.trim().length === 0) {
    return 'GOVERNANCE_MISSING';
  }
  if (input.aiApproved === true) {
    return 'AI_GOVERNANCE_REJECTED';
  }
  if (isForbiddenAuthorizationSource(input.actor)) {
    if (input.actor === 'AI') return 'AI_GOVERNANCE_REJECTED';
    if (input.actor === 'ORACLE') return 'ORACLE_CANNOT_AUTHORIZE';
    if (input.actor === 'PRODUCTIVE_VALUE_ENGINE') return 'PRODUCTIVE_VALUE_ENGINE_CANNOT_AUTHORIZE';
    if (input.actor === 'VALIDATOR') return 'VALIDATOR_CANNOT_AUTHORIZE_ALONE';
    return 'FORBIDDEN_AUTHORIZATION_SOURCE';
  }
  if (!(PERMITTED_GOVERNANCE_ACTORS as readonly string[]).includes(input.actor)) {
    return 'FORBIDDEN_AUTHORIZATION_SOURCE';
  }
  if (input.network === 'MAINNET' && input.actor !== 'HUMAN_GOVERNANCE') {
    return 'GOVERNANCE_MISSING';
  }
  return null;
}

export function requiredGovernanceApprovals(
  network: 'DEVELOPMENT' | 'TESTNET' | 'MAINNET',
): readonly string[] {
  if (network === 'MAINNET') {
    return Object.freeze(['HUMAN_GOVERNANCE', 'MONETARY_ISSUANCE_AUTHORITY']);
  }
  return Object.freeze(['HUMAN_GOVERNANCE', 'PROTOCOL_SIMULATION']);
}

export function governanceActorIsPermitted(actor: string): actor is PermittedGovernanceActor {
  return (PERMITTED_GOVERNANCE_ACTORS as readonly string[]).includes(actor);
}
