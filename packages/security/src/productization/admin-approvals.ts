/**
 * Wave 7 — administrative approval flows for sensitive non-monetary actions.
 *
 * Documents which operations require single-admin vs multi-party approval.
 * Business thresholds remain governed configuration.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import {
  type ApprovalModel,
  type PrivilegedOperation,
  privilegedOperation,
} from './privileged-matrix.ts';
import { thresholdForOperation } from './governance-signing.ts';

export type AdminApprovalRequest = {
  readonly operationId: string;
  readonly actorId: string;
  readonly actorRoles: readonly string[];
  readonly stepUpSatisfied: boolean;
  readonly now: string;
  readonly reason: string;
  readonly approvalCount?: number;
};

export type AdminApprovalDecision = {
  readonly operationId: string;
  readonly approvalModel: ApprovalModel;
  readonly allowed: boolean;
  readonly policyDecision: string;
  readonly requiredApprovals: number;
  readonly currentApprovals: number;
};

export function evaluateAdminApproval(request: AdminApprovalRequest): SecurityResult<AdminApprovalDecision> {
  const op = privilegedOperation(request.operationId);
  if (!op) {
    return securityErr('POLICY_REJECTED', `unknown privileged operation: ${request.operationId}`);
  }

  if (op.approvalModel === 'NOT_PERMITTED') {
    return securityOk(
      Object.freeze({
        operationId: request.operationId,
        approvalModel: op.approvalModel,
        allowed: false,
        policyDecision: 'NOT_PERMITTED',
        requiredApprovals: 0,
        currentApprovals: request.approvalCount ?? 0,
      }),
    );
  }

  if (op.stepUpRequired && !request.stepUpSatisfied) {
    return securityOk(
      Object.freeze({
        operationId: request.operationId,
        approvalModel: op.approvalModel,
        allowed: false,
        policyDecision: 'STEP_UP_REQUIRED',
        requiredApprovals: requiredCount(op),
        currentApprovals: request.approvalCount ?? 0,
      }),
    );
  }

  const hasRole = op.requiredRoles.some((role) => request.actorRoles.includes(role));
  if (!hasRole && op.requiredRoles.length > 0) {
    return securityOk(
      Object.freeze({
        operationId: request.operationId,
        approvalModel: op.approvalModel,
        allowed: false,
        policyDecision: 'ROLE_INSUFFICIENT',
        requiredApprovals: requiredCount(op),
        currentApprovals: request.approvalCount ?? 0,
      }),
    );
  }

  const required = requiredCount(op);
  const current = request.approvalCount ?? (op.approvalModel === 'SINGLE_ADMIN' ? 1 : 0);

  if (op.approvalModel !== 'SINGLE_ADMIN' && current < required) {
    return securityOk(
      Object.freeze({
        operationId: request.operationId,
        approvalModel: op.approvalModel,
        allowed: false,
        policyDecision: 'THRESHOLD_NOT_MET',
        requiredApprovals: required,
        currentApprovals: current,
      }),
    );
  }

  return securityOk(
    Object.freeze({
      operationId: request.operationId,
      approvalModel: op.approvalModel,
      allowed: true,
      policyDecision: 'ALLOWED',
      requiredApprovals: required,
      currentApprovals: current,
    }),
  );
}

function requiredCount(op: PrivilegedOperation): number {
  if (op.approvalModel === 'SINGLE_ADMIN') {
    return 1;
  }
  if (op.approvalModel === 'DUAL_CONTROL') {
    return 2;
  }
  if (op.approvalModel === 'MULTI_PARTY_GOVERNANCE' || op.approvalModel === 'CEREMONY_ONLY') {
    const threshold = thresholdForOperation(op.operationId);
    return threshold?.minimumApprovals ?? op.requiredRoles.length;
  }
  return 0;
}

export const SENSITIVE_NON_MONETARY_OPERATIONS = Object.freeze([
  'provider.configure',
  'provider.disable',
  'policy.activate',
  'identity.recovery_override',
  'circuit_breaker.release',
  'feature_flag.staged_activation',
] as const);

export type SensitiveNonMonetaryOperation = (typeof SENSITIVE_NON_MONETARY_OPERATIONS)[number];

export function isSensitiveNonMonetaryOperation(operationId: string): operationId is SensitiveNonMonetaryOperation {
  return (SENSITIVE_NON_MONETARY_OPERATIONS as readonly string[]).includes(operationId);
}
