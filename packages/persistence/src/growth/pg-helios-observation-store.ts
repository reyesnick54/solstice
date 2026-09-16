import type { Pool } from 'pg';

import type { HeliosObservationStoreSnapshot } from '../../../platform/src/helios/observation/store.ts';
import type { HeliosMarketObservationEnvelope } from '../../../platform/src/helios/observation/types.ts';
import { withClient } from '../postgres/pools.ts';

export async function persistHeliosObservationState(
  pool: Pool,
  snapshot: HeliosObservationStoreSnapshot,
): Promise<void> {
  await withClient(pool, async (client) => {
    await client.query('BEGIN');
    try {
      for (const envelope of snapshot.observations) {
        await client.query(
          `INSERT INTO growth.helios_market_observation
             (observation_id, provider_id, source_id, canonical_instrument_id, venue,
              observation_type, body_canonical, source_event_time, knowable_at, ingestion_time,
              entitlement_class, freshness_status, quality_state, lineage_id,
              duplicate_event_key, upstream_source_ref, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
           ON CONFLICT (observation_id) DO UPDATE SET
             body_canonical = EXCLUDED.body_canonical,
             freshness_status = EXCLUDED.freshness_status,
             quality_state = EXCLUDED.quality_state`,
          [
            envelope.observationId,
            envelope.providerId,
            envelope.sourceId,
            envelope.canonicalInstrumentId,
            envelope.venue,
            envelope.observationType,
            JSON.stringify(envelope),
            envelope.informationTime.sourceEventTime,
            envelope.informationTime.knowableAt,
            envelope.informationTime.ingestionTime,
            envelope.entitlement.entitlementClass,
            envelope.freshness.status,
            envelope.qualityState,
            envelope.lineage.lineageId,
            envelope.lineage.duplicateEventKey,
            envelope.lineage.upstreamSourceRef,
            envelope.informationTime.ingestionTime,
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

export async function loadHeliosObservationState(pool: Pool): Promise<HeliosObservationStoreSnapshot> {
  return withClient(pool, async (client) => {
    const result = await client.query(
      `SELECT body_canonical FROM growth.helios_market_observation ORDER BY knowable_at ASC`,
    );
    const observations: HeliosMarketObservationEnvelope[] = [];
    const upstreamRefs = new Set<string>();
    const duplicateEventKeys = new Set<string>();
    const lastSequenceByInstrument: Record<string, number> = {};
    const lastSourceEventTimeByInstrument: Record<string, string> = {};

    for (const row of result.rows) {
      const envelope = JSON.parse(row.body_canonical) as HeliosMarketObservationEnvelope;
      observations.push(envelope);
      if (envelope.lineage.upstreamSourceRef) {
        upstreamRefs.add(envelope.lineage.upstreamSourceRef);
      }
      if (envelope.lineage.duplicateEventKey) {
        duplicateEventKeys.add(envelope.lineage.duplicateEventKey);
      }
      if (envelope.sequence !== null) {
        const prior = lastSequenceByInstrument[envelope.canonicalInstrumentId];
        if (prior === undefined || envelope.sequence > prior) {
          lastSequenceByInstrument[envelope.canonicalInstrumentId] = envelope.sequence;
        }
      }
      if (envelope.informationTime.sourceEventTime) {
        lastSourceEventTimeByInstrument[envelope.canonicalInstrumentId] =
          envelope.informationTime.sourceEventTime;
      }
    }

    return Object.freeze({
      observations: Object.freeze(observations),
      deduplication: Object.freeze({ eventKeys: Object.freeze([...duplicateEventKeys]) }),
      upstreamRefs: Object.freeze([...upstreamRefs]),
      duplicateEventKeys: Object.freeze([...duplicateEventKeys]),
      lastSequenceByInstrument: Object.freeze(lastSequenceByInstrument),
      lastSourceEventTimeByInstrument: Object.freeze(lastSourceEventTimeByInstrument),
    });
  });
}
