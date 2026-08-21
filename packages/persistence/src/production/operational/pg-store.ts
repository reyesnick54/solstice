/**
 * Production-candidate PostgreSQL adapters for operational workflow state.
 * Not a second ledger and not a native-asset supply authority.
 */

import type { Pool, PoolClient } from 'pg';

import { withTransaction } from '../../postgres/write.ts';
import { DurableStoreError } from '../snapshot-envelope.ts';
import {
  assertCustodyWithdrawalTransition,
  assertExpectedRevision,
  assertExchangeOrderTransition,
  assertPaymentTransition,
  assertProviderTransition,
} from './transitions.ts';
import type {
  OperationalCredentialDescriptorRef,
  OperationalCustodyDeposit,
  OperationalCustodyReservation,
  OperationalCustodySubmission,
  OperationalCustodyWallet,
  OperationalCustodyWithdrawal,
  OperationalExchangeOrder,
  OperationalExchangeReservation,
  OperationalExchangeTrade,
  OperationalInboxRecord,
  OperationalOutboxRecord,
  OperationalPayment,
  OperationalProviderProfile,
  OperationalRailSubmission,
  OperationalSettlementIntent,
} from './types.ts';

export class PostgresOperationalStore {
  private readonly customer: Pool;
  private readonly security?: Pool;

  constructor(customer: Pool, security?: Pool) {
    this.customer = customer;
    this.security = security;
  }

  async upsertOperationalPayment(row: OperationalPayment, expectedRevision?: number): Promise<OperationalPayment> {
    return withTransaction(this.customer, async (client) => {
      const existing = await one<OperationalPayment>(
        client,
        `SELECT payment_id AS "paymentId", customer_id AS "customerId", status,
                idempotency_key AS "idempotencyKey", rail_submission_id AS "railSubmissionId",
                provider_idempotency_key AS "providerIdempotencyKey",
                quote_execution_ref AS "quoteExecutionRef", revision
           FROM payments.operational_payment WHERE payment_id = $1`,
        [row.paymentId],
      );
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `payment ${row.paymentId}`);
        assertPaymentTransition(existing.status, row.status);
      }
      const revision = existing ? existing.revision + 1 : (row.revision ?? 1);
      await client.query(
        `INSERT INTO payments.operational_payment (
           payment_id, customer_id, status, idempotency_key, rail_submission_id,
           provider_idempotency_key, quote_execution_ref, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
         ON CONFLICT (payment_id) DO UPDATE SET
           status = EXCLUDED.status,
           rail_submission_id = EXCLUDED.rail_submission_id,
           provider_idempotency_key = EXCLUDED.provider_idempotency_key,
           quote_execution_ref = EXCLUDED.quote_execution_ref,
           revision = EXCLUDED.revision,
           updated_at = NOW()
         WHERE payments.operational_payment.revision = $9`,
        [
          row.paymentId,
          row.customerId,
          row.status,
          row.idempotencyKey,
          row.railSubmissionId,
          row.providerIdempotencyKey,
          row.quoteExecutionRef,
          revision,
          existing?.revision ?? 0,
        ],
      );
      return { ...row, revision };
    });
  }

  async putRailSubmission(row: OperationalRailSubmission): Promise<OperationalRailSubmission> {
    return withTransaction(this.customer, async (client) => {
      const existing = await one<{ revision: number }>(
        client,
        `SELECT revision FROM payments.operational_rail_submission WHERE rail_submission_id = $1`,
        [row.railSubmissionId],
      );
      const revision = existing ? existing.revision + 1 : (row.revision ?? 1);
      await client.query(
        `INSERT INTO payments.operational_rail_submission (
           rail_submission_id, payment_id, provider, idempotency_key, status,
           execution_unknown, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
         ON CONFLICT (rail_submission_id) DO UPDATE SET
           status = EXCLUDED.status,
           execution_unknown = EXCLUDED.execution_unknown,
           revision = EXCLUDED.revision,
           updated_at = NOW()`,
        [
          row.railSubmissionId,
          row.paymentId,
          row.provider,
          row.idempotencyKey,
          row.status,
          row.executionUnknown,
          revision,
        ],
      );
      return { ...row, revision };
    });
  }

  async putWallet(row: OperationalCustodyWallet): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO custody.operational_wallet (wallet_id, vault_id, asset_id, revision, updated_at)
         VALUES ($1,$2,$3,$4, NOW())
         ON CONFLICT (wallet_id) DO UPDATE SET
           vault_id = EXCLUDED.vault_id,
           asset_id = EXCLUDED.asset_id,
           revision = custody.operational_wallet.revision + 1,
           updated_at = NOW()`,
        [row.walletId, row.vaultId, row.assetId, row.revision ?? 1],
      ),
    );
  }

  async putWithdrawal(
    row: OperationalCustodyWithdrawal,
    expectedRevision?: number,
  ): Promise<OperationalCustodyWithdrawal> {
    return withTransaction(this.customer, async (client) => {
      const existing = await one<OperationalCustodyWithdrawal>(
        client,
        `SELECT withdrawal_id AS "withdrawalId", customer_id AS "customerId", vault_id AS "vaultId",
                wallet_id AS "walletId", asset_id AS "assetId", quantity, state,
                submitted_once AS "submittedOnce", submission_id AS "submissionId",
                provider_idempotency_key AS "providerIdempotencyKey", journal_id AS "journalId",
                revision
           FROM custody.operational_withdrawal WHERE withdrawal_id = $1`,
        [row.withdrawalId],
      );
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `withdrawal ${row.withdrawalId}`);
        assertCustodyWithdrawalTransition(existing.state, row.state);
      }
      const revision = existing ? existing.revision + 1 : (row.revision ?? 1);
      await client.query(
        `INSERT INTO custody.operational_withdrawal (
           withdrawal_id, customer_id, vault_id, wallet_id, asset_id, quantity, state,
           submitted_once, submission_id, provider_idempotency_key, journal_id, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())
         ON CONFLICT (withdrawal_id) DO UPDATE SET
           state = EXCLUDED.state,
           submitted_once = EXCLUDED.submitted_once,
           submission_id = EXCLUDED.submission_id,
           provider_idempotency_key = EXCLUDED.provider_idempotency_key,
           journal_id = EXCLUDED.journal_id,
           revision = EXCLUDED.revision,
           updated_at = NOW()`,
        [
          row.withdrawalId,
          row.customerId,
          row.vaultId,
          row.walletId,
          row.assetId,
          row.quantity,
          row.state,
          row.submittedOnce,
          row.submissionId,
          row.providerIdempotencyKey,
          row.journalId,
          revision,
        ],
      );
      return { ...row, revision };
    });
  }

  async putDeposit(row: OperationalCustodyDeposit): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO custody.operational_deposit (
           deposit_id, customer_id, asset_id, quantity, state, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6, NOW())
         ON CONFLICT (deposit_id) DO UPDATE SET
           state = EXCLUDED.state,
           quantity = EXCLUDED.quantity,
           revision = custody.operational_deposit.revision + 1,
           updated_at = NOW()`,
        [row.depositId, row.customerId, row.assetId, row.quantity, row.state, row.revision ?? 1],
      ),
    );
  }

  async putCustodyReservation(row: OperationalCustodyReservation): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO custody.operational_reservation (
           reservation_id, vault_id, asset_id, quantity, released, debited, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
         ON CONFLICT (reservation_id) DO UPDATE SET
           released = EXCLUDED.released,
           debited = EXCLUDED.debited,
           revision = custody.operational_reservation.revision + 1,
           updated_at = NOW()`,
        [row.reservationId, row.vaultId, row.assetId, row.quantity, row.released, row.debited, row.revision ?? 1],
      ),
    );
  }

  async putCustodySubmission(row: OperationalCustodySubmission): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO custody.operational_provider_submission (
           submission_id, withdrawal_id, deposit_id, asset_id, state,
           provider_idempotency_key, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
         ON CONFLICT (submission_id) DO UPDATE SET
           state = EXCLUDED.state,
           revision = custody.operational_provider_submission.revision + 1,
           updated_at = NOW()`,
        [
          row.submissionId,
          row.withdrawalId,
          row.depositId,
          row.assetId,
          row.state,
          row.providerIdempotencyKey,
          row.revision ?? 1,
        ],
      ),
    );
  }

  async putOrder(row: OperationalExchangeOrder, expectedRevision?: number): Promise<OperationalExchangeOrder> {
    return withTransaction(this.customer, async (client) => {
      const existing = await one<OperationalExchangeOrder>(
        client,
        `SELECT order_id AS "orderId", client_idempotency_key AS "clientIdempotencyKey",
                state, hold_id AS "holdId", base_asset AS "baseAsset", quote_asset AS "quoteAsset",
                revision
           FROM sunrey_exchange.operational_order WHERE order_id = $1`,
        [row.orderId],
      );
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `order ${row.orderId}`);
        assertExchangeOrderTransition(existing.state, row.state);
      }
      const revision = existing ? existing.revision + 1 : (row.revision ?? 1);
      await client.query(
        `INSERT INTO sunrey_exchange.operational_order (
           order_id, client_idempotency_key, state, hold_id, base_asset, quote_asset, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
         ON CONFLICT (order_id) DO UPDATE SET
           state = EXCLUDED.state,
           hold_id = EXCLUDED.hold_id,
           revision = EXCLUDED.revision,
           updated_at = NOW()`,
        [row.orderId, row.clientIdempotencyKey, row.state, row.holdId, row.baseAsset, row.quoteAsset, revision],
      );
      return { ...row, revision };
    });
  }

  async putExchangeReservation(row: OperationalExchangeReservation): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO sunrey_exchange.operational_reservation (
           reservation_id, order_id, asset_id, quantity, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5, NOW())
         ON CONFLICT (reservation_id) DO UPDATE SET
           quantity = EXCLUDED.quantity,
           revision = sunrey_exchange.operational_reservation.revision + 1,
           updated_at = NOW()`,
        [row.reservationId, row.orderId, row.assetId, row.quantity, row.revision ?? 1],
      ),
    );
  }

  async putTrade(row: OperationalExchangeTrade): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO sunrey_exchange.operational_trade (trade_id, buy_order_id, sell_order_id)
         VALUES ($1,$2,$3)
         ON CONFLICT (trade_id) DO NOTHING`,
        [row.tradeId, row.buyOrderId, row.sellOrderId],
      ),
    );
  }

  async putSettlement(row: OperationalSettlementIntent): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO sunrey_exchange.operational_settlement_intent (
           intent_id, trade_id, base_asset, quote_asset, submission, journal_id, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
         ON CONFLICT (intent_id) DO UPDATE SET
           submission = EXCLUDED.submission,
           journal_id = EXCLUDED.journal_id,
           revision = sunrey_exchange.operational_settlement_intent.revision + 1,
           updated_at = NOW()`,
        [
          row.intentId,
          row.tradeId,
          row.baseAsset,
          row.quoteAsset,
          row.submission,
          row.journalId,
          row.revision ?? 1,
        ],
      ),
    );
  }

  async putProvider(row: OperationalProviderProfile, expectedRevision?: number): Promise<OperationalProviderProfile> {
    if (row.rawCredentialPresent !== false) {
      throw new DurableStoreError('SCHEMA_INVALID', 'raw credentials must not be persisted');
    }
    return withTransaction(this.customer, async (client) => {
      const existing = await one<OperationalProviderProfile>(
        client,
        `SELECT provider_id AS "providerId", profile_version AS "profileVersion",
                profile_hash AS "profileHash", acceptance_status AS "acceptanceStatus",
                credential_descriptor_id AS "credentialDescriptorId",
                credential_version AS "credentialVersion",
                credential_reference_hash AS "credentialReferenceHash",
                endpoint_profile_ref AS "endpointProfileRef",
                certification_ref AS "certificationRef",
                revalidation_state AS "revalidationState",
                suspension_state AS "suspensionState",
                raw_credential_present AS "rawCredentialPresent",
                revision
           FROM customer.provider_operational_state WHERE provider_id = $1`,
        [row.providerId],
      );
      if (existing) {
        assertExpectedRevision(existing.revision, expectedRevision, `provider ${row.providerId}`);
        assertProviderTransition(existing.acceptanceStatus, row.acceptanceStatus);
      }
      const revision = existing ? existing.revision + 1 : (row.revision ?? 1);
      await client.query(
        `INSERT INTO customer.provider_operational_state (
           provider_id, profile_version, profile_hash, acceptance_status,
           credential_descriptor_id, credential_version, credential_reference_hash,
           endpoint_profile_ref, certification_ref, revalidation_state, suspension_state,
           raw_credential_present, revision, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, FALSE, $12, NOW())
         ON CONFLICT (provider_id) DO UPDATE SET
           profile_version = EXCLUDED.profile_version,
           profile_hash = EXCLUDED.profile_hash,
           acceptance_status = EXCLUDED.acceptance_status,
           credential_descriptor_id = EXCLUDED.credential_descriptor_id,
           credential_version = EXCLUDED.credential_version,
           credential_reference_hash = EXCLUDED.credential_reference_hash,
           endpoint_profile_ref = EXCLUDED.endpoint_profile_ref,
           certification_ref = EXCLUDED.certification_ref,
           revalidation_state = EXCLUDED.revalidation_state,
           suspension_state = EXCLUDED.suspension_state,
           revision = EXCLUDED.revision,
           updated_at = NOW()`,
        [
          row.providerId,
          row.profileVersion,
          row.profileHash,
          row.acceptanceStatus,
          row.credentialDescriptorId,
          row.credentialVersion,
          row.credentialReferenceHash,
          row.endpointProfileRef,
          row.certificationRef,
          row.revalidationState,
          row.suspensionState,
          revision,
        ],
      );
      return { ...row, rawCredentialPresent: false, revision };
    });
  }

  async putCredentialRef(row: OperationalCredentialDescriptorRef): Promise<void> {
    if (!this.security) {
      throw new Error('security pool is required for credential descriptor references');
    }
    if (row.rawCredentialPresent !== false || row.privateKeyPresent !== false) {
      throw new DurableStoreError('SCHEMA_INVALID', 'credential values must not be persisted');
    }
    await withTransaction(this.security, (client) =>
      client.query(
        `INSERT INTO security.credential_descriptor_ref (
           descriptor_id, provider_id, credential_kind, version, reference_hash,
           endpoint_profile_ref, status, raw_credential_present, private_key_present, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7, FALSE, FALSE, NOW())
         ON CONFLICT (descriptor_id) DO UPDATE SET
           version = EXCLUDED.version,
           reference_hash = EXCLUDED.reference_hash,
           status = EXCLUDED.status`,
        [
          row.descriptorId,
          row.providerId,
          row.credentialKind,
          row.version,
          row.referenceHash,
          row.endpointProfileRef,
          row.status,
        ],
      ),
    );
  }

  async mutateWithOutbox<T>(
    mutate: (client: PoolClient) => Promise<T>,
    outbox: OperationalOutboxRecord,
  ): Promise<T> {
    return withTransaction(this.customer, async (client) => {
      const result = await mutate(client);
      await client.query(
        `INSERT INTO customer.operational_outbox (
           event_id, aggregate_id, kind, state, lease_expires_at, not_a_journal
         ) VALUES ($1,$2,$3,$4,$5, TRUE)
         ON CONFLICT (event_id) DO UPDATE SET
           state = EXCLUDED.state,
           lease_expires_at = EXCLUDED.lease_expires_at`,
        [outbox.eventId, outbox.aggregateId, outbox.kind, outbox.state, outbox.leaseExpiresAt],
      );
      return result;
    });
  }

  async putInbox(row: OperationalInboxRecord): Promise<void> {
    await withTransaction(this.customer, (client) =>
      client.query(
        `INSERT INTO customer.operational_inbox (consumer_id, event_id, state, interrupted)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (consumer_id, event_id) DO UPDATE SET
           state = EXCLUDED.state,
           interrupted = EXCLUDED.interrupted`,
        [row.consumerId, row.eventId, row.state, row.interrupted],
      ),
    );
  }

  async loadUnresolved(): Promise<{
    readonly payments: readonly OperationalPayment[];
    readonly withdrawals: readonly OperationalCustodyWithdrawal[];
    readonly settlements: readonly OperationalSettlementIntent[];
    readonly outbox: readonly OperationalOutboxRecord[];
    readonly inbox: readonly OperationalInboxRecord[];
    readonly providers: readonly OperationalProviderProfile[];
  }> {
    return withTransaction(this.customer, async (client) => {
      const payments = await many<OperationalPayment>(
        client,
        `SELECT payment_id AS "paymentId", customer_id AS "customerId", status,
                idempotency_key AS "idempotencyKey", rail_submission_id AS "railSubmissionId",
                provider_idempotency_key AS "providerIdempotencyKey",
                quote_execution_ref AS "quoteExecutionRef", revision
           FROM payments.operational_payment
          WHERE status = 'SUBMISSION_UNKNOWN'`,
      );
      const withdrawals = await many<OperationalCustodyWithdrawal>(
        client,
        `SELECT withdrawal_id AS "withdrawalId", customer_id AS "customerId", vault_id AS "vaultId",
                wallet_id AS "walletId", asset_id AS "assetId", quantity, state,
                submitted_once AS "submittedOnce", submission_id AS "submissionId",
                provider_idempotency_key AS "providerIdempotencyKey", journal_id AS "journalId",
                revision
           FROM custody.operational_withdrawal
          WHERE state = 'SUBMISSION_UNKNOWN'`,
      );
      const settlements = await many<OperationalSettlementIntent>(
        client,
        `SELECT intent_id AS "intentId", trade_id AS "tradeId", base_asset AS "baseAsset",
                quote_asset AS "quoteAsset", submission, journal_id AS "journalId", revision
           FROM sunrey_exchange.operational_settlement_intent
          WHERE submission IN ('PENDING', 'SUBMISSION_UNKNOWN')`,
      );
      const outbox = await many<OperationalOutboxRecord>(
        client,
        `SELECT event_id AS "eventId", aggregate_id AS "aggregateId", kind, state,
                lease_expires_at AS "leaseExpiresAt", not_a_journal AS "notAJournal"
           FROM customer.operational_outbox
          WHERE state = 'IN_FLIGHT'`,
      );
      const inbox = await many<OperationalInboxRecord>(
        client,
        `SELECT consumer_id AS "consumerId", event_id AS "eventId", state, interrupted
           FROM customer.operational_inbox
          WHERE interrupted = TRUE OR state = 'PROCESSING'`,
      );
      const providers = await many<OperationalProviderProfile>(
        client,
        `SELECT provider_id AS "providerId", profile_version AS "profileVersion",
                profile_hash AS "profileHash", acceptance_status AS "acceptanceStatus",
                credential_descriptor_id AS "credentialDescriptorId",
                credential_version AS "credentialVersion",
                credential_reference_hash AS "credentialReferenceHash",
                endpoint_profile_ref AS "endpointProfileRef",
                certification_ref AS "certificationRef",
                revalidation_state AS "revalidationState",
                suspension_state AS "suspensionState",
                raw_credential_present AS "rawCredentialPresent",
                revision
           FROM customer.provider_operational_state
          WHERE revalidation_state = 'PENDING' OR acceptance_status = 'REVOKED'`,
      );
      return { payments, withdrawals, settlements, outbox, inbox, providers };
    });
  }
}

async function one<T>(client: PoolClient, text: string, values: readonly unknown[]): Promise<T | undefined> {
  const result = await client.query(text, [...values]);
  return result.rows[0] as T | undefined;
}

async function many<T>(client: PoolClient, text: string): Promise<readonly T[]> {
  const result = await client.query(text);
  return result.rows as T[];
}
