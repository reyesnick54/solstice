import type { StrategyCapsuleQualificationState } from '../capsule/types.ts';
import { transitionCapsuleQualification } from '../capsule/lifecycle.ts';

export const M12_LIFECYCLE_MODES = ['SHADOW', 'PAPER', 'RESEARCH'] as const;
export type M12LifecycleMode = (typeof M12_LIFECYCLE_MODES)[number];

export type M12LifecycleState = {
  readonly mode: M12LifecycleMode;
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

export function initialM12LifecycleState(): M12LifecycleState {
  return Object.freeze({
    mode: 'RESEARCH',
    qualificationState: 'EVALUATION_PENDING',
    demoted: false,
    demotionReason: null,
  });
}

export function promoteM12ToShadow(state: M12LifecycleState): M12LifecycleState {
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

export function promoteM12ToPaper(state: M12LifecycleState): M12LifecycleState {
  const shadow = promoteM12ToShadow(state);
  const qualificationState = advance(shadow.qualificationState, ['PAPER_ELIGIBLE', 'PAPER_ACTIVE']);
  return Object.freeze({
    ...shadow,
    mode: qualificationState === 'PAPER_ACTIVE' || qualificationState === 'PAPER_ELIGIBLE' ? 'PAPER' : shadow.mode,
    demoted: false,
    demotionReason: null,
  });
}

export function demoteM12(state: M12LifecycleState, reason: string): M12LifecycleState {
  const revoked = transitionCapsuleQualification(state.qualificationState, 'REVOKED');
  return Object.freeze({
    mode: 'RESEARCH',
    qualificationState: revoked.ok ? revoked.value : 'REVOKED',
    demoted: true,
    demotionReason: reason,
  });
}

export function restartM12Lifecycle(_previous: M12LifecycleState): M12LifecycleState {
  return initialM12LifecycleState();
}
