import type { UtcInstant } from '../../domain/src/time.ts';
import type { AiApprovedPurpose, AiProviderKind } from './taxonomy.ts';
import type { InferenceCostMetadata } from './catalog.ts';
import type { AiProviderUsage } from './types.ts';

export type AiUsageRecord = {
  readonly provider: AiProviderKind;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly estimatedCostMicros: string;
  readonly agentId: string | null;
  readonly userId: string;
  readonly conversationId: string | null;
  readonly purpose: AiApprovedPurpose;
  readonly recordedAt: UtcInstant;
  readonly postedToCustomerLedger: false;
};

export class UsageAccountant {
  private readonly records: AiUsageRecord[] = [];

  record(input: {
    readonly provider: AiProviderKind;
    readonly model: string;
    readonly usage: AiProviderUsage;
    readonly latencyMs: number;
    readonly cost: InferenceCostMetadata | null;
    readonly agentId: string | null;
    readonly userId: string;
    readonly conversationId: string | null;
    readonly purpose: AiApprovedPurpose;
    readonly recordedAt: UtcInstant;
  }): AiUsageRecord {
    const inputTokens = input.usage.promptTokens ?? 0;
    const outputTokens = input.usage.completionTokens ?? 0;
    const estimated = estimateCostMicros(inputTokens, outputTokens, input.cost);
    const record = Object.freeze({
      provider: input.provider,
      model: input.model,
      inputTokens,
      outputTokens,
      latencyMs: input.latencyMs,
      estimatedCostMicros: estimated,
      agentId: input.agentId,
      userId: input.userId,
      conversationId: input.conversationId,
      purpose: input.purpose,
      recordedAt: input.recordedAt,
      postedToCustomerLedger: false as const,
    });
    this.records.push(record);
    return record;
  }

  snapshot(): readonly AiUsageRecord[] {
    return Object.freeze([...this.records]);
  }
}

export function estimateCostMicros(
  inputTokens: number,
  outputTokens: number,
  cost: InferenceCostMetadata | null,
): string {
  if (!cost) {
    return '0';
  }
  const inputMicros = Math.trunc((inputTokens * cost.inputMicrosPer1kTokens) / 1000);
  const outputMicros = Math.trunc((outputTokens * cost.outputMicrosPer1kTokens) / 1000);
  return String(inputMicros + outputMicros);
}
