/**
 * Map SEC EDGAR GuidanceObservation into external earnings guidance envelopes.
 */

import type { GuidanceObservation } from '../sec-fundamentals/types.ts';
import type { ExternalEarningsObservationEnvelope } from './types.ts';
import { EXTERNAL_EARNINGS_OBSERVATION_SCHEMA } from './types.ts';

export function mapSecGuidanceToExternalEarningsEnvelope(
  observation: GuidanceObservation,
): ExternalEarningsObservationEnvelope {
  return Object.freeze({
    schema: EXTERNAL_EARNINGS_OBSERVATION_SCHEMA,
    observationId: `sec.guidance.${observation.filingId}.${observation.metric}`,
    canonicalEntityId: observation.canonicalEntityId,
    canonicalInstrumentId: null,
    fiscalPeriodLabel: observation.fiscalPeriod,
    eventTime: observation.publishedAtUtc,
    publishedTime: observation.publishedAtUtc,
    providerAvailabilityTime: observation.publishedAtUtc ?? observation.knowableAt,
    sunreyArrivalTime: observation.knowableAt,
    knowableAt: observation.knowableAt,
    revisionId: observation.amendmentLineage.kind === 'amendment' ? observation.filingId : null,
    source: Object.freeze({
      providerId: 'sec.edgar',
      feedId: 'fundamentals',
      capability: 'sec-fundamentals.guidance',
    }),
    evidenceRef: observation.evidenceRef,
    grantsExecutionAuthority: false,
  });
}
