/**
 * Wave 7 — break-glass access with explicit monetary-control boundary.
 *
 * Break-glass is time-bounded, highly audited, and separately authorized.
 * It must NOT bypass canonical monetary authorization, validator consensus,
 * or supply invariants.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { BreakGlassRecord } from './privileged.ts';

export const BREAK_GLASS_FORBIDDEN_TARGETS = [
  'MINT',
  'LEDGER_POST',
  'EXECUTION_AUTHORITY_ISSUE',
  'VALIDATOR_CONSENSUS_OVERRIDE',
  'SUPPLY_INVARIANT_BYPASS',
  'MAINNET_SINGLE_ENV_ACTIVATION',
  'MONETARY_PARAMETER_DIRECT_WRITE',
  'CUSTODY_KEY_EXPORT',
  'issuance.sunrey.activate',
  'issuance.moonrey.activate',
  'monetary.parameter_change',
  'mainnet.activate',
  'governance.approve',
  'governance.activate_package',
] as const;

export type BreakGlassForbiddenTarget = (typeof BREAK_GLASS_FORBIDDEN_TARGETS)[number];

export type BreakGlassAttempt = {
  readonly record: BreakGlassRecord;
  readonly target: BreakGlassForbiddenTarget | string;
  readonly now: string;
};

export type BreakGlassAuditEvent = {
  readonly eventId: string;
  readonly recordId: string;
  readonly actorId: string;
  readonly target: string;
  readonly outcome: 'ALLOWED_NON_MONETARY' | 'REFUSED_MONETARY_BOUNDARY';
  readonly reason: string;
  readonly openedAt: string;
  readonly expiresAt: string;
  readonly occurredAt: string;
};

export function assertBreakGlassActive(
  record: BreakGlassRecord,
  now: string,
): SecurityResult<BreakGlassRecord> {
  if (record.closedAt !== null) {
    return securityErr('BREAK_GLASS_REQUIRED', 'break-glass record is closed');
  }
  if (Date.parse(now) >= Date.parse(record.expiresAt)) {
    return securityErr('CREDENTIAL_EXPIRED', 'break-glass lease has expired');
  }
  if (!record.recorded || record.reason.trim().length < 8) {
    return securityErr('BREAK_GLASS_REQUIRED', 'break-glass requires a recorded reason');
  }
  return securityOk(record);
}

export function evaluateBreakGlassAttempt(
  attempt: BreakGlassAttempt,
): SecurityResult<BreakGlassAuditEvent> {
  const active = assertBreakGlassActive(attempt.record, attempt.now);
  if (!active.ok) {
    return active;
  }

  const isForbidden = (BREAK_GLASS_FORBIDDEN_TARGETS as readonly string[]).includes(attempt.target);
  const event: BreakGlassAuditEvent = Object.freeze({
    eventId: `bg_audit_${attempt.record.recordId}_${attempt.target}`,
    recordId: attempt.record.recordId,
    actorId: attempt.record.actorId,
    target: attempt.target,
    outcome: isForbidden ? 'REFUSED_MONETARY_BOUNDARY' : 'ALLOWED_NON_MONETARY',
    reason: attempt.record.reason,
    openedAt: attempt.record.openedAt,
    expiresAt: attempt.record.expiresAt,
    occurredAt: attempt.now,
  });

  if (isForbidden) {
    return securityErr(
      'BREAK_GLASS_REQUIRED',
      `break-glass cannot bypass ${attempt.target}`,
    );
  }

  return securityOk(event);
}

export function breakGlassCannotBypassMonetaryControl(target: string): boolean {
  return (BREAK_GLASS_FORBIDDEN_TARGETS as readonly string[]).includes(target);
}
