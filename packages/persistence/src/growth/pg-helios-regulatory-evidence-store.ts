import type { Pool } from 'pg';

import type { RegulatoryEvidenceStoreSnapshot } from '../../../platform/src/helios/regulatory-evidence/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistRegulatoryEvidenceState(
  pool: Pool,
  state: RegulatoryEvidenceStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const pkg of state.packages) {
        await client.query(
          `INSERT INTO growth.helios_regulatory_evidence_package
             (package_id, trace_id, customer_id, work_order_id, package_version,
              package_hash, reportability, reporting_status, body_canonical, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (package_id) DO NOTHING`,
          [
            pkg.packageId,
            pkg.traceId,
            pkg.customerScope.customerId,
            pkg.workOrderId,
            pkg.packageVersion,
            pkg.packageHash,
            pkg.reportabilityDetermination,
            pkg.reportingStatus,
            JSON.stringify(pkg),
            pkg.createdAt,
          ],
        );
      }

      for (const obligation of state.obligations) {
        await client.query(
          `INSERT INTO growth.helios_reporting_obligation
             (obligation_id, trace_id, package_id, policy_obligation_ref,
              submission_state, body_canonical, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (obligation_id) DO UPDATE SET
             submission_state = EXCLUDED.submission_state,
             body_canonical = EXCLUDED.body_canonical,
             updated_at = EXCLUDED.updated_at`,
          [
            obligation.obligationId,
            obligation.traceId,
            obligation.packageId,
            obligation.policyObligationRef,
            obligation.submissionState,
            JSON.stringify(obligation),
            obligation.createdAt,
            obligation.updatedAt,
          ],
        );
      }

      for (const report of state.reportPackages) {
        await client.query(
          `INSERT INTO growth.helios_regulatory_report_package
             (report_package_id, obligation_id, trace_id, revision,
              submission_state, package_hash, body_canonical, generated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (report_package_id) DO UPDATE SET
             submission_state = EXCLUDED.submission_state,
             body_canonical = EXCLUDED.body_canonical`,
          [
            report.reportPackageId,
            report.obligationId,
            report.traceId,
            report.revision,
            report.submissionState,
            report.packageHash,
            JSON.stringify(report),
            report.generatedAt,
          ],
        );
      }

      for (const trigger of state.triggers) {
        await client.query(
          `INSERT INTO growth.helios_regulatory_idempotency (idempotency_key)
           VALUES ($1)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [trigger.idempotencyKey],
        );
      }

      for (const key of state.processedIdempotencyKeys) {
        await client.query(
          `INSERT INTO growth.helios_regulatory_idempotency (idempotency_key)
           VALUES ($1)
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [key],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });
}

export async function loadRegulatoryEvidenceState(pool: Pool): Promise<RegulatoryEvidenceStoreSnapshot> {
  return withClient(pool, async (client) => {
    const packages = await client.query(
      `SELECT body_canonical FROM growth.helios_regulatory_evidence_package ORDER BY created_at ASC`,
    );
    const obligations = await client.query(
      `SELECT body_canonical FROM growth.helios_reporting_obligation ORDER BY created_at ASC`,
    );
    const reports = await client.query(
      `SELECT body_canonical FROM growth.helios_regulatory_report_package ORDER BY generated_at ASC`,
    );
    const idempotency = await client.query(
      `SELECT idempotency_key FROM growth.helios_regulatory_idempotency ORDER BY processed_at ASC`,
    );

    return Object.freeze({
      packages: Object.freeze(packages.rows.map((row) => JSON.parse(row.body_canonical))),
      obligations: Object.freeze(obligations.rows.map((row) => JSON.parse(row.body_canonical))),
      reportPackages: Object.freeze(reports.rows.map((row) => JSON.parse(row.body_canonical))),
      submissions: Object.freeze([]),
      triggers: Object.freeze([]),
      processedIdempotencyKeys: Object.freeze(idempotency.rows.map((row) => row.idempotency_key as string)),
    });
  });
}
