/**
 * Chunk 167 — application rollback records on the production-handoff owner.
 *
 * APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK remains true.
 * Protocol recovery continues through Chunk 40/79 governance.
 */

import { APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK } from './types.ts';
import { recordChange } from './control.ts';
import type { ProductionChangeRecord } from './types.ts';

export function planHandoffApplicationRollback(input: {
  readonly changeId: string;
  readonly releaseHash: string;
  readonly configurationHash: string;
  readonly approval: string;
  readonly verification: string;
}): ProductionChangeRecord {
  if (APPLICATION_ROLLBACK_IS_NOT_CHAIN_HISTORY_ROLLBACK !== true) {
    throw new TypeError('application rollback cannot become chain-history rollback');
  }
  return recordChange({
    changeId: input.changeId,
    kind: 'APPLICATION',
    reason: `rollback to ${input.releaseHash} / ${input.configurationHash}`,
    affectedServices: ['application'],
    risk: 'HIGH',
    releaseRef: input.releaseHash,
    approval: input.approval,
    verification: input.verification,
    rollbackStrategy: 'redeploy prior release artifact; application rollback is not chain-history rollback',
  });
}

export function refuseProtocolHistoryRewrite(): {
  readonly accepted: false;
  readonly applicationRollbackIsChainHistoryRollback: false;
  readonly rejectionReason: 'PROTOCOL_ROLLBACK_REQUIRES_GOVERNANCE';
} {
  return Object.freeze({
    accepted: false,
    applicationRollbackIsChainHistoryRollback: false,
    rejectionReason: 'PROTOCOL_ROLLBACK_REQUIRES_GOVERNANCE',
  });
}
