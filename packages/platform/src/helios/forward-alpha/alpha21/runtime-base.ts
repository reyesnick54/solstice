import { randomUUID } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { registerShadowCapitalAccount, ShadowCapitalPortfolioBook } from '../alpha04-shadow-capital/index.ts';
import { sealDailyPortfolioSnapshot } from './daily-snapshot.ts';
import { MarketSessionCoordinator } from './market-session-coordinator.ts';
import { buildPortfolioRuntimeState } from './portfolio-nav.ts';
import { runStrategyTick } from './strategy-tick.ts';
import type { PortfolioRuntimeMode } from './taxonomy.ts';
import type {
  ActiveStrategyConfig,
  BenchmarkNavState,
  ImmutableDailyPortfolioSnapshot,
  PaperFillRecord,
  PortfolioRuntimePorts,
  PortfolioRuntimePosture,
  PortfolioRuntimeState,
  ScheduledOutcome,
  StrategyTickRecord,
} from './types.ts';

export type PortfolioRuntimeOptions = {
  readonly runtimeId?: string;
  readonly mode: PortfolioRuntimeMode;
  readonly posture: PortfolioRuntimePosture;
  readonly startingNotionalMinor: string;
  readonly currency: string;
  readonly benchmarkId: string;
  readonly strategies: readonly ActiveStrategyConfig[];
  readonly ports: PortfolioRuntimePorts;
  readonly coordinator?: MarketSessionCoordinator;
  readonly registeredAt: UtcInstant;
};

export class PortfolioRuntimeBase {
  readonly runtimeId: string;
  readonly mode: PortfolioRuntimeMode;
  readonly posture: PortfolioRuntimePosture;
  readonly strategies: readonly ActiveStrategyConfig[];
  readonly ports: PortfolioRuntimePorts;
  readonly coordinator: MarketSessionCoordinator;
  readonly book: ShadowCapitalPortfolioBook;
  private peakNavMinor: bigint;
  private sequence = 0;
  private readonly fills: PaperFillRecord[] = [];
  private readonly ticks: StrategyTickRecord[] = [];
  private readonly pendingOutcomes: ScheduledOutcome[] = [];
  private readonly benchmarkId: string;

  constructor(options: PortfolioRuntimeOptions) {
    this.runtimeId = options.runtimeId ?? `alpha21_rt_${randomUUID().slice(0, 8)}`;
    this.mode = options.mode;
    this.posture = options.posture;
    this.strategies = options.strategies;
    this.ports = options.ports;
    this.coordinator = options.coordinator ?? new MarketSessionCoordinator();
    this.benchmarkId = options.benchmarkId;
    const strategyIds = Object.freeze(options.strategies.map((row) => row.strategyId));
    const account = registerShadowCapitalAccount({
      accountId: `alpha21_acct_${this.runtimeId}`,
      registrationId: `alpha21_reg_${this.runtimeId}`,
      startingNotionalMinor: options.startingNotionalMinor,
      currency: options.currency,
      registeredAt: options.registeredAt,
      campaignPolicy: Object.freeze({
        reinvestRealizedProfits: true,
        additionalDeployableMinor: null,
        settlementDelayDays: 0,
      }),
      strategyIds,
    });
    this.book = new ShadowCapitalPortfolioBook(account);
    this.peakNavMinor = BigInt(options.startingNotionalMinor);
  }

  benchmarkNav(at: UtcInstant, navMinor: string): BenchmarkNavState {
    return Object.freeze({
      benchmarkId: this.benchmarkId,
      navMinor,
      asOf: at,
    });
  }

  tick(at: UtcInstant): PortfolioRuntimeState {
    const sessions = this.coordinator.resolveSessions({ strategies: this.strategies, at });
    const activeIds = this.coordinator.activeStrategyIds({ strategies: this.strategies, at });
    for (const strategyId of activeIds) {
      const strategy = this.strategies.find((row) => row.strategyId === strategyId);
      if (!strategy) {
        continue;
      }
      const result = runStrategyTick({
        strategy,
        certifiedStates: sessions,
        at,
        ports: this.ports,
        book: this.book,
        mode: this.mode,
      });
      this.ticks.push(result.record);
      if (result.fill) {
        this.fills.push(result.fill);
      }
      if (result.scheduled) {
        this.pendingOutcomes.push(result.scheduled);
      }
    }
    this.book.settleDueTrades(at);
    this.sequence += 1;
    const pnl = this.book.computePnL();
    const nav = BigInt(pnl.navMinor);
    if (nav > this.peakNavMinor) {
      this.peakNavMinor = nav;
    }
    return buildPortfolioRuntimeState({
      runtimeId: this.runtimeId,
      mode: this.mode,
      posture: this.posture,
      book: this.book,
      asOf: at,
      activeStrategyIds: activeIds,
      marketSessions: sessions,
      pendingOutcomes: Object.freeze([...this.pendingOutcomes]),
      sequence: this.sequence,
      previousPeakNavMinor: this.peakNavMinor,
      benchmark: this.benchmarkNav(at, pnl.navMinor),
    });
  }

  closeSession(tradingDay: string, sealedAt: UtcInstant): ImmutableDailyPortfolioSnapshot {
    const pnl = this.book.computePnL();
    const runtime = buildPortfolioRuntimeState({
      runtimeId: this.runtimeId,
      mode: this.mode,
      posture: this.posture,
      book: this.book,
      asOf: sealedAt,
      activeStrategyIds: Object.freeze([]),
      marketSessions: this.coordinator.resolveSessions({ strategies: this.strategies, at: sealedAt }),
      pendingOutcomes: Object.freeze([...this.pendingOutcomes]),
      sequence: this.sequence,
      previousPeakNavMinor: this.peakNavMinor,
      benchmark: this.benchmarkNav(sealedAt, pnl.navMinor),
    });
    return sealDailyPortfolioSnapshot({
      tradingDay,
      sealedAt,
      runtime,
      book: this.book,
      fills: Object.freeze([...this.fills]),
      ticks: Object.freeze([...this.ticks]),
    });
  }

  listFills(): readonly PaperFillRecord[] {
    return Object.freeze([...this.fills]);
  }

  listTicks(): readonly StrategyTickRecord[] {
    return Object.freeze([...this.ticks]);
  }

  markPrices(prices: Readonly<Record<string, string>>, at: UtcInstant): void {
    this.book.markPrices(prices, at);
  }
}
