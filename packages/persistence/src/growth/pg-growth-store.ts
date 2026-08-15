import type { Pool } from 'pg';

import type { GrowthStoreSnapshot } from '../../../platform/src/store.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistGrowthState(pool: Pool, state: GrowthStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const mandate of state.mandates) {
        await client.query(
          `INSERT INTO growth.mandate_version
             (mandate_id, version, subject_id, state, source_text, currency, body_canonical,
              planning_eligible, compiled_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (mandate_id, version) DO UPDATE SET
             state = EXCLUDED.state,
             planning_eligible = EXCLUDED.planning_eligible,
             body_canonical = EXCLUDED.body_canonical`,
          [
            mandate.mandateId,
            mandate.version,
            mandate.subjectId,
            mandate.state,
            mandate.sourceText,
            mandate.currency,
            JSON.stringify(mandate),
            mandate.planningEligible,
            mandate.compiledAt,
          ],
        );
      }
      for (const confirmation of state.confirmations) {
        await client.query(
          `INSERT INTO growth.mandate_confirmation
             (confirmation_id, mandate_id, version, actor_id, subject_id, session_id,
              authentication_assurance, confirmed_at, context_hash, confirmation_hash, high_impact)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (confirmation_id) DO NOTHING`,
          [
            confirmation.confirmationId,
            confirmation.mandateId,
            confirmation.version,
            confirmation.actorId,
            confirmation.subjectId,
            confirmation.sessionId,
            confirmation.authenticationAssurance,
            confirmation.confirmedAt,
            confirmation.contextHash,
            confirmation.confirmationHash,
            confirmation.highImpact,
          ],
        );
      }
      for (const cycle of state.cycles) {
        await client.query(
          `INSERT INTO growth.cycle
             (cycle_id, subject_id, mandate_id, mandate_version, state, created_at, peg_snapshot_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (cycle_id) DO UPDATE SET state = EXCLUDED.state`,
          [
            cycle.cycleId,
            cycle.subjectId,
            cycle.mandateId,
            cycle.mandateVersion,
            cycle.state,
            cycle.createdAt,
            cycle.pegSnapshotId ?? null,
          ],
        );
      }
      for (const plan of state.plans) {
        await client.query(
          `INSERT INTO growth.plan
             (plan_id, version, cycle_id, subject_id, mandate_id, mandate_version, peg_snapshot_id,
              generated_at, planning_version, state, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (plan_id, version) DO UPDATE SET
             state = EXCLUDED.state,
             body_canonical = EXCLUDED.body_canonical`,
          [
            plan.planId,
            plan.version,
            plan.cycleId,
            plan.subjectId,
            plan.mandateId,
            plan.mandateVersion,
            plan.pegSnapshotId,
            plan.generatedAt,
            plan.planningVersion,
            plan.state,
            JSON.stringify(plan),
          ],
        );
        if (plan.state === 'STALE') {
          await client.query(
            `INSERT INTO growth.invalidation (plan_id, plan_version, reason, invalidated_at)
             VALUES ($1,$2,$3,$4)
             ON CONFLICT (plan_id, plan_version) DO NOTHING`,
            [plan.planId, plan.version, 'stale', plan.generatedAt],
          );
        }
        for (const candidate of plan.candidateActions) {
          await client.query(
            `INSERT INTO growth.candidate
               (action_id, plan_id, plan_version, action, execution_capability, body_canonical)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (action_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
            [
              candidate.actionId,
              plan.planId,
              plan.version,
              candidate.action,
              candidate.executionCapability,
              JSON.stringify(candidate),
            ],
          );
        }
        for (const rejected of plan.rejectedCandidates) {
          await client.query(
            `INSERT INTO growth.feasibility (action_id, accepted, deferred, reasons_canonical, detail)
             VALUES ($1, FALSE, FALSE, $2, $3)
             ON CONFLICT (action_id) DO UPDATE SET
               reasons_canonical = EXCLUDED.reasons_canonical,
               detail = EXCLUDED.detail`,
            [rejected.candidate.actionId, JSON.stringify(rejected.reasons), rejected.detail],
          );
        }
      }
      for (const result of state.feasibility) {
        await client.query(
          `INSERT INTO growth.feasibility (action_id, accepted, deferred, reasons_canonical, detail)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (action_id) DO UPDATE SET
             accepted = EXCLUDED.accepted,
             deferred = EXCLUDED.deferred,
             reasons_canonical = EXCLUDED.reasons_canonical,
             detail = EXCLUDED.detail`,
          [result.actionId, result.accepted, result.deferred, JSON.stringify(result.reasons), result.detail],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadGrowthState(pool: Pool): Promise<GrowthStoreSnapshot> {
  return withClient(pool, async (client) => {
    const mandates = await client.query<{ body_canonical: string }>('SELECT body_canonical FROM growth.mandate_version');
    const confirmations = await client.query(
      `SELECT confirmation_id, mandate_id, version, actor_id, subject_id, session_id,
              authentication_assurance, confirmed_at, context_hash, confirmation_hash, high_impact
         FROM growth.mandate_confirmation`,
    );
    const cycles = await client.query(
      `SELECT cycle_id, subject_id, mandate_id, mandate_version, state, created_at, peg_snapshot_id
         FROM growth.cycle`,
    );
    const plans = await client.query<{ body_canonical: string }>('SELECT body_canonical FROM growth.plan');
    const feasibility = await client.query<{
      action_id: string;
      accepted: boolean;
      deferred: boolean;
      reasons_canonical: string;
      detail: string;
    }>('SELECT action_id, accepted, deferred, reasons_canonical, detail FROM growth.feasibility');
    return {
      drafts: Object.freeze([]),
      mandates: Object.freeze(mandates.rows.map((row) => JSON.parse(row.body_canonical))),
      confirmations: Object.freeze(
        confirmations.rows.map((row) => ({
          confirmationId: row.confirmation_id,
          mandateId: row.mandate_id,
          version: row.version,
          actorId: row.actor_id,
          subjectId: row.subject_id,
          sessionId: row.session_id,
          authenticationAssurance: row.authentication_assurance,
          confirmedAt: row.confirmed_at instanceof Date ? row.confirmed_at.toISOString() : row.confirmed_at,
          contextHash: row.context_hash,
          confirmationHash: row.confirmation_hash,
          highImpact: row.high_impact,
          stepUpRequired: false,
          stepUpSatisfied: true,
        })),
      ),
      cycles: Object.freeze(
        cycles.rows.map((row) => ({
          cycleId: row.cycle_id,
          subjectId: row.subject_id,
          mandateId: row.mandate_id,
          mandateVersion: row.mandate_version,
          state: row.state,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
          ...(row.peg_snapshot_id ? { pegSnapshotId: row.peg_snapshot_id } : {}),
        })),
      ),
      plans: Object.freeze(plans.rows.map((row) => JSON.parse(row.body_canonical))),
      feasibility: Object.freeze(
        feasibility.rows.map((row) => ({
          actionId: row.action_id,
          accepted: row.accepted,
          deferred: row.deferred,
          reasons: JSON.parse(row.reasons_canonical),
          detail: row.detail,
        })),
      ),
    } as unknown as GrowthStoreSnapshot;
  });
}
