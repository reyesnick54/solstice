import type { UtcInstant } from '../../../../domain/src/time.ts';
import type { ResearchSpendRecord } from '../execution-types.ts';

/** Platform-local S3M usage attribution; no ai-runtime import. */
export type HeliosS3mUsageAttribution = {
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

export type HeliosS3mSpendBridgeInput = {
  readonly attribution: HeliosS3mUsageAttribution;
  readonly workOrderId: import('../ids.ts').EconomicWorkOrderId;
  readonly taskId: import('../ids.ts').HeliosTaskId;
  readonly customerId: string;
  readonly programId: import('../ids.ts').HeliosProgramId;
  readonly reservedAmount: string;
  readonly attemptNumber: number;
  readonly retryCausedAdditionalCost: boolean;
  readonly succeeded: boolean;
  readonly now: UtcInstant;
};

export type HeliosS3mSpendBridge = {
  readonly toResearchSpendRecord: (input: HeliosS3mSpendBridgeInput) => ResearchSpendRecord;
};
