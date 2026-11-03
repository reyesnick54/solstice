import type { UtcInstant } from '@solstice/domain';
import type { ResearchBudgetSnapshot } from '../execution-types.ts';
import type { InformationTime } from '../observation/types.ts';
import type {
  HeliosCanonicalFeatureKind,
  ResearchMonitorBinaryOp,
  ResearchMonitorBlockReason,
  ResearchMonitorEvalOutcome,
  ResearchMonitorPriority,
  ResearchMonitorRuntimeStatus,
  ResearchMonitorTriggerAction,
  StaleFeaturePolicy,
} from './taxonomy.ts';
import type {
  ResearchMonitorEvaluationId,
  ResearchMonitorId,
  ResearchMonitorManifestId,
  ResearchMonitorTriggerEventId,
} from './ids.ts';

export type ResearchMonitorVersion = {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly schemaVersion: string;
};

export type ResearchMonitorExpression =
  | { readonly kind: 'feature'; readonly featureId: string }
  | { readonly kind: 'number'; readonly value: string }
  | { readonly kind: 'not'; readonly operand: ResearchMonitorExpression }
  | {
      readonly kind: 'binary';
      readonly op: ResearchMonitorBinaryOp;
      readonly left: ResearchMonitorExpression;
      readonly right: ResearchMonitorExpression;
    };

export type ResearchMonitorCondition = {
  readonly expression: ResearchMonitorExpression;
  readonly description?: string;
};

export type ResearchMonitorTrigger = {
  readonly action: ResearchMonitorTriggerAction;
  readonly researchTopic: string;
  readonly idempotencyKey?: string;
};

export type PointInTimeFeatureRequirement = {
  readonly featureId: string;
  readonly maxAgeMs: number;
  readonly requiredKind?: HeliosCanonicalFeatureKind;
};

export type ResearchMonitorDefinition = {
  readonly monitorId: ResearchMonitorId;
  readonly name: string;
  readonly version: ResearchMonitorVersion;
  readonly watch: readonly string[];
  readonly condition: ResearchMonitorCondition;
  readonly trigger: ResearchMonitorTrigger;
  readonly startAt: UtcInstant;
  readonly expiresAt: UtcInstant | null;
  readonly cooldownMs: number;
  readonly maxTriggers: number;
  readonly researchBudgetMinor: string;
  readonly priority: ResearchMonitorPriority;
  readonly allowedAgentClasses: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly pointInTimeFeatureRequirements: readonly PointInTimeFeatureRequirement[];
  readonly staleDataPolicy: StaleFeaturePolicy;
};

export type ResearchMonitorManifest = {
  readonly manifestId: ResearchMonitorManifestId;
  readonly monitorId: ResearchMonitorId;
  readonly name: string;
  readonly version: ResearchMonitorVersion;
  readonly watch: readonly string[];
  readonly featureRefs: readonly string[];
  readonly trigger: ResearchMonitorTrigger;
  readonly definitionHash: string;
  readonly expressionHash: string;
  readonly compiledAt: UtcInstant;
  readonly grantsTradingAction: false;
};

export type CanonicalFeatureObservation = {
  readonly featureId: string;
  readonly kind: HeliosCanonicalFeatureKind;
  readonly instrumentId: string | null;
  readonly value: string;
  readonly asOf: UtcInstant;
  readonly informationTime: InformationTime;
  readonly observationRef: string | null;
  readonly stale: boolean;
  readonly missing: boolean;
};

export type FeatureResolutionDiagnostic = {
  readonly featureId: string;
  readonly ok: boolean;
  readonly reason: ResearchMonitorBlockReason | null;
  readonly asOf: UtcInstant | null;
  readonly knowableAt: UtcInstant | null;
};

export type ResearchMonitorState = {
  readonly monitorId: ResearchMonitorId;
  readonly runtimeStatus: ResearchMonitorRuntimeStatus;
  readonly triggerCount: number;
  readonly lastTriggeredAt: UtcInstant | null;
  readonly lastEvaluationAt: UtcInstant | null;
  readonly lastTriggerFingerprint: string | null;
  readonly budgetReservedMinor: string;
  readonly manifestId: ResearchMonitorManifestId | null;
};

/** DSL runtime trigger record (distinct from OS07→OS08 integration `ResearchMonitorTriggerEvent`). */
export type HeliosResearchMonitorTriggerRecord = {
  readonly triggerEventId: ResearchMonitorTriggerEventId;
  readonly monitorId: ResearchMonitorId;
  readonly manifestId: ResearchMonitorManifestId;
  readonly action: ResearchMonitorTriggerAction;
  readonly researchTopic: string;
  readonly triggeredAt: UtcInstant;
  readonly fingerprint: string;
  readonly budgetReservedMinor: string;
  readonly priority: ResearchMonitorPriority;
  readonly allowedAgentClasses: readonly string[];
  readonly requiredEvidence: readonly string[];
  readonly watch: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type ResearchMonitorEvaluation = {
  readonly evaluationId: ResearchMonitorEvaluationId;
  readonly monitorId: ResearchMonitorId;
  readonly manifestId: ResearchMonitorManifestId;
  readonly evaluatedAt: UtcInstant;
  readonly conditionMet: boolean;
  readonly triggerEmitted: boolean;
  readonly outcome: ResearchMonitorEvalOutcome;
  readonly blockReason: ResearchMonitorBlockReason | null;
  readonly featureDiagnostics: readonly FeatureResolutionDiagnostic[];
  readonly triggerEvent: HeliosResearchMonitorTriggerRecord | null;
  readonly evidenceRefs: readonly string[];
  readonly deterministic: true;
};

export type ResearchMonitorStoreSnapshot = {
  readonly states: readonly ResearchMonitorState[];
  readonly triggers: readonly HeliosResearchMonitorTriggerRecord[];
  readonly evaluations: readonly ResearchMonitorEvaluation[];
  readonly manifests: readonly ResearchMonitorManifest[];
};

export type AafFeatureFabricPort = {
  resolveFeatures(input: {
    readonly evaluationTime: UtcInstant;
    readonly featureIds: readonly string[];
    readonly watch: readonly string[];
    readonly pointInTimeRequirements: readonly PointInTimeFeatureRequirement[];
  }): readonly CanonicalFeatureObservation[];
};

export type HeliosObservationFabricPort = {
  /** Optional enrichment — observation refs must already be present on features when absent. */
  readonly observationStoreRef?: string;
};

export type H20ResearchBudgetPort = {
  readonly snapshot: ResearchBudgetSnapshot;
  reserveForResearch(input: {
    readonly monitorId: ResearchMonitorId;
    readonly amountMinor: string;
    readonly evaluatedAt: UtcInstant;
  }):
    | { readonly ok: true; readonly snapshot: ResearchBudgetSnapshot }
    | { readonly ok: false; readonly code: 'BUDGET_EXHAUSTED' | 'RESERVATION_FAILED'; readonly message: string };
};

export type ResearchMonitorEvaluateInput = {
  readonly definition: ResearchMonitorDefinition;
  readonly evaluatedAt: UtcInstant;
  readonly featureFabric: AafFeatureFabricPort;
  readonly observationFabric?: HeliosObservationFabricPort;
  readonly researchBudget: H20ResearchBudgetPort;
  readonly evidenceVault?: import('@solstice/evidence').EvidenceVault;
};

export type CompileResearchMonitorResult =
  | { readonly ok: true; readonly manifest: ResearchMonitorManifest }
  | { readonly ok: false; readonly code: string; readonly message: string };
