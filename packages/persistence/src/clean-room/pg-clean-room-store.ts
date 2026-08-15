import type { Pool } from 'pg';

import type { CleanRoomStoreSnapshot } from '../../../clean-room/src/types.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export async function persistCleanRoomState(pool: Pool, state: CleanRoomStoreSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const session of state.sessions) {
        await client.query(
          `INSERT INTO clean_room.session
             (session_id, requester_id, recipient_id, purpose_id, purpose_version, status,
              created_at, expires_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (session_id) DO UPDATE SET
             status = EXCLUDED.status,
             body_canonical = EXCLUDED.body_canonical`,
          [
            session.sessionId,
            session.requesterId,
            session.recipientId,
            session.purposeId,
            session.purposeVersion,
            session.status,
            session.createdAt,
            session.expiresAt,
            canonicalJson(session),
          ],
        );
      }
      for (const job of state.jobs) {
        await client.query(
          `INSERT INTO clean_room.job
             (job_id, session_id, template_id, template_version, status, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (job_id) DO UPDATE SET
             status = EXCLUDED.status,
             body_canonical = EXCLUDED.body_canonical`,
          [job.jobId, job.sessionId, job.templateId, job.templateVersion, job.status, job.createdAt, canonicalJson(job)],
        );
      }
      for (const budget of state.budgets) {
        await client.query(
          `INSERT INTO clean_room.query_budget
             (session_id, requester_id, purpose_id, queries_used, expires_at, differential_privacy, body_canonical)
           VALUES ($1,$2,$3,$4,$5,'DIFFERENTIAL_PRIVACY_NOT_IMPLEMENTED',$6)
           ON CONFLICT (session_id) DO UPDATE SET
             queries_used = EXCLUDED.queries_used,
             body_canonical = EXCLUDED.body_canonical`,
          [
            budget.sessionId,
            budget.requesterId,
            budget.purposeId,
            budget.queriesUsed,
            budget.expiresAt,
            canonicalJson(budget),
          ],
        );
      }
      for (const row of state.egress) {
        await client.query(
          `INSERT INTO clean_room.egress_decision
             (decision_id, job_id, decision, reason_code, occurred_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (decision_id) DO NOTHING`,
          [row.decisionId, row.jobId, row.decision, row.reasonCode, row.occurredAt, canonicalJson(row)],
        );
      }
      for (const receipt of state.receipts) {
        await client.query(
          `INSERT INTO clean_room.receipt
             (receipt_id, session_id, job_id, requester_id, result_hash, generated_at,
              raw_input_included, immutable, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,FALSE,TRUE,$7)
           ON CONFLICT (receipt_id) DO NOTHING`,
          [
            receipt.receiptId,
            receipt.sessionId,
            receipt.jobId,
            receipt.requesterId,
            receipt.resultHash,
            receipt.generatedAt,
            canonicalJson(receipt),
          ],
        );
      }
      for (const ref of state.contributions) {
        await client.query(
          `INSERT INTO clean_room.contribution_ref
             (contribution_id, subject_id, receipt_id, purpose_id, coin_issued,
              market_price_assigned, settled_earnings, body_canonical)
           VALUES ($1,$2,$3,$4,FALSE,FALSE,FALSE,$5)
           ON CONFLICT (contribution_id) DO NOTHING`,
          [ref.contributionId, ref.subjectId, ref.receiptId, ref.purposeId, canonicalJson(ref)],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}
