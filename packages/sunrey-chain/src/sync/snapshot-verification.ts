/**
 * Wave 2 — snapshot verification with supply invariants.
 *
 * Invalid snapshots fail closed. Supply is validated against the canonical
 * economics auditor; never invented from a database dump.
 */

import { auditSupply } from '../economics/auditor.ts';
import { emptyBook, type AssetSupplyBook } from '../economics/supply.ts';
import type { NativeMonetaryAssetId } from '../economics/types.ts';
import { opsErr, opsOk } from '../ops/types.ts';
import { verifySnapshot, type ChainSnapshot, type SnapshotTrust } from '../ops/snapshots.ts';
import type { SnapshotSupplyState, SyncResult } from './types.ts';

export type SnapshotVerificationInput = {
  readonly snapshot: ChainSnapshot;
  readonly trust: SnapshotTrust;
  readonly supply?: readonly SnapshotSupplyState[];
  readonly commitCertificateBlockId?: string;
};

export type SnapshotVerificationReport = {
  readonly ok: boolean;
  readonly formatOk: boolean;
  readonly chainOk: boolean;
  readonly heightOk: boolean;
  readonly stateCommitmentOk: boolean;
  readonly finalizedBlockOk: boolean;
  readonly supplyOk: boolean;
  readonly failures: readonly string[];
};

function toSupplyBook(row: SnapshotSupplyState) {
  const book = emptyBook(row.assetId as NativeMonetaryAssetId, 'sunrey.monetary.constitution.v1');
  book.genesisAllocated = row.genesisAllocated;
  book.issuedPostGenesis = row.issuedPostGenesis;
  book.burned = row.burned;
  book.circulating = row.circulating;
  book.locked = row.locked;
  book.escrowed = row.escrowed;
  book.feeReserved = row.feeReserved;
  return book;
}

export function verifySnapshotSupply(supply: readonly SnapshotSupplyState[]): SyncResult<true> {
  if (supply.length === 0) {
    return opsOk(true);
  }
  for (const row of supply) {
    const book = toSupplyBook(row);
    const expected = book.genesisAllocated + book.issuedPostGenesis - book.burned;
    const observed = book.circulating + book.locked + book.escrowed + book.feeReserved;
    if (expected !== observed || expected < 0n) {
      return opsErr('SNAPSHOT_TAMPER', `supply invariant failed for ${row.assetId}`);
    }
  }
  const audit = auditSupply(
    supply.map((row) => {
      const book = toSupplyBook(row);
      book.positions.set('snapshot-total', {
        account: 'snapshot-total',
        circulating: book.circulating,
        locked: book.locked,
        escrowed: book.escrowed,
        feeReserved: book.feeReserved,
      });
      return book;
    }),
  );
  if (!audit.ok) {
    return opsErr('SNAPSHOT_TAMPER', 'canonical supply audit failed');
  }
  return opsOk(true);
}

export function verifyCanonicalSnapshot(input: SnapshotVerificationInput): SyncResult<SnapshotVerificationReport> {
  const failures: string[] = [];
  const base = verifySnapshot(input.snapshot, input.trust);
  const formatOk = base.ok;
  const chainOk = base.ok;
  const heightOk = input.snapshot.manifest.height <= input.trust.trustedFinalizedHeight;
  const stateCommitmentOk = base.ok;
  let finalizedBlockOk = true;
  if (input.commitCertificateBlockId && input.snapshot.manifest.finalizedBlockId !== input.commitCertificateBlockId) {
    finalizedBlockOk = false;
    failures.push('finalized block id does not match commit certificate');
  }
  if (!base.ok) {
    failures.push(base.error.message);
  }
  if (!heightOk) {
    failures.push('snapshot height exceeds trusted finalized height');
  }
  const supplyCheck = input.supply ? verifySnapshotSupply(input.supply) : opsOk(true);
  const supplyOk = supplyCheck.ok;
  if (!supplyOk && !supplyCheck.ok) {
    failures.push(supplyCheck.error.message);
  }
  const ok = formatOk && chainOk && heightOk && stateCommitmentOk && finalizedBlockOk && supplyOk;
  if (!ok) {
    return opsOk({
      ok: false,
      formatOk,
      chainOk,
      heightOk,
      stateCommitmentOk,
      finalizedBlockOk,
      supplyOk,
      failures,
    });
  }
  return opsOk({
    ok: true,
    formatOk: true,
    chainOk: true,
    heightOk: true,
    stateCommitmentOk: true,
    finalizedBlockOk: true,
    supplyOk: true,
    failures,
  });
}
