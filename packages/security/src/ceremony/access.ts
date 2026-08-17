/**
 * Ceremony access control. Authenticated human/operator identities
 * approve and sign. AI may assist with reports only.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { CeremonyActorKind, CeremonyRole, HighImpactOperation } from './types.ts';

export const FIXTURE_KEY_MARKER = 'NOT_FOR_PRODUCTION' as const;
export const FIXTURE_ENV_VARIABLE = 'SUNREY_FIXTURE_ENV' as const;
export const FIXTURE_ENVIRONMENTS = ['local', 'ci', 'test'] as const;

const AI_FORBIDDEN_ACTIONS = [
  'approve',
  'sign_as_human',
  'verify_external_hsm_possession',
  'declare_production_authority_active',
] as const;

export function fixtureEnvironmentAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = env[FIXTURE_ENV_VARIABLE];
  if (explicit && (FIXTURE_ENVIRONMENTS as readonly string[]).includes(explicit)) {
    return true;
  }
  if (env.CI === 'true' || env.CI === '1') {
    return true;
  }
  if (env.NODE_ENV === 'test' || Boolean(env.NODE_TEST_CONTEXT)) {
    return true;
  }
  return false;
}

export function assertCeremonyFixtureContext(env: NodeJS.ProcessEnv = process.env): SecurityResult<true> {
  if (!fixtureEnvironmentAllowed(env)) {
    return securityErr(
      'CEREMONY_FIXTURE_REJECTED',
      'ceremony fixture keys are rejected outside local/CI/test contexts. Set SUNREY_FIXTURE_ENV=local.',
    );
  }
  return securityOk(true);
}

export function assertAiCannot(
  actorKind: CeremonyActorKind,
  action: (typeof AI_FORBIDDEN_ACTIONS)[number],
): SecurityResult<true> {
  if (actorKind === 'AI') {
    return securityErr('AI_ROLE_FORBIDDEN', `AI cannot ${action.replaceAll('_', ' ')}`);
  }
  return securityOk(true);
}

export function assertHumanApprover(actorKind: CeremonyActorKind, role: CeremonyRole): SecurityResult<true> {
  const blocked = assertAiCannot(actorKind, 'approve');
  if (!blocked.ok) {
    return blocked;
  }
  if (actorKind !== 'HUMAN') {
    return securityErr('AI_ROLE_FORBIDDEN', `${role} approval requires a human participant`);
  }
  return securityOk(true);
}

export function assertCannotDeclareProduction(
  actorKind: CeremonyActorKind,
  environmentClass: string,
): SecurityResult<true> {
  if (actorKind === 'AI') {
    return securityErr('AI_ROLE_FORBIDDEN', 'AI cannot declare production authority active');
  }
  if (environmentClass !== 'PRODUCTION_CANDIDATE') {
    return securityErr(
      'PRODUCTION_CLAIM_FORBIDDEN',
      'rehearsal/simulation cannot declare a production authority active',
    );
  }
  return securityErr(
    'PRODUCTION_CLAIM_FORBIDDEN',
    'no external production ceremony evidence exists in this repository',
  );
}

export function defaultApprovalThreshold(operation: HighImpactOperation | string, configured: number): number {
  if (
    operation === 'CREATE_ROOT_GOVERNANCE_KEY' ||
    operation === 'ACTIVATE_GENESIS_SIGNING_SESSION' ||
    operation === 'ROTATE_RELEASE_AUTHORITY' ||
    operation === 'APPROVE_RECOVERY_PROCEDURE'
  ) {
    return Math.max(2, configured);
  }
  return Math.max(1, configured);
}
