import type { UtcInstant } from '../../../domain/src/time.ts';
import type { AiUsageRecord } from '../usage.ts';
import type { S3mServingUsage } from './contract.ts';

export type S3mResearchUsageAttribution = {
  readonly inferenceRequestId: string;
  readonly workOrderRef: string | null;
  readonly taskRef: string | null;
  readonly providerId: string;
  readonly modelId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly computeUnits: number | null;
  readonly gpuDurationMs: number | null;
  readonly estimatedCostMicros: string;
  readonly latencyMs: number;
  readonly costStatus: 'ESTIMATED' | 'RECORDED' | 'UNKNOWN';
  readonly recordedAt: UtcInstant;
  readonly postedToCustomerLedger: false;
};

export function buildS3mServingUsage(input: {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostMicros: string;
  readonly latencyMs: number;
  readonly computeUnits?: number | null;
  readonly gpuDurationMs?: number | null;
}): S3mServingUsage {
  return Object.freeze({
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    computeUnits: input.computeUnits ?? null,
    gpuDurationMs: input.gpuDurationMs ?? null,
    estimatedCostMicros: input.estimatedCostMicros,
    latencyMs: input.latencyMs,
  });
}

export function attributeS3mResearchUsage(input: {
  readonly inferenceRequestId: string;
  readonly workOrderRef: string | null;
  readonly taskRef: string | null;
  readonly providerId: string;
  readonly modelId: string;
  readonly usage: S3mServingUsage;
  readonly recordedAt: UtcInstant;
}): S3mResearchUsageAttribution {
  return Object.freeze({
    inferenceRequestId: input.inferenceRequestId,
    workOrderRef: input.workOrderRef,
    taskRef: input.taskRef,
    providerId: input.providerId,
    modelId: input.modelId,
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    computeUnits: input.usage.computeUnits,
    gpuDurationMs: input.usage.gpuDurationMs,
    estimatedCostMicros: input.usage.estimatedCostMicros,
    latencyMs: input.usage.latencyMs,
    costStatus: 'ESTIMATED',
    recordedAt: input.recordedAt,
    postedToCustomerLedger: false,
  });
}

export function fromGatewayUsageRecord(
  record: AiUsageRecord,
  input: {
    readonly inferenceRequestId: string;
    readonly workOrderRef: string | null;
    readonly taskRef: string | null;
    readonly modelId: string;
  },
): S3mResearchUsageAttribution {
  return attributeS3mResearchUsage({
    inferenceRequestId: input.inferenceRequestId,
    workOrderRef: input.workOrderRef,
    taskRef: input.taskRef,
    providerId: record.provider,
    modelId: input.modelId,
    usage: buildS3mServingUsage({
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      estimatedCostMicros: record.estimatedCostMicros,
      latencyMs: record.latencyMs,
    }),
    recordedAt: record.recordedAt,
  });
}
