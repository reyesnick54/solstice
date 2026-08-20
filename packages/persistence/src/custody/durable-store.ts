/**
 * Crash-safe custody metadata persistence. Chain remains native quantity
 * authority. This store is not a second ledger.
 *
 * FILE_NOT_FOUND initializes an empty fixture. Corruption fails closed.
 */

import { dirname, join } from 'node:path';

import {
  DurableStoreError,
  type NativeOperationalAssetId,
  type SnapshotPersistOptions,
  assertNativeAsset,
  isNativeOperationalAssetId,
  loadEnvelopeOrEmpty,
  persistEnvelopeAtomic,
  wrapSnapshot,
} from '../production/snapshot-envelope.ts';

export type DurableWithdrawalState =
  | 'PENDING'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'SUBMISSION_UNKNOWN'
  | 'CONFIRMED'
  | 'FAILED';

export const CUSTODY_WITHDRAWAL_TRANSITIONS: {
  readonly [S in DurableWithdrawalState]: readonly DurableWithdrawalState[];
} = {
  PENDING: ['APPROVED', 'FAILED'],
  APPROVED: ['SUBMITTED', 'SUBMISSION_UNKNOWN', 'FAILED'],
  SUBMITTED: ['SUBMISSION_UNKNOWN', 'CONFIRMED', 'FAILED'],
  SUBMISSION_UNKNOWN: ['CONFIRMED', 'FAILED'],
  CONFIRMED: [],
  FAILED: [],
};

export type DurableWithdrawal = {
  readonly withdrawalId: string;
  readonly customerId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly state: DurableWithdrawalState;
  readonly submittedOnce: boolean;
  readonly submissionId: string | null;
  readonly providerIdempotencyKey: string | null;
  readonly approvalIds: readonly string[];
  readonly journalId: string | null;
  readonly revision: number;
};

export type DurableVault = {
  readonly vaultId: string;
  readonly label: string;
  readonly controlPolicy: string;
  readonly authorizedAssets: readonly NativeOperationalAssetId[];
};

export type DurableCustodyWallet = {
  readonly walletId: string;
  readonly vaultId: string;
  readonly assetId: NativeOperationalAssetId;
};

export type DurableCustodyDeposit = {
  readonly depositId: string;
  readonly customerId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly state: string;
  readonly revision: number;
};

export type DurableCustodyReservation = {
  readonly reservationId: string;
  readonly vaultId: string;
  readonly assetId: NativeOperationalAssetId;
  readonly quantity: string;
  readonly released: boolean;
  readonly debited: boolean;
  readonly revision: number;
};

export type DurableCustodySubmission = {
  readonly submissionId: string;
  readonly withdrawalId: string | null;
  readonly depositId: string | null;
  readonly assetId: NativeOperationalAssetId;
  readonly state: 'NOT_SUBMITTED' | 'SUBMITTED' | 'SUBMISSION_UNKNOWN' | 'FINALIZED' | 'REJECTED';
  readonly providerIdempotencyKey: string;
  readonly revision: number;
};

export type CustodyDurableSnapshot = {
  readonly vaults: readonly DurableVault[];
  readonly wallets: readonly DurableCustodyWallet[];
  readonly withdrawals: readonly DurableWithdrawal[];
  readonly deposits: readonly DurableCustodyDeposit[];
  readonly reservations: readonly DurableCustodyReservation[];
  readonly submissions: readonly DurableCustodySubmission[];
  readonly reconciliations: readonly { readonly id: string; readonly matched: boolean }[];
  readonly notQuantityAuthority: true;
};

const EMPTY_CUSTODY: CustodyDurableSnapshot = Object.freeze({
  vaults: [],
  wallets: [],
  withdrawals: [],
  deposits: [],
  reservations: [],
  submissions: [],
  reconciliations: [],
  notQuantityAuthority: true,
});

export class DurableCustodyStore {
  readonly path: string;
  private snapshot: CustodyDurableSnapshot;
  private sequence: number;
  private persistOptions: SnapshotPersistOptions;

  constructor(directory: string, persistOptions: SnapshotPersistOptions = {}) {
    this.path = join(directory, 'custody.durable.json');
    this.persistOptions = persistOptions;
    const loaded = loadEnvelopeOrEmpty(this.path, 'CUSTODY', isCustodySnapshot);
    if (loaded.kind === 'EMPTY') {
      this.snapshot = EMPTY_CUSTODY;
      this.sequence = 0;
      return;
    }
    this.snapshot = loaded.envelope.payload;
    this.sequence = loaded.envelope.sequence;
  }

  createWithdrawal(row: DurableWithdrawal): DurableWithdrawal {
    if (this.snapshot.withdrawals.some((existing) => existing.withdrawalId === row.withdrawalId)) {
      throw new Error('duplicate withdrawal creation is forbidden');
    }
    assertNativeAsset(row.assetId, 'withdrawal.assetId');
    this.snapshot = {
      ...this.snapshot,
      withdrawals: [...this.snapshot.withdrawals, freezeWithdrawal(row)],
    };
    this.persist();
    return row;
  }

  upsertVault(vault: DurableVault): void {
    for (const asset of vault.authorizedAssets) {
      assertNativeAsset(asset, 'vault.authorizedAssets');
    }
    const exists = this.snapshot.vaults.some((row) => row.vaultId === vault.vaultId);
    this.snapshot = {
      ...this.snapshot,
      vaults: exists
        ? this.snapshot.vaults.map((row) => (row.vaultId === vault.vaultId ? vault : row))
        : [...this.snapshot.vaults, vault],
    };
    this.persist();
  }

  upsertWallet(wallet: DurableCustodyWallet): void {
    assertNativeAsset(wallet.assetId, 'wallet.assetId');
    const exists = this.snapshot.wallets.some((row) => row.walletId === wallet.walletId);
    this.snapshot = {
      ...this.snapshot,
      wallets: exists
        ? this.snapshot.wallets.map((row) => (row.walletId === wallet.walletId ? wallet : row))
        : [...this.snapshot.wallets, wallet],
    };
    this.persist();
  }

  upsertDeposit(deposit: DurableCustodyDeposit): void {
    assertNativeAsset(deposit.assetId, 'deposit.assetId');
    const exists = this.snapshot.deposits.some((row) => row.depositId === deposit.depositId);
    this.snapshot = {
      ...this.snapshot,
      deposits: exists
        ? this.snapshot.deposits.map((row) => (row.depositId === deposit.depositId ? deposit : row))
        : [...this.snapshot.deposits, deposit],
    };
    this.persist();
  }

  upsertReservation(reservation: DurableCustodyReservation): void {
    assertNativeAsset(reservation.assetId, 'reservation.assetId');
    const exists = this.snapshot.reservations.some((row) => row.reservationId === reservation.reservationId);
    this.snapshot = {
      ...this.snapshot,
      reservations: exists
        ? this.snapshot.reservations.map((row) =>
            row.reservationId === reservation.reservationId ? reservation : row,
          )
        : [...this.snapshot.reservations, reservation],
    };
    this.persist();
  }

  upsertSubmission(submission: DurableCustodySubmission): void {
    assertNativeAsset(submission.assetId, 'submission.assetId');
    const exists = this.snapshot.submissions.some((row) => row.submissionId === submission.submissionId);
    this.snapshot = {
      ...this.snapshot,
      submissions: exists
        ? this.snapshot.submissions.map((row) =>
            row.submissionId === submission.submissionId ? submission : row,
          )
        : [...this.snapshot.submissions, submission],
    };
    this.persist();
  }

  markUnknown(withdrawalId: string, submissionId: string): DurableWithdrawal {
    const current = this.snapshot.withdrawals.find((row) => row.withdrawalId === withdrawalId);
    if (!current) {
      throw new Error('withdrawal not found');
    }
    if (current.submittedOnce && current.state === 'SUBMISSION_UNKNOWN') {
      return current;
    }
    assertTransition(current.state, 'SUBMISSION_UNKNOWN');
    const next: DurableWithdrawal = {
      ...current,
      state: 'SUBMISSION_UNKNOWN',
      submittedOnce: true,
      submissionId,
      journalId: null,
      revision: current.revision + 1,
    };
    this.replace(next, current.revision);
    return next;
  }

  replace(next: DurableWithdrawal, expectedRevision?: number): DurableWithdrawal {
    const current = this.snapshot.withdrawals.find((row) => row.withdrawalId === next.withdrawalId);
    if (!current) {
      throw new Error('withdrawal not found');
    }
    if (expectedRevision !== undefined && current.revision !== expectedRevision) {
      throw new DurableStoreError('STALE_REVISION', `stale writer for withdrawal ${next.withdrawalId}`);
    }
    if (current.state !== next.state) {
      assertTransition(current.state, next.state);
    }
    assertNativeAsset(next.assetId, 'withdrawal.assetId');
    this.snapshot = {
      ...this.snapshot,
      withdrawals: this.snapshot.withdrawals.map((row) => (row.withdrawalId === next.withdrawalId ? next : row)),
    };
    this.persist();
    return next;
  }

  reopen(): DurableCustodyStore {
    return new DurableCustodyStore(dirname(this.path));
  }

  list(): CustodyDurableSnapshot {
    return this.snapshot;
  }

  private persist(): void {
    this.sequence += 1;
    persistEnvelopeAtomic(
      this.path,
      wrapSnapshot({
        storeKind: 'CUSTODY',
        sequence: this.sequence,
        createdAt: new Date().toISOString(),
        payload: this.snapshot,
      }),
      this.persistOptions,
    );
  }
}

function assertTransition(from: DurableWithdrawalState, to: DurableWithdrawalState): void {
  if (!CUSTODY_WITHDRAWAL_TRANSITIONS[from].includes(to)) {
    throw new DurableStoreError('ILLEGAL_TRANSITION', `custody withdrawal ${from} → ${to} is illegal`);
  }
}

function freezeWithdrawal(row: DurableWithdrawal): DurableWithdrawal {
  return Object.freeze({
    ...row,
    assetId: assertNativeAsset(row.assetId, 'withdrawal.assetId'),
    approvalIds: Object.freeze([...row.approvalIds]),
    revision: row.revision ?? 1,
  });
}

function isCustodySnapshot(value: unknown): value is CustodyDurableSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.notQuantityAuthority !== true) {
    return false;
  }
  if (!Array.isArray(record.withdrawals) || !Array.isArray(record.vaults)) {
    return false;
  }
  const withdrawals = record.withdrawals as readonly unknown[];
  const wallets = (record.wallets ?? []) as readonly unknown[];
  const deposits = (record.deposits ?? []) as readonly unknown[];
  const reservations = (record.reservations ?? []) as readonly unknown[];
  const submissions = (record.submissions ?? []) as readonly unknown[];
  return (
    withdrawals.every(isWithdrawal) &&
    wallets.every(isWallet) &&
    deposits.every(isDeposit) &&
    reservations.every(isReservation) &&
    submissions.every(isSubmission)
  );
}

function isWithdrawal(value: unknown): value is DurableWithdrawal {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.withdrawalId === 'string' && isNativeOperationalAssetId(row.assetId);
}

function isWallet(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.walletId === 'string' && isNativeOperationalAssetId(row.assetId);
}

function isDeposit(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.depositId === 'string' && isNativeOperationalAssetId(row.assetId);
}

function isReservation(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.reservationId === 'string' && isNativeOperationalAssetId(row.assetId);
}

function isSubmission(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.submissionId === 'string' && isNativeOperationalAssetId(row.assetId);
}

export { DurableStoreError };
