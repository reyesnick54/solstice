import type { UtcInstant } from '@solstice/domain';

import type { ShadowCapitalPortfolioBook } from '../alpha04-shadow-capital/shadow-portfolio-book.ts';
import {
  ALPHA21_CONTINUOUS_SHADOW_RUNTIME_SCHEMA,
  type PortfolioRuntimeMode,
} from './taxonomy.ts';
import type {
  ActiveStrategyConfig,
  BenchmarkNavState,
  CertifiedMarketState,
  PortfolioDrawdownState,
  PortfolioRuntimePosture,
  PortfolioRuntimeState,
  ScheduledOutcome,
} from './types.ts';

export function computeDrawdown(input: {
  readonly navMinor: bigint;
  readonly previousPeakNavMinor: bigint;
}): { readonly peak: bigint; readonly drawdown: PortfolioDrawdownState } {
  const peak = input.navMinor > input.previousPeakNavMinor ? input.navMinor : input.previousPeakNavMinor;
  const drawdownMinor = peak - input.navMinor;
  const drawdownBps = peak === 0n ? 0 : Number((drawdownMinor * 10_000n) / peak);
  return Object.freeze({
    peak,
    drawdown: Object.freeze({
      peakNavMinor: peak.toString(),
      drawdownMinor: drawdownMinor.toString(),
      drawdownBps,
    }),
  });
}

export function buildPortfolioRuntimeState(input: {
  readonly runtimeId: string;
  readonly mode: PortfolioRuntimeMode;
  readonly posture: PortfolioRuntimePosture;
  readonly book: ShadowCapitalPortfolioBook;
  readonly asOf: UtcInstant;
  readonly activeStrategyIds: readonly string[];
  readonly marketSessions: readonly CertifiedMarketState[];
  readonly pendingOutcomes: readonly ScheduledOutcome[];
  readonly sequence: number;
  readonly previousPeakNavMinor: bigint;
  readonly benchmark: BenchmarkNavState;
}): PortfolioRuntimeState {
  const pnl = input.book.computePnL();
  const nav = BigInt(pnl.navMinor);
  const { drawdown } = computeDrawdown({
    navMinor: nav,
    previousPeakNavMinor: input.previousPeakNavMinor,
  });
  const snapshot = input.book.snapshot();
  return Object.freeze({
    schema: ALPHA21_CONTINUOUS_SHADOW_RUNTIME_SCHEMA,
    runtimeId: input.runtimeId,
    mode: input.mode,
    posture: input.posture,
    asOf: input.asOf,
    cash: Object.freeze({
      currency: snapshot.cash.currency,
      settledMinor: snapshot.cash.settledMinor,
      unsettledMinor: snapshot.cash.unsettledMinor,
      reservedMinor: snapshot.cash.reservedMinor,
    }),
    pnl: Object.freeze({
      realizedMinor: pnl.realizedMinor,
      unrealizedMinor: pnl.unrealizedMinor,
      feesMinor: pnl.feesMinor,
      navMinor: pnl.navMinor,
    }),
    exposure: Object.freeze({
      grossExposureMinor: pnl.grossExposureMinor,
      netExposureMinor: pnl.netExposureMinor,
    }),
    drawdown,
    benchmark: input.benchmark,
    positionCount: snapshot.positions.length,
    activeStrategyIds: input.activeStrategyIds,
    marketSessions: input.marketSessions,
    pendingOutcomes: input.pendingOutcomes,
    sequence: input.sequence,
  });
}

export function uniqueInstrumentIds(strategies: readonly ActiveStrategyConfig[]): readonly string[] {
  const set = new Set<string>();
  for (const row of strategies) {
    for (const instrumentId of row.instrumentIds) {
      set.add(instrumentId);
    }
  }
  return Object.freeze([...set]);
}
