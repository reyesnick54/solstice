import type { Pool, PoolClient } from 'pg';

import { isUniqueViolation, withTransaction } from '../postgres/write.ts';
import { withClient } from '../postgres/pools.ts';

/** Opaque durable snapshot persisted as canonical JSON. Typed at composition roots. */
export type HumanEconomicStateSnapshot = {
  readonly registry: unknown;
  readonly resolution: unknown;
  readonly proofBoundClaims?: unknown;
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, current) => (typeof current === 'bigint' ? current.toString() : current));
}

export async function persistHumanEconomicState(pool: Pool, state: HumanEconomicStateSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query(
      `INSERT INTO human_contribution.snapshot (snapshot_id, body_canonical, created_at)
       VALUES ('human_economic_state_head', $1, NOW())
       ON CONFLICT (snapshot_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical, created_at = NOW()`,
      [canonicalJson(state)],
    );
  });
}

export async function loadHumanEconomicState(pool: Pool): Promise<HumanEconomicStateSnapshot | null> {
  const result = await pool.query<{ body_canonical: string }>(
    `SELECT body_canonical FROM human_contribution.snapshot WHERE snapshot_id = 'human_economic_state_head'`,
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return JSON.parse(row.body_canonical) as HumanEconomicStateSnapshot;
}

export type ReservationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'DUPLICATE_FINGERPRINT' | 'DUPLICATE_REPLAY' | 'DUPLICATE_MONETIZATION_KEY' | 'DUPLICATE_CLAIM_FINGERPRINT' };

export async function reserveActiveFingerprint(
  client: PoolClient,
  fingerprint: string,
  contributionId: string,
): Promise<ReservationResult> {
  try {
    await client.query(
      `INSERT INTO human_contribution.active_fingerprint (fingerprint, contribution_id, reserved_at)
       VALUES ($1,$2,NOW())`,
      [fingerprint, contributionId],
    );
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, code: 'DUPLICATE_FINGERPRINT' };
    }
    throw error;
  }
}

export async function reserveVerifiedFingerprint(
  client: PoolClient,
  fingerprint: string,
  contributionId: string,
): Promise<ReservationResult> {
  try {
    await client.query(
      `INSERT INTO human_contribution.verified_fingerprint (fingerprint, contribution_id, verified_at)
       VALUES ($1,$2,NOW())`,
      [fingerprint, contributionId],
    );
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, code: 'DUPLICATE_FINGERPRINT' };
    }
    throw error;
  }
}

export async function releaseActiveFingerprint(
  client: PoolClient,
  fingerprint: string,
): Promise<void> {
  await client.query(`DELETE FROM human_contribution.active_fingerprint WHERE fingerprint = $1`, [fingerprint]);
}

export async function reserveObservationReplayKey(
  client: PoolClient,
  replayKey: string,
  observationId: string,
): Promise<ReservationResult> {
  try {
    await client.query(
      `INSERT INTO human_contribution.observation (observation_id, replay_key, body_canonical, observed_at)
       VALUES ($1,$2,'{}',NOW())`,
      [observationId, replayKey],
    );
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, code: 'DUPLICATE_REPLAY' };
    }
    throw error;
  }
}

export async function reserveMonetizationKey(
  client: PoolClient,
  monetizationKey: string,
  claimId: string,
): Promise<ReservationResult> {
  try {
    await client.query(
      `INSERT INTO human_contribution.monetization_consumed_key (monetization_key, claim_id, consumed_at)
       VALUES ($1,$2,NOW())`,
      [monetizationKey, claimId],
    );
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, code: 'DUPLICATE_MONETIZATION_KEY' };
    }
    throw error;
  }
}

export async function reserveProofBoundClaimFingerprint(
  client: PoolClient,
  fingerprint: string,
  economicClaimId: string,
  bodyCanonical: string,
): Promise<ReservationResult> {
  try {
    await client.query(
      `INSERT INTO human_contribution.proof_bound_claim
         (economic_claim_id, fingerprint, lifecycle_state, body_canonical, registered_at)
       VALUES ($1,$2,'REGISTERED',$3,NOW())`,
      [economicClaimId, fingerprint, bodyCanonical],
    );
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, code: 'DUPLICATE_CLAIM_FINGERPRINT' };
    }
    throw error;
  }
}

export async function markProofBoundClaimMonetized(
  client: PoolClient,
  economicClaimId: string,
): Promise<ReservationResult> {
  try {
    await client.query(
      `INSERT INTO human_contribution.monetized_claim (economic_claim_id, monetized_at)
       VALUES ($1,NOW())`,
      [economicClaimId],
    );
    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, code: 'DUPLICATE_MONETIZATION_KEY' };
    }
    throw error;
  }
}

export async function withHumanEconomicReservation<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(pool, fn);
}
