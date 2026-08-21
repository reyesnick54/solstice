import type { PoolClient } from 'pg';

import type { AccountRestriction } from '../../../domain/src/account-restriction.ts';

export type PersistedAccountOverlay = {
  readonly accountId: string;
  readonly lifecycle: string | null;
  readonly closedAt: string | null;
  readonly providerId: string | null;
  readonly providerExternalRef: string | null;
  readonly metadata: Readonly<Record<string, string>>;
};

export async function upsertAccountRestriction(
  client: PoolClient,
  restriction: AccountRestriction,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger.account_restriction (
       id, account_id, code, state, reason, applied_at, released_at, applied_by_actor_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       state = EXCLUDED.state,
       released_at = EXCLUDED.released_at`,
    [
      restriction.id,
      restriction.accountId,
      restriction.code,
      restriction.state,
      restriction.reason,
      restriction.appliedAt,
      restriction.releasedAt,
      restriction.appliedByActorId,
    ],
  );
}

export async function upsertAccountProductOverlay(
  client: PoolClient,
  overlay: PersistedAccountOverlay,
): Promise<void> {
  await client.query(
    `INSERT INTO ledger.account_product_overlay (
       account_id, lifecycle, closed_at, provider_id, provider_external_ref, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (account_id) DO UPDATE SET
       lifecycle = EXCLUDED.lifecycle,
       closed_at = EXCLUDED.closed_at,
       provider_id = EXCLUDED.provider_id,
       provider_external_ref = EXCLUDED.provider_external_ref,
       metadata = EXCLUDED.metadata`,
    [
      overlay.accountId,
      overlay.lifecycle,
      overlay.closedAt,
      overlay.providerId,
      overlay.providerExternalRef,
      JSON.stringify(overlay.metadata),
    ],
  );
}
