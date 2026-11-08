import type { UtcInstant } from '@solstice/domain';

import type {
  HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA,
  CanonicalOutcomeHorizonId,
  OutcomeRealizedLabel,
  OutcomeResolutionStatus,
} from './taxonomy.ts';

/** Frozen before campaign start — required horizons for every decision in the campaign. */
export type OutcomeMaturitySchedule = Readonly<{
  readonly schema: typeof HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA;
  readonly scheduleId: string;
  readonly campaignId: string;
  readonly declaredBeforeCampaignStart: true;
  readonly campaignStartsAt: UtcInstant;
  readonly sealedAt: UtcInstant;
  readonly requiredHorizonIds: readonly CanonicalOutcomeHorizonId[];
  readonly grantsExecutionAuthority: false;
}>;

/** Chronological observation window for outcome labeling — no data after windowEnd may influence the label. */
export type OutcomeObservationWindow = Readonly<{
  readonly decisionTime: UtcInstant;
  readonly windowStart: UtcInstant;
  readonly windowEnd: UtcInstant;
  readonly horizonId: CanonicalOutcomeHorizonId;
  readonly horizonMs: number;
}>;

/** Immutable binding to the sealed prediction at decision time — never mutated after enqueue. */
export type OutcomeSealedDecisionBinding = Readonly<{
  readonly decisionId: string;
  readonly campaignId: string;
  readonly decisionTime: UtcInstant;
  readonly instrumentId: string;
  readonly referenceMidMinor: string;
  readonly sealedContentHash: string;
  readonly immutableAfterSeal: true;
}>;

export type PendingOutcome = Readonly<{
  readonly schema: typeof HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA;
  readonly pendingId: string;
  readonly binding: OutcomeSealedDecisionBinding;
  readonly horizonId: CanonicalOutcomeHorizonId;
  readonly observationWindow: OutcomeObservationWindow;
  readonly maturityAt: UtcInstant;
  readonly enqueuedAt: UtcInstant;
  readonly status: OutcomeResolutionStatus;
  readonly maturedOutcome: MaturedOutcome | null;
}>;

export type MaturedOutcomeSeal = Readonly<{
  readonly sealedAt: UtcInstant;
  readonly contentHash: string;
}>;

export type MaturedOutcome = Readonly<{
  readonly schema: typeof HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA;
  readonly maturedOutcomeId: string;
  readonly pendingId: string;
  readonly decisionId: string;
  readonly horizonId: CanonicalOutcomeHorizonId;
  readonly observationWindow: OutcomeObservationWindow;
  readonly realizedAt: UtcInstant;
  readonly realizedMidMinor: string;
  readonly realizedLabel: OutcomeRealizedLabel;
  readonly observationEventIdsChronological: readonly string[];
  readonly bindingDigest: string;
  readonly immutable: true;
  readonly seal: MaturedOutcomeSeal;
}>;

export type OutcomeEvidenceUpdateRecord = Readonly<{
  readonly schema: typeof HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA;
  readonly updateId: string;
  readonly campaignId: string;
  readonly decisionId: string;
  readonly horizonId: CanonicalOutcomeHorizonId;
  readonly maturedOutcomeId: string;
  readonly triggeredAt: UtcInstant;
  readonly statisticalChannel: 'forward_alpha_delayed_label_v1';
}>;

export type OutcomeMaturityQueueState = Readonly<{
  readonly schema: typeof HELIOS_ALPHA19_OUTCOME_MATURITY_SCHEMA;
  readonly campaignId: string;
  readonly schedule: OutcomeMaturitySchedule;
  readonly pending: readonly PendingOutcome[];
  readonly matured: readonly MaturedOutcome[];
  readonly evidenceUpdates: readonly OutcomeEvidenceUpdateRecord[];
  readonly grantsExecutionAuthority: false;
}>;

export type OutcomeMaturityEngineFailureCode =
  | 'SCHEDULE_NOT_BEFORE_CAMPAIGN'
  | 'UNKNOWN_HORIZON'
  | 'OUTCOME_BEFORE_MATURITY'
  | 'EARLY_LABEL_FORBIDDEN'
  | 'SEALED_BINDING_MUTATION'
  | 'PARTIAL_FUTURE_PATH_FORBIDDEN'
  | 'NOT_YET_KNOWABLE'
  | 'OUTCOME_DATA_INCOMPLETE';

export type OutcomeMaturityEngineFailure = Readonly<{
  readonly code: OutcomeMaturityEngineFailureCode;
  readonly message: string;
}>;
