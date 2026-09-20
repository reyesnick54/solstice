import type { StrategyCapsuleQualificationState } from '../capsule/types.ts';
import { transitionCapsuleQualification } from '../capsule/lifecycle.ts';

export const M09_LIFECYCLE_MODES = ['SHADOW', 'PAPER', 'RESEARCH'] as const;
export type M09LifecycleMode = (typeof M09_LIFECYCLE_MODES)[number];

export type M09LifecycleState = {
  readonly mode: M09LifecycleMode;
  readonly qualificationState: StrategyCapsuleQualificationState;
  readonly demoted: boolean;
  readonly demotionReason: string | null;
};

function advance(
  state: StrategyCapsuleQualificationState,
  targets: readonly StrategyCapsuleQualificationState[],
): StrategyCapsuleQualificationState {
  let current = state;
  for (const target of targets) {
    const next = transitionCapsuleQualification(current, target);
    if (!next.ok) {
      return current;
    }
    current = next.value;
  }
  return current;
}

export function initialM09LifecycleState(): M09LifecycleState {
  return Object.freeze({
    mode: 'RESEARCH',
    qualificationState: 'EVALUATION_PENDING',
    demoted: false,
    demotionReason: null,
  });
}

export function promoteM09ToShadow(state: M09LifecycleState): M09LifecycleState {
  const qualificationState = advance(state.qualificationState, [
    'EVALUATING',
    'SHADOW_ELIGIBLE',
    'SHADOW_ACTIVE',
  ]);
  return Object.freeze({
    ...state,
    mode: qualificationState === 'SHADOW_ACTIVE' || qualificationState === 'SHADOW_ELIGIBLE' ? 'SHADOW' : state.mode,
    qualificationState,
  });
}

export function promoteM09ToPaper(state: M09LifecycleState): M09LifecycleState {
  const shadow = promoteM09ToShadow(state);
  const qualificationState = advance(shadow.qualificationState, ['PAPER_ELIGIBLE', 'PAPER_ACTIVE']);
  return Object.freeze({
    ...shadow,
    mode: qualificationState === 'PAPER_ACTIVE' || qualificationState === 'PAPER_ELIGIBLE' ? 'PAPER' : shadow.mode,
    qualificationState,
    demoted: false,
    demotionReason: null,
  });
}

export function demoteM09(state: M09LifecycleState, reason: string): M09LifecycleState {
  const revoked = transitionCapsuleQualification(state.qualificationState, 'REVOKED');
  return Object.freeze({
    mode: 'RESEARCH',
    qualificationState: revoked.ok ? revoked.value : 'REVOKED',
    demoted: true,
    demotionReason: reason,
  });
}

export function restartM09Lifecycle(_previous: M09LifecycleState): M09LifecycleState {
  return initialM09LifecycleState();
}
