import type { Pool } from 'pg';

import {
  asAccountRestrictionId,
  freezeAccountRestriction,
  type AccountRestriction,
  type AccountRestrictionCode,
  type AccountRestrictionState,
} from '../../../domain/src/account-restriction.ts';
import { asAccountId } from '../../../domain/src/account.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { asHoldId, freezeHold, type FundsHold, type HoldPurpose, type HoldState } from '../../../domain/src/hold.ts';
import { asCurrencyCode } from '../../../domain/src/currency.ts';
import type { PersistedAccountOverlay } from './account-product-writes.ts';

export type LoadedAccountProductState = {
  readonly restrictions: readonly AccountRestriction[];
  readonly overlays: readonly PersistedAccountOverlay[];
  readonly holds: readonly FundsHold[];
};

export async function loadAccountProductState(pool: Pool): Promise<LoadedAccountProductState> {
  const [restrictions, overlays, holds] = await Promise.all([
    pool.query<{
      id: string;
      account_id: string;
      code: AccountRestrictionCode;
      state: AccountRestrictionState;
      reason: string;
      applied_at: Date;
      released_at: Date | null;
      applied_by_actor_id: string;
    }>(
      `SELECT id, account_id, code, state, reason, applied_at, released_at, applied_by_actor_id
         FROM ledger.account_restriction`,
    ),
    pool.query<{
      account_id: string;
      lifecycle: string | null;
      closed_at: Date | null;
      provider_id: string | null;
      provider_external_ref: string | null;
      metadata: Record<string, string> | null;
    }>(`SELECT account_id, lifecycle, closed_at, provider_id, provider_external_ref, metadata FROM ledger.account_product_overlay`),
    pool.query<{
      id: string;
      account_id: string;
      currency: string;
      amount_minor_units: string;
      purpose: HoldPurpose;
      state: HoldState;
      idempotency_key: string;
      created_at: Date;
      updated_at: Date;
      expires_at: Date | null;
      capture_journal_id: string | null;
      epoch: number;
    }>(
      `SELECT id, account_id, currency, amount_minor_units, purpose, state, idempotency_key,
              created_at, updated_at, expires_at, capture_journal_id, epoch
         FROM ledger.funds_hold`,
    ),
  ]);

  return {
    restrictions: restrictions.rows.map((row) =>
      freezeAccountRestriction({
        id: asAccountRestrictionId(row.id),
        accountId: asAccountId(row.account_id),
        code: row.code,
        state: row.state,
        reason: row.reason,
        appliedAt: asUtcInstant(row.applied_at.toISOString()),
        releasedAt: row.released_at ? asUtcInstant(row.released_at.toISOString()) : null,
        appliedByActorId: row.applied_by_actor_id,
      }),
    ),
    overlays: overlays.rows.map((row) =>
      Object.freeze({
        accountId: row.account_id,
        lifecycle: row.lifecycle,
        closedAt: row.closed_at ? row.closed_at.toISOString() : null,
        providerId: row.provider_id,
        providerExternalRef: row.provider_external_ref,
        metadata: Object.freeze({ ...(row.metadata ?? {}) }),
      }),
    ),
    holds: holds.rows.map((row) =>
      freezeHold({
        id: asHoldId(row.id),
        accountId: asAccountId(row.account_id),
        currency: asCurrencyCode(row.currency.trim()),
        amountMinorUnits: BigInt(row.amount_minor_units),
        purpose: row.purpose,
        state: row.state,
        idempotencyKey: row.idempotency_key,
        createdAt: asUtcInstant(row.created_at.toISOString()),
        updatedAt: asUtcInstant(row.updated_at.toISOString()),
        expiresAt: row.expires_at ? asUtcInstant(row.expires_at.toISOString()) : null,
        captureJournalId: row.capture_journal_id,
        epoch: row.epoch,
      }),
    ),
  };
}
