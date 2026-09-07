import type { Pool } from 'pg';

import { withClient } from '../postgres/pools.ts';

export type PersistedConsumerInternalPayment = {
  readonly paymentId: string;
  readonly customerId: string;
  readonly sourceAccountId: string;
  readonly destinationAccountId: string;
  readonly idempotencyKey: string;
  readonly journalId: string;
  readonly status: 'SETTLED';
  readonly body: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;
};

type PaymentRow = {
  payment_id: string;
  customer_id: string;
  source_account_id: string;
  destination_account_id: string;
  idempotency_key: string;
  journal_id: string;
  status: 'SETTLED';
  body_canonical: Record<string, unknown> | string;
  created_at: Date | string;
  updated_at: Date | string;
};

export async function persistConsumerInternalPayment(
  pool: Pool,
  payment: PersistedConsumerInternalPayment,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query(
      `INSERT INTO payments.consumer_internal_payment (
         payment_id, customer_id, source_account_id, destination_account_id,
         idempotency_key, journal_id, status, body_canonical, created_at, updated_at,
         production_money_movement, not_a_ledger
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,TRUE)
       ON CONFLICT (payment_id) DO UPDATE SET
         body_canonical = EXCLUDED.body_canonical,
         journal_id = EXCLUDED.journal_id,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [
        payment.paymentId,
        payment.customerId,
        payment.sourceAccountId,
        payment.destinationAccountId,
        payment.idempotencyKey,
        payment.journalId,
        payment.status,
        JSON.stringify(payment.body),
        payment.createdAt,
        payment.updatedAt,
      ],
    );
  });
}

export async function loadConsumerInternalPaymentByIdempotency(
  pool: Pool,
  idempotencyKey: string,
): Promise<PersistedConsumerInternalPayment | null> {
  const result = await pool.query<PaymentRow>(
    `SELECT payment_id, customer_id, source_account_id, destination_account_id,
            idempotency_key, journal_id, status, body_canonical, created_at, updated_at
       FROM payments.consumer_internal_payment
      WHERE idempotency_key = $1`,
    [idempotencyKey],
  );
  return result.rows[0] ? rowToPayment(result.rows[0]) : null;
}

export async function loadConsumerInternalPayment(
  pool: Pool,
  customerId: string,
  paymentId: string,
): Promise<PersistedConsumerInternalPayment | null> {
  const result = await pool.query<PaymentRow>(
    `SELECT payment_id, customer_id, source_account_id, destination_account_id,
            idempotency_key, journal_id, status, body_canonical, created_at, updated_at
       FROM payments.consumer_internal_payment
      WHERE customer_id = $1 AND payment_id = $2`,
    [customerId, paymentId],
  );
  return result.rows[0] ? rowToPayment(result.rows[0]) : null;
}

export async function listConsumerInternalPayments(
  pool: Pool,
  customerId: string,
): Promise<readonly PersistedConsumerInternalPayment[]> {
  const result = await pool.query<PaymentRow>(
    `SELECT payment_id, customer_id, source_account_id, destination_account_id,
            idempotency_key, journal_id, status, body_canonical, created_at, updated_at
       FROM payments.consumer_internal_payment
      WHERE customer_id = $1
      ORDER BY created_at DESC, payment_id DESC`,
    [customerId],
  );
  return Object.freeze(result.rows.map(rowToPayment));
}

function rowToPayment(row: PaymentRow): PersistedConsumerInternalPayment {
  return Object.freeze({
    paymentId: row.payment_id,
    customerId: row.customer_id,
    sourceAccountId: row.source_account_id,
    destinationAccountId: row.destination_account_id,
    idempotencyKey: row.idempotency_key,
    journalId: row.journal_id,
    status: row.status,
    body: Object.freeze(
      typeof row.body_canonical === 'string'
        ? (JSON.parse(row.body_canonical) as Record<string, unknown>)
        : row.body_canonical,
    ),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  });
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
