/**
 * External earnings observation envelopes (provider-neutral, simulation-first).
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  EarningsArtifactKind,
  EarningsProviderKind,
  EarningsSessionTiming,
  Sec8kItem,
  SecEarningsForm,
} from './taxonomy.ts';

export const EXTERNAL_EARNINGS_OBSERVATION_SCHEMA = 'sunrey.external.earnings-observation.v1' as const;

export type ExternalEarningsProviderRef = {
  readonly providerId: string;
  readonly feedId: string;
  readonly capability: string;
};

/** EARN01 — lightweight guidance / calendar envelope. */
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

export type EarningsFiscalIdentity = {
  readonly fiscalYear: number;
  readonly fiscalQuarter: 1 | 2 | 3 | 4 | null;
  readonly reportPeriod: string;
  readonly fiscalPeriodLabel: string;
};

export type EarningsEventTimeBundle = {
  readonly scheduledEventTime: UtcInstant | null;
  readonly confirmedEventTime: UtcInstant | null;
  readonly actualReleaseTime: UtcInstant | null;
  readonly secAcceptedTime: UtcInstant | null;
  readonly callStartTime: UtcInstant | null;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
};

export type EarningsObservationProvenance = {
  readonly providerId: string;
  readonly providerKind: EarningsProviderKind;
  readonly sourceId: string;
  readonly evidenceRef: string;
  readonly rawPayloadHash: string;
  readonly dedupeKey: string;
};

/** EARN02 — full lifecycle earnings event observation. */
export type EarningsExternalObservation = {
  readonly schema: typeof EXTERNAL_EARNINGS_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly canonicalEntityId: string;
  readonly earningsEventKey: string;
  readonly artifactKind: EarningsArtifactKind;
  readonly fiscal: EarningsFiscalIdentity;
  readonly times: EarningsEventTimeBundle;
  readonly sessionTiming: EarningsSessionTiming;
  readonly provenance: EarningsObservationProvenance;
  readonly lineageRootId: string;
  readonly supersedesObservationId: string | null;
  readonly rescheduledFromEventKey: string | null;
  readonly secForm: SecEarningsForm | null;
  readonly sec8kItem: Sec8kItem | null;
  readonly accessionNumber: string | null;
  readonly filingId: string | null;
  readonly payload: Readonly<Record<string, string>>;
  readonly grantsExecutionAuthority: false;
};

export type IngestEarningsObservationInput = Omit<
  EarningsExternalObservation,
  'schema' | 'grantsExecutionAuthority'
>;

export type IngestEarningsObservationResult =
  | { readonly ok: true; readonly observation: EarningsExternalObservation; readonly deduplicated: boolean }
  | { readonly ok: false; readonly reason: string };
