/**
 * Wave 7 — privileged security enforcement facade.
 *
 * Central entry point for privileged-operation authorization checks.
 * Compromise of admin account, API credential, application server,
 * provider credential, or ordinary service identity must not
 * automatically compromise validator keys, monetary governance,
 * canonical supply, user custody, or evidence integrity.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { KeyPurpose } from '../purposes.ts';
import { assertServiceCannotGovern } from './governance-signing.ts';
import { evaluateBreakGlassAttempt, breakGlassCannotBypassMonetaryControl } from './break-glass-monetary.ts';
import type { BreakGlassRecord } from './privileged.ts';
import {
  assertKeyRoleSeparation,
  assertWrongKeyType,
  roleForPurpose,
  type KeyRole,
} from './key-classification.ts';
import { evaluateAdminApproval } from './admin-approvals.ts';
import { privilegedOperation } from './privileged-matrix.ts';
import { sealPrivilegedAuditEvent } from './admin-audit.ts';
import { emergencyRevoke } from './rotation.ts';
import type { KeyProvider } from '../provider.ts';

export type PrivilegedEnforcementInput = {
  readonly operationId: string;
  readonly actorId: string;
  readonly actorKind: 'HUMAN' | 'SERVICE' | 'AGENT' | 'AI';
  readonly actorRoles: readonly string[];
  readonly stepUpSatisfied: boolean;
  readonly now: string;
  readonly reason: string;
  readonly breakGlass?: BreakGlassRecord | null;
};

export function enforcePrivilegedOperation(
  input: PrivilegedEnforcementInput,
): SecurityResult<{ readonly auditEventId: string; readonly allowed: boolean }> {
  const op = privilegedOperation(input.operationId);
  if (!op) {
    return securityErr('POLICY_REJECTED', `unknown privileged operation: ${input.operationId}`);
  }

  if (input.actorKind === 'SERVICE' && op.category === 'GOVERNANCE') {
    const gov = assertServiceCannotGovern(input.actorKind);
    if (!gov.ok) {
      const audit = sealPrivilegedAuditEvent({
        kind: 'privileged.operation.refused',
        who: input.actorId,
        what: input.operationId,
        when: input.now,
        resource: op.owner,
        policyDecision: 'SERVICE_CANNOT_GOVERN',
        authorization: input.actorKind,
        previousStateRef: 'unchanged',
        newStateRef: 'unchanged',
        reason: input.reason,
      });
      return securityErr(gov.error.code, gov.error.message);
    }
  }

  if (input.actorKind === 'AGENT' || input.actorKind === 'AI') {
    if (op.category === 'ISSUANCE' || op.category === 'MONETARY' || op.category === 'GOVERNANCE') {
      const audit = sealPrivilegedAuditEvent({
        kind: 'privileged.operation.refused',
        who: input.actorId,
        what: input.operationId,
        when: input.now,
        resource: op.owner,
        policyDecision: 'AGENT_CANNOT_AUTHORIZE',
        authorization: input.actorKind,
        previousStateRef: 'unchanged',
        newStateRef: 'unchanged',
        reason: input.reason,
      });
      return securityErr('AI_ROLE_FORBIDDEN', 'agents cannot authorize privileged monetary or governance operations');
    }
  }

  if (input.breakGlass) {
    const bg = evaluateBreakGlassAttempt({
      record: input.breakGlass,
      target: input.operationId,
      now: input.now,
    });
    if (!bg.ok) {
      return bg;
    }
  }

  const approval = evaluateAdminApproval({
    operationId: input.operationId,
    actorId: input.actorId,
    actorRoles: input.actorRoles,
    stepUpSatisfied: input.stepUpSatisfied,
    now: input.now,
    reason: input.reason,
  });
  if (!approval.ok) {
    return approval;
  }

  const audit = sealPrivilegedAuditEvent({
    kind: approval.value.allowed ? 'privileged.operation.allowed' : 'privileged.operation.refused',
    who: input.actorId,
    what: input.operationId,
    when: input.now,
    resource: op.owner,
    policyDecision: approval.value.policyDecision,
    authorization: input.actorKind,
    previousStateRef: 'prior',
    newStateRef: approval.value.allowed ? 'mutated' : 'unchanged',
    reason: input.reason,
  });

  if (!approval.value.allowed) {
    return securityErr('ADMIN_BOUNDARY', approval.value.policyDecision);
  }

  return securityOk(Object.freeze({ auditEventId: audit.eventId, allowed: true }));
}

export function enforceAdminCannotMint(actorRoles: readonly string[]): SecurityResult<true> {
  const approval = evaluateAdminApproval({
    operationId: 'issuance.sunrey.activate',
    actorId: 'admin_attempt',
    actorRoles,
    stepUpSatisfied: true,
    now: new Date().toISOString(),
    reason: 'admin mint attempt',
    approvalCount: 1,
  });
  if (!approval.ok) {
    return securityOk(true);
  }
  if (approval.value.allowed) {
    return securityErr('ADMIN_BOUNDARY', 'ordinary admin cannot authorize mint');
  }
  return securityOk(true);
}

export function enforceValidatorKeyNotUserKey(
  attemptedPurpose: KeyPurpose,
  actualRole: KeyRole,
): SecurityResult<true> {
  const expectedRole = roleForPurpose(attemptedPurpose);
  if (expectedRole === 'USER_WALLET_KEY' && actualRole === 'VALIDATOR_KEY') {
    return securityErr('PURPOSE_MISMATCH', 'validator key cannot be used as user wallet key');
  }
  if (expectedRole === 'VALIDATOR_KEY' && actualRole === 'USER_WALLET_KEY') {
    return securityErr('PURPOSE_MISMATCH', 'user wallet key cannot be used as validator key');
  }
  if (expectedRole !== null && expectedRole !== actualRole) {
    return assertWrongKeyType(expectedRole, actualRole);
  }
  return securityOk(true);
}

export function enforceKeyRoleSeparation(left: KeyRole, right: KeyRole): SecurityResult<true> {
  return assertKeyRoleSeparation(left, right);
}

export function enforceRevokedServiceCredential(
  keys: KeyProvider,
  purpose: KeyPurpose,
  version: number,
  now: string,
): SecurityResult<true> {
  const revoked = emergencyRevoke(keys, purpose, version, 'service credential revoked', now);
  if (!revoked.ok) {
    return revoked;
  }
  const sign = keys.sign(purpose, 'probe');
  if (sign.ok) {
    return securityErr('POLICY_REJECTED', 'revoked service credential must not sign');
  }
  return securityOk(true);
}

export { breakGlassCannotBypassMonetaryControl };
