import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { AdmissibleEvidenceRecord, EvidenceRegistryPort } from './types.ts';

export const SIMULATION_EVIDENCE_REGISTRY: readonly AdmissibleEvidenceRecord[] = Object.freeze([
  Object.freeze({
    evidenceRef: 'ev_external_market_obs_001',
    sourceKind: 'EXTERNAL_OBSERVATION',
    provenanceId: 'prov_market_data_sim_v1',
    observedAt: '2026-09-15T13:55:00.000Z' as UtcInstant,
    arrivedAt: '2026-09-15T13:55:30.000Z' as UtcInstant,
    entitlementScope: 'PUBLIC',
    freshnessHorizonSeconds: 3600,
    dataQualityOk: true,
    unresolvedQualityFailures: Object.freeze([]),
  }),
  Object.freeze({
    evidenceRef: 'ev_external_market_obs_stale',
    sourceKind: 'EXTERNAL_OBSERVATION',
    provenanceId: 'prov_market_data_sim_v1',
    observedAt: '2026-09-01T00:00:00.000Z' as UtcInstant,
    arrivedAt: '2026-09-01T00:01:00.000Z' as UtcInstant,
    entitlementScope: 'PUBLIC',
    freshnessHorizonSeconds: 3600,
    dataQualityOk: true,
    unresolvedQualityFailures: Object.freeze([]),
  }),
  Object.freeze({
    evidenceRef: 'ev_fixture_internal_001',
    sourceKind: 'FIXTURE',
    provenanceId: 'fixture_lab_only',
    observedAt: '2026-09-15T13:55:00.000Z' as UtcInstant,
    arrivedAt: '2026-09-15T13:55:00.000Z' as UtcInstant,
    entitlementScope: 'PUBLIC',
    freshnessHorizonSeconds: 86400,
    dataQualityOk: true,
    unresolvedQualityFailures: Object.freeze([]),
  }),
  Object.freeze({
    evidenceRef: 'ev_customer_private_001',
    sourceKind: 'PEG_DERIVED',
    provenanceId: 'peg_snapshot_v1',
    observedAt: '2026-09-15T13:50:00.000Z' as UtcInstant,
    arrivedAt: '2026-09-15T13:50:10.000Z' as UtcInstant,
    entitlementScope: 'SUBJECT',
    subjectId: 'id_a',
    freshnessHorizonSeconds: 7200,
    dataQualityOk: true,
    unresolvedQualityFailures: Object.freeze([]),
  }),
  Object.freeze({
    evidenceRef: 'ev_entitlement_restricted',
    sourceKind: 'MARKET_DATA',
    provenanceId: 'prov_market_data_sim_v1',
    observedAt: '2026-09-15T13:55:00.000Z' as UtcInstant,
    arrivedAt: '2026-09-15T13:55:30.000Z' as UtcInstant,
    entitlementScope: 'CUSTOMER',
    customerId: 'cust_a',
    freshnessHorizonSeconds: 3600,
    dataQualityOk: true,
    unresolvedQualityFailures: Object.freeze([]),
  }),
  Object.freeze({
    evidenceRef: 'ev_data_quality_failed',
    sourceKind: 'EXTERNAL_OBSERVATION',
    provenanceId: 'prov_market_data_sim_v1',
    observedAt: '2026-09-15T13:55:00.000Z' as UtcInstant,
    arrivedAt: '2026-09-15T13:55:30.000Z' as UtcInstant,
    entitlementScope: 'PUBLIC',
    freshnessHorizonSeconds: 3600,
    dataQualityOk: false,
    unresolvedQualityFailures: Object.freeze(['missing_timestamp', 'source_gap']),
  }),
  Object.freeze({
    evidenceRef: 'ev_fixture_masquerade',
    sourceKind: 'EXTERNAL_OBSERVATION',
    provenanceId: 'fixture_lab_only',
    observedAt: '2026-09-15T13:55:00.000Z' as UtcInstant,
    arrivedAt: '2026-09-15T13:55:00.000Z' as UtcInstant,
    entitlementScope: 'PUBLIC',
    freshnessHorizonSeconds: 3600,
    dataQualityOk: true,
    unresolvedQualityFailures: Object.freeze([]),
  }),
]);

export function createEvidenceRegistry(
  records: readonly AdmissibleEvidenceRecord[] = SIMULATION_EVIDENCE_REGISTRY,
): EvidenceRegistryPort {
  const byRef = new Map(records.map((row) => [row.evidenceRef, row]));
  return Object.freeze({
    resolve(ref: string): AdmissibleEvidenceRecord | null {
      return byRef.get(ref) ?? null;
    },
  });
}
