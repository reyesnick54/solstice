/**
 * Crash-safe custody metadata persistence. Chain remains native quantity
 * authority. This store is not a second ledger.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type DurableWithdrawal = {
  readonly withdrawalId: string;
  readonly customerId: string;
  readonly state: 'PENDING' | 'APPROVED' | 'SUBMITTED' | 'SUBMISSION_UNKNOWN' | 'CONFIRMED' | 'FAILED';
  readonly submittedOnce: boolean;
  readonly submissionId: string | null;
  readonly approvalIds: readonly string[];
  readonly journalId: string | null;
};

export type DurableVault = {
  readonly vaultId: string;
  readonly label: string;
  readonly controlPolicy: string;
};

export type CustodyDurableSnapshot = {
  readonly vaults: readonly DurableVault[];
  readonly withdrawals: readonly DurableWithdrawal[];
  readonly reconciliations: readonly { readonly id: string; readonly matched: boolean }[];
  readonly notQuantityAuthority: true;
};

export class DurableCustodyStore {
  readonly path: string;
  private snapshot: CustodyDurableSnapshot;

  constructor(directory: string) {
    this.path = join(directory, 'custody.durable.json');
    this.snapshot = loadOrEmpty(this.path);
  }

  createWithdrawal(row: DurableWithdrawal): DurableWithdrawal {
    if (this.snapshot.withdrawals.some((existing) => existing.withdrawalId === row.withdrawalId)) {
      throw new Error('duplicate withdrawal creation is forbidden');
    }
    this.snapshot = {
      ...this.snapshot,
      withdrawals: [...this.snapshot.withdrawals, row],
    };
    persistAtomic(this.path, this.snapshot);
    return row;
  }

  markUnknown(withdrawalId: string, submissionId: string): DurableWithdrawal {
    const current = this.snapshot.withdrawals.find((row) => row.withdrawalId === withdrawalId);
    if (!current) {
      throw new Error('withdrawal not found');
    }
    if (current.submittedOnce && current.state === 'SUBMISSION_UNKNOWN') {
      return current;
    }
    const next: DurableWithdrawal = {
      ...current,
      state: 'SUBMISSION_UNKNOWN',
      submittedOnce: true,
      submissionId,
      journalId: null,
    };
    this.replace(next);
    return next;
  }

  reopen(): DurableCustodyStore {
    return new DurableCustodyStore(dirname(this.path));
  }

  list(): CustodyDurableSnapshot {
    return this.snapshot;
  }

  private replace(next: DurableWithdrawal): void {
    this.snapshot = {
      ...this.snapshot,
      withdrawals: this.snapshot.withdrawals.map((row) => (row.withdrawalId === next.withdrawalId ? next : row)),
    };
    persistAtomic(this.path, this.snapshot);
  }
}

function loadOrEmpty(path: string): CustodyDurableSnapshot {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as CustodyDurableSnapshot;
  } catch {
    return { vaults: [], withdrawals: [], reconciliations: [], notQuantityAuthority: true };
  }
}

function persistAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(value), { mode: 0o600 });
  renameSync(tmp, path);
}
