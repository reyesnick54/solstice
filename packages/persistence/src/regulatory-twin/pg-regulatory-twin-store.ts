import type { Pool } from 'pg';

import { asUtcInstant } from '../../../domain/src/time.ts';
import type { RegulatoryTwinStoreSnapshot } from '../../../regulatory-twin/src/store.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistRegulatoryTwinState(
  pool: Pool,
  state: RegulatoryTwinStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const twin of state.twins) {
        await client.query(
          `INSERT INTO regulatory_twin.twin (twin_id, created_at, label)
           VALUES ($1,$2,$3)
           ON CONFLICT (twin_id) DO UPDATE SET label = EXCLUDED.label`,
          [twin.twinId, twin.createdAt, twin.label],
        );
      }
      for (const snapshot of state.snapshots) {
        await client.query(
          `INSERT INTO regulatory_twin.snapshot
             (snapshot_id, twin_id, captured_at, effective_at, content_hash, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (snapshot_id) DO NOTHING`,
          [
            snapshot.snapshotId,
            snapshot.twinId,
            snapshot.capturedAt,
            snapshot.effectiveAt,
            snapshot.contentHash,
            JSON.stringify(snapshot),
          ],
        );
      }
      for (const scenario of state.scenarios) {
        await client.query(
          `INSERT INTO regulatory_twin.scenario
             (scenario_id, suite_id, name, category, created_at, invariant, subject_ref, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (scenario_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [
            scenario.scenarioId,
            scenario.suiteId ?? null,
            scenario.name,
            scenario.category,
            scenario.createdAt,
            scenario.invariant,
            scenario.subjectRef ?? null,
            JSON.stringify(scenario),
          ],
        );
      }
      for (const suite of state.suites) {
        await client.query(
          `INSERT INTO regulatory_twin.suite
             (suite_id, name, category, invariant, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (suite_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [suite.suiteId, suite.name, suite.category, suite.invariant, suite.createdAt, JSON.stringify(suite)],
        );
      }
      for (const candidate of state.candidates) {
        await client.query(
          `INSERT INTO regulatory_twin.candidate_set
             (candidate_set_id, label, created_at, legal_review_status, notes, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (candidate_set_id) DO UPDATE SET notes = EXCLUDED.notes`,
          [
            candidate.candidateSetId,
            candidate.label,
            candidate.createdAt,
            candidate.legalReviewStatus,
            candidate.notes,
            JSON.stringify(candidate),
          ],
        );
      }
      for (const assumption of state.assumptions) {
        await client.query(
          `INSERT INTO regulatory_twin.assumption
             (assumption_id, jurisdiction, subject, proposition, legal_review_status,
              created_at, owner_ref, reviewer_ref, superseded_by, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (assumption_id) DO UPDATE SET
             legal_review_status = EXCLUDED.legal_review_status,
             superseded_by = EXCLUDED.superseded_by`,
          [
            assumption.assumptionId,
            assumption.jurisdiction,
            assumption.subject,
            assumption.proposition,
            assumption.legalReviewStatus,
            assumption.createdAt,
            assumption.ownerRef,
            assumption.reviewerRef ?? null,
            assumption.supersededBy ?? null,
            JSON.stringify(assumption),
          ],
        );
      }
      for (const report of state.reports) {
        await client.query(
          `INSERT INTO regulatory_twin.impact_report
             (report_id, twin_id, baseline_snapshot_id, candidate_set_id, suite_id, generated_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (report_id) DO NOTHING`,
          [
            report.reportId,
            report.twinId,
            report.baselineSnapshotId,
            report.candidateSetId,
            report.suiteId,
            report.generatedAt,
            JSON.stringify(report),
          ],
        );
      }
      for (const assessment of state.assessments) {
        await client.query(
          `INSERT INTO regulatory_twin.readiness_assessment
             (assessment_id, kind, subject, jurisdiction, state, assessed_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (assessment_id) DO NOTHING`,
          [
            assessment.assessmentId,
            assessment.kind,
            assessment.subject,
            assessment.jurisdiction,
            assessment.state,
            assessment.assessedAt,
            JSON.stringify(assessment),
          ],
        );
      }
      for (const disposition of state.dispositions) {
        await client.query(
          `INSERT INTO regulatory_twin.disposition
             (review_id, assessment_id, disposition, decided_by_kind, decided_by_ref, decided_at, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (review_id) DO NOTHING`,
          [
            disposition.reviewId,
            disposition.assessmentId,
            disposition.disposition,
            disposition.decidedByKind,
            disposition.decidedByRef,
            disposition.decidedAt,
            disposition.notes,
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

export async function loadRegulatoryTwinState(pool: Pool): Promise<RegulatoryTwinStoreSnapshot> {
  const twins = await pool.query(`SELECT twin_id, created_at, label FROM regulatory_twin.twin`);
  const snapshots = await pool.query(`SELECT body_canonical FROM regulatory_twin.snapshot`);
  const scenarios = await pool.query(`SELECT body_canonical FROM regulatory_twin.scenario`);
  const suites = await pool.query(`SELECT body_canonical FROM regulatory_twin.suite`);
  const candidates = await pool.query(`SELECT body_canonical FROM regulatory_twin.candidate_set`);
  const assumptions = await pool.query(`SELECT body_canonical FROM regulatory_twin.assumption`);
  const reports = await pool.query(`SELECT body_canonical FROM regulatory_twin.impact_report`);
  const assessments = await pool.query(`SELECT body_canonical FROM regulatory_twin.readiness_assessment`);
  const dispositions = await pool.query(
    `SELECT review_id, assessment_id, disposition, decided_by_kind, decided_by_ref, decided_at, notes
     FROM regulatory_twin.disposition`,
  );
  return Object.freeze({
    twins: Object.freeze(
      twins.rows.map((row) =>
        Object.freeze({
          twinId: row.twin_id,
          createdAt: asUtcInstant(new Date(row.created_at).toISOString()),
          label: row.label,
        }),
      ),
    ),
    snapshots: Object.freeze(snapshots.rows.map((row) => JSON.parse(row.body_canonical))),
    scenarios: Object.freeze(scenarios.rows.map((row) => JSON.parse(row.body_canonical))),
    suites: Object.freeze(suites.rows.map((row) => JSON.parse(row.body_canonical))),
    candidates: Object.freeze(candidates.rows.map((row) => JSON.parse(row.body_canonical))),
    assumptions: Object.freeze(assumptions.rows.map((row) => JSON.parse(row.body_canonical))),
    reports: Object.freeze(reports.rows.map((row) => JSON.parse(row.body_canonical))),
    assessments: Object.freeze(assessments.rows.map((row) => JSON.parse(row.body_canonical))),
    dispositions: Object.freeze(
      dispositions.rows.map((row) =>
        Object.freeze({
          reviewId: row.review_id,
          assessmentId: row.assessment_id,
          disposition: row.disposition,
          decidedByKind: row.decided_by_kind,
          decidedByRef: row.decided_by_ref,
          decidedAt: asUtcInstant(new Date(row.decided_at).toISOString()),
          notes: row.notes,
          legalStatusUnchanged: true as const,
        }),
      ),
    ),
  });
}
