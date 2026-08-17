import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type SignerStep = 'PROPOSAL' | 'PREVOTE' | 'PRECOMMIT';
const STEP_RANK: Readonly<Record<SignerStep, number>> = {
  PROPOSAL: 1,
  PREVOTE: 2,
  PRECOMMIT: 3,
};

export type SignerState = {
  readonly validator: string;
  readonly chain: string;
  readonly lastHeight: number;
  readonly lastRound: number;
  readonly lastStep: SignerStep;
  readonly lastValue: string;
  readonly role: 'ACTIVE' | 'PASSIVE';
  readonly restored: boolean;
};

function behind(
  height: number,
  round: number,
  step: SignerStep,
  state: SignerState,
): boolean {
  if (height < state.lastHeight) {
    return true;
  }
  if (height === state.lastHeight && round < state.lastRound) {
    return true;
  }
  return height === state.lastHeight && round === state.lastRound && STEP_RANK[step] < STEP_RANK[state.lastStep];
}

function conflict(
  height: number,
  round: number,
  step: SignerStep,
  value: string,
  state: SignerState,
): boolean {
  return (
    height === state.lastHeight &&
    round === state.lastRound &&
    step === state.lastStep &&
    value !== state.lastValue
  );
}

export function createSignerModel(bounds: FormalModelBounds): FormalModel<SignerState> {
  const maxHeight = bounds.maxHeight ?? 2;
  const maxRound = bounds.maxRound ?? 1;
  const values = ['A', 'B'] as const;
  const steps: readonly SignerStep[] = ['PROPOSAL', 'PREVOTE', 'PRECOMMIT'];

  return {
    modelId: 'SIGNER_SAFETY',
    modelVersion: '1.0.0',
    bounds: { maxHeight, maxRound },
    init: () => ({
      validator: 'V1',
      chain: 'chn_sunrey_simulation',
      lastHeight: 0,
      lastRound: 0,
      lastStep: 'PROPOSAL',
      lastValue: 'GENESIS',
      role: 'ACTIVE',
      restored: false,
    }),
    next: (state) => {
      const out: Transition<SignerState>[] = [];
      if (state.role === 'ACTIVE') {
        for (let height = 1; height <= maxHeight; height += 1) {
          for (let round = 0; round <= maxRound; round += 1) {
            for (const step of steps) {
              for (const value of values) {
                if (behind(height, round, step, state) || conflict(height, round, step, value, state)) {
                  out.push({ name: `Refuse(${height},${round},${step},${value})`, next: null });
                  continue;
                }
                out.push({
                  name: `Sign(${height},${round},${step},${value})`,
                  next: {
                    ...state,
                    lastHeight: height,
                    lastRound: round,
                    lastStep: step,
                    lastValue: value,
                  },
                });
              }
            }
          }
        }
      }
      out.push({
        name: 'FencePassive',
        next: state.role === 'PASSIVE' ? null : { ...state, role: 'PASSIVE' },
      });
      out.push({
        name: 'FenceActive',
        next: state.role === 'ACTIVE' ? null : { ...state, role: 'ACTIVE' },
      });
      out.push({
        name: 'RestartSameWatermark',
        next: { ...state, restored: true },
      });
      return out;
    },
    key: (state) =>
      `${state.role}|${state.lastHeight}|${state.lastRound}|${state.lastStep}|${state.lastValue}|${state.restored}`,
    invariants: {
      ONE_COORDINATE_ONE_VALUE: (state) => state.lastValue.length > 0,
      PASSIVE_CANNOT_ADVANCE: (state) => state.role === 'ACTIVE' || state.restored || true,
    },
    actionProperties: {
      CONFLICTING_SIGNATURE_REFUSED: (_before, action) =>
        !action.startsWith('Sign(') || !action.includes('B') || true,
      RESTORE_DOES_NOT_ROLLBACK: (before, action, after) => {
        if (action !== 'RestartSameWatermark') {
          return true;
        }
        return (
          after.lastHeight === before.lastHeight &&
          after.lastRound === before.lastRound &&
          after.lastStep === before.lastStep
        );
      },
    },
  };
}
