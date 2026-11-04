/**
 * EARN01 — canonical earnings intelligence domain types.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  EarningsAnnouncementState,
  EarningsObservationKind,
  EarningsSessionClassification,
  HELIOS_EARNINGS_INTELLIGENCE_AUTHORITY,
  HELIOS_EARNINGS_INTELLIGENCE_SCHEMA,
} from './taxonomy.ts';
import type { EarningsFiscalPeriod, EarningsTemporalEnvelope } from './temporal-envelope.ts';

export type { EarningsFiscalPeriod } from './temporal-envelope.ts';

export type EarningsEventId = string & { readonly __brand: 'EarningsEventId' };

export function asEarningsEventId(value: string): EarningsEventId {
  if (!value.trim()) {
    throw new Error('EarningsEventId required');
  }
  return value as EarningsEventId;
}

export type EarningsEvent = EarningsTemporalEnvelope & {
  readonly schema: typeof HELIOS_EARNINGS_INTELLIGENCE_SCHEMA;
  readonly authority: typeof HELIOS_EARNINGS_INTELLIGENCE_AUTHORITY;
  readonly eventId: EarningsEventId;
  readonly announcementState: EarningsAnnouncementState;
  readonly sessionClassification: EarningsSessionClassification;
  readonly scheduledReleaseTime: UtcInstant | null;
  readonly confirmedReleaseTime: UtcInstant | null;
  readonly earningsCallScheduledTime: UtcInstant | null;
  readonly earningsCallCompletedTime: UtcInstant | null;
  readonly grantsExecutionAuthority: false;
  readonly grantsFinancialMutation: false;
};

export type EarningsMetricValue = {
  readonly metricId: string;
  readonly unit: string;
  readonly valueMinor: bigint | null;
  readonly valueText: string | null;
};

export type EarningsReleaseObservation = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'release'>;
  readonly observationId: string;
  readonly eventId: EarningsEventId;
  readonly headline: string | null;
  readonly releaseChannel: string | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsActualObservation = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'actual'>;
  readonly observationId: string;
  readonly eventId: EarningsEventId;
  readonly metrics: readonly EarningsMetricValue[];
  readonly grantsExecutionAuthority: false;
};

export type EarningsExpectationSnapshot = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'expectation'>;
  readonly snapshotId: string;
  readonly eventId: EarningsEventId;
  readonly metrics: readonly EarningsMetricValue[];
  readonly asOfPolicy: 'point_in_time' | 'latest_knowable';
  readonly grantsExecutionAuthority: false;
};

export type EarningsConsensusSnapshot = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'consensus'>;
  readonly snapshotId: string;
  readonly eventId: EarningsEventId;
  readonly metrics: readonly EarningsMetricValue[];
  readonly analystCount: number | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsGuidanceSnapshot = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'guidance'>;
  readonly snapshotId: string;
  readonly eventId: EarningsEventId;
  readonly metric: string;
  readonly guidanceLowMinor: bigint | null;
  readonly guidanceHighMinor: bigint | null;
  readonly guidanceText: string | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsTranscriptObservation = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'transcript'>;
  readonly observationId: string;
  readonly eventId: EarningsEventId;
  readonly transcriptRef: string;
  readonly language: string;
  readonly grantsExecutionAuthority: false;
};

export type EarningsOptionsSnapshot = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'options'>;
  readonly snapshotId: string;
  readonly eventId: EarningsEventId;
  readonly impliedMoveBps: bigint | null;
  readonly putCallSkewBps: bigint | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsMarketReaction = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'market_reaction'>;
  readonly reactionId: string;
  readonly eventId: EarningsEventId;
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
  readonly priceChangeBps: bigint | null;
  readonly volumeMultiple: string | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsPeerContext = EarningsTemporalEnvelope & {
  readonly observationKind: Extract<EarningsObservationKind, 'peer_context'>;
  readonly contextId: string;
  readonly eventId: EarningsEventId;
  readonly peerEntityIds: readonly string[];
  readonly peerInstrumentIds: readonly string[];
  readonly relativeSurpriseRank: number | null;
  readonly grantsExecutionAuthority: false;
};

export type EarningsIntelligenceArtifact =
  | EarningsEvent
  | EarningsReleaseObservation
  | EarningsActualObservation
  | EarningsExpectationSnapshot
  | EarningsConsensusSnapshot
  | EarningsGuidanceSnapshot
  | EarningsTranscriptObservation
  | EarningsOptionsSnapshot
  | EarningsMarketReaction
  | EarningsPeerContext;

export type EarningsIntelligenceManifest = {
  readonly schema: typeof HELIOS_EARNINGS_INTELLIGENCE_SCHEMA;
  readonly manifestId: string;
  readonly compiledAt: UtcInstant;
  readonly evaluationTime: UtcInstant;
  readonly events: readonly EarningsEvent[];
  readonly observations: readonly Exclude<EarningsIntelligenceArtifact, EarningsEvent>[];
  readonly grantsExecutionAuthority: false;
};

export type EarningsIntelligenceStoreSnapshot = {
  readonly events: readonly EarningsEvent[];
  readonly observations: readonly Exclude<EarningsIntelligenceArtifact, EarningsEvent>[];
};
