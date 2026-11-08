import type { UtcInstant } from '@solstice/domain';
import type { CanonicalMarketDataEvent } from '@solstice/provider-sdk';

import type {
  HELIOS_ALPHA03_PREQUENTIAL_SCHEMA,
  PrequentialDataSourceKind,
  PrequentialLoopPhase,
  PrequentialPredictedLabel,
} from './taxonomy.ts';

export type PrequentialDecisionSeal = Readonly<{
  readonly sealedAt: UtcInstant;
  readonly contentHash: string;
}>;

export type PrequentialDecision = Readonly<{
  readonly schema: typeof HELIOS_ALPHA03_PREQUENTIAL_SCHEMA;
  readonly decisionId: string;
  readonly campaignId: string;
  readonly decisionTime: UtcInstant;
  readonly predictedLabel: PrequentialPredictedLabel;
  /** Mid price at decision in minor units (string). */
  readonly predictedReferenceMidMinor: string;
  readonly instrumentId: string;
  readonly contextDigest: string;
  readonly observationEventIdsAtDecision: readonly string[];
  readonly outcomeHorizonMs: number;
  readonly seal: PrequentialDecisionSeal;
  readonly outcome: PrequentialOutcome | null;
  readonly score: PrequentialScore | null;
  readonly modelVersion: string;
  readonly immutableAfterSeal: true;
  readonly grantsExecutionAuthority: false;
}>;

export type PrequentialOutcome = Readonly<{
  readonly observedAt: UtcInstant;
  readonly horizonEnd: UtcInstant;
  readonly realizedMidMinor: string;
  readonly observationEventIdsAtOutcome: readonly string[];
}>;

export type PrequentialScore = Readonly<{
  readonly scoredAt: UtcInstant;
  readonly signedErrorBps: number;
  readonly directionHit: boolean;
  readonly scoringRuleId: 'mid_direction_v1';
}>;

export type PrequentialModelUpdateRecord = Readonly<{
  readonly appliedAt: UtcInstant;
  readonly priorModelVersion: string;
  readonly nextModelVersion: string;
  readonly triggerDecisionId: string;
  readonly predeclared: true;
}>;

export type PrequentialState = Readonly<{
  readonly schema: typeof HELIOS_ALPHA03_PREQUENTIAL_SCHEMA;
  readonly campaignId: string;
  readonly dataSource: PrequentialDataSourceKind;
  /** True only for MD15 live-shadow chronological campaigns with verified read-only provider posture. */
  readonly forwardAlphaEvidenceEligible: boolean;
  readonly onlineLearningEnabled: boolean;
  readonly modelVersion: string;
  readonly startedAt: UtcInstant;
  readonly observationRef: string;
  readonly instrumentId: string;
  readonly decisions: readonly PrequentialDecision[];
  readonly modelUpdates: readonly PrequentialModelUpdateRecord[];
  readonly lastLoopPhase: PrequentialLoopPhase | null;
  readonly grantsExecutionAuthority: false;
}>;

export type PrequentialChronologicalObservation = Readonly<{
  readonly event: CanonicalMarketDataEvent;
  readonly chronologicalIndex: number;
}>;

export type PrequentialCampaignConfig = Readonly<{
  readonly campaignId: string;
  readonly dataSource: PrequentialDataSourceKind;
  readonly forwardAlphaEvidenceEligible: boolean;
  readonly onlineLearningEnabled: boolean;
  readonly startedAt: UtcInstant;
  readonly observationRef: string;
  readonly instrumentId: string;
  readonly outcomeHorizonMs?: number;
  readonly initialModelVersion?: string;
}>;

export type PrequentialEngineFailureCode =
  | 'NOT_YET_KNOWABLE'
  | 'DECISION_IMMUTABLE'
  | 'OUTCOME_BEFORE_HORIZON'
  | 'FUTURE_CONTEXT_LEAK'
  | 'REPLAY_SEALED_DECISION'
  | 'MODEL_UPDATE_BEFORE_SCORE'
  | 'UNKNOWN_DECISION';

export type PrequentialEngineFailure = Readonly<{
  readonly code: PrequentialEngineFailureCode;
  readonly message: string;
}>;
