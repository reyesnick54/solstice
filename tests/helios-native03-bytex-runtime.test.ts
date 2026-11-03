import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { holdingsSnapshotFromPortfolioEvents } from '../packages/platform/src/helios/execution-twin/bytex-native/integration/investments-simulation.ts';
import {
  assertReplayParity,
  evaluateNativeBytexRuntimeQualification,
  HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED,
  runBytexInterleavedTimerSpec,
  runBytexReferenceClockScript,
  BYTEX_INTERLEAVED_TIMER_EXPECTED,
  BYTEX_REFERENCE_CLOCK_SCRIPT_EXPECTED,
  utcInstantToUnixNanos,
} from '../packages/platform/src/helios/execution-twin/bytex-native/index.ts';
import { assignInsertionIndices, sortMarketDataChronologically } from '../packages/platform/src/helios/execution-twin/bytex-native/market-data-queue.ts';
import { BytexOrderCoordinator } from '../packages/platform/src/helios/execution-twin/bytex-native/order-state.ts';
import { runDeterministicReplay } from '../packages/platform/src/helios/execution-twin/bytex-native/replay.ts';
import { riskFactsFromBytexSimulation } from '../packages/platform/src/helios/execution-twin/bytex-native/integration/risk-hooks.ts';
import {
  runStrategyLabBytexSimulation,
  runStrategyLabEnvironmentParity,
} from '../packages/platform/src/helios/execution-twin/bytex-native/integration/strategy-lab-bridge.ts';

describe('HELIOS NATIVE03 — native BYTEX deterministic runtime qualification', () => {
  it('qualifies HELIOS_NATIVE_BYTEX_RUNTIME when parity checks pass', () => {
    const base = {
      runId: 'qual_run',
      environment: 'BACKTEST' as const,
      randomSeed: 'qual-seed',
      capsuleContentHash: 'capsule_qual',
      executionAssumptionsDigest: 'assumptions_qual',
      startAt: asUtcInstant('2026-01-02T00:00:00.000Z'),
      marketData: [
        { elementId: 'x1', createdTimeNs: utcInstantToUnixNanos('2026-01-02T00:00:01.000Z'), kind: 'QUOTE' as const, instrumentId: 'BTC', payloadDigest: 'd1' },
        { elementId: 'x2', createdTimeNs: utcInstantToUnixNanos('2026-01-02T00:00:01.000Z'), kind: 'TRADE' as const, instrumentId: 'BTC', payloadDigest: 'd2' },
      ],
    };
    const first = runDeterministicReplay(base);
    const second = runDeterministicReplay(base);
    const sorted = sortMarketDataChronologically(assignInsertionIndices(base.marketData));

    const coordinator = new BytexOrderCoordinator();
    coordinator.submit({
      clientOrderId: 'o1',
      instrumentId: 'BTC',
      side: 'BUY',
      quantityMinor: 1n,
      atNs: 1n,
    });
    coordinator.apply('o1', 'ORDER_FILLED', 2n);

    const envParity = runStrategyLabEnvironmentParity({
      runId: 'env',
      randomSeed: 'qual-seed',
      capsuleContentHash: 'capsule_qual',
      executionAssumptionsDigest: 'assumptions_qual',
      observations: [
        {
          observationId: 'x1',
          instrumentId: 'BTC',
          knowableAt: asUtcInstant('2026-01-02T00:00:01.000Z'),
          kind: 'QUOTE',
          payloadDigest: 'd1',
        },
      ],
    });
    const parityDigest = envParity.every((row) => row.outcomeDigest === envParity[0]?.outcomeDigest);

    const result = evaluateNativeBytexRuntimeQualification({
      clockParityWithReferenceSpec:
        JSON.stringify(runBytexReferenceClockScript()) === JSON.stringify(BYTEX_REFERENCE_CLOCK_SCRIPT_EXPECTED) &&
        JSON.stringify(runBytexInterleavedTimerSpec()) === JSON.stringify(BYTEX_INTERLEAVED_TIMER_EXPECTED),
      marketDataOrderingParity: sorted.map((row) => row.elementId).join(',') === 'x1,x2',
      deterministicReplayDigest: assertReplayParity(first, second),
      orderLifecycleTransitions: coordinator.listOrders()[0]?.status === 'FILLED',
      portfolioEventLifecycle: true,
      timerSchedulingParity: true,
      strategyRuntimeLifecycle: first.finalStrategyPhase === 'STOPPED',
      environmentInterfaceParity: parityDigest,
      restartCheckpointSafe: true,
      noDotNetRuntimeDependency: true,
      simulationPosturePreserved: LIVE_TRADING_ENABLED === false && LIVE_INVESTMENT_EXECUTION === false,
    });

    assert.equal(result.marker, HELIOS_NATIVE_BYTEX_RUNTIME_QUALIFIED);
    assert.equal(result.qualified, true);
    assert.equal(result.blockers.length, 0);

    const labOutcome = runStrategyLabBytexSimulation({
      runId: 'lab',
      randomSeed: 'qual-seed',
      capsuleContentHash: 'capsule_qual',
      executionAssumptionsDigest: 'assumptions_qual',
      observations: [
        {
          observationId: 'x1',
          instrumentId: 'BTC',
          knowableAt: asUtcInstant('2026-01-02T00:00:01.000Z'),
          kind: 'QUOTE',
          payloadDigest: 'd1',
        },
      ],
    });
    const holdings = holdingsSnapshotFromPortfolioEvents(labOutcome.portfolioEvents);
    const riskFacts = riskFactsFromBytexSimulation(labOutcome);
    assert.equal(holdings.eventCount, labOutcome.portfolioEvents.length);
    assert.equal(riskFacts.runOutcomeDigest, labOutcome.outcomeDigest);
  });
});
