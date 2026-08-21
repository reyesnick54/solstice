/**
 * Application rollback is not chain-history rollback.
 * Protocol recovery must use governed upgrade mechanisms.
 */

import { APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK } from '../../production-handoff/types.ts';
import { recordChange } from '../../production-handoff/control.ts';
import type { ApplicationRollbackPlan, ProtocolRollbackAttempt } from './types.ts';

export function planApplicationRollback(input: {
  readonly planId: string;
  readonly releaseHash: string;
  readonly configurationHash: string;
  readonly schemaCompatible: boolean;
  readonly dataMigrationCompatible: boolean;
  readonly approval?: string | null;
  readonly postRollbackVerification?: string | null;
}): ApplicationRollbackPlan {
  const missing: string[] = [];
  if (!input.releaseHash) missing.push('release hash required');
  if (!input.configurationHash) missing.push('configuration hash required');
  if (!input.schemaCompatible) missing.push('schema incompatible');
  if (!input.dataMigrationCompatible) missing.push('data migration incompatible');
  if (!input.approval) missing.push('approval required');
  if (!input.postRollbackVerification) missing.push('post-rollback verification required');
  if (APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK !== true) {
    missing.push('application rollback invariant missing');
  }
  return Object.freeze({
    planId: input.planId,
    releaseHash: input.releaseHash,
    configurationHash: input.configurationHash,
    schemaCompatible: input.schemaCompatible,
    dataMigrationCompatible: input.dataMigrationCompatible,
    approval: input.approval ?? null,
    postRollbackVerification: input.postRollbackVerification ?? null,
    rewritesChainHistory: false,
    applicationRollbackIsNotChainHistoryRollback: true,
    accepted: missing.length === 0,
    rejectionReason: missing.length === 0 ? null : missing.join('; '),
  });
}

export function recordApprovedApplicationRollback(plan: ApplicationRollbackPlan) {
  if (!plan.accepted) {
    throw new TypeError(plan.rejectionReason ?? 'application rollback plan rejected');
  }
  return recordChange({
    changeId: plan.planId,
    kind: 'APPLICATION',
    reason: 'rehearsal application binary/config rollback to an approved previous version',
    affectedServices: ['application'],
    risk: 'HIGH',
    releaseRef: plan.releaseHash,
    approval: plan.approval,
    verification: plan.postRollbackVerification,
    rollbackStrategy: 'redeploy prior release artifact; application rollback is not chain-history rollback',
  });
}

export function attemptProtocolRollback(input: {
  readonly attemptId: string;
  readonly method: 'GIT_CHECKOUT' | 'GOVERNED_UPGRADE';
  readonly governancePackageHash?: string | null;
}): ProtocolRollbackAttempt {
  if (input.method === 'GIT_CHECKOUT') {
    return Object.freeze({
      attemptId: input.attemptId,
      method: input.method,
      accepted: false,
      rejectionReason: 'PROTOCOL_ROLLBACK_REQUIRES_GOVERNANCE',
      requiresGovernance: true,
      rewritesFinalizedState: false,
    });
  }
  if (!input.governancePackageHash) {
    return Object.freeze({
      attemptId: input.attemptId,
      method: input.method,
      accepted: false,
      rejectionReason: 'PROTOCOL_ROLLBACK_REQUIRES_GOVERNANCE',
      requiresGovernance: true,
      rewritesFinalizedState: false,
    });
  }
  return Object.freeze({
    attemptId: input.attemptId,
    method: input.method,
    accepted: true,
    rejectionReason: null,
    requiresGovernance: true,
    rewritesFinalizedState: false,
  });
}
