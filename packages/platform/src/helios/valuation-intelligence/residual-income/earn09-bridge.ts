/**
 * VAL07 bridge — forward anchors from EARN09 probabilistic earnings state.
 */

import type { ProbabilisticEarningsState } from '../../earnings-intelligence/state-estimator/types.ts';
import { VAL01_EARN09_BRIDGE_VERSION } from '../earn09-bridge.ts';

export const VAL07_EARN09_BRIDGE_VERSION = 'helios-val07-earn09-residual-income-bridge-v1' as const;

export type Earn09ForwardEquityAnchor = {
  readonly bridgeVersion: typeof VAL07_EARN09_BRIDGE_VERSION;
  readonly earn09BridgeVersion: typeof VAL01_EARN09_BRIDGE_VERSION;
  readonly asOf: ProbabilisticEarningsState['asOf'];
  readonly forwardNetIncomePerShare: number | null;
  readonly forwardRoeDecimal: number | null;
  readonly impliedBookEquityEvolutionPerShare: number | null;
};

export function forwardNetIncomeFromEarn09(
  state: ProbabilisticEarningsState,
  sharesOutstanding: number,
): number | null {
  const epsRaw = state.nextQuarterEps?.pointEstimate;
  if (!epsRaw || sharesOutstanding <= 0) {
    return null;
  }
  const eps = Number(epsRaw);
  if (!Number.isFinite(eps)) {
    return null;
  }
  return eps * sharesOutstanding;
}

export function forwardRoeFromEarn09AndBook(input: {
  readonly state: ProbabilisticEarningsState;
  readonly beginningBookEquity: number;
  readonly sharesOutstanding: number;
}): number | null {
  const netIncome = forwardNetIncomeFromEarn09(input.state, input.sharesOutstanding);
  if (netIncome === null || input.beginningBookEquity === 0) {
    return null;
  }
  return netIncome / input.beginningBookEquity;
}

export function buildEarn09ForwardEquityAnchor(input: {
  readonly state: ProbabilisticEarningsState;
  readonly beginningBookEquity: number;
  readonly sharesOutstanding: number;
  readonly retentionRatio?: number;
}): Earn09ForwardEquityAnchor {
  const forwardNetIncomePerShare =
    input.sharesOutstanding > 0
      ? (forwardNetIncomeFromEarn09(input.state, input.sharesOutstanding) ?? 0) /
        input.sharesOutstanding
      : null;
  const forwardRoeDecimal = forwardRoeFromEarn09AndBook(input);
  const retention = input.retentionRatio ?? 1;
  const impliedBookEvolution =
    forwardNetIncomePerShare !== null
      ? forwardNetIncomePerShare * retention
      : null;

  return Object.freeze({
    bridgeVersion: VAL07_EARN09_BRIDGE_VERSION,
    earn09BridgeVersion: VAL01_EARN09_BRIDGE_VERSION,
    asOf: input.state.asOf,
    forwardNetIncomePerShare,
    forwardRoeDecimal,
    impliedBookEquityEvolutionPerShare: impliedBookEvolution,
  });
}
