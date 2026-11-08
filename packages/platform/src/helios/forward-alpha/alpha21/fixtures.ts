import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import type { PortfolioRuntimePorts, PaperFillRecord } from './types.ts';

export const ALPHA21_FIXTURE_STARTING_NOTIONAL = '100000000';

export const alpha21MultiMarketStrategies = () =>
  Object.freeze([
    Object.freeze({
      strategyId: 'strat_crypto_momentum',
      instrumentIds: Object.freeze(['CRYPTO:BTC:USD']),
      extendedHoursPermitted: false,
    }),
    Object.freeze({
      strategyId: 'strat_equity_mr',
      instrumentIds: Object.freeze(['SECURITY:US:SPY:ARCX']),
      extendedHoursPermitted: false,
    }),
    Object.freeze({
      strategyId: 'strat_equity_extended',
      instrumentIds: Object.freeze(['SECURITY:US:AAPL:XNAS']),
      extendedHoursPermitted: true,
    }),
    Object.freeze({
      strategyId: 'strat_futures_trend',
      instrumentIds: Object.freeze(['FUT:CL:2026-10']),
      extendedHoursPermitted: false,
    }),
    Object.freeze({
      strategyId: 'strat_fx_carry',
      instrumentIds: Object.freeze(['FX:EURUSD']),
      extendedHoursPermitted: false,
    }),
  ]);

export function defaultAlpha21Ports(input?: {
  readonly tradeOnTick?: boolean;
  readonly blockRiskFor?: readonly string[];
}): PortfolioRuntimePorts {
  const block = new Set(input?.blockRiskFor ?? []);
  return Object.freeze({
    produceStrategyDecision: ({ strategyId, certifiedStates }) => {
      const open = certifiedStates.find((row) => row.sessionOpen);
      if (!open || !(input?.tradeOnTick ?? true)) {
        return { action: 'NO_ACTION' };
      }
      if (strategyId === 'strat_equity_mr' && open.marketState === 'PRE_MARKET') {
        return { action: 'NO_ACTION' };
      }
      return {
        action: 'TRADE',
        instrumentId: open.instrumentId,
        side: 'BUY',
        quantityMinor: 10n,
        priceMinor: 1_000_000n,
        feeMinor: 1_000n,
      };
    },
    riskPermits: ({ strategyId }) => !block.has(strategyId),
    capitalAllocationMinor: () => 50_000_000n,
    executionPlanId: ({ strategyId, instrumentId }) => `plan_${strategyId}_${instrumentId}`,
    routePaperFill: (fillInput): PaperFillRecord =>
      Object.freeze({
        fillId: `paper_fill_${randomUUID().slice(0, 8)}`,
        strategyId: fillInput.strategyId,
        instrumentId: fillInput.instrumentId,
        side: fillInput.side,
        quantityMinor: fillInput.quantityMinor.toString(),
        priceMinor: fillInput.priceMinor.toString(),
        feeMinor: fillInput.feeMinor.toString(),
        routedVia: 'EXECUTION_TWIN',
        externalBrokerSubmitted: false,
        filledAt: fillInput.at,
      }),
  });
}

export function alpha21ScenarioTimes(): Readonly<Record<string, UtcInstant>> {
  return Object.freeze({
    cryptoWeekend: '2026-09-19T15:00:00.000Z' as UtcInstant,
    equityRegular: '2026-09-16T15:00:00.000Z' as UtcInstant,
    equityPreMarket: '2026-09-16T12:00:00.000Z' as UtcInstant,
    equityPostMarket: '2026-09-16T21:00:00.000Z' as UtcInstant,
    equityHoliday: '2026-01-01T15:00:00.000Z' as UtcInstant,
    futuresEvening: '2026-09-15T22:30:00.000Z' as UtcInstant,
    fxMidweek: '2026-09-17T15:00:00.000Z' as UtcInstant,
    fxWeekend: '2026-09-20T15:00:00.000Z' as UtcInstant,
  });
}
