/**
 * Crash-safe payment operational fixture store.
 * Not a second ledger. FILE_NOT_FOUND initializes empty. Corruption fails closed.
 */

import { dirname, join } from 'node:path';

import {
  DurableStoreError,
  type SnapshotPersistOptions,
  loadEnvelopeOrEmpty,
  persistEnvelopeAtomic,
  wrapSnapshot,
} from '../production/snapshot-envelope.ts';

export type DurablePaymentStatus =
  | 'DRAFT'
  | 'PENDING_COMPLIANCE'
  | 'READY'
  | 'FUNDS_RESERVED'
  | 'SUBMITTED'
  | 'SUBMISSION_UNKNOWN'
  | 'PROCESSING'
  | 'SETTLED'
  | 'FAILED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'HELD';

export const PAYMENT_TRANSITIONS: {
  readonly [S in DurablePaymentStatus]: readonly DurablePaymentStatus[];
} = {
  DRAFT: ['PENDING_COMPLIANCE', 'CANCELLED', 'FAILED'],
  PENDING_COMPLIANCE: ['READY', 'HELD', 'FAILED', 'CANCELLED'],
  READY: ['FUNDS_RESERVED', 'FAILED', 'CANCELLED', 'HELD'],
  FUNDS_RESERVED: ['SUBMITTED', 'SUBMISSION_UNKNOWN', 'FAILED', 'CANCELLED'],
  SUBMITTED: ['PROCESSING', 'SETTLED', 'FAILED', 'RETURNED', 'SUBMISSION_UNKNOWN', 'CANCELLED'],
  SUBMISSION_UNKNOWN: ['PROCESSING', 'SETTLED', 'FAILED', 'RETURNED'],
  PROCESSING: ['SETTLED', 'FAILED', 'RETURNED', 'CANCELLED'],
  SETTLED: ['RETURNED'],
  FAILED: [],
  RETURNED: [],
  CANCELLED: [],
  HELD: ['CANCELLED', 'FAILED', 'READY'],
};

export type DurablePayment = {
  readonly paymentId: string;
  readonly customerId: string;
  readonly status: DurablePaymentStatus;
  readonly idempotencyKey: string;
  readonly railSubmissionId: string | null;
  readonly providerIdempotencyKey: string | null;
  readonly quoteExecutionRef: string | null;
  readonly revision: number;
};

export type DurableRailSubmission = {
  readonly railSubmissionId: string;
  readonly paymentId: string;
  readonly provider: string;
  readonly idempotencyKey: string;
  readonly status: string;
  readonly executionUnknown: boolean;
  readonly revision: number;
};

export type PaymentDurableSnapshot = {
  readonly payments: readonly DurablePayment[];
  readonly submissions: readonly DurableRailSubmission[];
  readonly callbacks: readonly { readonly providerEventId: string; readonly payloadHash: string }[];
  readonly notALedger: true;
};

const EMPTY_PAYMENT: PaymentDurableSnapshot = Object.freeze({
  payments: [],
  submissions: [],
  callbacks: [],
  notALedger: true,
});

export class DurablePaymentStore {
  readonly path: string;
  private snapshot: PaymentDurableSnapshot;
  private sequence: number;
  private persistOptions: SnapshotPersistOptions;

  constructor(directory: string, persistOptions: SnapshotPersistOptions = {}) {
    this.path = join(directory, 'payment.durable.json');
    this.persistOptions = persistOptions;
    const loaded = loadEnvelopeOrEmpty(this.path, 'PAYMENT', isPaymentSnapshot);
    if (loaded.kind === 'EMPTY') {
      this.snapshot = EMPTY_PAYMENT;
      this.sequence = 0;
      return;
    }
    this.snapshot = loaded.envelope.payload;
    this.sequence = loaded.envelope.sequence;
  }

  upsertPayment(payment: DurablePayment, expectedRevision?: number): DurablePayment {
    const existing = this.snapshot.payments.find((row) => row.paymentId === payment.paymentId);
    if (existing) {
      if (expectedRevision !== undefined && existing.revision !== expectedRevision) {
        throw new DurableStoreError('STALE_REVISION', `stale writer for payment ${payment.paymentId}`);
      }
      if (existing.status !== payment.status && !PAYMENT_TRANSITIONS[existing.status].includes(payment.status)) {
        throw new DurableStoreError(
          'ILLEGAL_TRANSITION',
          `payment ${existing.status} → ${payment.status} is illegal`,
        );
      }
      const next = { ...payment, revision: existing.revision + 1 };
      this.snapshot = {
        ...this.snapshot,
        payments: this.snapshot.payments.map((row) => (row.paymentId === payment.paymentId ? next : row)),
      };
      this.persist();
      return next;
    }
    const created = { ...payment, revision: payment.revision ?? 1 };
    this.snapshot = { ...this.snapshot, payments: [...this.snapshot.payments, created] };
    this.persist();
    return created;
  }

  upsertSubmission(submission: DurableRailSubmission): DurableRailSubmission {
    const existing = this.snapshot.submissions.find((row) => row.railSubmissionId === submission.railSubmissionId);
    const next = existing ? { ...submission, revision: existing.revision + 1 } : { ...submission, revision: 1 };
    this.snapshot = {
      ...this.snapshot,
      submissions: existing
        ? this.snapshot.submissions.map((row) => (row.railSubmissionId === submission.railSubmissionId ? next : row))
        : [...this.snapshot.submissions, next],
    };
    this.persist();
    return next;
  }

  reopen(): DurablePaymentStore {
    return new DurablePaymentStore(dirname(this.path));
  }

  list(): PaymentDurableSnapshot {
    return this.snapshot;
  }

  private persist(): void {
    this.sequence += 1;
    persistEnvelopeAtomic(
      this.path,
      wrapSnapshot({
        storeKind: 'PAYMENT',
        sequence: this.sequence,
        createdAt: new Date().toISOString(),
        payload: this.snapshot,
      }),
      this.persistOptions,
    );
  }
}

function isPaymentSnapshot(value: unknown): value is PaymentDurableSnapshot {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.notALedger === true && Array.isArray(record.payments) && Array.isArray(record.submissions);
}

export { DurableStoreError };
