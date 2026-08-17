import { createHash } from 'node:crypto';

import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export function contributionFingerprint(parts: readonly string[]): string {
  return createHash('sha256').update([...parts].sort().join('|')).digest('hex');
}

export type MoonReyState = {
  readonly issuedFingerprints: readonly string[];
  readonly categoryIssued: number;
  readonly epochIssued: number;
  readonly globalIssued: number;
  readonly circulating: number;
  readonly burned: number;
  readonly authorized: boolean;
};

export function createMoonReyModel(bounds: FormalModelBounds): FormalModel<MoonReyState> {
  const categoryLimit = bounds.maxQuantity ?? 2;
  const epochLimit = bounds.maxQuantity ?? 2;
  const globalLimit = 3;
  const prints = [
    contributionFingerprint(['a', 'b']),
    contributionFingerprint(['b', 'a']),
    contributionFingerprint(['c']),
  ];
  return {
    modelId: 'MOONREY_ISSUANCE',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: categoryLimit, maxEpochs: 1 },
    init: () => ({
      issuedFingerprints: [],
      categoryIssued: 0,
      epochIssued: 0,
      globalIssued: 0,
      circulating: 0,
      burned: 0,
      authorized: true,
    }),
    next: (state) => {
      const out: Transition<MoonReyState>[] = [];
      for (const print of prints) {
        const duplicate = state.issuedFingerprints.includes(print);
        const overCategory = state.categoryIssued >= categoryLimit;
        const overEpoch = state.epochIssued >= epochLimit;
        const overGlobal = state.globalIssued >= globalLimit;
        if (!state.authorized || duplicate || overCategory || overEpoch || overGlobal) {
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
            globalIssued: state.globalIssued + 1,
            circulating: state.circulating + 1,
          },
        });
      }
      out.push({ name: 'Unauthorize', next: { ...state, authorized: false } });
      return out;
    },
    key: (state) =>
      `${state.issuedFingerprints.slice().sort().join(',')}|${state.categoryIssued}|${state.authorized}`,
    invariants: {
      SAME_CONTRIBUTION_CANNOT_ISSUE_TWICE: (state) =>
        new Set(state.issuedFingerprints).size === state.issuedFingerprints.length,
      FINGERPRINT_REORDER_NOT_INDEPENDENT: () =>
        contributionFingerprint(['a', 'b']) === contributionFingerprint(['b', 'a']),
      CATEGORY_LIMIT: (state) => state.categoryIssued <= categoryLimit,
      EPOCH_LIMIT: (state) => state.epochIssued <= epochLimit,
      GLOBAL_LIMIT: (state) => state.globalIssued <= globalLimit,
      ISSUANCE_REQUIRES_AUTHORIZATION: (state) =>
        state.authorized || state.issuedFingerprints.length === state.globalIssued,
      SUPPLY_RECONCILES: (state) => state.circulating + state.burned === state.globalIssued,
    },
  };
}
