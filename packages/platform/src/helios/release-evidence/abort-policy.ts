/**
 * HELIOS H36 — mandatory pilot abort / kill conditions.
 */

import { PILOT_ABORT_CONDITIONS } from './taxonomy.ts';
import type { PilotAbortPolicy } from './types.ts';

export const HELIOS_PILOT_ABORT_POLICY: PilotAbortPolicy = Object.freeze({
  mandatoryConditions: PILOT_ABORT_CONDITIONS,
  onAbort: Object.freeze([
    'Stop new deployment within pilot scope.',
    'Preserve submitted orders.',
    'Reconcile in-flight operations.',
    'Preserve evidence in the Evidence Vault.',
    'Permit authorized risk-reduction/exit actions only.',
    'Maintain customer access to truthful status.',
    'Retain withdrawal rights according to canonical settlement rules.',
    'Do not erase state or rewrite history.',
  ]),
  preservesEvidence: true as const,
  preservesWithdrawalRights: true as const,
  failClosed: true as const,
});

export function shouldAbortPilot(condition: (typeof PILOT_ABORT_CONDITIONS)[number]): boolean {
  return PILOT_ABORT_CONDITIONS.includes(condition);
}
