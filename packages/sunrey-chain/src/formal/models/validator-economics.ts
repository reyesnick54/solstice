import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type ValidatorEconomicsState = {
  readonly epoch: number;
  readonly bonded: number;
  readonly pending: number;
  readonly available: number;
  readonly penalized: number;
  readonly unbondEpoch: number | null;
  readonly rewarded: boolean;
  readonly penaltyApplied: boolean;
  readonly customer: number;
  readonly policyVersion: number;
  readonly pool: number;
  readonly paid: number;
  readonly remainder: number;
};

const ISSUED = 2;
const CUSTOMER = 2;
const DELAY = 1;

export function createValidatorEconomicsModel(bounds: FormalModelBounds): FormalModel<ValidatorEconomicsState> {
  const maxEpoch = Math.min(bounds.maxEpochs ?? 2, 2);
  const maxQty = Math.min(bounds.maxQuantity ?? 2, 2);
  return {
    modelId: 'VALIDATOR_ECONOMICS',
    modelVersion: '1.0.0',
    bounds: { maxEpochs: maxEpoch, maxQuantity: maxQty, validators: 1 },
    init: () => ({
      epoch: 0,
      bonded: 0,
      pending: 0,
      available: ISSUED,
      penalized: 0,
      unbondEpoch: null,
      rewarded: false,
      penaltyApplied: false,
      customer: CUSTOMER,
      policyVersion: 1,
      pool: 0,
      paid: 0,
      remainder: 0,
    }),
    next: (state) => {
      const out: Transition<ValidatorEconomicsState>[] = [];
      if (state.bonded === 0 && state.pending === 0 && state.available > 0) {
        out.push({
          name: 'Bond',
          next: { ...state, bonded: 1, available: state.available - 1 },
        });
      }
      if (state.bonded > 0 && state.pending === 0) {
        out.push({
          name: 'RequestUnbond',
          next: {
            ...state,
            pending: state.bonded,
            bonded: 0,
            unbondEpoch: state.epoch,
          },
        });
      }
      if (state.epoch < maxEpoch) {
        out.push({ name: 'AdvanceEpoch', next: { ...state, epoch: state.epoch + 1 } });
      }
      if (state.pending > 0 && state.unbondEpoch !== null && state.epoch >= state.unbondEpoch + DELAY) {
        out.push({
          name: 'ReleaseUnbond',
          next: {
            ...state,
            available: state.available + state.pending,
            pending: 0,
            unbondEpoch: null,
          },
        });
      }
      out.push({ name: 'ImmediateUnbond', next: null });
      if (state.pool < maxQty) {
        out.push({ name: 'CreditPool', next: { ...state, pool: state.pool + 1 } });
      }
      if (!state.rewarded && state.pool > 0) {
        const paid = Math.floor(state.pool / 1);
        out.push({
          name: 'Reward',
          next: { ...state, rewarded: true, paid, remainder: 0, pool: 0 },
        });
      }
      out.push({ name: 'DuplicateReward', next: null });
      if (!state.penaltyApplied && state.bonded + state.pending > 0) {
        const slash = 1;
        const fromBonded = Math.min(state.bonded, slash);
        const fromPending = slash - fromBonded;
        out.push({
          name: 'Penalty',
          next: {
            ...state,
            bonded: state.bonded - fromBonded,
            pending: state.pending - fromPending,
            penalized: state.penalized + slash,
            penaltyApplied: true,
          },
        });
      }
      out.push({ name: 'DuplicatePenalty', next: null });
      out.push({ name: 'InvalidEvidence', next: null });
      out.push({ name: 'CustomerDebit', next: null });
      out.push({ name: 'WrongPolicyVersion', next: null });
      out.push({ name: 'RewardOverflow', next: null });
      return out;
    },
    key: (state) =>
      [
        state.epoch,
        state.bonded,
        state.pending,
        state.available,
        state.penalized,
        state.unbondEpoch ?? '-',
        state.rewarded ? 1 : 0,
        state.penaltyApplied ? 1 : 0,
        state.customer,
        state.policyVersion,
        state.pool,
        state.paid,
        state.remainder,
      ].join(','),
    invariants: {
      BOND_CONSERVATION: (state) =>
        state.bonded + state.pending + state.available + state.penalized === ISSUED,
      NO_DUPLICATE_REWARD: (state) => state.paid <= ISSUED,
      NO_DUPLICATE_PENALTY: (state) => state.penalized <= 1,
      UNBOND_DELAY_RESPECTED: (state) =>
        state.pending === 0 || state.unbondEpoch === null || state.epoch >= state.unbondEpoch,
      CUSTOMER_ASSETS_UNAFFECTED: (state) => state.customer === CUSTOMER,
      INVALID_EVIDENCE_CANNOT_CREATE_PROTOCOL_PENALTY: (state) =>
        !state.penaltyApplied || state.penalized > 0,
      POLICY_VERSION_DETERMINISTIC: (state) => state.policyVersion === 1,
    },
    actionProperties: {
      UNBOND_DELAY_RESPECTED: (before, action, after) => {
        if (action !== 'ReleaseUnbond') {
          return true;
        }
        return before.unbondEpoch !== null && before.epoch >= before.unbondEpoch + DELAY && after.pending === 0;
      },
      CUSTOMER_ASSETS_UNAFFECTED: (_before, _action, after) => after.customer === CUSTOMER,
      POLICY_VERSION_DETERMINISTIC: (_before, _action, after) => after.policyVersion === 1,
    },
  };
}
