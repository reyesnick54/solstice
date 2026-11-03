import { HELIOS_NATIVE13_CROSS_MARKET_RULE_ID, PREDICTION_PROBABILITY_SCALE_MINOR } from './constants.ts';
import type { CrossMarketConsistencyInput, CrossMarketConsistencyResult } from './types.ts';

export function evaluateCrossMarketConsistency(
  input: CrossMarketConsistencyInput,
): CrossMarketConsistencyResult {
  const { yesMidMinor, noMidMinor } = input.pair;
  if (yesMidMinor === null || noMidMinor === null) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_CROSS_MARKET_RULE_ID,
      consistent: false,
      complementGapMinor: null,
      reason: 'MISSING_MID',
    });
  }
  const sum = yesMidMinor + noMidMinor;
  const gap =
    sum > PREDICTION_PROBABILITY_SCALE_MINOR
      ? sum - PREDICTION_PROBABILITY_SCALE_MINOR
      : PREDICTION_PROBABILITY_SCALE_MINOR - sum;
  if (gap > input.maxComplementGapMinor) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_CROSS_MARKET_RULE_ID,
      consistent: false,
      complementGapMinor: gap,
      reason: 'COMPLEMENT_GAP_EXCEEDED',
    });
  }
  return Object.freeze({
    ruleId: HELIOS_NATIVE13_CROSS_MARKET_RULE_ID,
    consistent: true,
    complementGapMinor: gap,
    reason: 'CONSISTENT',
  });
}
