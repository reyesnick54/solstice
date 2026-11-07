import type { RevisionLedgerEntry } from '../revision-ledger/types.ts';
import type { TemporalObservation } from '../temporal-types.ts';
import type { AlternativeDataObservation } from '../../alternative-data-intelligence/types.ts';
import { HELIOS_AAF06_REVISION_LEDGER_SCHEMA } from '../revision-ledger/types.ts';

export function alternativeDataObservationToTemporalObservation(
  observation: AlternativeDataObservation,
): TemporalObservation {
  return Object.freeze({
    observationRef: observation.observationId,
    kind: 'ALT_DATA',
    entityId: observation.entityLink.canonicalEntityId ?? 'entity.unresolved',
    instrumentId: observation.entityLink.canonicalInstrumentId,
    sourceEventTime: observation.eventTime ?? observation.knowableAt,
    knowableAt: observation.knowableAt,
    validUntil: null,
    revisionSequence: 0,
    periodEnd: observation.eventTime,
    publishedKnowableAt: observation.knowableAt,
    valueMinor: observation.valueMinor ?? 0n,
    metadata: Object.freeze({
      signalFamily: observation.signalFamily,
      providerId: observation.providerId,
      revisionId: observation.revisionId,
      licenseClass: observation.licenseClass,
      entitlementRef: observation.entitlementRef,
      entityLinkConfidence:
        observation.entityLink.entityLinkConfidence === null
          ? 'null'
          : String(observation.entityLink.entityLinkConfidence),
      qualityState: observation.qualityState,
      geographicCoverage: observation.geographicCoverage.regionCodes.join(','),
    }),
  });
}

export function alternativeDataObservationToRevisionLedgerEntry(
  observation: AlternativeDataObservation,
): RevisionLedgerEntry {
  const eventPeriod = (observation.eventTime ?? observation.knowableAt).slice(0, 7);
  const lineageId = `lineage.alt.${observation.seriesId}.${observation.revisionId}`;
  const valueMinor = observation.valueMinor ?? 0n;
  return Object.freeze({
    schemaVersion: HELIOS_AAF06_REVISION_LEDGER_SCHEMA,
    revisionChainId: `chain.alt.${observation.seriesId}`,
    observationRef: observation.observationId,
    revisionSequence: 0,
    eventPeriod,
    periodEnd: observation.eventTime,
    originalPublicationTime: observation.providerAvailableAt,
    revisionPublicationTime: observation.knowableAt,
    knowableAt: observation.knowableAt,
    supersedesObservationRef: null,
    supersededByObservationRef: null,
    valueMinor,
    valueDecimal: observation.valueText ?? (Number(valueMinor) / 100).toFixed(4),
    source: observation.providerId,
    evidence: `evidence:${observation.observationId}`,
    provider: observation.providerId,
    lineage: Object.freeze({
      lineageId,
      parentLineageIds: Object.freeze([]),
      contentFingerprint: lineageId,
    }),
    revisionKind: 'INITIAL_RELEASE',
    evidenceRef: null,
    sourceProvider: observation.providerId,
    grantsExecutionAuthority: false as const,
  });
}
