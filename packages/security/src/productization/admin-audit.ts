/**
 * Wave 7 — immutable privileged admin audit events.
 *
 * Every privileged operation creates an audit event. Secrets are never
 * recorded. Events are suitable for hash-chained evidence sealing.
 */

import { sha256Hex } from '../hash.ts';
import { redactForAuditLog } from './key-storage.ts';

export const PRIVILEGED_AUDIT_KINDS = [
  'privileged.operation.attempted',
  'privileged.operation.allowed',
  'privileged.operation.refused',
  'privileged.break_glass.opened',
  'privileged.break_glass.closed',
  'privileged.governance.approval',
  'privileged.key.rotation',
  'privileged.credential.revoked',
  'privileged.mainnet.prerequisite_check',
] as const;

export type PrivilegedAuditKind = (typeof PRIVILEGED_AUDIT_KINDS)[number];

export type PrivilegedAuditEvent = {
  readonly eventId: string;
  readonly kind: PrivilegedAuditKind;
  readonly who: string;
  readonly what: string;
  readonly when: string;
  readonly resource: string;
  readonly policyDecision: string;
  readonly authorization: string;
  readonly previousStateRef: string;
  readonly newStateRef: string;
  readonly reason: string;
  readonly eventHash: string;
};

export type PrivilegedAuditInput = {
  readonly kind: PrivilegedAuditKind;
  readonly who: string;
  readonly what: string;
  readonly when: string;
  readonly resource: string;
  readonly policyDecision: string;
  readonly authorization: string;
  readonly previousStateRef: string;
  readonly newStateRef: string;
  readonly reason: string;
  readonly metadata?: Record<string, unknown>;
};

export function sealPrivilegedAuditEvent(input: PrivilegedAuditInput): PrivilegedAuditEvent {
  const redactedMeta = input.metadata ? redactForAuditLog(input.metadata) : {};
  const eventId = sha256Hex(
    `${input.kind}|${input.who}|${input.what}|${input.when}|${input.resource}`,
  );
  const eventHash = sha256Hex(
    JSON.stringify({
      eventId,
      kind: input.kind,
      who: input.who,
      what: input.what,
      when: input.when,
      resource: input.resource,
      policyDecision: input.policyDecision,
      authorization: input.authorization,
      previousStateRef: input.previousStateRef,
      newStateRef: input.newStateRef,
      reason: input.reason,
      metadata: redactedMeta,
    }),
  );
  return Object.freeze({
    eventId,
    kind: input.kind,
    who: input.who,
    what: input.what,
    when: input.when,
    resource: input.resource,
    policyDecision: input.policyDecision,
    authorization: input.authorization,
    previousStateRef: input.previousStateRef,
    newStateRef: input.newStateRef,
    reason: input.reason,
    eventHash,
  });
}

export function assertAuditContainsNoSecrets(event: PrivilegedAuditEvent): boolean {
  const serialized = JSON.stringify(event);
  return !/-----BEGIN|sk_live_|whsec_|privateKey/i.test(serialized);
}
