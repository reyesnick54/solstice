import { createHash } from 'node:crypto';

import type { Brand } from '@solstice/domain';

export type ExecutionDropCopyEventId = Brand<string, 'ExecutionDropCopyEventId'>;
export type BrokerStatementSnapshotId = Brand<string, 'BrokerStatementSnapshotId'>;
export type CustodyStatementSnapshotId = Brand<string, 'CustodyStatementSnapshotId'>;
export type Exec12ReconciliationRunId = Brand<string, 'Exec12ReconciliationRunId'>;
export type Exec12ReconciliationBreakId = Brand<string, 'Exec12ReconciliationBreakId'>;

export function executionDropCopyEventIdFor(dedupeKey: string): ExecutionDropCopyEventId {
  const digest = createHash('sha256').update(`exec12_dce:${dedupeKey}`).digest('hex').slice(0, 16);
  return `dce_${digest}` as ExecutionDropCopyEventId;
}

export function brokerStatementSnapshotIdFor(providerId: string, asOf: string): BrokerStatementSnapshotId {
  const digest = createHash('sha256').update(`exec12_broker:${providerId}:${asOf}`).digest('hex').slice(0, 16);
  return `bstmt_${digest}` as BrokerStatementSnapshotId;
}

export function custodyStatementSnapshotIdFor(custodianId: string, asOf: string): CustodyStatementSnapshotId {
  const digest = createHash('sha256').update(`exec12_custody:${custodianId}:${asOf}`).digest('hex').slice(0, 16);
  return `cstmt_${digest}` as CustodyStatementSnapshotId;
}

export function exec12ReconciliationRunIdFor(accountId: string, asOf: string): Exec12ReconciliationRunId {
  const digest = createHash('sha256').update(`exec12_run:${accountId}:${asOf}`).digest('hex').slice(0, 16);
  return `ex12_run_${digest}` as Exec12ReconciliationRunId;
}

export function exec12ReconciliationBreakIdFor(
  kind: string,
  accountId: string,
  anchor: string,
): Exec12ReconciliationBreakId {
  const digest = createHash('sha256').update(`exec12_brk:${kind}:${accountId}:${anchor}`).digest('hex').slice(0, 16);
  return `ex12_brk_${digest}` as Exec12ReconciliationBreakId;
}
