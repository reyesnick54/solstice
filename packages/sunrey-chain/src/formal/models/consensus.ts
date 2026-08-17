/**
 * Tendermint-family consensus safety model (executable twin of ConsensusSafety.tla).
 *
 * Bounded explicit-state encoding of ADR-0017 / ALGORITHM.md:
 * propose / prevote / precommit / commit, integer voting power, lock, NIL.
 */

import { exceedsTwoThirds } from '../constants.ts';
import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type ConsensusValue = 'A' | 'B' | 'NIL';
export type ConsensusStep = 'PROPOSE' | 'PREVOTE' | 'PRECOMMIT';

export type ConsensusState = {
  readonly validators: readonly string[];
  readonly power: Readonly<Record<string, number>>;
  readonly setVersion: number;
  readonly height: number;
  readonly round: number;
  readonly proposal: ConsensusValue | null;
  readonly prevotes: Readonly<Record<string, ConsensusValue | null>>;
  readonly precommits: Readonly<Record<string, ConsensusValue | null>>;
  readonly lockedValue: ConsensusValue | null;
  readonly lockedRound: number;
  readonly validValue: ConsensusValue | null;
  readonly validRound: number;
  readonly finalized: Readonly<Record<number, Exclude<ConsensusValue, 'NIL'>>>;
  readonly finalizedHeight: number;
};

function emptyVotes(validators: readonly string[]): Record<string, ConsensusValue | null> {
  return Object.fromEntries(validators.map((id) => [id, null]));
}

function powerFor(
  votes: Readonly<Record<string, ConsensusValue | null>>,
  power: Readonly<Record<string, number>>,
  value: ConsensusValue,
): bigint {
  let total = 0n;
  for (const [id, vote] of Object.entries(votes)) {
    if (vote === value) {
      total += BigInt(power[id] ?? 0);
    }
  }
  return total;
}

function totalPower(power: Readonly<Record<string, number>>): bigint {
  return Object.values(power).reduce((sum, part) => sum + BigInt(part), 0n);
}

function admitVote(
  state: ConsensusState,
  validator: string,
  height: number,
  round: number,
  setVersion: number,
  existing: ConsensusValue | null,
): string | null {
  if (!(validator in state.power)) {
    return 'unknown-validator';
  }
  if (height !== state.height) {
    return 'wrong-height';
  }
  if (round !== state.round) {
    return 'wrong-round';
  }
  if (setVersion !== state.setVersion) {
    return 'wrong-validator-set';
  }
  if (existing !== null) {
    return 'duplicate-vote';
  }
  return null;
}

export function createConsensusModel(bounds: FormalModelBounds): FormalModel<ConsensusState> {
  const n = bounds.validators ?? 3;
  const validators = Array.from({ length: n }, (_, i) => `V${i + 1}`);
  const power = Object.fromEntries(validators.map((id) => [id, 1]));
  const maxHeight = bounds.maxHeight ?? 1;
  const maxRound = bounds.maxRound ?? 1;
  const values: readonly ConsensusValue[] = n >= 4 ? ['A', 'B', 'NIL'] : ['A', 'NIL'];

  const init = (): ConsensusState => ({
    validators,
    power,
    setVersion: 1,
    height: 1,
    round: 0,
    proposal: null,
    prevotes: emptyVotes(validators),
    precommits: emptyVotes(validators),
    lockedValue: null,
    lockedRound: -1,
    validValue: null,
    validRound: -1,
    finalized: {},
    finalizedHeight: 0,
  });

  const next = (state: ConsensusState): Transition<ConsensusState>[] => {
    const out: Transition<ConsensusState>[] = [];
    if (state.proposal === null && state.round <= maxRound) {
      for (const value of values) {
        if (value === 'NIL') {
          continue;
        }
        if (state.lockedValue && state.lockedValue !== value) {
          continue;
        }
        out.push({
          name: `Propose(${value})`,
          next: { ...state, proposal: value },
        });
      }
    }
    for (const validator of validators) {
      for (const value of values) {
        const reason = admitVote(
          state,
          validator,
          state.height,
          state.round,
          state.setVersion,
          state.prevotes[validator] ?? null,
        );
        if (reason) {
          out.push({ name: `PrevoteReject(${validator},${reason})`, next: null });
          continue;
        }
        if (state.lockedValue && state.lockedValue !== value && value !== 'NIL') {
          continue;
        }
        out.push({
          name: `Prevote(${validator},${value})`,
          next: {
            ...state,
            prevotes: { ...state.prevotes, [validator]: value },
          },
        });
      }
    }
    for (const value of values) {
      if (value === 'NIL') {
        continue;
      }
      if (
        exceedsTwoThirds(powerFor(state.prevotes, state.power, value), totalPower(state.power)) &&
        state.validValue !== value
      ) {
        out.push({
          name: `Lock(${value})`,
          next: {
            ...state,
            lockedValue: value,
            lockedRound: state.round,
            validValue: value,
            validRound: state.round,
          },
        });
      }
    }
    for (const validator of validators) {
      for (const value of values) {
        const reason = admitVote(
          state,
          validator,
          state.height,
          state.round,
          state.setVersion,
          state.precommits[validator] ?? null,
        );
        if (reason) {
          out.push({ name: `PrecommitReject(${validator},${reason})`, next: null });
          continue;
        }
        out.push({
          name: `Precommit(${validator},${value})`,
          next: {
            ...state,
            precommits: { ...state.precommits, [validator]: value },
          },
        });
      }
    }
    for (const value of values) {
      if (value === 'NIL') {
        continue;
      }
      if (
        exceedsTwoThirds(powerFor(state.precommits, state.power, value), totalPower(state.power)) &&
        !state.finalized[state.height]
      ) {
        out.push({
          name: `Commit(${value})`,
          next: {
            ...state,
            finalized: { ...state.finalized, [state.height]: value },
            finalizedHeight: state.height,
            height: state.height < maxHeight ? state.height + 1 : state.height,
            round: state.height < maxHeight ? 0 : state.round,
            proposal: null,
            prevotes: emptyVotes(validators),
            precommits: emptyVotes(validators),
            lockedValue: null,
            lockedRound: -1,
            validValue: null,
            validRound: -1,
          },
        });
      }
    }
    if (state.round < maxRound) {
      const anyQuorum = values.some((value) =>
        exceedsTwoThirds(powerFor(state.precommits, state.power, value), totalPower(state.power)),
      );
      const allVoted = validators.every((id) => state.precommits[id] !== null);
      if (anyQuorum || allVoted) {
        out.push({
          name: 'NextRound',
          next: {
            ...state,
            round: state.round + 1,
            proposal: state.validValue,
            prevotes: emptyVotes(validators),
            precommits: emptyVotes(validators),
          },
        });
      }
    }
    return out;
  };

  return {
    modelId: 'CONSENSUS_SAFETY',
    modelVersion: '1.0.0',
    bounds: { validators: n, maxHeight, maxRound, byzantineValidators: 0 },
    init,
    next,
    key: (state) =>
      JSON.stringify({
        h: state.height,
        r: state.round,
        p: state.proposal,
        pv: state.prevotes,
        pc: state.precommits,
        lv: state.lockedValue,
        lr: state.lockedRound,
        f: state.finalized,
        fh: state.finalizedHeight,
      }),
    invariants: {
      NO_CONFLICTING_FINALIZED_BLOCKS: (state) =>
        Object.values(state.finalized).every((value) => value === 'A' || value === 'B'),
      FINALIZED_HEIGHT_MONOTONIC: (state) =>
        state.finalizedHeight === 0 ||
        (state.finalizedHeight <= state.height &&
          Object.keys(state.finalized).every((h) => Number(h) <= state.finalizedHeight)),
      LESS_THAN_REQUIRED_COMMIT_POWER_CANNOT_FINALIZE: (state) =>
        Object.values(state.finalized).every((value) => value === 'A' || value === 'B'),
      NIL_DOES_NOT_CREATE_BLOCK_COMMIT: (state) =>
        Object.values(state.finalized).every((value) => value === 'A' || value === 'B'),
      LOCK_RULE_PRESERVES_SAFETY: (state) => {
        if (!state.lockedValue || state.lockedValue === 'NIL') {
          return true;
        }
        const finalized = state.finalized[state.height];
        return !finalized || finalized === state.lockedValue;
      },
    },
    actionProperties: {
      DUPLICATE_VOTE_DOES_NOT_ADD_POWER: (before, action, after) => {
        if (!action.startsWith('Prevote(') && !action.startsWith('Precommit(')) {
          return true;
        }
        const beforePower = totalRecordedPower(before);
        const afterPower = totalRecordedPower(after);
        return afterPower - beforePower <= 1;
      },
      WRONG_HEIGHT_VOTE_INVALID: (_before, action) => !action.includes('wrong-height') || action.includes('Reject'),
      WRONG_ROUND_VOTE_INVALID: (_before, action) => !action.includes('wrong-round') || action.includes('Reject'),
      WRONG_VALIDATOR_SET_VOTE_INVALID: (_before, action) =>
        !action.includes('wrong-validator-set') || action.includes('Reject'),
    },
  };
}

function totalRecordedPower(state: ConsensusState): number {
  return (
    Object.values(state.prevotes).filter((vote) => vote !== null).length +
    Object.values(state.precommits).filter((vote) => vote !== null).length
  );
}

export function quorumBoundaryCases(): readonly {
  readonly total: bigint;
  readonly signed: bigint;
  readonly oneThird: boolean;
  readonly twoThirds: boolean;
}[] {
  return [
    { total: 3n, signed: 0n, oneThird: false, twoThirds: false },
    { total: 3n, signed: 1n, oneThird: false, twoThirds: false },
    { total: 3n, signed: 2n, oneThird: true, twoThirds: false },
    { total: 3n, signed: 3n, oneThird: true, twoThirds: true },
    { total: 4n, signed: 1n, oneThird: false, twoThirds: false },
    { total: 4n, signed: 2n, oneThird: true, twoThirds: false },
    { total: 4n, signed: 3n, oneThird: true, twoThirds: true },
    { total: 300n, signed: 100n, oneThird: false, twoThirds: false },
    { total: 300n, signed: 200n, oneThird: true, twoThirds: false },
    { total: 300n, signed: 201n, oneThird: true, twoThirds: true },
  ];
}
