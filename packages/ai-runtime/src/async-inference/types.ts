import type { UtcInstant } from '@solstice/domain';
import type { ModelId, ModelVersion } from '@solstice/model-registry';
import type { AiRequestId } from '../ids.ts';
import type { AiApprovedPurpose, AiProviderKind, AiTaskClass } from '../taxonomy.ts';
import type { AiGatewayResult, AiGatewayRequest } from '../gateway.ts';
import type { AiProviderFailure } from '../types.ts';
import type {
  InferenceCancellationState,
  InferenceCostStatus,
  InferenceExternalPrivacyClass,
  InferenceJobState,
  InferenceTimeoutKind,
} from './taxonomy.ts';

export type StructuredInferenceRequest = {
  readonly inferenceRequestId: AiRequestId;
  readonly taskId: string | null;
  readonly workOrderId: string | null;
  readonly customerId: string;
  readonly purposeReference: string;
  readonly purpose: AiApprovedPurpose;
  readonly taskClass: AiTaskClass;
  readonly provider: AiProviderKind;
  readonly modelId: ModelId;
  readonly modelVersion: ModelVersion;
  readonly promptTemplateId: string | null;
  readonly structuredInput: Readonly<Record<string, unknown>>;
  readonly toolCapabilities: readonly string[];
  readonly responseSchema: AiGatewayRequest['responseSchema'];
  readonly maxOutputTokens: number | null;
  readonly connectionTimeoutMs: number;
  readonly processingTimeoutMs: number;
  readonly taskDeadline: UtcInstant | null;
  readonly workOrderHorizon: UtcInstant | null;
  readonly privacyClassification: InferenceExternalPrivacyClass;
  readonly budgetReservationRef: string | null;
  readonly estimatedBudgetMicros: string | null;
  readonly traceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly gatewayRequest: AiGatewayRequest;
};

export type InferenceJobRecord = {
  readonly inferenceRequestId: AiRequestId;
  readonly taskId: string | null;
  readonly workOrderId: string | null;
  readonly customerId: string;
  readonly provider: AiProviderKind;
  readonly modelId: ModelId;
  readonly modelVersion: ModelVersion;
  readonly state: InferenceJobState;
  readonly cancellationState: InferenceCancellationState | null;
  readonly timeoutKind: InferenceTimeoutKind | null;
  readonly correlationId: string;
  readonly queuedAt: UtcInstant;
  readonly startedAt: UtcInstant | null;
  readonly completedAt: UtcInstant | null;
  readonly attempt: number;
  readonly result: AiGatewayResult | null;
  readonly failure: AiProviderFailure | null;
  readonly usageRecordId: string | null;
  readonly budgetReservationRef: string | null;
  readonly idempotencyKey: string;
};

export type DurableInferenceUsageRecord = {
  readonly usageRecordId: string;
  readonly inferenceRequestId: AiRequestId;
  readonly taskId: string | null;
  readonly workOrderId: string | null;
  readonly customerId: string;
  readonly provider: AiProviderKind;
  readonly model: string;
  readonly providerRequestId: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cachedTokens: number | null;
  readonly requestCount: number;
  readonly durationMs: number;
  readonly providerReportedCostMicros: string | null;
  readonly estimatedCostMicros: string | null;
  readonly currency: string | null;
  readonly costStatus: InferenceCostStatus;
  readonly succeeded: boolean;
  readonly cancelled: boolean;
  readonly cancellationState: InferenceCancellationState | null;
  readonly recordedAt: UtcInstant;
};

export type AsyncInferenceSubmitResult =
  | { readonly ok: true; readonly job: InferenceJobRecord }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type AsyncInferencePollResult =
  | { readonly ok: true; readonly job: InferenceJobRecord }
  | { readonly ok: false; readonly code: 'JOB_NOT_FOUND'; readonly message: string };
