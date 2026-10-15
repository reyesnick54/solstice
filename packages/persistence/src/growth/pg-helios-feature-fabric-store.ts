import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

import type { HeliosFeatureFabricStoreSnapshot } from '../../../platform/src/helios/feature-fabric/store.ts';
import type { FeatureManifest, FeatureObservation } from '../../../platform/src/helios/feature-fabric/types.ts';
import { persistenceJsonStringify } from '../json.ts';
import { withClient } from '../postgres/pools.ts';

function evidenceRefHash(observation: FeatureObservation): string | null {
  if (observation.evidenceRefs.length === 0) {
    return null;
  }
  return createHash('sha256').update(observation.evidenceRefs.join('|')).digest('hex');
}

export async function persistHeliosFeatureFabricState(
  pool: Pool,
  snapshot: HeliosFeatureFabricStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const observation of snapshot.observations) {
        await client.query(
          `INSERT INTO growth.helios_feature_observation
             (feature_observation_id, feature_id, feature_version, revision_id,
              canonical_entity_id, canonical_instrument_id, knowable_at, computed_at,
              event_time, lineage_id, transformation_version, evidence_ref_hash, body_canonical, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (feature_observation_id) DO NOTHING`,
          [
            observation.featureObservationId,
            observation.featureId,
            observation.featureVersion,
            observation.revisionId,
            observation.canonicalEntityId,
            observation.canonicalInstrumentId,
            observation.knowableAt,
            observation.computedAt,
            observation.eventTime,
            observation.lineage.lineageId,
            observation.transformationVersion,
            evidenceRefHash(observation),
            persistenceJsonStringify(observation),
            observation.computedAt,
          ],
        );
      }
      for (const manifest of snapshot.manifests) {
        await client.query(
          `INSERT INTO growth.helios_feature_manifest
             (manifest_id, evaluation_timestamp, body_canonical, created_at)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (manifest_id) DO NOTHING`,
          [
            manifest.manifestId,
            manifest.evaluationTimestamp,
            persistenceJsonStringify(manifest),
            manifest.evaluationTimestamp,
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

export async function loadHeliosFeatureFabricState(pool: Pool): Promise<HeliosFeatureFabricStoreSnapshot> {
  return withClient(pool, async (client) => {
    const obsRows = await client.query(
      `SELECT body_canonical FROM growth.helios_feature_observation ORDER BY knowable_at ASC`,
    );
    const manifestRows = await client.query(
      `SELECT body_canonical FROM growth.helios_feature_manifest ORDER BY evaluation_timestamp ASC`,
    );
    const observations = obsRows.rows.map(
      (row) => JSON.parse(String(row.body_canonical)) as FeatureObservation,
    );
    const manifests = manifestRows.rows.map(
      (row) => JSON.parse(String(row.body_canonical)) as FeatureManifest,
    );
    const definitionByKey = new Map<string, import('../../../platform/src/helios/feature-fabric/types.ts').FeatureDefinition>();
    for (const manifest of manifests) {
      for (const definition of manifest.featureDefinitions) {
        definitionByKey.set(`${definition.featureId}@${definition.featureVersion}`, definition);
      }
    }
    return Object.freeze({
      definitions: Object.freeze([...definitionByKey.values()]),
      observations: Object.freeze(observations),
      manifests: Object.freeze(manifests),
    });
  });
}
