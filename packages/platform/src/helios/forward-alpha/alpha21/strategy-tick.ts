import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { ShadowCapitalPortfolioBook } from '../alpha04-shadow-capital/shadow-portfolio-book.ts';
import type { ShadowTrade } from '../alpha04-shadow-capital/types.ts';
import type {
  ActiveStrategyConfig,
  CertifiedMarketState,
  PaperFillRecord,
  PortfolioRuntimePorts,
  ScheduledOutcome,
  StrategyTickRecord,
} from './types.ts';
import type { StrategyTickStage } from './taxonomy.ts';

function isTrade(
  result: ShadowTrade | { readonly code: string },
): result is ShadowTrade {
  return 'tradeId' in result;
}

export function runStrategyTick(input: {
  readonly strategy: ActiveStrategyConfig;
  readonly certifiedStates: readonly CertifiedMarketState[];
  readonly at: UtcInstant;
  readonly ports: PortfolioRuntimePorts;
  readonly book: ShadowCapitalPortfolioBook;
  readonly mode: 'SHADOW' | 'PAPER';
}): {
  readonly record: StrategyTickRecord;
  readonly fill: PaperFillRecord | null;
  readonly scheduled: ScheduledOutcome | null;
} {
  const stages: StrategyTickStage[] = [];
  const relevant = input.certifiedStates.filter((row) => input.strategy.instrumentIds.includes(row.instrumentId));
  stages.push('CERTIFIED_MARKET_STATE');

  const marketClosed = relevant.length === 0 || relevant.every((row) => !row.sessionOpen);
  if (marketClosed) {
    return Object.freeze({
      record: Object.freeze({
        tickId: `alpha21_tick_${randomUUID().slice(0, 8)}`,
        strategyId: input.strategy.strategyId,
        at: input.at,
        stagesCompleted: Object.freeze(stages),
        marketClosed: true,
        riskBlocked: false,
        fill: null,
        shadowTrade: null,
      }),
      fill: null,
      scheduled: null,
    });
  }

  const decision = input.ports.produceStrategyDecision({
    strategyId: input.strategy.strategyId,
    certifiedStates: relevant,
    at: input.at,
  });
  stages.push('STRATEGY_DECISION');
  if (decision.action === 'NO_ACTION') {
    return Object.freeze({
      record: Object.freeze({
        tickId: `alpha21_tick_${randomUUID().slice(0, 8)}`,
        strategyId: input.strategy.strategyId,
        at: input.at,
        stagesCompleted: Object.freeze(stages),
        marketClosed: false,
        riskBlocked: false,
        fill: null,
        shadowTrade: null,
      }),
      fill: null,
      scheduled: null,
    });
  }

  stages.push('RISK');
  if (!input.ports.riskPermits({ strategyId: input.strategy.strategyId, at: input.at })) {
    return Object.freeze({
      record: Object.freeze({
        tickId: `alpha21_tick_${randomUUID().slice(0, 8)}`,
        strategyId: input.strategy.strategyId,
        at: input.at,
        stagesCompleted: Object.freeze(stages),
        marketClosed: false,
        riskBlocked: true,
        fill: null,
        shadowTrade: null,
      }),
      fill: null,
      scheduled: null,
    });
  }

  stages.push('CAPITAL_ALLOCATION');
  const cap = input.ports.capitalAllocationMinor({
    strategyId: input.strategy.strategyId,
    instrumentId: decision.instrumentId,
    at: input.at,
  });
  if (cap === null || cap <= 0n) {
    return Object.freeze({
      record: Object.freeze({
        tickId: `alpha21_tick_${randomUUID().slice(0, 8)}`,
        strategyId: input.strategy.strategyId,
        at: input.at,
        stagesCompleted: Object.freeze(stages),
        marketClosed: false,
        riskBlocked: false,
        fill: null,
        shadowTrade: null,
      }),
      fill: null,
      scheduled: null,
    });
  }

  stages.push('EXECUTION_PLAN');
  const planId = input.ports.executionPlanId({
    strategyId: input.strategy.strategyId,
    instrumentId: decision.instrumentId,
  });

  stages.push('PAPER_ROUTE');
  const fill = input.ports.routePaperFill({
    strategyId: input.strategy.strategyId,
    instrumentId: decision.instrumentId,
    side: decision.side,
    quantityMinor: decision.quantityMinor,
    priceMinor: decision.priceMinor,
    feeMinor: decision.feeMinor,
    executionPlanId: planId,
    at: input.at,
  });
  stages.push('FILL_RECORD');

  const tradeResult = input.book.applyTrade({
    instrumentId: decision.instrumentId,
    strategyId: input.strategy.strategyId,
    side: decision.side,
    quantityMinor: decision.quantityMinor,
    priceMinor: decision.priceMinor,
    feeMinor: decision.feeMinor,
    tradeAt: input.at,
  });
  stages.push('POSITION_UPDATE');
  const shadowTrade = isTrade(tradeResult) ? tradeResult : null;

  const scheduled: ScheduledOutcome = Object.freeze({
    outcomeId: `alpha21_out_${randomUUID().slice(0, 8)}`,
    strategyId: input.strategy.strategyId,
    kind: 'SETTLEMENT',
    dueAt: input.at,
    instrumentId: decision.instrumentId,
  });
  stages.push('OUTCOME_SCHEDULE');

  return Object.freeze({
    record: Object.freeze({
      tickId: `alpha21_tick_${randomUUID().slice(0, 8)}`,
      strategyId: input.strategy.strategyId,
      at: input.at,
      stagesCompleted: Object.freeze(stages),
      marketClosed: false,
      riskBlocked: false,
      fill: input.mode === 'PAPER' ? fill : null,
      shadowTrade,
    }),
    fill: input.mode === 'PAPER' ? fill : null,
    scheduled,
  });
}
