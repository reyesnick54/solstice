import type { Pool } from 'pg';

import type { ModelRegistrySnapshot } from '../../../model-registry/src/types.ts';
import { withClient } from '../postgres/pools.ts';

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item));
}

export async function persistModelRegistryState(pool: Pool, state: ModelRegistrySnapshot): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const model of state.models) {
        await client.query(
          `INSERT INTO model_registry.artifact
             (artifact_ref, sha256, kind, description, simulation_only)
           VALUES ($1,$2,$3,$4,TRUE)
           ON CONFLICT (artifact_ref) DO NOTHING`,
          [model.artifact.reference, model.artifact.sha256, model.artifact.kind, model.artifact.description],
        );
        await client.query(
          `INSERT INTO model_registry.model_version
             (model_id, version, type, description, owner, input_schema, output_schema, determinism,
              artifact_ref, configuration_canonical, created_at, lifecycle, applicable_domain,
              simulation_only, live_approved, body_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE,FALSE,$14)
           ON CONFLICT (model_id, version) DO UPDATE SET
             lifecycle = EXCLUDED.lifecycle,
             body_canonical = EXCLUDED.body_canonical`,
          [
            model.modelId,
            model.version,
            model.type,
            model.description,
            model.owner,
            model.inputSchema,
            model.outputSchema,
            model.determinism,
            model.artifact.reference,
            model.configurationCanonical,
            model.createdAt,
            model.lifecycle,
            model.applicableDomain,
            canonicalJson(model),
          ],
        );
      }
      for (const validation of state.validations) {
        await client.query(
          `INSERT INTO model_registry.validation
             (validation_id, model_id, version, status, reviewer, reviewer_kind, timestamp,
              claims_real_world_performance, body_canonical)
           VALUES ($1,$2,$3,$4,$5,'HUMAN_OPERATOR',$6,FALSE,$7)
           ON CONFLICT (validation_id) DO NOTHING`,
          [
            validation.validationId,
            validation.modelId,
            validation.version,
            validation.status,
            validation.reviewer,
            validation.timestamp,
            canonicalJson(validation),
          ],
        );
      }
      for (const approval of state.approvals) {
        await client.query(
          `INSERT INTO model_registry.approval
             (model_id, version, actor_id, subject_id, session_id, actor_kind, reason, approved_at)
           VALUES ($1,$2,$3,$4,$5,'HUMAN_OPERATOR',$6,$7)
           ON CONFLICT DO NOTHING`,
          [
            approval.modelId,
            approval.version,
            approval.actorId,
            approval.subjectId,
            approval.sessionId,
            approval.reason,
            approval.approvedAt,
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
