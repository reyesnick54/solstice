import type { Pool } from 'pg';

import type {
  PolicyVersionRecord,
  RegulatoryChangeRequest,
  RegulatoryTransparencyStoreSnapshot,
  SupervisoryExportPackage,
  SupervisoryExportRequest,
} from '../../../platform/src/helios/regulatory-transparency/types.ts';
import type { PolicyVersionRef } from '../../../platform/src/helios/regulatory-transparency/ids.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistRegulatoryTransparencyState(
  pool: Pool,
  state: RegulatoryTransparencyStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const request of state.exportRequests) {
        await client.query(
          `INSERT INTO growth.helios_supervisory_export_request
             (export_request_id, export_mode, approval_state, body_canonical, created_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (export_request_id) DO NOTHING`,
          [
            request.exportRequestId,
            request.exportMode,
            request.approvalState,
            JSON.stringify(request),
            request.createdAt,
          ],
        );
      }
      for (const pkg of state.exportPackages) {
        await client.query(
          `INSERT INTO growth.helios_supervisory_export_package
             (package_id, export_request_id, package_hash, body_canonical, generated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (package_id) DO NOTHING`,
          [
            pkg.packageId,
            pkg.exportRequestId,
            pkg.packageHash,
            JSON.stringify(pkg),
            pkg.manifest.generatedAt,
          ],
        );
      }
      for (const request of state.changeRequests) {
        await client.query(
          `INSERT INTO growth.helios_regulatory_change_request
             (change_request_id, state, body_canonical, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (change_request_id) DO NOTHING`,
          [
            request.changeRequestId,
            request.state,
            JSON.stringify(request),
            request.createdAt,
            request.updatedAt,
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

export async function loadRegulatoryTransparencyState(
  pool: Pool,
): Promise<RegulatoryTransparencyStoreSnapshot> {
  return withClient(pool, async (client) => {
    const exportRequests = await client.query(
      `SELECT body_canonical FROM growth.helios_supervisory_export_request ORDER BY created_at ASC`,
    );
    const exportPackages = await client.query(
      `SELECT body_canonical FROM growth.helios_supervisory_export_package ORDER BY generated_at ASC`,
    );
    const changeRequests = await client.query(
      `SELECT body_canonical FROM growth.helios_regulatory_change_request ORDER BY created_at ASC`,
    );

    const parsedRequests = exportRequests.rows.map(
      (row) => JSON.parse(row.body_canonical) as SupervisoryExportRequest,
    );
    const parsedPackages = exportPackages.rows.map(
      (row) => JSON.parse(row.body_canonical) as SupervisoryExportPackage,
    );
    const parsedChanges = changeRequests.rows.map(
      (row) => JSON.parse(row.body_canonical) as RegulatoryChangeRequest,
    );

    const policyVersions = parsedChanges.flatMap((request) =>
      request.proposedPolicyVersion ? [request.proposedPolicyVersion] : [],
    ) as PolicyVersionRecord[];
    const activatedVersionRefs = parsedChanges
      .filter((request) => request.state === 'ACTIVATED' && request.proposedPolicyVersion)
      .map((request) => request.proposedPolicyVersion!.versionRef as PolicyVersionRef);

    const snapshot: RegulatoryTransparencyStoreSnapshot = Object.freeze({
      exportRequests: Object.freeze(parsedRequests),
      exportPackages: Object.freeze(parsedPackages),
      changeRequests: Object.freeze(parsedChanges),
      policyVersions: Object.freeze(policyVersions),
      activatedVersionRefs: Object.freeze(activatedVersionRefs),
      scheduledActivations: Object.freeze([]),
    });
    return snapshot;
  });
}
