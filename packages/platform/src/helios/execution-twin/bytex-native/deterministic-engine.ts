import { createHash } from 'node:crypto';

import { utcInstantToUnixNanos, BytexSimulationClock } from './clock.ts';
import { buildRuntimeCheckpoint } from './checkpoint.ts';
import {
  assignInsertionIndices,
  countDispatchedUpTo,
  sortMarketDataChronologically,
} from './market-data-queue.ts';
import { BytexOrderCoordinator } from './order-state.ts';
import { BytexPortfolioLedger } from './portfolio-state.ts';
import { BytexStrategyRuntime, type BytexStrategyHooks } from './strategy-runtime.ts';
import type {
  BytexDeterministicRunInput,
  BytexDeterministicRunOutcome,
  BytexEngineEvent,
  BytexRuntimeCheckpoint,
} from './types.ts';
import type { BytexRuntimeEnvironment } from './taxonomy.ts';

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, current) => (typeof current === 'bigint' ? current.toString() : current));
}

function digestPayload(payload: unknown): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 32);
}

export class BytexDeterministicEngine {
  private readonly clock: BytexSimulationClock;
  private readonly orders = new BytexOrderCoordinator();
  private readonly portfolio = new BytexPortfolioLedger();
  private readonly strategy: BytexStrategyRuntime;
  private readonly sortedMarket;
  private dispatched = 0;
  private lastDispatchedKey: { readonly timeNs: bigint; readonly insertionIndex: number } | null = null;
  private engineSequence = 0;
  private readonly engineEvents: BytexEngineEvent[] = [];
  private readonly environment: BytexRuntimeEnvironment;
  private readonly randomSeed: string;
  private readonly runId: string;

  private readonly input: BytexDeterministicRunInput;

  constructor(input: BytexDeterministicRunInput, strategyHooks: BytexStrategyHooks = {}) {
    this.input = input;
    this.runId = input.runId;
    this.environment = input.environment;
    this.randomSeed = input.randomSeed;
    this.clock = new BytexSimulationClock(utcInstantToUnixNanos(input.startAt));
    const withIndex = assignInsertionIndices(input.marketData);
    this.sortedMarket = sortMarketDataChronologically(withIndex);
    this.strategy = new BytexStrategyRuntime('strategy-001', input.capsuleContentHash, strategyHooks);
  }

  restoreCheckpoint(checkpoint: BytexRuntimeCheckpoint, dispatchedOverride?: number): void {
    this.clock.setTime(checkpoint.clockNs);
    this.dispatched = dispatchedOverride ?? checkpoint.dispatchedMarketCount;
    this.lastDispatchedKey = checkpoint.lastDispatchedKey;
    this.strategy.restore(checkpoint.strategy);
    this.strategy.markRestored();
    this.orders.restoreOrders(checkpoint.orders, checkpoint.strategy.lastEventSequence);
  }

  saveCheckpoint(checkpointId: string): BytexRuntimeCheckpoint {
    return buildRuntimeCheckpoint({
      checkpointId,
      environment: this.environment,
      randomSeed: this.randomSeed,
      clock: this.clock,
      dispatchedMarketCount: this.dispatched,
      lastDispatchedKey: this.lastDispatchedKey,
      strategy: this.strategy,
      orders: this.orders,
      engineEvents: this.engineEvents,
    });
  }

  run(): BytexDeterministicRunOutcome {
    this.pushEngineEvent('STRATEGY', 'RUN_START', { runId: this.runId, seed: this.randomSeed });
    this.strategy.start(this.clock.nowNs());

    while (this.dispatched < this.sortedMarket.length) {
      const element = this.sortedMarket[this.dispatched]!;
      const targetNs = element.createdTimeNs;
      const timerHandlers = this.clock.advanceTime(targetNs, true);
      for (const handler of timerHandlers) {
        this.pushEngineEvent('TIMER', handler.event.name, handler.event);
        this.strategy.notifyTimer(handler.event.eventTimeNs, handler.event.name, this.engineSequence);
        handler.handle();
      }
      this.dispatchMarketElement(element);
    }

    this.strategy.stop(this.clock.nowNs());
    this.pushEngineEvent('STRATEGY', 'RUN_STOP', { phase: this.strategy.state().phase });

    const outcomeDigest = createHash('sha256')
      .update(
        stableStringify({
          seed: this.randomSeed,
          capsule: this.input.capsuleContentHash,
          assumptions: this.input.executionAssumptionsDigest,
          events: this.engineEvents.map((e) => [e.sequence, e.kind, e.detail, e.payloadDigest]),
          orders: this.orders.orderEventsLog().map((e) => [e.sequence, e.kind, e.toStatus]),
          portfolio: this.portfolio.eventsLog().map((e) => [e.sequence, e.kind, e.cashDeltaMinor.toString()]),
        }),
      )
      .digest('hex');

    return Object.freeze({
      runId: this.runId,
      environment: this.environment,
      outcomeDigest,
      eventCount: this.engineEvents.length,
      orderEvents: this.orders.orderEventsLog(),
      portfolioEvents: this.portfolio.eventsLog(),
      engineEvents: Object.freeze([...this.engineEvents]),
      finalStrategyPhase: this.strategy.state().phase,
    });
  }

  /** Environment parity: same strategy hooks across BACKTEST / SANDBOX / LIVE interfaces (simulation-only live). */
  runWithEnvironmentParity(environments: readonly BytexRuntimeEnvironment[]): readonly BytexDeterministicRunOutcome[] {
    return Object.freeze(
      environments.map((environment) => {
        const engine = new BytexDeterministicEngine({ ...this.input, environment });
        return engine.run();
      }),
    );
  }

  private dispatchMarketElement(element: (typeof this.sortedMarket)[number]): void {
    this.pushEngineEvent('MARKET_DATA', element.kind, element);
    this.strategy.notifyMarket(this.clock.nowNs(), element.instrumentId, element.payloadDigest, this.engineSequence);
    this.dispatched += 1;
    this.lastDispatchedKey = Object.freeze({
      timeNs: element.createdTimeNs,
      insertionIndex: element.insertionIndex,
    });
  }

  private pushEngineEvent(kind: BytexEngineEvent['kind'], detail: string, payload: unknown): void {
    this.engineSequence += 1;
    this.engineEvents.push(
      Object.freeze({
        sequence: this.engineSequence,
        atNs: this.clock.nowNs(),
        kind,
        detail,
        payloadDigest: digestPayload(payload),
      }),
    );
  }

  /** BYTEX ReleaseDispatched cursor semantics for chunked streaming backtests. */
  recomputeDispatchCursor(last: { readonly timeNs: bigint; readonly insertionIndex: number }): number {
    return countDispatchedUpTo(this.sortedMarket, last);
  }
}
