import { createSpendRecord } from '../budget.ts';
import type { HeliosS3mSpendBridge, HeliosS3mSpendBridgeInput } from './types.ts';

/**
 * Bridge S3M inference usage into HELIOS H06/H10 research accounting.
 * No free hidden inference — every dispatch carries work-order attribution.
 */
export const heliosS3mSpendBridge: HeliosS3mSpendBridge = {
  toResearchSpendRecord(input: HeliosS3mSpendBridgeInput) {
    const { attribution } = input;
    return createSpendRecord({
      workOrderId: input.workOrderId,
      taskId: input.taskId,
      customerId: input.customerId,
      programId: input.programId,
      budgetCategory: 'COMPUTE_UNITS',
      reservedAmount: input.reservedAmount,
      actualAmount: attribution.estimatedCostMicros,
      estimatedAmount: attribution.estimatedCostMicros,
      costStatus: attribution.costStatus === 'ESTIMATED' ? 'ESTIMATED' : 'UNKNOWN',
      currency: 'USD',
      attemptNumber: input.attemptNumber,
      retryCausedAdditionalCost: input.retryCausedAdditionalCost,
      succeeded: input.succeeded,
      providerId: attribution.providerId,
      modelId: attribution.modelId,
      toolId: 's3m_finance_inference',
      now: input.now,
    });
  },
};
