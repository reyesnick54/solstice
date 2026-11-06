import type { StrategyAdversary, BullStrategyAgentView, FailureHypothesis, StrategyFalsificationContext } from './types.ts';

function bearHypotheses(ctx: StrategyFalsificationContext): readonly FailureHypothesis[] {
  return Object.freeze([
    {
      hypothesisId: `h_bear_regime_${ctx.strategyId}`,
      statement: 'Edge may be a single-regime artifact that breaks under REGIME_CHANGE or VOLATILITY_SHOCK.',
      relatedChallenge: 'REGIME_CHANGE',
    },
    {
      hypothesisId: `h_bear_crowd_${ctx.strategyId}`,
      statement: 'Serious crowding may collapse alpha when CROWDING_PROXY rises alongside LIQUIDITY_SHOCK.',
      relatedChallenge: 'CROWDING_PROXY',
    },
  ]);
}

function leakageHypotheses(ctx: StrategyFalsificationContext): readonly FailureHypothesis[] {
  return Object.freeze([
    {
      hypothesisId: `h_leak_pit_${ctx.strategyId}`,
      statement: 'Point-in-time integrity may fail under FEATURE_REVISION or DELAYED_SIGNAL replay.',
      relatedChallenge: 'FEATURE_REVISION',
    },
  ]);
}

function overfitHypotheses(ctx: StrategyFalsificationContext): readonly FailureHypothesis[] {
  return Object.freeze([
    {
      hypothesisId: `h_overfit_param_${ctx.strategyId}`,
      statement: 'Reported edge may rely on PARAMETER_PERTURBATION luck or trial selection.',
      relatedChallenge: 'PARAMETER_PERTURBATION',
    },
    {
      hypothesisId: `h_overfit_missing_${ctx.strategyId}`,
      statement: 'Sparse trials explode apparent edge when MISSING_DATA gaps are ignored.',
      relatedChallenge: 'MISSING_DATA',
    },
  ]);
}

function executionHypotheses(ctx: StrategyFalsificationContext): readonly FailureHypothesis[] {
  return Object.freeze([
    {
      hypothesisId: `h_exec_slip_${ctx.strategyId}`,
      statement: 'Net edge may vanish after SLIPPAGE, SPREAD_WIDENING, TRANSACTION_COST_INCREASE stack.',
      relatedChallenge: 'SLIPPAGE',
    },
    {
      hypothesisId: `h_exec_latent_${ctx.strategyId}`,
      statement: 'LATENCY and PARTIAL_FILLS may erase working paper returns.',
      relatedChallenge: 'LATENCY',
    },
  ]);
}

/** Strongest attack — proposes failure modes; does not qualify. */
export const bearStrategyAdversary: StrategyAdversary = Object.freeze({
  adversaryId: 'BEAR_STRATEGY',
  role: 'BEAR',
  proposeHypotheses: bearHypotheses,
});

export const leakageHunterAdversary: StrategyAdversary = Object.freeze({
  adversaryId: 'LEAKAGE_HUNTER',
  role: 'LEAKAGE_HUNTER',
  proposeHypotheses: leakageHypotheses,
});

export const overfitHunterAdversary: StrategyAdversary = Object.freeze({
  adversaryId: 'OVERFIT_HUNTER',
  role: 'OVERFIT_HUNTER',
  proposeHypotheses: overfitHypotheses,
});

export const executionRealityAdversary: StrategyAdversary = Object.freeze({
  adversaryId: 'EXECUTION_REALITY',
  role: 'EXECUTION_REALITY',
  proposeHypotheses: executionHypotheses,
});

export function runBullStrategyAgent(ctx: StrategyFalsificationContext): BullStrategyAgentView {
  return Object.freeze({
    agentId: 'BULL_STRATEGY',
    strongestCaseSummary: `Strategy ${ctx.strategyId} shows ${ctx.baselineEdgeBps} bps baseline edge before stress; merits adversarial falsification, not promotion by agent fiat.`,
  });
}
