/**
 * AAF04 — temporal observation shapes for point-in-time compilation.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';

export const TEMPORAL_OBSERVATION_KINDS = [
  'MARKET_BAR',
  'CORPORATE_FILING',
  'FINANCIAL_STATEMENT_FACT',
  'MACRO_RELEASE',
  'SCHEDULED_EVENT',
  'REFERENCE_METADATA',
  'ALT_DATA',
  'UNIVERSE_MEMBERSHIP',
  'CORPORATE_ACTION',
] as const;

export type TemporalObservationKind = (typeof TEMPORAL_OBSERVATION_KINDS)[number];

export type RevisionPolicy = 'LATEST_KNOWABLE_REVISION' | 'INITIAL_PUBLICATION_ONLY';

export type MissingnessPolicy = 'FAIL_CLOSED' | 'NULL_IF_MISSING';

export type TemporalObservation = {
  readonly observationRef: string;
  readonly kind: TemporalObservationKind;
  readonly entityId: string;
  readonly instrumentId: string | null;
  readonly sourceEventTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly validUntil: UtcInstant | null;
  readonly revisionSequence: number;
  readonly periodEnd: UtcInstant | null;
  readonly publishedKnowableAt: UtcInstant | null;
  readonly valueMinor: bigint;
  readonly metadata: Readonly<Record<string, string>>;
};

export const FEATURE_COMPUTE_KINDS = [
  'AS_OF_SCALAR',
  'LAGGED',
  'ROLLING_SUM',
  'CROSS_SECTIONAL_RANK',
] as const;

export type FeatureComputeKind = (typeof FEATURE_COMPUTE_KINDS)[number];

export type TemporalFeatureDefinition = {
  readonly featureId: string;
  readonly version: string;
  readonly computeKind: FeatureComputeKind;
  readonly observationKind: TemporalObservationKind;
  readonly entityId?: string;
  readonly instrumentId?: string;
  readonly lagPeriods?: number;
  readonly rollingWindow?: number;
  readonly crossSectionField?: string;
};

export type UniverseMembershipRow = {
  readonly instrumentId: string;
  readonly indexId: string;
  readonly enteredKnowableAt: UtcInstant;
  readonly leftKnowableAt: UtcInstant | null;
};

export type TickerSymbolRow = {
  readonly entityId: string;
  readonly instrumentId: string;
  readonly symbol: string;
  readonly effectiveKnowableAt: UtcInstant;
};

export type CorporateActionRevisionRow = {
  readonly instrumentId: string;
  readonly actionId: string;
  readonly revisionSequence: number;
  readonly knowableAt: UtcInstant;
  readonly valueMinor: bigint;
};
