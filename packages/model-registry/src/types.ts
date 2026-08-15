import type { UtcInstant } from '../../domain/src/time.ts';
import type {
  ModelArtifactReference,
  ModelId,
  ModelValidationId,
  ModelVersion,
} from './ids.ts';

export const MODEL_TYPES = [
  'RISK_MODEL',
  'PORTFOLIO_MODEL',
  'FORECAST_MODEL',
  'SIGNAL_MODEL',
  'RANKING_MODEL',
  'AI_MODEL_REFERENCE',
] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

export const MODEL_LIFECYCLE_STATES = [
  'DRAFT',
  'VALIDATION_REQUIRED',
  'VALIDATED_FOR_SIMULATION',
  'APPROVED_FOR_SIMULATION',
  'REJECTED',
  'RETIRED',
] as const;

export type ModelLifecycleState = (typeof MODEL_LIFECYCLE_STATES)[number];

export const MODEL_DETERMINISM = ['DETERMINISTIC', 'NON_DETERMINISTIC'] as const;
export type ModelDeterminism = (typeof MODEL_DETERMINISM)[number];

export const MODEL_VALIDATION_STATUSES = [
  'PASSED_SIMULATION',
  'FAILED',
  'INCONCLUSIVE',
  'INSUFFICIENT_EVIDENCE',
] as const;

export type ModelValidationStatus = (typeof MODEL_VALIDATION_STATUSES)[number];

export type ModelArtifact = {
  readonly reference: ModelArtifactReference;
  readonly sha256: string;
  readonly kind: 'CONFIGURATION' | 'FORMULA' | 'FEATURE_SET' | 'WEIGHTS_REFERENCE';
  readonly description: string;
  readonly simulationOnly: true;
};

export type RegisteredModelVersion = {
  readonly modelId: ModelId;
  readonly version: ModelVersion;
  readonly type: ModelType;
  readonly description: string;
  readonly owner: string;
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly determinism: ModelDeterminism;
  readonly artifact: ModelArtifact;
  readonly configurationCanonical: string;
  readonly createdAt: UtcInstant;
  readonly lifecycle: ModelLifecycleState;
  readonly limitations: readonly string[];
  readonly applicableDomain: string;
  readonly dataRequirements: readonly string[];
  readonly simulationOnly: true;
  readonly liveApproved: false;
};

export type ModelValidationReport = {
  readonly validationId: ModelValidationId;
  readonly modelId: ModelId;
  readonly version: ModelVersion;
  readonly testsExecuted: readonly string[];
  readonly testDatasetReference: string;
  readonly expectedBehavior: string;
  readonly observedBehavior: string;
  readonly limitations: readonly string[];
  readonly status: ModelValidationStatus;
  readonly reviewer: string;
  readonly reviewerKind: 'HUMAN_OPERATOR';
  readonly timestamp: UtcInstant;
  readonly claimsRealWorldPerformance: false;
};

export type ModelApproval = {
  readonly modelId: ModelId;
  readonly version: ModelVersion;
  readonly actorId: string;
  readonly subjectId: string;
  readonly sessionId: string;
  readonly actorKind: 'HUMAN_OPERATOR';
  readonly reason: string;
  readonly approvedAt: UtcInstant;
};

export type ModelRegistrySnapshot = {
  readonly models: readonly RegisteredModelVersion[];
  readonly validations: readonly ModelValidationReport[];
  readonly approvals: readonly ModelApproval[];
};
