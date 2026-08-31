/**
 * In-memory store for allocation snapshots and entitlements.
 */

import type { IssuedAccessEntitlement } from '../dual-token-allocation/types.ts';
import type {
  AccessAllocationSnapshot,
  AllocationSnapshotResult,
  ParticipantAllocationEvidence,
} from './types.ts';

export type FinalizeRecord = {
  readonly snapshotId: string;
  readonly idempotencyKey: string;
  readonly finalizedAt: string;
  readonly result: AllocationSnapshotResult;
};

export class AccessAllocationStore {
  private snapshots = new Map<string, AccessAllocationSnapshot>();
  private evidence = new Map<string, readonly ParticipantAllocationEvidence[]>();
  private entitlements = new Map<string, readonly IssuedAccessEntitlement[]>();
  private finalizeRecords = new Map<string, FinalizeRecord>();
  private idempotencyIndex = new Map<string, string>();

  saveSnapshot(snapshot: AccessAllocationSnapshot): void {
    this.snapshots.set(snapshot.snapshotId, snapshot);
  }

  getSnapshot(snapshotId: string): AccessAllocationSnapshot | null {
    return this.snapshots.get(snapshotId) ?? null;
  }

  saveEvidence(snapshotId: string, rows: readonly ParticipantAllocationEvidence[]): void {
    this.evidence.set(snapshotId, Object.freeze([...rows]));
  }

  getEvidence(snapshotId: string): readonly ParticipantAllocationEvidence[] {
    return this.evidence.get(snapshotId) ?? Object.freeze([]);
  }

  saveEntitlements(snapshotId: string, rows: readonly IssuedAccessEntitlement[]): void {
    this.entitlements.set(snapshotId, Object.freeze([...rows]));
  }

  getEntitlements(snapshotId: string): readonly IssuedAccessEntitlement[] {
    return this.entitlements.get(snapshotId) ?? Object.freeze([]);
  }

  recordFinalize(record: FinalizeRecord): void {
    this.finalizeRecords.set(record.snapshotId, record);
    this.idempotencyIndex.set(record.idempotencyKey, record.snapshotId);
  }

  getFinalizeRecord(snapshotId: string): FinalizeRecord | null {
    return this.finalizeRecords.get(snapshotId) ?? null;
  }

  findByIdempotencyKey(idempotencyKey: string): FinalizeRecord | null {
    const snapshotId = this.idempotencyIndex.get(idempotencyKey);
    if (!snapshotId) {
      return null;
    }
    return this.finalizeRecords.get(snapshotId) ?? null;
  }

  isFinalized(snapshotId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    return snapshot?.status === 'FINALIZED';
  }
}
