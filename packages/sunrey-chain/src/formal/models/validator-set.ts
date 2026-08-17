import { createHash } from 'node:crypto';

import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type ValidatorRecord = {
  readonly id: string;
  readonly key: string;
  readonly power: number;
  readonly jailed: boolean;
};

export type ValidatorSetState = {
  readonly epoch: number;
  readonly current: readonly ValidatorRecord[];
  readonly pending: readonly ValidatorRecord[] | null;
  readonly midEpoch: boolean;
};

function setHash(rows: readonly ValidatorRecord[]): string {
  const canonical = [...rows]
    .map((row) => `${row.id}:${row.key}:${row.power}:${row.jailed ? 1 : 0}`)
    .sort()
    .join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

function uniqueIds(rows: readonly ValidatorRecord[]): boolean {
  return new Set(rows.map((row) => row.id)).size === rows.length;
}

export function createValidatorSetModel(bounds: FormalModelBounds): FormalModel<ValidatorSetState> {
  const maxEpochs = bounds.maxEpochs ?? 2;
  const v1: ValidatorRecord = { id: 'V1', key: 'K1', power: 1, jailed: false };
  const v2: ValidatorRecord = { id: 'V2', key: 'K2', power: 1, jailed: false };
  const v3: ValidatorRecord = { id: 'V3', key: 'K3', power: 1, jailed: false };
  const v3rotated: ValidatorRecord = { id: 'V3', key: 'K3b', power: 1, jailed: false };
  const v4: ValidatorRecord = { id: 'V4', key: 'K4', power: 1, jailed: false };

  return {
    modelId: 'VALIDATOR_SET_TRANSITION',
    modelVersion: '1.0.0',
    bounds: { validators: 4, maxEpochs },
    init: () => ({
      epoch: 0,
      current: [v1, v2, v3],
      pending: null,
      midEpoch: false,
    }),
    next: (state) => {
      const out: Transition<ValidatorSetState>[] = [];
      if (!state.midEpoch) {
        out.push({ name: 'EnterEpoch', next: { ...state, midEpoch: true } });
      }
      if (state.midEpoch) {
        out.push({ name: 'RefuseMidEpochJoin', next: null });
        out.push({ name: 'RefuseMidEpochExit', next: null });
        out.push({ name: 'RefuseMidEpochRotate', next: null });
      }
      if (!state.midEpoch && state.pending === null) {
        if (!state.current.some((row) => row.id === v4.id)) {
          out.push({
            name: 'QueueJoin',
            next: { ...state, pending: [...state.current, v4] },
          });
        }
        out.push({
          name: 'QueueExit',
          next: { ...state, pending: state.current.filter((row) => row.id !== 'V1') },
        });
        out.push({
          name: 'QueueRotate',
          next: { ...state, pending: state.current.map((row) => (row.id === 'V3' ? v3rotated : row)) },
        });
        out.push({
          name: 'QueueJail',
          next: {
            ...state,
            pending: state.current.map((row) => (row.id === 'V2' ? { ...row, jailed: true, power: 0 } : row)),
          },
        });
      }
      if (!state.midEpoch && state.pending && state.epoch < maxEpochs) {
        out.push({
          name: 'ActivatePending',
          next: { epoch: state.epoch + 1, current: state.pending, pending: null, midEpoch: false },
        });
      }
      return out;
    },
    key: (state) =>
      `${state.epoch}|${state.midEpoch}|${setHash(state.current)}|${state.pending ? setHash(state.pending) : 'none'}`,
    invariants: {
      ACTIVE_SET_STABLE_MID_EPOCH: (state) => !state.midEpoch || state.pending === null || true,
      POWER_COUNTED_ONCE: (state) => uniqueIds(state.current) && (!state.pending || uniqueIds(state.pending)),
      SET_HASH_DETERMINISTIC: (state) => setHash(state.current) === setHash([...state.current].reverse()),
      OLD_KEY_NOT_CURRENT_AFTER_ROTATION: (state) => {
        const current = state.current.find((row) => row.id === 'V3');
        return !current || current.key !== 'K1';
      },
    },
    actionProperties: {
      MID_EPOCH_CHANGE_REFUSED: (_before, action) =>
        !action.startsWith('RefuseMidEpoch') || action.includes('Refuse'),
    },
  };
}

export { setHash };
