import { REHYDRATION_STEPS, type RehydrationStep } from './types.ts';

export function rehydrationOrder(): readonly RehydrationStep[] {
  return REHYDRATION_STEPS;
}

export function nextRehydrationStep(current: RehydrationStep | null): RehydrationStep | null {
  if (current === null) {
    return REHYDRATION_STEPS[0] ?? null;
  }
  const index = REHYDRATION_STEPS.indexOf(current);
  if (index < 0 || index + 1 >= REHYDRATION_STEPS.length) {
    return null;
  }
  return REHYDRATION_STEPS[index + 1] ?? null;
}
