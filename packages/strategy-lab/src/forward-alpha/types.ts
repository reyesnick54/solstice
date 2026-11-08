import type { UtcInstant } from '@solstice/domain';

import type {
  ForwardAlphaCampaignId,
  ForwardAlphaDecisionId,
  ForwardAlphaEvidenceId,
  ForwardAlphaManifestId,
  ForwardAlphaObservationId,
  ForwardAlphaOutcomeId,
  ForwardAlphaStrategyId,
} from './ids.ts';
import type {
  FORWARD_ALPHA_DECISION_FAILURE_CODES,
  ForwardAlphaDecisionFailureCode,
  ForwardAlphaEvidenceLane,
  ForwardAlphaStatus,
  HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA,
} from './taxonomy.ts';

export type ForwardAlphaStrategy = {
  readonly strategyId: ForwardAlphaStrategyId;
  readonly strategyVersion: string;
  /** True once the version fingerprint is frozen for forward evidence collection. */
  readonly versionFrozen: boolean;
  readonly versionFrozenAt: UtcInstant | null;
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly capsuleFingerprint: string | null;
};

export type ForwardAlphaDecision = {
  readonly schemaVersion: typeof HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA;
  readonly decisionId: ForwardAlphaDecisionId;
  readonly campaignId: ForwardAlphaCampaignId;
  readonly strategyId: ForwardAlphaStrategyId;
  readonly strategyVersion: string;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly decisionAt: UtcInstant;
  readonly earliestOutcomeKnowableAt: UtcInstant;
  readonly featureVersions: Readonly<Record<string, string>>;
  readonly sealDigest: string;
  readonly sealedAt: UtcInstant;
  readonly immutableAfterSeal: boolean;
  readonly outcomeId: ForwardAlphaOutcomeId | null;
  readonly outcomeAttachedAt: UtcInstant | null;
  readonly liveCapital: boolean;
};

export type ForwardAlphaObservation = {
  readonly observationId: ForwardAlphaObservationId;
  readonly campaignId: ForwardAlphaCampaignId;
  readonly instrumentId: string;
  readonly knowableAt: UtcInstant;
  readonly providerSequence: number;
  readonly chronologicalIndex: number;
  readonly payloadDigest: string;
  readonly syntheticReplay: boolean;
};

export type ForwardAlphaOutcome = {
  readonly outcomeId: ForwardAlphaOutcomeId;
  readonly decisionId: ForwardAlphaDecisionId;
  readonly observedAt: UtcInstant;
  readonly netEconomicsMinor: bigint;
  readonly tradingCostMinor: bigint;
  readonly notes: string;
};

export type ForwardAlphaEvidence = {
  readonly evidenceId: ForwardAlphaEvidenceId;
  readonly campaignId: ForwardAlphaCampaignId;
  readonly lane: ForwardAlphaEvidenceLane;
  readonly decisionIds: readonly ForwardAlphaDecisionId[];
  readonly decisionCount: number;
  readonly netEconomicsMinor: bigint;
  readonly tradingCostMinor: bigint;
  readonly afterCostsNetMinor: bigint;
  readonly contentDigest: string;
  readonly syntheticFixture: boolean;
};

export type ForwardAlphaCampaign = {
  readonly campaignId: ForwardAlphaCampaignId;
  readonly strategy: ForwardAlphaStrategy;
  readonly primaryLane: ForwardAlphaForwardCampaignLane;
  readonly status: ForwardAlphaStatus;
  readonly openedAt: UtcInstant;
  readonly closedAt: UtcInstant | null;
  readonly observationRef: string;
  readonly sendsOrders: boolean;
  readonly changesInvestmentState: boolean;
  readonly financialEffectCreated: boolean;
};

export type ForwardAlphaForwardCampaignLane = Extract<
  ForwardAlphaEvidenceLane,
  'FORWARD_SHADOW' | 'FORWARD_PAPER' | 'LIVE_CAPITAL'
>;

export type ForwardAlphaManifest = {
  readonly manifestId: ForwardAlphaManifestId;
  readonly schemaVersion: typeof HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_SCHEMA;
  readonly campaign: ForwardAlphaCampaign;
  readonly evidenceByLane: Readonly<Partial<Record<ForwardAlphaEvidenceLane, ForwardAlphaEvidence>>>;
  readonly statusesReached: readonly ForwardAlphaStatus[];
  readonly qualificationMarker:
    | 'HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_QUALIFIED'
    | 'HELIOS_ALPHA01_FORWARD_EVIDENCE_DOMAIN_BLOCKED';
  readonly contentHash: string;
  readonly syntheticFixture: boolean;
};

export type ForwardAlphaDecisionIntegrityInput = {
  readonly decisionAt: UtcInstant;
  readonly earliestOutcomeKnowableAt: UtcInstant;
  readonly sealedAt: UtcInstant;
  readonly immutableAfterSeal: boolean;
  readonly strategyVersionFrozen: boolean;
  readonly featureVersionsKnown: boolean;
  readonly marketDataChronological: boolean;
  readonly outcomeAttachedAt: UtcInstant | null;
  readonly evidenceLane: ForwardAlphaEvidenceLane;
  readonly attemptedRelabelFromLane: ForwardAlphaEvidenceLane | null;
  readonly syntheticHistoricalReplay: boolean;
};

export type ForwardAlphaDecisionIntegrityResult = {
  readonly qualifiesAsForward: boolean;
  readonly failures: readonly ForwardAlphaDecisionFailureCode[];
};

export type ForwardAlphaDecisionFailure = {
  readonly code: ForwardAlphaDecisionFailureCode;
  readonly message: string;
};

/** Re-export failure codes for consumers that need the const tuple type. */
export type ForwardAlphaDecisionFailureCodeTuple = typeof FORWARD_ALPHA_DECISION_FAILURE_CODES;
