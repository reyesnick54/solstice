import type { Pool, PoolClient } from 'pg';

import type {
  SealedDecisionRecord,
  ShadowLabCheckpoint,
  ShadowLabCampaignLease,
  ShadowLabCampaignRegistration,
  ShadowLabDecisionCommitInput,
  ShadowLabDecisionCommitResult,
  ShadowLabDurableStore,
  ShadowLabMaturedOutcome,
  ShadowLabPendingOutcome,
  ShadowLabShadowFill,
  ShadowLabStrategyVersionRecord,
} from '@solstice/platform';
import { isUniqueViolation } from '../postgres/write.ts';
import { withClient } from '../postgres/pools.ts';

function addMsIso(at: string, ms: number): string {
  return new Date(Date.parse(at) + ms).toISOString();
}

async function withTxn<T>(pool: Pool, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export class PgShadowLabDurableStore implements ShadowLabDurableStore {
  readonly persistenceAvailable = true;
  private readonly pool: Pool;
  private forcedUnavailable = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /** Test hook — simulates database outage (fail closed). */
  setForcedUnavailable(unavailable: boolean): void {
    this.forcedUnavailable = unavailable;
  }

  private guard(): void {
    if (this.forcedUnavailable) {
      throw new Error('PERSISTENCE_UNAVAILABLE');
    }
  }

  async registerCampaign(registration: ShadowLabCampaignRegistration): Promise<'OK' | 'DUPLICATE'> {
    this.guard();
    try {
      await withClient(this.pool, async (client) => {
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_campaign
             (campaign_id, fingerprint, body_canonical, registered_at)
           VALUES ($1,$2,$3,$4)`,
          [
            registration.campaignId,
            registration.fingerprint,
            JSON.stringify(registration),
            registration.registeredAt,
          ],
        );
      });
      return 'OK';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'DUPLICATE';
      }
      throw error;
    }
  }

  async registerStrategyVersion(record: ShadowLabStrategyVersionRecord): Promise<'OK' | 'DUPLICATE'> {
    this.guard();
    try {
      await withClient(this.pool, async (client) => {
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_strategy_version
             (strategy_version_id, campaign_id, strategy_id, version, freeze_hash, body_canonical, registered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            record.strategyVersionId,
            record.campaignId,
            record.strategyId,
            record.version,
            record.freezeHash,
            JSON.stringify(record),
            record.registeredAt,
          ],
        );
      });
      return 'OK';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'DUPLICATE';
      }
      throw error;
    }
  }

  async tryAcquireLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly now: string;
    readonly leaseMs: number;
  }): Promise<ShadowLabCampaignLease | 'HELD_BY_OTHER' | 'PERSISTENCE_UNAVAILABLE'> {
    if (this.forcedUnavailable) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    return withTxn(this.pool, async (client) => {
      const existing = await client.query(
        `SELECT worker_id, fencing_token, expires_at
           FROM growth.helios_shadow_lab_campaign_lease
          WHERE campaign_id = $1
          FOR UPDATE`,
        [input.campaignId],
      );
      const row = existing.rows[0] as
        | { worker_id: string; fencing_token: string; expires_at: string }
        | undefined;
      if (row && Date.parse(row.expires_at) > Date.parse(input.now) && row.worker_id !== input.workerId) {
        return 'HELD_BY_OTHER';
      }
      const fencingToken = row ? Number(row.fencing_token) + 1 : 1;
      const expiresAt = addMsIso(input.now, input.leaseMs);
      await client.query(
        `INSERT INTO growth.helios_shadow_lab_campaign_lease
           (campaign_id, worker_id, fencing_token, acquired_at, expires_at)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (campaign_id) DO UPDATE SET
           worker_id = EXCLUDED.worker_id,
           fencing_token = EXCLUDED.fencing_token,
           acquired_at = EXCLUDED.acquired_at,
           expires_at = EXCLUDED.expires_at
         WHERE growth.helios_shadow_lab_campaign_lease.fencing_token < EXCLUDED.fencing_token
            OR growth.helios_shadow_lab_campaign_lease.worker_id = EXCLUDED.worker_id`,
        [input.campaignId, input.workerId, fencingToken, input.now, expiresAt],
      );
      return Object.freeze({
        campaignId: input.campaignId,
        workerId: input.workerId,
        fencingToken,
        acquiredAt: input.now,
        expiresAt,
      });
    });
  }

  async renewLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly fencingToken: number;
    readonly now: string;
    readonly leaseMs: number;
  }): Promise<'OK' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE'> {
    if (this.forcedUnavailable) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    const expiresAt = addMsIso(input.now, input.leaseMs);
    const result = await withClient(this.pool, async (client) => {
      const updated = await client.query(
        `UPDATE growth.helios_shadow_lab_campaign_lease
            SET expires_at = $4
          WHERE campaign_id = $1
            AND worker_id = $2
            AND fencing_token = $3`,
        [input.campaignId, input.workerId, input.fencingToken, expiresAt],
      );
      return updated.rowCount === 1;
    });
    return result ? 'OK' : 'LEASE_LOST';
  }

  async releaseLease(input: {
    readonly campaignId: string;
    readonly workerId: string;
    readonly fencingToken: number;
  }): Promise<void> {
    await withClient(this.pool, async (client) => {
      await client.query(
        `DELETE FROM growth.helios_shadow_lab_campaign_lease
          WHERE campaign_id = $1 AND worker_id = $2 AND fencing_token = $3`,
        [input.campaignId, input.workerId, input.fencingToken],
      );
    });
  }

  async commitSealedDecision(input: ShadowLabDecisionCommitInput): Promise<ShadowLabDecisionCommitResult> {
    if (this.forcedUnavailable) {
      return { ok: false, reason: 'PERSISTENCE_UNAVAILABLE' };
    }
    try {
      await withTxn(this.pool, async (client) => {
        const lease = await client.query(
          `SELECT worker_id, fencing_token FROM growth.helios_shadow_lab_campaign_lease
            WHERE campaign_id = $1 FOR UPDATE`,
          [input.decision.campaignId],
        );
        const leaseRow = lease.rows[0] as { worker_id: string; fencing_token: string } | undefined;
        const fencing = Number(leaseRow?.fencing_token ?? 0);
        if (!leaseRow || fencing !== input.fencingToken || leaseRow.worker_id !== input.workerId) {
          throw Object.assign(new Error('LEASE_LOST'), { code: 'LEASE_LOST' });
        }
        const d = input.decision;
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_sealed_decision
             (decision_id, campaign_id, strategy_id, content_hash, previous_hash, body_canonical, knowable_at, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            d.decisionId,
            d.campaignId,
            d.strategyId,
            d.contentHash,
            d.previousHash,
            JSON.stringify(d),
            d.knowableAt,
            d.recordedAt,
          ],
        );
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_decision_evidence
             (evidence_hash, decision_id, campaign_id, body_canonical, sealed_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [input.evidenceHash, d.decisionId, d.campaignId, JSON.stringify({ hash: input.evidenceHash }), d.recordedAt],
        );
        const cp = input.checkpoint;
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_checkpoint
             (checkpoint_id, campaign_id, body_canonical, sealed_at)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (checkpoint_id) DO NOTHING`,
          [cp.checkpointId, d.campaignId, JSON.stringify(cp), cp.sealedAt],
        );
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_evidence_state
             (campaign_id, chain_head_hash, decision_count, body_canonical, updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (campaign_id) DO UPDATE SET
             chain_head_hash = EXCLUDED.chain_head_hash,
             decision_count = EXCLUDED.decision_count,
             body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
          [d.campaignId, d.contentHash, cp.decisionCount, JSON.stringify(cp), cp.sealedAt],
        );
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_outbox
             (event_id, campaign_id, kind, body_canonical, state, created_at)
           VALUES ($1,$2,$3,$4,'PENDING',$5)`,
          [input.outboxEventId, d.campaignId, input.outboxKind, JSON.stringify({ decisionId: d.decisionId }), d.recordedAt],
        );
      });
      return { ok: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('helios_shadow_lab_decision_evidence')) {
          return { ok: false, reason: 'DUPLICATE_EVIDENCE' };
        }
        return { ok: false, reason: 'DUPLICATE_DECISION' };
      }
      if (error instanceof Error && (error as Error & { code?: string }).code === 'LEASE_LOST') {
        return { ok: false, reason: 'LEASE_LOST' };
      }
      throw error;
    }
  }

  async listDecisions(campaignId: string): Promise<readonly SealedDecisionRecord[]> {
    return withClient(this.pool, async (client) => {
      const rows = await client.query(
        `SELECT body_canonical FROM growth.helios_shadow_lab_sealed_decision
          WHERE campaign_id = $1 ORDER BY recorded_at ASC`,
        [campaignId],
      );
      return Object.freeze(rows.rows.map((row) => JSON.parse(String(row.body_canonical)) as SealedDecisionRecord));
    });
  }

  async getEvidenceHash(decisionId: string): Promise<string | undefined> {
    return withClient(this.pool, async (client) => {
      const row = await client.query(
        `SELECT evidence_hash FROM growth.helios_shadow_lab_decision_evidence WHERE decision_id = $1`,
        [decisionId],
      );
      return (row.rows[0] as { evidence_hash: string } | undefined)?.evidence_hash;
    });
  }

  async getCheckpoint(campaignId: string): Promise<ShadowLabCheckpoint | undefined> {
    return withClient(this.pool, async (client) => {
      const row = await client.query(
        `SELECT body_canonical FROM growth.helios_shadow_lab_evidence_state WHERE campaign_id = $1`,
        [campaignId],
      );
      const body = (row.rows[0] as { body_canonical: string } | undefined)?.body_canonical;
      return body ? (JSON.parse(body) as ShadowLabCheckpoint) : undefined;
    });
  }

  async recordShadowFill(
    fill: ShadowLabShadowFill,
  ): Promise<'OK' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'> {
    if (this.forcedUnavailable) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    try {
      await withClient(this.pool, async (client) => {
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_shadow_fill
             (fill_id, campaign_id, decision_id, body_canonical, filled_at)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            fill.fillId,
            fill.campaignId,
            fill.decisionId,
            JSON.stringify({ ...fill, notionalMinor: fill.notionalMinor.toString() }),
            fill.filledAt,
          ],
        );
      });
      return 'OK';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'DUPLICATE';
      }
      throw error;
    }
  }

  async enqueuePendingOutcome(
    outcome: ShadowLabPendingOutcome,
  ): Promise<'OK' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'> {
    if (this.forcedUnavailable) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    try {
      await withClient(this.pool, async (client) => {
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_pending_outcome
             (outcome_id, decision_id, campaign_id, matures_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5)`,
          [outcome.outcomeId, outcome.decisionId, outcome.campaignId, outcome.maturesAt, JSON.stringify(outcome)],
        );
      });
      return 'OK';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'DUPLICATE';
      }
      throw error;
    }
  }

  async matureOutcome(input: {
    readonly outcome: ShadowLabMaturedOutcome;
    readonly fencingToken: number;
    readonly campaignId: string;
  }): Promise<'OK' | 'LEASE_LOST' | 'DUPLICATE' | 'PERSISTENCE_UNAVAILABLE'> {
    if (this.forcedUnavailable) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
    try {
      await withTxn(this.pool, async (client) => {
        const lease = await client.query(
          `SELECT fencing_token FROM growth.helios_shadow_lab_campaign_lease WHERE campaign_id = $1 FOR UPDATE`,
          [input.campaignId],
        );
        const fencing = Number((lease.rows[0] as { fencing_token: string } | undefined)?.fencing_token ?? 0);
        if (fencing !== input.fencingToken) {
          throw Object.assign(new Error('LEASE_LOST'), { code: 'LEASE_LOST' });
        }
        const o = input.outcome;
        await client.query(
          `INSERT INTO growth.helios_shadow_lab_matured_outcome
             (outcome_id, decision_id, campaign_id, matured_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5)`,
          [o.outcomeId, o.decisionId, o.campaignId, o.maturedAt, JSON.stringify(o)],
        );
        await client.query(`DELETE FROM growth.helios_shadow_lab_pending_outcome WHERE outcome_id = $1`, [
          o.outcomeId.replace(/^smat_/, 'sout_'),
        ]);
      });
      return 'OK';
    } catch (error) {
      if (isUniqueViolation(error)) {
        return 'DUPLICATE';
      }
      if (error instanceof Error && (error as Error & { code?: string }).code === 'LEASE_LOST') {
        return 'LEASE_LOST';
      }
      throw error;
    }
  }

  async listPendingOutcomesReady(now: string): Promise<readonly ShadowLabPendingOutcome[]> {
    return withClient(this.pool, async (client) => {
      const rows = await client.query(
        `SELECT body_canonical FROM growth.helios_shadow_lab_pending_outcome WHERE matures_at <= $1`,
        [now],
      );
      return Object.freeze(rows.rows.map((row) => JSON.parse(String(row.body_canonical)) as ShadowLabPendingOutcome));
    });
  }

  async recordDemotion(input: {
    readonly demotionId: string;
    readonly campaignId: string;
    readonly strategyId: string;
    readonly reason: string;
    readonly at: string;
    readonly fencingToken: number;
  }): Promise<'OK' | 'LEASE_LOST' | 'PERSISTENCE_UNAVAILABLE'> {
    if (this.forcedUnavailable) {
      return 'PERSISTENCE_UNAVAILABLE';
    }
  const result = await withTxn(this.pool, async (client) => {
      const lease = await client.query(
        `SELECT fencing_token FROM growth.helios_shadow_lab_campaign_lease WHERE campaign_id = $1 FOR UPDATE`,
        [input.campaignId],
      );
      const fencing = Number((lease.rows[0] as { fencing_token: string } | undefined)?.fencing_token ?? 0);
      if (fencing !== input.fencingToken) {
        return 'LEASE_LOST' as const;
      }
      await client.query(
        `INSERT INTO growth.helios_shadow_lab_demotion_event
           (demotion_id, campaign_id, strategy_id, body_canonical, demoted_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [input.demotionId, input.campaignId, input.strategyId, JSON.stringify({ reason: input.reason }), input.at],
      );
      return 'OK' as const;
    });
    return result;
  }
}
