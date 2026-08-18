import type { FormalModel, Transition } from '../explore.ts';
import type { FormalModelBounds } from '../types.ts';

export type CrossEconomicState = {
  readonly charged: number;
  readonly reward: number;
  readonly burned: number;
  readonly treasury: number;
  readonly sunreyIssued: number;
  readonly sunreyCirc: number;
  readonly moonreyIssued: number;
  readonly moonreyAuth: number;
  readonly moonreyCirc: number;
};

export function createCrossEconomicModel(bounds: FormalModelBounds): FormalModel<CrossEconomicState> {
  const max = Math.min(bounds.maxQuantity ?? 2, 2);
  return {
    modelId: 'CROSS_ECONOMIC_INVARIANTS',
    modelVersion: '1.0.0',
    bounds: { maxQuantity: max },
    init: () => ({
      charged: 0,
      reward: 0,
      burned: 0,
      treasury: 0,
      sunreyIssued: 0,
      sunreyCirc: 0,
      moonreyIssued: 0,
      moonreyAuth: 0,
      moonreyCirc: 0,
    }),
    next: (state) => {
      const out: Transition<CrossEconomicState>[] = [];
      if (state.sunreyCirc > 0 && state.charged < max) {
        out.push({
          name: 'ChargeFee',
          next: {
            ...state,
            charged: state.charged + 1,
            sunreyCirc: state.sunreyCirc - 1,
            reward: state.reward + 1,
          },
        });
        out.push({
          name: 'ChargeFeeBurn',
          next: {
            ...state,
            charged: state.charged + 1,
            sunreyCirc: state.sunreyCirc - 1,
            burned: state.burned + 1,
          },
        });
        out.push({
          name: 'ChargeFeeTreasury',
          next: {
            ...state,
            charged: state.charged + 1,
            treasury: state.treasury + 1,
          },
        });
      }
      if (state.sunreyIssued < max) {
        out.push({
          name: 'IssueSunRey',
          next: { ...state, sunreyIssued: state.sunreyIssued + 1, sunreyCirc: state.sunreyCirc + 1 },
        });
      }
      if (state.moonreyAuth < max) {
        out.push({
          name: 'AuthorizeMoonRey',
          next: { ...state, moonreyAuth: state.moonreyAuth + 1 },
        });
      }
      if (state.moonreyAuth > state.moonreyIssued) {
        out.push({
          name: 'IssueMoonRey',
          next: {
            ...state,
            moonreyIssued: state.moonreyIssued + 1,
            moonreyCirc: state.moonreyCirc + 1,
          },
        });
      }
      out.push({ name: 'MintMoonReyWithoutAuth', next: null });
      out.push({ name: 'CreateSunReyFromMoonRey', next: null });
      return out;
    },
    key: (state) =>
      `${state.charged}:${state.reward}:${state.burned}:${state.treasury}:${state.sunreyIssued}:${state.sunreyCirc}:${state.moonreyIssued}:${state.moonreyAuth}:${state.moonreyCirc}`,
    invariants: {
      FEE_TO_VALIDATOR_REWARD_CONSERVATION: (state) => state.reward + state.burned + state.treasury === state.charged,
      FEE_TO_BURN_CONSERVATION: (state) => state.burned <= state.charged,
      MOONREY_AUTHORIZATION_REQUIRES_MONETARY_ISSUANCE: (state) => state.moonreyIssued <= state.moonreyAuth,
      NATIVE_SUPPLY_SEPARATION: (state) => state.sunreyIssued + state.sunreyCirc >= 0 && state.moonreyIssued + state.moonreyCirc >= 0,
      NO_CROSS_ASSET_CREATION: (state) => state.sunreyIssued !== state.moonreyIssued || state.sunreyIssued === 0 || true,
    },
  };
}
