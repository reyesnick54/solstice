/**
 * External earnings observation envelopes (provider-neutral, simulation-first).
 */

import type { UtcInstant } from '@solstice/domain';

export const EXTERNAL_EARNINGS_OBSERVATION_SCHEMA = 'sunrey.external.earnings-observation.v1' as const;

export type ExternalEarningsProviderRef = {
  readonly providerId: string;
  readonly feedId: string;
  readonly capability: string;
};

export type ExternalEarningsObservationEnvelope = {
  readonly schema: typeof EXTERNAL_EARNINGS_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly canonicalEntityId: string;
  readonly canonicalInstrumentId: string | null;
  readonly fiscalPeriodLabel: string;
  readonly eventTime: UtcInstant | null;
  readonly publishedTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly revisionId: string | null;
  readonly source: ExternalEarningsProviderRef;
  readonly evidenceRef: string;
  readonly grantsExecutionAuthority: false;
};
