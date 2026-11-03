import { HELIOS_NATIVE13_LIQUIDITY_RULE_ID } from './constants.ts';
import type { LiquidityDecision, LiquidityEvaluateInput } from './types.ts';

export function evaluateLiquidityStrategy(input: LiquidityEvaluateInput): LiquidityDecision {
  const spread = input.book.spreadBps;
  if (spread === null) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_LIQUIDITY_RULE_ID,
      tradable: false,
      reason: 'UNKNOWN_SPREAD',
    });
  }
  if (spread > input.maxSpreadBps) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_LIQUIDITY_RULE_ID,
      tradable: false,
      reason: 'SPREAD_TOO_WIDE',
    });
  }
  if (input.book.bidDepthContracts < input.minBidDepth) {
    return Object.freeze({
      ruleId: HELIOS_NATIVE13_LIQUIDITY_RULE_ID,
      tradable: false,
      reason: 'INSUFFICIENT_BID_DEPTH',
    });
  }
  return Object.freeze({
    ruleId: HELIOS_NATIVE13_LIQUIDITY_RULE_ID,
    tradable: true,
    reason: 'LIQUIDITY_OK',
  });
}
