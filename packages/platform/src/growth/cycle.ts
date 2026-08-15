import { err, ok, type Result } from '../../../domain/src/result.ts';
import { GROWTH_CYCLE_STATES, type GrowthCycleState } from './taxonomy.ts';

const ALLOWED: Readonly<Record<GrowthCycleState, readonly GrowthCycleState[]>> = {
  CREATED: ['ASSESSING', 'CANCELLED'],
  ASSESSING: ['PLANNING', 'CANCELLED', 'STALE'],
  PLANNING: ['AWAITING_USER', 'COMPLETED', 'CANCELLED', 'STALE'],
  AWAITING_USER: ['COMPLETED', 'STALE', 'CANCELLED'],
  COMPLETED: ['STALE'],
  STALE: ['ASSESSING', 'CANCELLED'],
  CANCELLED: [],
};

export type CycleTransitionFailure = {
  readonly code: 'INVALID_CYCLE_TRANSITION';
  readonly from: GrowthCycleState;
  readonly to: GrowthCycleState;
};

export function transitionCycle(
  from: GrowthCycleState,
  to: GrowthCycleState,
): Result<GrowthCycleState, CycleTransitionFailure> {
  if (!ALLOWED[from].includes(to)) {
    return err({ code: 'INVALID_CYCLE_TRANSITION', from, to });
  }
  return ok(to);
}

export function isGrowthCycleState(value: string): value is GrowthCycleState {
  return (GROWTH_CYCLE_STATES as readonly string[]).includes(value);
}
