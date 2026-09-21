import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import type { ExecutionTacticType } from './taxonomy.ts';
import type { ExecutionResearchRecommendation } from './types.ts';

/** Deterministic fixture adapter for Execution Research specialist output. */
export function synthesizeExecutionResearchRecommendation(input: {
  readonly executionPlanId: string;
  readonly suggestedTacticType: ExecutionTacticType | null;
  readonly suggestedOrderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | null;
  readonly findings: readonly string[];
  readonly confidenceBps: number;
}): ExecutionResearchRecommendation {
  const material = `${input.executionPlanId}:${input.suggestedTacticType}:${input.findings.join('|')}`;
  const recommendationId = `exr_${createHash('sha256').update(material).digest('hex').slice(0, 20)}`;
  return Object.freeze({
    recommendationId,
    executionPlanId: input.executionPlanId,
    suggestedTacticType: input.suggestedTacticType,
    suggestedOrderType: input.suggestedOrderType,
    confidenceBps: Math.max(0, Math.min(10_000, Math.floor(input.confidenceBps))),
    findings: Object.freeze([...input.findings]),
    llmSourced: true as const,
    advisoryOnly: true as const,
    grantsExecutionAuthority: false as const,
  });
}

export function executionResearchRouteLabel(now: UtcInstant): string {
  return `execution-research@simulation:${now}`;
}
