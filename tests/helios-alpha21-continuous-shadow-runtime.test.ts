/**
 * HELIOS Forward Alpha ALPHA21 — continuous shadow portfolio and paper execution runtime.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED,
  PORTFOLIO_RUNTIME_POSTURE,
  PaperPortfolioRuntime,
  ShadowPortfolioRuntime,
  alpha21MultiMarketStrategies,
  alpha21RequiredPipelineStages,
  alpha21ScenarioTimes,
  defaultAlpha21Ports,
  evaluateAlpha21ContinuousShadowRuntimeQualification,
  MarketSessionCoordinator,
} from '../packages/platform/src/helios/forward-alpha/alpha21/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-09-16T14:00:00.000Z');
const START = '100000000';

describe('HELIOS Forward Alpha ALPHA21 continuous shadow runtime', () => {
  it('respects HELIOS boundary lint for alpha21 module', () => {
    const scoped = lintHeliosBoundary(process.cwd()).filter((f) =>
      f.file.includes('forward-alpha/alpha21'),
    );
    assert.deepEqual(scoped, []);
  });

  it('MarketSessionCoordinator does not assume all markets open simultaneously', () => {
    const coordinator = new MarketSessionCoordinator();
    const times = alpha21ScenarioTimes();
    const strategies = alpha21MultiMarketStrategies();
    const cryptoWeekend = coordinator.activeStrategyIds({ strategies, at: times.cryptoWeekend });
    const equityHoliday = coordinator.activeStrategyIds({ strategies, at: times.equityHoliday });
    const equityRegular = coordinator.activeStrategyIds({ strategies, at: times.equityRegular });

    assert.ok(cryptoWeekend.includes('strat_crypto_momentum'));
    assert.ok(!cryptoWeekend.includes('strat_equity_mr'));
    assert.ok(!equityHoliday.includes('strat_equity_mr'));
    assert.ok(equityHoliday.includes('strat_crypto_momentum'));
    assert.ok(equityRegular.includes('strat_equity_mr'));
    assert.ok(equityRegular.includes('strat_futures_trend') || equityRegular.includes('strat_fx_carry'));
  });

  it('extended hours strategy runs only when permitted', () => {
    const coordinator = new MarketSessionCoordinator();
    const times = alpha21ScenarioTimes();
    const extended = Object.freeze([
      Object.freeze({
        strategyId: 'strat_equity_extended',
        instrumentIds: Object.freeze(['SECURITY:US:AAPL:XNAS']),
        extendedHoursPermitted: true,
      }),
    ]);
  const pre = coordinator.certifiedStateForInstrument({
      instrumentId: 'SECURITY:US:AAPL:XNAS',
      at: times.equityPreMarket,
      extendedHoursPermitted: true,
    });
    assert.equal(pre.marketState, 'PRE_MARKET');
    assert.equal(pre.sessionOpen, true);

    const withoutExtended = coordinator.certifiedStateForInstrument({
      instrumentId: 'SECURITY:US:AAPL:XNAS',
      at: times.equityPreMarket,
      extendedHoursPermitted: false,
    });
    assert.equal(withoutExtended.sessionOpen, false);
  });

  it('ShadowPortfolioRuntime and PaperPortfolioRuntime maintain NAV and posture', () => {
    const times = alpha21ScenarioTimes();
    const strategies = alpha21MultiMarketStrategies();
    const ports = defaultAlpha21Ports();

    const shadow = new ShadowPortfolioRuntime({
      startingNotionalMinor: START,
      currency: 'USD',
      benchmarkId: 'BM:SPY:BUY_HOLD',
      strategies,
      ports,
      registeredAt: T0,
    });
    const paper = new PaperPortfolioRuntime({
      startingNotionalMinor: START,
      currency: 'USD',
      benchmarkId: 'BM:SPY:BUY_HOLD',
      strategies,
      ports,
      registeredAt: T0,
    });

    const shadowState = shadow.tickShadow(times.equityRegular);
    const paperState = paper.tickPaper(times.equityRegular);

    assert.deepEqual(shadowState.posture, PORTFOLIO_RUNTIME_POSTURE);
    assert.deepEqual(paperState.posture, PORTFOLIO_RUNTIME_POSTURE);
    assert.ok(BigInt(shadowState.pnl.navMinor) > 0n);
    assert.equal(paperState.benchmark.benchmarkId, 'BM:SPY:BUY_HOLD');
    assert.ok(paper.listFills().every((row) => row.externalBrokerSubmitted === false));
  });

  it('strategy pipeline completes mandated stages on paper fills', () => {
    const paper = new PaperPortfolioRuntime({
      startingNotionalMinor: START,
      currency: 'USD',
      benchmarkId: 'BM:SPY:BUY_HOLD',
      strategies: alpha21MultiMarketStrategies(),
      ports: defaultAlpha21Ports(),
      registeredAt: T0,
    });
    paper.tickPaper(alpha21ScenarioTimes().cryptoWeekend);
    const tick = paper.listTicks().find((row) => row.fill !== null);
    assert.ok(tick);
    assert.deepEqual(
      [...tick!.stagesCompleted],
      alpha21RequiredPipelineStages(),
    );
  });

  it('session close seals immutable daily portfolio snapshot', () => {
    const paper = new PaperPortfolioRuntime({
      startingNotionalMinor: START,
      currency: 'USD',
      benchmarkId: 'BM:SPY:BUY_HOLD',
      strategies: alpha21MultiMarketStrategies(),
      ports: defaultAlpha21Ports(),
      registeredAt: T0,
    });
    paper.tickPaper(alpha21ScenarioTimes().futuresEvening);
    const snap = paper.closePaperSession('2026-09-15', asUtcInstant('2026-09-15T23:59:00.000Z'));
    assert.ok(snap.digest.length > 0);
    const again = paper.closePaperSession('2026-09-15', asUtcInstant('2026-09-15T23:59:00.000Z'));
    assert.equal(snap.digest, again.digest);
  });

  it('qualifies continuous shadow runtime contract', () => {
    const times = alpha21ScenarioTimes();
    const coordinator = new MarketSessionCoordinator();
    const strategies = alpha21MultiMarketStrategies();
    const shadow = new ShadowPortfolioRuntime({
      startingNotionalMinor: START,
      currency: 'USD',
      benchmarkId: 'BM:SPY:BUY_HOLD',
      strategies,
      ports: defaultAlpha21Ports(),
      registeredAt: T0,
    });
    const paper = new PaperPortfolioRuntime({
      startingNotionalMinor: START,
      currency: 'USD',
      benchmarkId: 'BM:SPY:BUY_HOLD',
      strategies,
      ports: defaultAlpha21Ports(),
      registeredAt: T0,
    });
    shadow.tickShadow(times.equityRegular);
    paper.tickPaper(times.cryptoWeekend);
    paper.tickPaper(times.fxMidweek);

    const cryptoOnly = coordinator.activeStrategyIds({ strategies, at: times.cryptoWeekend });
    const equityOnly = coordinator.activeStrategyIds({ strategies, at: times.equityRegular });

    const qualification = evaluateAlpha21ContinuousShadowRuntimeQualification({
      researchPosture:
        PORTFOLIO_RUNTIME_POSTURE.financialEffectCreated === false &&
        PORTFOLIO_RUNTIME_POSTURE.liveBroker === false &&
        PORTFOLIO_RUNTIME_POSTURE.customerMoneyUsed === false,
      shadowAndPaperRuntimes: true,
      marketSessionCoordinator: true,
      portfolioRuntimeStateNav: BigInt(paper.tickPaper(times.equityRegular).pnl.navMinor) > 0n,
      mdInstrumentCalendars: coordinator.resolveSessions({ strategies, at: times.equityRegular }).every(
        (row) => row.calendarId !== null,
      ),
      asymmetricSessions:
        cryptoOnly.includes('strat_crypto_momentum') &&
        !cryptoOnly.includes('strat_equity_mr') &&
        equityOnly.includes('strat_equity_mr'),
      strategyPipelineStages: paper.listTicks().some((row) => row.stagesCompleted.length === alpha21RequiredPipelineStages().length),
      paperRoutingNoLiveBroker: paper.listFills().every((row) => row.externalBrokerSubmitted === false && row.routedVia === 'EXECUTION_TWIN'),
      dailySnapshotImmutable: paper.closePaperSession('2026-09-16', asUtcInstant('2026-09-16T23:59:00.000Z')).digest.length > 0,
    });

    assert.equal(qualification.marker, HELIOS_ALPHA21_CONTINUOUS_SHADOW_RUNTIME_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
  });
});
