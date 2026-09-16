/**
 * H08 — HELIOS canonical market observation envelope.
 *
 * Composes provider-sdk ExternalObservation with provenance, information-time,
 * freshness, entitlement, lineage, and quality semantics.
 * Does not grant Execution Authority or authorize financial execution.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  CommercialUseStatus,
  ExternalObservation,
  FreshnessStatus,
  RedistributionStatus,
} from '../../../../provider-sdk/src/types.ts';
import type { FreshnessAssessment } from '../../../../provider-sdk/src/freshness.ts';
import type {
  CanonicalTrustResult,
  ConfidenceBand,
  TrustResultStatus,
} from '../../../../provider-sdk/src/trust/types.ts';

export const HELIOS_MARKET_OBSERVATION_SCHEMA = 'sunrey.helios.market-observation.v1' as const;

export const OBSERVATION_TYPES = [
  'tick',
  'quote',
  'daily_price',
  'corporate_filing',
  'economic_release',
  'reference_metadata',
  'other',
] as const;
export type ObservationType = (typeof OBSERVATION_TYPES)[number];

export const FEED_DELAY_CLASSIFICATIONS = [
  'real_time',
  'delayed',
  'end_of_day',
  'unknown',
] as const;
export type FeedDelayClassification = (typeof FEED_DELAY_CLASSIFICATIONS)[number];

export const ENTITLEMENT_CLASSES = [
  'provider_feed_real_time',
  'provider_feed_delayed',
  'provider_feed_eod',
  'sandbox_test',
  'internal_use',
  'redistribution_restricted',
  'commercial_restricted',
  'unavailable',
  'unknown',
] as const;
export type EntitlementClass = (typeof ENTITLEMENT_CLASSES)[number];

export const QUALITY_STATES = [
  'VALID',
  'DEGRADED_STALE',
  'DEGRADED_GAP',
  'DEGRADED_OUTLIER',
  'DEGRADED_CONTRADICTORY',
  'DEGRADED_ENTITLEMENT',
  'DEGRADED_MALFORMED',
  'DEGRADED_DUPLICATE',
  'DEGRADED_SEQUENCE',
  'UNAVAILABLE',
] as const;
export type QualityState = (typeof QUALITY_STATES)[number];

export const GAP_STATES = ['NONE', 'DETECTED', 'UNKNOWN'] as const;
export type GapState = (typeof GAP_STATES)[number];

export const OUTLIER_STATES = ['NONE', 'OUTLIER', 'SUSPECTED', 'UNKNOWN'] as const;
export type OutlierState = (typeof OUTLIER_STATES)[number];

export const SOURCE_INDEPENDENCE = [
  'INDEPENDENT',
  'SHARED_UPSTREAM',
  'DUPLICATE',
  'UNKNOWN',
] as const;
export type SourceIndependence = (typeof SOURCE_INDEPENDENCE)[number];

export const QUALITY_FLAG_CODES = [
  'STALENESS',
  'TIMESTAMP_REVERSAL',
  'MISSING_SEQUENCE',
  'DUPLICATE_OBSERVATION',
  'GAP_DETECTED',
  'EXTREME_OUTLIER',
  'CONTRADICTORY_STATE',
  'INVALID_INSTRUMENT',
  'ENTITLEMENT_UNAVAILABLE',
  'ENTITLEMENT_UNKNOWN',
  'MALFORMED_PAYLOAD',
  'PROVIDER_UNAVAILABLE',
  'SHARED_UPSTREAM_SOURCE',
] as const;
export type QualityFlagCode = (typeof QUALITY_FLAG_CODES)[number];

export type QualityFlag = {
  readonly code: QualityFlagCode;
  readonly message: string;
};

/** Information-time semantics — separates event time from knowability. */
export type InformationTime = {
  /** When the underlying market/economic event occurred. */
  readonly sourceEventTime: UtcInstant | null;
  /** When the provider published the observation, if known. */
  readonly sourcePublishedTime: UtcInstant | null;
  /** When the provider made the data available on the feed, if known. */
  readonly providerAvailabilityTime: UtcInstant | null;
  /** When SunRey first received the observation from the provider adapter. */
  readonly sunreyArrivalTime: UtcInstant;
  /** When HELIOS normalized and sealed the observation envelope. */
  readonly ingestionTime: UtcInstant;
  /**
   * Earliest UTC instant at which SunRey could have known this observation.
   * Derived from availability/arrival — never earlier than provider delay permits.
   */
  readonly knowableAt: UtcInstant;
};

export type ObservationEntitlement = {
  readonly entitlementClass: EntitlementClass;
  readonly commercialUseStatus: CommercialUseStatus;
  readonly redistributionStatus: RedistributionStatus;
  readonly feedDelayClassification: FeedDelayClassification;
  /** True when entitlement is explicitly unavailable — observation must not be used as unrestricted. */
  readonly unavailable: boolean;
};

export type ObservationLineageRecord = {
  readonly lineageId: string;
  readonly parentLineageIds: readonly string[];
  readonly upstreamSourceRef: string | null;
  readonly sourceFamily: string | null;
  readonly duplicateEventKey: string | null;
};

export type HeliosFreshnessAssessment = FreshnessAssessment & {
  readonly policyId: string;
  readonly staleAfter: UtcInstant | null;
  readonly observationType: ObservationType;
};

export type TrustIntegrationRef = {
  readonly trustPolicyProfile: string;
  readonly trustPolicyVersion: string;
  readonly status: TrustResultStatus;
  readonly confidenceBand: ConfidenceBand;
  readonly grantsExecutionAuthority: false;
};

/** Canonical HELIOS market observation envelope for downstream consumers. */
export type HeliosMarketObservationEnvelope = {
  readonly schemaVersion: typeof HELIOS_MARKET_OBSERVATION_SCHEMA;
  readonly observationId: string;
  readonly providerId: string;
  readonly sourceId: string;
  readonly canonicalInstrumentId: string;
  readonly venue: string | null;
  readonly observationType: ObservationType;
  readonly observation: ExternalObservation<unknown>;
  readonly informationTime: InformationTime;
  readonly sequence: number | null;
  readonly version: string | null;
  readonly lineage: ObservationLineageRecord;
  readonly entitlement: ObservationEntitlement;
  readonly freshness: HeliosFreshnessAssessment;
  readonly qualityState: QualityState;
  readonly gapState: GapState;
  readonly outlierState: OutlierState;
  readonly corroborationRefs: readonly string[];
  readonly sourceIndependence: SourceIndependence;
  readonly qualityFlags: readonly QualityFlag[];
  readonly trustRef: TrustIntegrationRef | null;
};

export type IngestObservationInput<T> = {
  readonly observation: ExternalObservation<T>;
  readonly sourceId: string;
  readonly canonicalInstrumentId: string;
  readonly venue?: string | null;
  readonly observationType: ObservationType;
  readonly informationTime?: Partial<{
    readonly sourceEventTime: UtcInstant | null;
    readonly sourcePublishedTime: UtcInstant | null;
    readonly providerAvailabilityTime: UtcInstant | null;
    readonly sunreyArrivalTime: UtcInstant;
    readonly ingestionTime: UtcInstant;
  }>;
  readonly sequence?: number | null;
  readonly version?: string | null;
  readonly lineage?: Partial<ObservationLineageRecord>;
  readonly entitlement?: Partial<ObservationEntitlement>;
  readonly feedDelayClassification?: FeedDelayClassification;
  readonly corroborationRefs?: readonly string[];
  readonly trustResult?: CanonicalTrustResult<T> | null;
};

export type IngestObservationResult<T> =
  | { readonly ok: true; readonly envelope: HeliosMarketObservationEnvelope; readonly duplicate: boolean }
  | { readonly ok: false; readonly code: string; readonly message: string };
