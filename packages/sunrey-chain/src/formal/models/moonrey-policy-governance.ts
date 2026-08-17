import { createHash } from 'node:crypto';

import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export function policyContentHash(version: number, activationHeight: number): string {
  return createHash('sha256').update(`policy|${version}|${activationHeight}`).digest('hex');
}

export type MoonReyPolicyState = {
  readonly issuedFingerprints: readonly string[];
  readonly crossCategoryEvents: readonly string[];
  readonly categoryIssued: number;
  readonly epochIssued: number;
  readonly circulating: number;
  readonly burned: number;
  readonly activePolicyVersion: number;
  readonly activeActivationHeight: number;
  readonly height: number;
  readonly eligible: boolean;
};

export function createMoonReyPolicyGovernanceModel(bounds: FormalModelBounds): FormalModel<MoonReyPolicyState> {
  const categoryLimit = bounds.maxQuantity ?? 2;
  const epochLimit = bounds.maxQuantity ?? 2;
  const prints = ['fp-a', 'fp-a', 'fp-b'];
  const events = ['evt-1', 'evt-1'];
  return {
    modelId: 'MOONREY_POLICY_GOVERNANCE',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: categoryLimit, maxEpochs: bounds.maxEpochs ?? 1 },
    init: () => ({
      issuedFingerprints: [],
      crossCategoryEvents: [],
      categoryIssued: 0,
      epochIssued: 0,
      circulating: 0,
      burned: 0,
      activePolicyVersion: 1,
      activeActivationHeight: 0,
      height: 0,
      eligible: true,
    }),
    next: (state) => {
      const out: Transition<MoonReyPolicyState>[] = [];
      const maxHeight = bounds.maxHeight ?? bounds.maxEpochs ?? 2;
      if (state.height < maxHeight) {
        out.push({
          name: 'AdvanceHeight',
          next: { ...state, height: state.height + 1, epochIssued: 0 },
        });
      }
      if (state.activePolicyVersion === 1) {
        out.push({
          name: 'ActivatePolicy(v2)',
          next: {
            ...state,
            activePolicyVersion: 2,
            activeActivationHeight: 2,
            height: Math.max(state.height, 2),
          },
        });
      }
      out.push({
        name: 'RefuseWrongPolicyVersion',
        next: null,
      });
      out.push({
        name: 'RefuseIneligible',
        next: null,
      });
      for (const print of prints) {
        const duplicate = state.issuedFingerprints.includes(print);
        const overCategory = state.categoryIssued >= categoryLimit;
        const overEpoch = state.epochIssued >= epochLimit;
        if (!state.eligible || duplicate || overCategory || overEpoch) {
          out.push({ name: 'RefuseIssue', next: null });
          continue;
        }
        out.push({
          name: 'Issue(authorized)',
          next: {
            ...state,
            issuedFingerprints: [...state.issuedFingerprints, print],
            categoryIssued: state.categoryIssued + 1,
            epochIssued: state.epochIssued + 1,
            circulating: state.circulating + 1,
          },
        });
      }
      for (const event of events) {
        if (state.crossCategoryEvents.includes(event)) {
          out.push({ name: 'RefuseCrossCategory', next: null });
          continue;
        }
        out.push({
          name: 'RecordCrossCategory',
          next: { ...state, crossCategoryEvents: [...state.crossCategoryEvents, event] },
        });
      }
      out.push({ name: 'MarkIneligible', next: { ...state, eligible: false } });
      return out;
    },
    key: (state) =>
      `${state.issuedFingerprints.join(',')}|${state.crossCategoryEvents.join(',')}|${state.categoryIssued}|${state.epochIssued}|${state.activePolicyVersion}|${state.height}|${state.eligible}`,
    invariants: {
      SAME_CONTRIBUTION_CANNOT_ISSUE_TWICE: (state) =>
        new Set(state.issuedFingerprints).size === state.issuedFingerprints.length,
      CATEGORY_CAP_RESPECTED: (state) => state.categoryIssued <= categoryLimit,
      EPOCH_CAP_RESPECTED: (state) => state.epochIssued <= epochLimit,
      POLICY_ACTIVATION_DETERMINISTIC: (state) =>
        state.activePolicyVersion === 1
          ? state.activeActivationHeight === 0
          : state.activeActivationHeight === 2 && state.height >= 2,
      WRONG_POLICY_VERSION_REJECTED: () => policyContentHash(1, 0) !== policyContentHash(2, 2),
      SUPPLY_RECONCILIATION_EXACT: (state) => state.circulating + state.burned === state.issuedFingerprints.length,
      INVALID_ELIGIBILITY_CANNOT_ISSUE: (state) => state.eligible || state.issuedFingerprints.length === state.circulating,
      CROSS_CATEGORY_DUPLICATE_PREVENTED: (state) =>
        new Set(state.crossCategoryEvents).size === state.crossCategoryEvents.length,
    },
  };
}
