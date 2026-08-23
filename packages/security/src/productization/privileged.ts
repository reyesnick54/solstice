/**
 * Privileged / administrative access. Named humans only. Step-up,
 * short-lived sessions, audit, and recorded break-glass.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';

export const ADMIN_ROLES = [
  'SECURITY_OPERATOR',
  'PLATFORM_OPERATOR',
  'COMPLIANCE_REVIEWER',
  'BREAK_GLASS_OPERATOR',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ASSURANCE = ['STANDARD', 'STEP_UP', 'HIGH_ASSURANCE'] as const;
export type AdminAssurance = (typeof ADMIN_ASSURANCE)[number];

export type PrivilegedSession = {
  readonly sessionId: string;
  readonly actorId: string;
  readonly role: AdminRole;
  readonly assurance: AdminAssurance;
  readonly expiresAt: string;
  readonly stepUpSatisfied: boolean;
  readonly sharedAccount: false;
  readonly auditRef: string;
};

export type BreakGlassRecord = {
  readonly recordId: string;
  readonly actorId: string;
  readonly role: 'BREAK_GLASS_OPERATOR';
  readonly reason: string;
  readonly openedAt: string;
  readonly expiresAt: string;
  readonly recorded: true;
  readonly sharedAccount: false;
  readonly closedAt: string | null;
};

export class PrivilegedAccessRegistry {
  readonly #sessions = new Map<string, PrivilegedSession>();
  readonly #breakGlass = new Map<string, BreakGlassRecord>();

  open(input: {
    readonly sessionId: string;
    readonly actorId: string;
    readonly role: AdminRole;
    readonly assurance: AdminAssurance;
    readonly expiresAt: string;
    readonly now: string;
    readonly sharedAccount?: boolean;
  }): SecurityResult<PrivilegedSession> {
    if (input.sharedAccount === true || input.actorId.startsWith('shared_') || input.actorId === 'admin') {
      return securityErr('SHARED_ACCOUNT_FORBIDDEN', 'administrative access cannot use a shared account');
    }
    if (input.assurance === 'STANDARD' && input.role !== 'COMPLIANCE_REVIEWER') {
      return securityErr('ADMIN_BOUNDARY', 'privileged mutation requires step-up or high assurance');
    }
    if (Date.parse(input.expiresAt) <= Date.parse(input.now)) {
      return securityErr('CREDENTIAL_EXPIRED', 'privileged session TTL has already elapsed');
    }
    const session: PrivilegedSession = Object.freeze({
      sessionId: input.sessionId,
      actorId: input.actorId,
      role: input.role,
      assurance: input.assurance,
      expiresAt: input.expiresAt,
      stepUpSatisfied: input.assurance === 'STEP_UP' || input.assurance === 'HIGH_ASSURANCE',
      sharedAccount: false,
      auditRef: `audit://privileged/${input.sessionId}`,
    });
    this.#sessions.set(session.sessionId, session);
    return securityOk(session);
  }

  authorize(sessionId: string, needed: AdminRole, now: string): SecurityResult<PrivilegedSession> {
    const session = this.#sessions.get(sessionId);
    if (!session) {
      return securityErr('ADMIN_BOUNDARY', 'no privileged session');
    }
    if (Date.parse(now) >= Date.parse(session.expiresAt)) {
      return securityErr('CREDENTIAL_EXPIRED', 'privileged session expired');
    }
    if (!session.stepUpSatisfied) {
      return securityErr('ADMIN_BOUNDARY', 'step-up has not been satisfied');
    }
    if (session.role !== needed && session.role !== 'BREAK_GLASS_OPERATOR') {
      return securityErr('ADMIN_BOUNDARY', `${session.role} cannot exercise ${needed}`);
    }
    return securityOk(session);
  }

  openBreakGlass(input: {
    readonly recordId: string;
    readonly actorId: string;
    readonly reason: string;
    readonly openedAt: string;
    readonly expiresAt: string;
  }): SecurityResult<BreakGlassRecord> {
    if (input.reason.trim().length < 8) {
      return securityErr('BREAK_GLASS_REQUIRED', 'break-glass requires a recorded reason');
    }
    if (input.actorId === 'admin' || input.actorId.startsWith('shared_')) {
      return securityErr('SHARED_ACCOUNT_FORBIDDEN', 'break-glass cannot use a shared account');
    }
    const record: BreakGlassRecord = Object.freeze({
      recordId: input.recordId,
      actorId: input.actorId,
      role: 'BREAK_GLASS_OPERATOR',
      reason: input.reason,
      openedAt: input.openedAt,
      expiresAt: input.expiresAt,
      recorded: true,
      sharedAccount: false,
      closedAt: null,
    });
    this.#breakGlass.set(record.recordId, record);
    return securityOk(record);
  }

  closeBreakGlass(recordId: string, closedAt: string): SecurityResult<BreakGlassRecord> {
    const current = this.#breakGlass.get(recordId);
    if (!current) {
      return securityErr('BREAK_GLASS_REQUIRED', 'unknown break-glass record');
    }
    const closed: BreakGlassRecord = Object.freeze({ ...current, closedAt });
    this.#breakGlass.set(recordId, closed);
    return securityOk(closed);
  }

  listBreakGlass(): readonly BreakGlassRecord[] {
    return Object.freeze([...this.#breakGlass.values()]);
  }
}
