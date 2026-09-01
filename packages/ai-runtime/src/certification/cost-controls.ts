import type { AiApprovedPurpose } from '../taxonomy.ts';

export type AiCostControlPolicy = {
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly requestBudgetMicros: number | null;
};

export const DEFAULT_AI_COST_CONTROLS: AiCostControlPolicy = Object.freeze({
  maxInputTokens: 8_192,
  maxOutputTokens: 1_024,
  timeoutMs: 30_000,
  maxRetries: 1,
  requestBudgetMicros: null,
});

const PURPOSE_OVERRIDES: Partial<Record<AiApprovedPurpose, Partial<AiCostControlPolicy>>> = Object.freeze({
  MARKET_OPPORTUNITY_RESEARCH: Object.freeze({
    maxOutputTokens: 2_048,
    timeoutMs: 45_000,
  }),
  GROWTH_PLANNING: Object.freeze({
    maxOutputTokens: 1_536,
    timeoutMs: 35_000,
  }),
  GENERAL_ASSISTANT: Object.freeze({
    maxOutputTokens: 512,
    timeoutMs: 20_000,
  }),
});

export function resolveCostControls(
  purpose: AiApprovedPurpose,
  overrides?: Partial<AiCostControlPolicy>,
): AiCostControlPolicy {
  const purposeOverride = PURPOSE_OVERRIDES[purpose] ?? {};
  return Object.freeze({
    maxInputTokens: overrides?.maxInputTokens ?? purposeOverride.maxInputTokens ?? DEFAULT_AI_COST_CONTROLS.maxInputTokens,
    maxOutputTokens: overrides?.maxOutputTokens ?? purposeOverride.maxOutputTokens ?? DEFAULT_AI_COST_CONTROLS.maxOutputTokens,
    timeoutMs: overrides?.timeoutMs ?? purposeOverride.timeoutMs ?? DEFAULT_AI_COST_CONTROLS.timeoutMs,
    maxRetries: overrides?.maxRetries ?? purposeOverride.maxRetries ?? DEFAULT_AI_COST_CONTROLS.maxRetries,
    requestBudgetMicros:
      overrides?.requestBudgetMicros ?? purposeOverride.requestBudgetMicros ?? DEFAULT_AI_COST_CONTROLS.requestBudgetMicros,
  });
}

export function estimateInputTokensFromMessages(messages: readonly { readonly content: string }[]): number {
  const chars = messages.reduce((sum, message) => sum + message.content.length, 0);
  return Math.max(1, Math.trunc(chars / 4));
}

export function exceedsInputTokenBudget(inputTokens: number, policy: AiCostControlPolicy): boolean {
  return inputTokens > policy.maxInputTokens;
}
