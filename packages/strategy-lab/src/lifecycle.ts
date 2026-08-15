import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  FORBIDDEN_STRATEGY_STATES,
  STRATEGY_LIFECYCLE_STATES,
  type ForbiddenStrategyState,
  type StrategyFailure,
  type StrategyLifecycleState,
} from './types.ts';

export const LEGAL_STRATEGY_TRANSITIONS: Readonly<
  Record<StrategyLifecycleState, readonly StrategyLifecycleState[]>
> = Object.freeze({
  DRAFT: Object.freeze(['COMPILED', 'RETIRED'] as const),
  COMPILED: Object.freeze(['BACKTESTING', 'RETIRED'] as const),
  BACKTESTING: Object.freeze(['BACKTESTED', 'VALIDATION_FAILED', 'RETIRED'] as const),
  BACKTESTED: Object.freeze(['BACKTESTING', 'REVIEW_REQUIRED', 'VALIDATION_FAILED', 'RETIRED'] as const),
  VALIDATION_FAILED: Object.freeze(['BACKTESTING', 'REVIEW_REQUIRED', 'RETIRED'] as const),
  REVIEW_REQUIRED: Object.freeze(['SHADOW_APPROVED', 'VALIDATION_FAILED', 'RETIRED'] as const),
  SHADOW_APPROVED: Object.freeze(['SHADOW_RUNNING', 'RETIRED'] as const),
  SHADOW_RUNNING: Object.freeze(['SHADOW_COMPLETED', 'RETIRED'] as const),
  SHADOW_COMPLETED: Object.freeze(['REVIEW_REQUIRED', 'PAPER_APPROVED', 'RETIRED'] as const),
  PAPER_APPROVED: Object.freeze(['PAPER_RUNNING', 'RETIRED'] as const),
  PAPER_RUNNING: Object.freeze(['PAPER_HALTED', 'RETIRED'] as const),
  PAPER_HALTED: Object.freeze(['RETIRED'] as const),
  RETIRED: Object.freeze([] as const),
});

export function isForbiddenLiveState(value: string): value is ForbiddenStrategyState {
  return (FORBIDDEN_STRATEGY_STATES as readonly string[]).includes(value);
}

export function assertNoLiveTransition(from: StrategyLifecycleState, to: string): Result<true, StrategyFailure> {
  if (isForbiddenLiveState(to) || to.startsWith('LIVE')) {
    return err({
      code: 'LIVE_FORBIDDEN',
      message: `no LIVE strategy state exists; cannot move ${from} to ${to}`,
    });
  }
  return ok(true);
}

export function transitionStrategy(
  from: StrategyLifecycleState,
  to: StrategyLifecycleState,
): Result<StrategyLifecycleState, StrategyFailure> {
  const live = assertNoLiveTransition(from, to);
  if (!live.ok) {
    return live;
  }
  if (from === to) {
    return ok(from);
  }
  if (!LEGAL_STRATEGY_TRANSITIONS[from].includes(to)) {
    return err({
      code: 'INVALID_TRANSITION',
      message: `cannot move strategy ${from} to ${to}`,
    });
  }
  return ok(to);
}

export function liveStatesPresentIn(values: readonly string[]): readonly string[] {
  return Object.freeze(values.filter((value) => isForbiddenLiveState(value) || value.startsWith('LIVE_')));
}

export function allLifecycleStates(): readonly StrategyLifecycleState[] {
  return STRATEGY_LIFECYCLE_STATES;
}
