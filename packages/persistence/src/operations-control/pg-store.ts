import type { Pool } from 'pg';

import type { OperationsSnapshot } from '../../../kernel/src/operations/store.ts';
import { EMPTY_OPERATIONS_SNAPSHOT } from '../../../kernel/src/operations/store.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistOperationsSnapshot(pool: Pool, snapshot: OperationsSnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO operations.snapshot (snapshot_id, body_canonical, sealed_at)
         VALUES ('current', $1, NOW())
         ON CONFLICT (snapshot_id) DO UPDATE SET
           body_canonical = EXCLUDED.body_canonical,
           sealed_at = EXCLUDED.sealed_at`,
        [JSON.stringify(snapshot)],
      );
      for (const row of snapshot.cases) {
        await client.query(
          `INSERT INTO operations.case_record (
             case_id, domain, case_type, subject_ref, severity, status, source,
             owner_ref, queue, specialized_case_id, investigator_id, created_at, updated_at, body_canonical
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (case_id) DO UPDATE SET
             status = EXCLUDED.status,
             owner_ref = EXCLUDED.owner_ref,
             investigator_id = EXCLUDED.investigator_id,
             updated_at = EXCLUDED.updated_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            row.caseId,
            row.domain,
            row.type,
            row.subject,
            row.severity,
            row.status,
            row.source,
            row.owner,
            row.queue,
            row.specializedCaseId,
            row.investigatorId,
            row.createdAt,
            row.updatedAt,
            JSON.stringify(row),
          ],
        );
        for (const approval of row.approvals) {
          await client.query(
            `INSERT INTO operations.approval (
               approval_id, case_id, action, requester_id, approver_id, status, reason, created_at, decided_at
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (approval_id) DO UPDATE SET
               status = EXCLUDED.status,
               approver_id = EXCLUDED.approver_id,
               decided_at = EXCLUDED.decided_at`,
            [
              approval.approvalId,
              row.caseId,
              approval.action,
              approval.requesterId,
              approval.approverId,
              approval.status,
              approval.reason,
              approval.createdAt,
              approval.decidedAt,
            ],
          );
        }
        for (const note of row.notes) {
          await client.query(
            `INSERT INTO operations.note (note_id, case_id, author_id, body, created_at)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (note_id) DO NOTHING`,
            [note.noteId, row.caseId, note.authorId, note.body, note.createdAt],
          );
        }
      }
      for (const row of snapshot.actions) {
        await client.query(
          `INSERT INTO operations.operator_action (
             action_id, operator_id, action, reason, case_id, subject_ref, evidence_id, outcome, created_at, body_canonical
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (action_id) DO NOTHING`,
          [
            row.actionId,
            row.operatorId,
            row.action,
            row.reason,
            row.caseId,
            row.subjectRef,
            row.evidenceId,
            row.outcome,
            row.createdAt,
            JSON.stringify(row),
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadOperationsSnapshot(pool: Pool): Promise<OperationsSnapshot> {
  const result = await pool.query<{ body_canonical: string }>(
    `SELECT body_canonical FROM operations.snapshot WHERE snapshot_id = 'current'`,
  );
  const raw = result.rows[0]?.body_canonical;
  if (!raw) {
    return EMPTY_OPERATIONS_SNAPSHOT;
  }
  const parsed = JSON.parse(raw) as OperationsSnapshot;
  return Object.freeze({
    ...EMPTY_OPERATIONS_SNAPSHOT,
    ...parsed,
    cases: Object.freeze(
      (parsed.cases ?? []).map((row) =>
        Object.freeze({
          ...row,
          createdAt: asUtcInstant(row.createdAt),
          updatedAt: asUtcInstant(row.updatedAt),
        }),
      ),
    ),
    actions: Object.freeze(
      (parsed.actions ?? []).map((row) =>
        Object.freeze({
          ...row,
          createdAt: asUtcInstant(row.createdAt),
        }),
      ),
    ),
  });
}
