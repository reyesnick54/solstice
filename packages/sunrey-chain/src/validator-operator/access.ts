/**
 * Workload/user authorization for the operator platform.
 *
 * An operator may only control its assigned operational resources.
 * There is no shared admin secret. AI cannot perform high-impact
 * human actions. No operator receives another operator's signer.
 */

import {
  type HighImpactAction,
  type OperatorPrincipal,
  type OperatorReasonCode,
  type OperatorResult,
  type OperatorRole,
  operatorErr,
  operatorOk,
} from './types.ts';

const ROLE_ACTIONS: Readonly<Record<OperatorRole, readonly HighImpactAction[]>> = {
  OPERATOR_ADMIN: [
    'ENROLL',
    'ACCEPT',
    'MAINTENANCE_PLAN',
    'MAINTENANCE_EXECUTE',
    'UPGRADE_PLAN',
    'UPGRADE_BATCH',
    'PROTOCOL_ACTIVATE',
    'ROTATE_PREPARE',
    'ROTATE_ACTIVATE',
    'RECOVERY',
    'INCIDENT_OPEN',
    'INCIDENT_PRESERVE',
    'GOVERNANCE_PREPARE',
    'BACKUP_CREATE',
    'BACKUP_RESTORE',
    'SENTRY_REPLACE',
    'SIGNER_FENCE',
  ],
  FLEET_OPERATOR: [
    'MAINTENANCE_PLAN',
    'MAINTENANCE_EXECUTE',
    'UPGRADE_PLAN',
    'UPGRADE_BATCH',
    'RECOVERY',
    'BACKUP_CREATE',
    'BACKUP_RESTORE',
    'SENTRY_REPLACE',
    'INCIDENT_OPEN',
  ],
  SIGNER_CUSTODIAN: ['ROTATE_PREPARE', 'SIGNER_FENCE', 'INCIDENT_PRESERVE'],
  ENROLLMENT_OFFICER: ['ENROLL'],
  INCIDENT_RESPONDER: ['INCIDENT_OPEN', 'INCIDENT_PRESERVE', 'RECOVERY'],
  GOVERNANCE_PREPARER: ['GOVERNANCE_PREPARE'],
  VIEWER: [],
  AI_ANALYST: ['GOVERNANCE_PREPARE'],
};

const HUMAN_ONLY: ReadonlySet<HighImpactAction> = new Set([
  'ACCEPT',
  'MAINTENANCE_EXECUTE',
  'UPGRADE_BATCH',
  'PROTOCOL_ACTIVATE',
  'ROTATE_ACTIVATE',
  'GOVERNANCE_CAST',
  'BACKUP_RESTORE',
]);

export function authorizeAction(
  principal: OperatorPrincipal,
  action: HighImpactAction,
  resourceOperatorId: string,
): OperatorResult<true> {
  if (principal.operatorId !== resourceOperatorId) {
    return operatorErr('CROSS_OPERATOR_DENIED', `operator ${principal.operatorId} cannot control ${resourceOperatorId}`);
  }
  if (action === 'GOVERNANCE_CAST') {
    return operatorErr('AI_CANNOT_CAST_VOTE', 'current architecture does not define machine vote authority');
  }
  if (principal.kind === 'AI' && HUMAN_ONLY.has(action)) {
    return operatorErr('AI_CANNOT_PERFORM', `AI cannot perform ${action}`);
  }
  const allowed = ROLE_ACTIONS[principal.role];
  if (!allowed.includes(action)) {
    return operatorErr('UNAUTHORIZED_ROLE', `role ${principal.role} cannot ${action}`);
  }
  return operatorOk(true);
}

export function authorizeRead(
  principal: OperatorPrincipal,
  resourceOperatorId: string,
): OperatorResult<true> {
  if (principal.operatorId !== resourceOperatorId) {
    return operatorErr('UNAUTHORIZED_OPERATOR', `operator ${principal.operatorId} cannot read ${resourceOperatorId}`);
  }
  return operatorOk(true);
}

export function sharedAdminSecretForbidden(): true {
  return true;
}

export function reasonOf(result: OperatorResult<unknown>): OperatorReasonCode {
  return result.ok ? 'OK' : result.code;
}
