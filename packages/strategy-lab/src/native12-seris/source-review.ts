import { err, ok, type Result } from '@solstice/domain';
import type { StrategyFailure } from '../types.ts';

/** Seris-style kebab strategy directory name — user strategies must not collide with bundled ids. */
export function isValidSerisStyleStrategyName(name: unknown): name is string {
  return typeof name === 'string' && /^[a-z0-9][a-z0-9-]{0,62}$/.test(name);
}

export type StrategySourceReview = {
  readonly strategyName: string;
  readonly researchAgentRef: string;
  readonly upstreamAttribution: 'SERIS_PATTERN_NATIVE12';
  readonly userAuthored: boolean;
  readonly bundledBuiltin: false;
  readonly deployRequested: false;
  readonly liveExecutionRequested: false;
  readonly reviewedAt: string;
};

export function reviewStrategySource(input: {
  readonly strategyName: string;
  readonly researchAgentRef: string;
  readonly userAuthored?: boolean;
  readonly deployRequested?: boolean;
}): Result<StrategySourceReview, StrategyFailure> {
  if (!isValidSerisStyleStrategyName(input.strategyName)) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: 'strategy source name must match Seris-style kebab identifier',
    });
  }
  if (input.deployRequested === true) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: 'AI strategy sources may not request deployment',
    });
  }
  if (!input.researchAgentRef.startsWith('agent/')) {
    return err({
      code: 'PROMOTION_GATE_FAILED',
      message: 'researchAgentRef must be an agent-scoped reference',
    });
  }
  return ok(
    Object.freeze({
      strategyName: input.strategyName,
      researchAgentRef: input.researchAgentRef,
      upstreamAttribution: 'SERIS_PATTERN_NATIVE12' as const,
      userAuthored: input.userAuthored ?? true,
      bundledBuiltin: false as const,
      deployRequested: false as const,
      liveExecutionRequested: false as const,
      reviewedAt: new Date().toISOString(),
    }),
  );
}
