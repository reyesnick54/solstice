/**
 * Step-up / authentication-assurance checks.
 *
 * Authentication code exposes an assurance level. It does not encode
 * action-specific financial limits (beneficiary, withdrawal amount, Agent
 * approval). Those belong to authorization / Kernel (Prompt 3).
 */

import { err, ok, type Result } from '../../domain/src/result.ts';
import { assuranceAtLeast, type AuthenticationAssurance } from './assurance.ts';
import type { IdentitySession } from './auth.ts';

export type StepUpDecision = {
  readonly required: boolean;
  readonly current: AuthenticationAssurance;
  readonly needed: AuthenticationAssurance;
};

export function evaluateStepUp(
  session: IdentitySession,
  needed: AuthenticationAssurance,
): Result<StepUpDecision, { readonly code: string; readonly message: string }> {
  if (session.revocationState !== 'ACTIVE') {
    return err({ code: 'SESSION_REVOKED', message: 'session is not active' });
  }
  const current = session.authenticationStrength;
  return ok({
    required: !assuranceAtLeast(current, needed),
    current,
    needed,
  });
}
