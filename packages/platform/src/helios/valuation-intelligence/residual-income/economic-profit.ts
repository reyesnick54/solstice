import type {
  EconomicProfitInput,
  EconomicProfitState,
  EconomicValueCreationState,
} from './types.ts';
import { VAL07_RATE_BPS_SCALE } from './taxonomy.ts';

const DEFAULT_NEUTRAL_TOLERANCE_BPS = 25;

export function computeEconomicProfitState(input: EconomicProfitInput): EconomicProfitState {
  if (input.investedCapital === 0) {
    return Object.freeze({
      periodIndex: input.periodIndex,
      nopat: input.nopat,
      investedCapital: input.investedCapital,
      roicBps: 0,
      waccBps: input.waccBps,
      economicProfit: 0,
      spreadBps: -input.waccBps,
    });
  }
  const roicDecimal = input.nopat / input.investedCapital;
  const roicBps = Math.round(roicDecimal * VAL07_RATE_BPS_SCALE);
  const spreadBps = roicBps - input.waccBps;
  const economicProfit = (roicDecimal - input.waccBps / VAL07_RATE_BPS_SCALE) * input.investedCapital;
  return Object.freeze({
    periodIndex: input.periodIndex,
    nopat: input.nopat,
    investedCapital: input.investedCapital,
    roicBps,
    waccBps: input.waccBps,
    economicProfit,
    spreadBps,
  });
}

export function classifyEconomicValueCreation(input: {
  readonly roicBps: number;
  readonly waccBps: number;
  readonly investedCapital: number;
  readonly economicProfit: number;
  readonly spreadNeutralToleranceBps?: number;
}): EconomicValueCreationState {
  const tolerance = input.spreadNeutralToleranceBps ?? DEFAULT_NEUTRAL_TOLERANCE_BPS;
  const spreadBps = input.roicBps - input.waccBps;
  let label: EconomicValueCreationState['label'] = 'UNCERTAIN';
  if (input.investedCapital <= 0 || !Number.isFinite(input.economicProfit)) {
    label = 'UNCERTAIN';
  } else if (Math.abs(spreadBps) <= tolerance) {
    label = 'VALUE_NEUTRAL';
  } else if (spreadBps > tolerance) {
    label = 'VALUE_CREATING';
  } else if (spreadBps < -tolerance) {
    label = 'VALUE_DESTROYING';
  }
  return Object.freeze({
    label,
    roicBps: input.roicBps,
    waccBps: input.waccBps,
    spreadBps,
    investedCapital: input.investedCapital,
    economicProfit: input.economicProfit,
    researchClassificationOnly: true,
  });
}
