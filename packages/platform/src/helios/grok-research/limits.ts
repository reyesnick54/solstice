import type { ResearchLoopLimits } from './types.ts';

export const DEFAULT_RESEARCH_LOOP_LIMITS: ResearchLoopLimits = Object.freeze({
  maxReasoningIterations: 5,
  maxToolCalls: 8,
  maxModelCalls: 6,
  maxWallClockMs: 120_000,
  maxInputTokens: 32_000,
  maxOutputTokens: 8_000,
  maxBudgetConsumed: '1000',
  perToolCallLimit: 8,
});

export const STRICT_RESEARCH_LOOP_LIMITS: ResearchLoopLimits = Object.freeze({
  maxReasoningIterations: 2,
  maxToolCalls: 2,
  maxModelCalls: 2,
  maxWallClockMs: 5_000,
  maxInputTokens: 4_000,
  maxOutputTokens: 1_000,
  maxBudgetConsumed: '100',
  perToolCallLimit: 2,
});
