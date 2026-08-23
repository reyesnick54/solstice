import type { Pool } from 'pg';

import type { PersonalDataVaultStoreSnapshot } from '../../../personal-data-vault/src/types.ts';
import type { ProductVaultSnapshot } from '../../../personal-data-vault/src/product/service.ts';
import type { VaultCorrectionRequest } from '../../../personal-data-vault/src/product/correction.ts';
import { withClient } from '../postgres/pools.ts';

export type PersistableVaultState = PersonalDataVaultStoreSnapshot & {
  readonly recordMetadata?: ProductVaultSnapshot['recordMetadata'];
  readonly corrections?: ProductVaultSnapshot['corrections'];
  readonly exportJobs?: ProductVaultSnapshot['exportJobs'];
  readonly agentCategories?: ProductVaultSnapshot['agentCategories'];
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

function correctionBody(row: VaultCorrectionRequest): string {
  return canonicalJson({
    correctionId: row.correctionId,
    dataRecordId: row.dataRecordId,
    subjectId: row.subjectId,
    kind: row.kind,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt,
    outcome: row.outcome,
    proposedPayloadPresent: row.proposedPayload !== null && row.proposedPayload !== undefined,
  });
}

export async function persistPersonalDataVaultState(
  pool: Pool,
  state: PersistableVaultState,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const vault of state.vaults) {
        await client.query(
          `INSERT INTO personal_data_vault.vault
             (vault_id, subject_id, customer_id, created_at, kek_key_id, kek_version,
              subject_key_handle_canonical, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (vault_id) DO UPDATE SET body_canonical = EXCLUDED.body_canonical`,
          [
            vault.vaultId,
            vault.subjectId,
            vault.customerId,
            vault.createdAt,
            vault.kekKeyId,
            vault.kekVersion,
            canonicalJson(vault.subjectKeyHandle),
            canonicalJson(vault),
          ],
        );
      }
      for (const asset of state.assets) {
        await client.query(
          `INSERT INTO personal_data_vault.asset
             (asset_id, vault_id, subject_id, category, schema_id, schema_version, source_id,
              sensitivity, current_version_id, current_payload_id, content_sha256, lifecycle,
              contribution_mark, authoritative_for_financial_state, financial_balance, token_balance,
              expected_version, created_at, observed_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,FALSE,NULL,NULL,$14,$15,$16,$17)
           ON CONFLICT (asset_id) DO UPDATE SET
             lifecycle = EXCLUDED.lifecycle,
             current_version_id = EXCLUDED.current_version_id,
             current_payload_id = EXCLUDED.current_payload_id,
             content_sha256 = EXCLUDED.content_sha256,
             body_canonical = EXCLUDED.body_canonical`,
          [
            asset.assetId,
            asset.vaultId,
            asset.subjectId,
            asset.category,
            asset.schemaId,
            asset.schemaVersion,
            asset.sourceId,
            asset.sensitivity,
            asset.currentVersionId,
            asset.currentPayloadId,
            asset.contentSha256,
            asset.lifecycle,
            asset.contributionMark,
            asset.expectedVersion,
            asset.createdAt,
            asset.observedAt,
            canonicalJson(asset),
          ],
        );
      }
      for (const version of state.versions) {
        await client.query(
          `INSERT INTO personal_data_vault.asset_version
             (version_id, asset_id, subject_id, sequence, payload_id, content_sha256, state,
              kek_version, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (version_id) DO UPDATE SET
             state = EXCLUDED.state,
             payload_id = EXCLUDED.payload_id,
             body_canonical = EXCLUDED.body_canonical`,
          [
            version.versionId,
            version.assetId,
            version.subjectId,
            version.sequence,
            version.payloadId,
            version.contentSha256,
            version.state,
            version.kekVersion,
            version.createdAt,
            canonicalJson(version),
          ],
        );
      }
      for (const payload of state.payloads) {
        await client.query(
          `INSERT INTO personal_data_vault.payload
             (payload_id, content_sha256, byte_length, shredded, envelope_canonical)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (payload_id) DO UPDATE SET
             shredded = EXCLUDED.shredded,
             envelope_canonical = EXCLUDED.envelope_canonical`,
          [
            payload.payloadId,
            payload.contentSha256,
            payload.byteLength,
            payload.shredded,
            canonicalJson(payload.envelope),
          ],
        );
      }
      for (const ingestion of state.ingestions) {
        await client.query(
          `INSERT INTO personal_data_vault.ingestion
             (ingestion_id, asset_id, subject_id, source_id, source_record_ref, idempotency_key,
              source_revision, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (ingestion_id) DO NOTHING`,
          [
            ingestion.ingestionId,
            ingestion.assetId,
            ingestion.subjectId,
            ingestion.sourceId,
            ingestion.sourceRecordRef,
            ingestion.idempotencyKey,
            ingestion.sourceRevision,
            ingestion.createdAt,
            canonicalJson(ingestion),
          ],
        );
      }
      for (const derivation of state.derivations) {
        await client.query(
          `INSERT INTO personal_data_vault.derivation
             (derivation_id, output_asset_id, method, method_version, created_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (derivation_id) DO NOTHING`,
          [
            derivation.derivationId,
            derivation.outputAssetId,
            derivation.method,
            derivation.methodVersion,
            derivation.createdAt,
            canonicalJson(derivation),
          ],
        );
      }
      for (const access of state.access) {
        await client.query(
          `INSERT INTO personal_data_vault.access_audit
             (access_id, actor_id, subject_id, asset_id, operation, purpose_ref, decision, reason,
              occurred_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (access_id) DO NOTHING`,
          [
            access.accessId,
            access.actorId,
            access.subjectId,
            access.assetId,
            access.operation,
            access.purposeRef,
            access.decision,
            access.reason,
            access.occurredAt,
            canonicalJson(access),
          ],
        );
      }
      for (const exported of state.exports) {
        await client.query(
          `INSERT INTO personal_data_vault.export_manifest
             (export_id, subject_id, generated_at, manifest_sha256, legal_portability_claim, body_canonical)
           VALUES ($1,$2,$3,$4,FALSE,$5)
           ON CONFLICT (export_id) DO NOTHING`,
          [
            exported.exportId,
            exported.subjectId,
            exported.generatedAt,
            exported.manifestSha256,
            canonicalJson(exported),
          ],
        );
      }
      for (const meta of state.recordMetadata ?? []) {
        await client.query(
          `INSERT INTO personal_data_vault.record_metadata
             (asset_id, subject_id, registry_category, data_kind, verification_state,
              consent_reference, disputed, object_ref, change_reason, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (asset_id) DO UPDATE SET
             registry_category = EXCLUDED.registry_category,
             data_kind = EXCLUDED.data_kind,
             verification_state = EXCLUDED.verification_state,
             disputed = EXCLUDED.disputed,
             object_ref = EXCLUDED.object_ref,
             change_reason = EXCLUDED.change_reason,
             body_canonical = EXCLUDED.body_canonical`,
          [
            meta.assetId,
            state.assets.find((row) => row.assetId === meta.assetId)?.subjectId ?? 'unknown',
            meta.registryCategory,
            meta.dataKind,
            meta.verificationState,
            meta.consentReference,
            meta.disputed,
            meta.objectRef,
            meta.changeReason,
            canonicalJson(meta),
          ],
        );
      }
      for (const correction of state.corrections ?? []) {
        await client.query(
          `INSERT INTO personal_data_vault.correction
             (correction_id, asset_id, subject_id, kind, status, requested_at, resolved_at,
              proposed_payload_present, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (correction_id) DO UPDATE SET
             status = EXCLUDED.status,
             resolved_at = EXCLUDED.resolved_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            correction.correctionId,
            correction.dataRecordId,
            correction.subjectId,
            correction.kind,
            correction.status,
            correction.requestedAt,
            correction.resolvedAt,
            correction.proposedPayload !== null && correction.proposedPayload !== undefined,
            correctionBody(correction),
          ],
        );
      }
      for (const job of state.exportJobs ?? []) {
        await client.query(
          `INSERT INTO personal_data_vault.export_job
             (export_id, subject_id, status, requested_at, completed_at, manifest_sha256,
              record_count, legal_portability_claim, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8)
           ON CONFLICT (export_id) DO UPDATE SET
             status = EXCLUDED.status,
             completed_at = EXCLUDED.completed_at,
             manifest_sha256 = EXCLUDED.manifest_sha256,
             record_count = EXCLUDED.record_count,
             body_canonical = EXCLUDED.body_canonical`,
          [
            job.exportId,
            job.subjectId,
            job.status,
            job.requestedAt,
            job.completedAt,
            job.manifestSha256,
            job.recordCount,
            canonicalJson(job),
          ],
        );
      }
      for (const row of state.agentCategories ?? []) {
        for (const categoryId of row.categories) {
          await client.query(
            `INSERT INTO personal_data_vault.agent_category (subject_id, category_id)
             VALUES ($1,$2)
             ON CONFLICT (subject_id, category_id) DO NOTHING`,
            [row.subjectId, categoryId],
          );
        }
      }
      for (const deletion of state.deletions) {
        await client.query(
          `INSERT INTO personal_data_vault.deletion_request
             (request_id, asset_id, subject_id, requested_at, outcome, policy_id, policy_source,
              completed_at, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (request_id) DO UPDATE SET
             completed_at = EXCLUDED.completed_at,
             body_canonical = EXCLUDED.body_canonical`,
          [
            deletion.requestId,
            deletion.assetId,
            deletion.subjectId,
            deletion.requestedAt,
            deletion.outcome,
            deletion.policyId,
            deletion.policySource,
            deletion.completedAt,
            canonicalJson(deletion),
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

export async function loadPersonalDataVaultState(pool: Pool): Promise<PersistableVaultState> {
  return withClient(pool, async (client) => {
    const vaults = await client.query('SELECT body_canonical FROM personal_data_vault.vault');
    const assets = await client.query('SELECT body_canonical FROM personal_data_vault.asset');
    const versions = await client.query('SELECT body_canonical FROM personal_data_vault.asset_version');
    const payloads = await client.query(
      'SELECT payload_id, content_sha256, byte_length, shredded, envelope_canonical FROM personal_data_vault.payload',
    );
    const ingestions = await client.query('SELECT body_canonical FROM personal_data_vault.ingestion');
    const derivations = await client.query('SELECT body_canonical FROM personal_data_vault.derivation');
    const access = await client.query('SELECT body_canonical FROM personal_data_vault.access_audit');
    const exports = await client.query('SELECT body_canonical FROM personal_data_vault.export_manifest');
    const deletions = await client.query('SELECT body_canonical FROM personal_data_vault.deletion_request');
    const metadata = await client.query('SELECT body_canonical FROM personal_data_vault.record_metadata').catch(() => ({
      rows: [],
    }));
    const corrections = await client.query('SELECT body_canonical FROM personal_data_vault.correction').catch(() => ({
      rows: [],
    }));
    const exportJobs = await client.query('SELECT body_canonical FROM personal_data_vault.export_job').catch(() => ({
      rows: [],
    }));
    const agentCategories = await client
      .query('SELECT subject_id, category_id FROM personal_data_vault.agent_category')
      .catch(() => ({ rows: [] }));
    const agentMap = new Map<string, string[]>();
    for (const row of agentCategories.rows as { subject_id: string; category_id: string }[]) {
      const current = agentMap.get(row.subject_id) ?? [];
      current.push(row.category_id);
      agentMap.set(row.subject_id, current);
    }
    return Object.freeze({
      vaults: Object.freeze(vaults.rows.map((row) => JSON.parse(row.body_canonical))),
      assets: Object.freeze(assets.rows.map((row) => JSON.parse(row.body_canonical))),
      versions: Object.freeze(versions.rows.map((row) => JSON.parse(row.body_canonical))),
      ingestions: Object.freeze(ingestions.rows.map((row) => JSON.parse(row.body_canonical))),
      access: Object.freeze(access.rows.map((row) => JSON.parse(row.body_canonical))),
      derivations: Object.freeze(derivations.rows.map((row) => JSON.parse(row.body_canonical))),
      exports: Object.freeze(exports.rows.map((row) => JSON.parse(row.body_canonical))),
      deletions: Object.freeze(deletions.rows.map((row) => JSON.parse(row.body_canonical))),
      payloads: Object.freeze(
        payloads.rows.map((row) =>
          Object.freeze({
            payloadId: row.payload_id,
            contentSha256: row.content_sha256,
            byteLength: row.byte_length,
            shredded: row.shredded,
            envelope: JSON.parse(row.envelope_canonical),
          }),
        ),
      ),
      recordMetadata: Object.freeze(metadata.rows.map((row) => JSON.parse(row.body_canonical))),
      corrections: Object.freeze(corrections.rows.map((row) => JSON.parse(row.body_canonical))),
      exportJobs: Object.freeze(exportJobs.rows.map((row) => JSON.parse(row.body_canonical))),
      agentCategories: Object.freeze(
        [...agentMap.entries()].map(([subjectId, categories]) => Object.freeze({ subjectId, categories })),
      ),
    });
  });
}
