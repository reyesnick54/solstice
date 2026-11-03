import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { IngestMacroEventInput } from '../../multi-asset/event-intelligence/types.ts';
import type { MacroOfficialReleaseEvent } from './types.ts';

const DOMAIN_BY_RELEASE: Record<MacroOfficialReleaseEvent['releaseType'], IngestMacroEventInput['domain']> = {
  cpi_release: 'inflation_release',
  employment_release: 'employment_release',
  gdp_release: 'gdp_economic_data',
  central_bank_policy_decision: 'central_bank_decision',
  official_release: 'treasury_rate_event',
};

export function macroReleaseToM14IngestInput(
  event: MacroOfficialReleaseEvent,
  asOf: UtcInstant,
): IngestMacroEventInput {
  const actual = event.initialReportedValue;
  return Object.freeze({
    eventId: `m14.bridge.${event.eventId}`,
    eventType: event.actualPublicationTime ? 'observed_release' : 'scheduled_event',
    domain: DOMAIN_BY_RELEASE[event.releaseType],
    title: `AAF10 ${event.releaseType} ${event.periodRepresented}`,
    description: `Point-in-time macro release for ${event.seriesKey}`,
    jurisdiction: 'US',
    region: 'North America',
    affectedAssetClasses: Object.freeze(['equity', 'bond', 'fx']),
    affectedInstrumentIds: Object.freeze([]),
    scheduledTime: event.scheduledReleaseTime,
    observedTime: event.actualPublicationTime,
    arrivalTime: event.sunreyArrivalTime,
    knowableAt: event.knowableAt,
    source: event.source.providerId,
    provenance: Object.freeze({
      providerId: 'aaf10-macro-intelligence',
      sourceId: event.source.seriesId,
      sourceUrl: null,
      rawPayloadHash: event.revisionChainId,
      upstreamSourceRef: event.eventId,
      ingestionId: `aaf10_${event.eventId}`,
    }),
    confidence: 'HIGH',
    expectedValues: Object.freeze([]),
    actualValues: Object.freeze([
      Object.freeze({
        metricId: event.seriesKey,
        unit: 'minor',
        valueMinorUnits: actual.valueMinor,
        valueText: actual.valueMinor.toString(),
        layer: 'source_fact',
        sourceId: event.source.providerId,
        knowableAt: actual.knowableAt,
      }),
    ]),
    evidenceRefs: Object.freeze(
      event.evidenceRefs.map((evidenceId) =>
        Object.freeze({
          evidenceId,
          layer: 'source_fact',
          sourceId: event.source.providerId,
          arrivalTime: event.sunreyArrivalTime,
          knowableAt: event.knowableAt,
          excerptHash: null,
        }),
      ),
    ),
    relevanceWindow: Object.freeze({
      preEventMinutes: 60,
      postEventMinutes: 240,
      expiresAt: asOf,
    }),
    knowledgeLayer: 'source_fact',
  });
}
