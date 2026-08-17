import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export const MODEL_CRYPTO_STATES = [
  'CLASSICAL_ONLY',
  'HYBRID_AVAILABLE',
  'HYBRID_REQUIRED_SELECTED_ROLES',
  'PQ_PRIMARY',
  'LEGACY_VERIFY_ONLY',
] as const;
export type ModelCryptoState = (typeof MODEL_CRYPTO_STATES)[number];

const ORDER: Readonly<Record<ModelCryptoState, number>> = {
  CLASSICAL_ONLY: 0,
  HYBRID_AVAILABLE: 1,
  HYBRID_REQUIRED_SELECTED_ROLES: 2,
  PQ_PRIMARY: 3,
  LEGACY_VERIFY_ONLY: 4,
};

export type CryptoPolicyState = {
  readonly chainPolicy: ModelCryptoState;
  readonly localConfig: ModelCryptoState;
  readonly governed: boolean;
  readonly lastAuthSuite: 'CLASSICAL' | 'HYBRID' | 'PQ';
  readonly historicalVerifyRetained: true;
};

export function createCryptoPolicyModel(_bounds: FormalModelBounds): FormalModel<CryptoPolicyState> {
  return {
    modelId: 'CRYPTO_POLICY_MIGRATION',
    modelVersion: '1.0.0',
    bounds: {},
    init: () => ({
      chainPolicy: 'CLASSICAL_ONLY',
      localConfig: 'CLASSICAL_ONLY',
      governed: false,
      lastAuthSuite: 'CLASSICAL',
      historicalVerifyRetained: true,
    }),
    next: (state) => {
      const out: Transition<CryptoPolicyState>[] = [];
      const idx = ORDER[state.chainPolicy];
      const nextState = MODEL_CRYPTO_STATES[idx + 1];
      if (nextState) {
        out.push({
          name: `GovernedAdvance(${nextState})`,
          next: {
            ...state,
            chainPolicy: nextState,
            governed: true,
            lastAuthSuite: ORDER[nextState] >= ORDER.HYBRID_REQUIRED_SELECTED_ROLES ? 'HYBRID' : state.lastAuthSuite,
          },
        });
      }
      out.push({ name: 'LocalWeaken', next: null });
      if (state.chainPolicy === 'HYBRID_REQUIRED_SELECTED_ROLES' || state.chainPolicy === 'PQ_PRIMARY') {
        out.push({ name: 'ClassicalAuthorizeHybridRole', next: null });
        out.push({
          name: 'HybridAuthorize',
          next: { ...state, lastAuthSuite: 'HYBRID' },
        });
      }
      if (state.chainPolicy === 'LEGACY_VERIFY_ONLY') {
        out.push({
          name: 'HistoricalVerifyClassical',
          next: { ...state, historicalVerifyRetained: true },
        });
      }
      return out;
    },
    key: (state) => `${state.chainPolicy}|${state.lastAuthSuite}|${state.governed}`,
    invariants: {
      TRANSITION_ONLY_THROUGH_GOVERNANCE: (state) =>
        state.chainPolicy === 'CLASSICAL_ONLY' || state.governed,
      HYBRID_REQUIRED_REJECTS_CLASSICAL_AUTH: (state) =>
        state.chainPolicy !== 'HYBRID_REQUIRED_SELECTED_ROLES' || state.lastAuthSuite !== 'CLASSICAL' || !state.governed,
      HISTORICAL_VERIFY_RETAINED: (state) => state.historicalVerifyRetained,
      LOCAL_CONFIG_CANNOT_WEAKEN: (state) => ORDER[state.localConfig] <= ORDER[state.chainPolicy] || state.localConfig === state.chainPolicy,
    },
  };
}
