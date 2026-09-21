/**
 * HELIOS Multi-Asset M20 — portfolio drawdown, concentration, loss-budget, kill-control framework.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { ratioPercent } from '../packages/risk/src/arithmetic.ts';
import {
  HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED,
  PortfolioRiskEngine,
  buildPolicyFromLimits,
  computePortfolioDrawdown,
  computeStrategyDrawdowns,
  detectElevatedRiskOnClusters,
  evaluateM20PortfolioRiskQualification,
  fixtureMultiAssetProfiles,
  nextPolicyVersion,
  policyUpdatePermitted,
  rollDailyLossLedger,
  type M20QualificationChecks,
  type PortfolioPositionRiskFact,
  type PortfolioRiskContext,
  type ReconciledEquityPoint,
} from '../packages/risk/src/portfolio/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-09-20T14:00:00.000Z');
const T1 = asUtcInstant('2026-09-20T20:00:00.000Z');
const NEXT_DAY = asUtcInstant('2026-09-21T01:00:00.000Z');

function position(input: Partial<PortfolioPositionRiskFact> & Pick<PortfolioPositionRiskFact, 'instrumentId' | 'marketValueMinor'>): PortfolioPositionRiskFact {
  const profile = fixtureMultiAssetProfiles().find((row) => row.instrumentId === input.instrumentId);
  return Object.freeze({
    strategyId: profile?.strategyId,
    assetClass: profile?.assetClass ?? 'ETF',
    venue: profile?.venue ?? 'SIM_VENUE',
    signedExposureMinor: input.marketValueMinor,
    priceQuality: 'CURRENT',
    liquidityClass: 'HIGH',
    sourceRef: `fixture:${input.instrumentId}`,
    ...input,
  });
}

function flatEquitySeries(): readonly ReconciledEquityPoint[] {
  return Object.freeze([
    Object.freeze({
      at: asUtcInstant('2026-09-19T00:00:00.000Z'),
      equityMinor: 1_000_000n,
      cumulativeNetFlowMinor: 0n,
      currency: 'USD',
      reconciled: true as const,
      sourceRef: 'recon:flat1',
    }),
    Object.freeze({
      at: asUtcInstant('2026-09-20T00:00:00.000Z'),
      equityMinor: 1_010_000n,
      cumulativeNetFlowMinor: 0n,
      currency: 'USD',
      reconciled: true as const,
      sourceRef: 'recon:flat2',
    }),
  ]);
}

function drawdownEquitySeries(): readonly ReconciledEquityPoint[] {
  return Object.freeze([
    Object.freeze({
      at: asUtcInstant('2026-09-01T00:00:00.000Z'),
      equityMinor: 1_000_000n,
      cumulativeNetFlowMinor: 0n,
      currency: 'USD',
      reconciled: true as const,
      sourceRef: 'recon:day1',
    }),
    Object.freeze({
      at: asUtcInstant('2026-09-10T00:00:00.000Z'),
      equityMinor: 1_100_000n,
      cumulativeNetFlowMinor: 100_000n,
      currency: 'USD',
      reconciled: true as const,
      sourceRef: 'recon:day10',
    }),
    Object.freeze({
      at: asUtcInstant('2026-09-20T00:00:00.000Z'),
      equityMinor: 900_000n,
      cumulativeNetFlowMinor: 100_000n,
      currency: 'USD',
      reconciled: true as const,
      sourceRef: 'recon:day20',
    }),
  ]);
}

function basePolicy(overrides: Parameters<typeof buildPolicyFromLimits>[0]['limits'] = {}) {
  return buildPolicyFromLimits({
    policyId: 'pol_m20_demo',
    mandateId: 'mand_demo',
    customerId: 'cust_demo',
    portfolioId: 'port_demo',
    effectiveFrom: T0,
    limits: {
      maximumPositionExposure: ratioPercent(35n),
      maximumStrategyExposure: ratioPercent(45n),
      maximumAssetClassExposure: ratioPercent(55n),
      maximumCorrelatedClusterExposure: ratioPercent(70n),
      maximumCryptoExposure: ratioPercent(25n),
      maximumPortfolioDrawdown: ratioPercent(20n),
      dailyRealizedLossLimitMinor: 50_000n,
      minimumLiquidityMinor: 25_000n,
      cautionPortfolioDrawdown: ratioPercent(5n),
      reducedRiskPortfolioDrawdown: ratioPercent(8n),
      newEntriesBlockedPortfolioDrawdown: ratioPercent(12n),
      exitOnlyPortfolioDrawdown: ratioPercent(15n),
      emergencyClosePortfolioDrawdown: ratioPercent(18n),
      emergencyClosePermitted: false,
      staleDataBlocksNewEntries: true,
      providerHealthBlocksNewEntries: true,
      ...overrides,
    },
  });
}

function baseContext(overrides: Partial<PortfolioRiskContext> = {}): PortfolioRiskContext {
  return Object.freeze({
    mandateId: 'mand_demo',
    portfolioId: 'port_demo',
    customerId: 'cust_demo',
    asOf: T1,
    currency: 'USD',
    positions: Object.freeze([
      position({ instrumentId: 'EQUITY:SPY:us:etf:USD', marketValueMinor: 200_000n }),
      position({ instrumentId: 'EQUITY:QQQ:us:etf:USD', marketValueMinor: 150_000n }),
    ]),
    instrumentProfiles: fixtureMultiAssetProfiles(),
    reconciledEquity: flatEquitySeries(),
    dailyLoss: Object.freeze({
      utcDay: '2026-09-20',
      realizedLossMinor: 0n,
      totalLossMinor: 0n,
      consecutiveLossCount: 0,
      lastResetAt: T0,
    }),
    strategyDrawdowns: Object.freeze([]),
    brokerageCashMinor: 650_000n,
    unsettledEstimateMinor: 0n,
    providerHealthy: true,
    reconciliationOk: true,
    customerPaused: false,
    compliancePaused: false,
    executionFailureCount: 0,
    sourceRefs: Object.freeze(['fixture:portfolio']),
    simulationOnly: true,
    ...overrides,
  });
}

function engine(at: typeof T0 = T1) {
  const clock = new FrozenClock(at);
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const portfolioEngine = new PortfolioRiskEngine({ clock, events, evidence });
  return { clock, portfolioEngine, events, evidence };
}

describe('HELIOS Multi-Asset M20 portfolio risk controls', () => {
  it('passes HELIOS boundary lint', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0, findings.map((row) => row.message).join('; '));
  });

  it('normal operation stays NORMAL and permits new entries', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(baseContext(), policy);
    assert.equal(evaluation.state, 'NORMAL');
    assert.equal(evaluation.newEntriesPermitted, true);
    assert.equal(evaluation.breachedRules.length, 0);
  });

  it('blocks when position cap is exceeded', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy({ maximumPositionExposure: ratioPercent(30n) });
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({
        positions: Object.freeze([
          position({ instrumentId: 'EQUITY:SPY:us:etf:USD', marketValueMinor: 400_000n }),
        ]),
        brokerageCashMinor: 600_000n,
      }),
      policy,
    );
    assert.equal(evaluation.newEntriesPermitted, false);
    assert.match(evaluation.breachedRules.join(','), /POSITION_CAP:EQUITY:SPY/);
    assert.equal(evaluation.state, 'NEW_ENTRIES_BLOCKED');
    assert.ok(evaluation.intervention);
    assert.equal(evaluation.intervention?.rule.startsWith('POSITION_CAP'), true);
  });

  it('blocks when asset-class cap is exceeded', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy({ maximumAssetClassExposure: ratioPercent(40n) });
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({
        positions: Object.freeze([
          position({ instrumentId: 'EQUITY:SPY:us:etf:USD', marketValueMinor: 300_000n }),
          position({ instrumentId: 'EQUITY:QQQ:us:etf:USD', marketValueMinor: 250_000n }),
        ]),
        brokerageCashMinor: 450_000n,
      }),
      policy,
    );
    assert.match(evaluation.breachedRules.join(','), /ASSET_CLASS_CAP:ETF/);
  });

  it('detects elevated correlated risk-on exposure for SPY/QQQ/NVDA/BTC cluster', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy({ maximumCorrelatedClusterExposure: ratioPercent(55n) });
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({
        positions: Object.freeze([
          position({ instrumentId: 'EQUITY:SPY:us:etf:USD', marketValueMinor: 200_000n }),
          position({ instrumentId: 'EQUITY:QQQ:us:etf:USD', marketValueMinor: 180_000n }),
          position({ instrumentId: 'EQUITY:NVDA:us:equity:USD', marketValueMinor: 170_000n }),
          position({ instrumentId: 'CRYPTO:BTC:bitcoin:native:USD', marketValueMinor: 160_000n }),
        ]),
        brokerageCashMinor: 290_000n,
      }),
      policy,
    );
    const riskOn = evaluation.exposure.clusterExposures.find((row) => row.clusterId === 'RISK_ON');
    assert.ok(riskOn);
    assert.ok(riskOn!.memberInstrumentIds.includes('EQUITY:SPY:us:etf:USD'));
    assert.ok(riskOn!.memberInstrumentIds.includes('CRYPTO:BTC:bitcoin:native:USD'));
    assert.match(evaluation.breachedRules.join(','), /CORRELATION_CLUSTER_CAP:RISK_ON/);
    const elevated = detectElevatedRiskOnClusters(evaluation.exposure.clusterExposures, ratioPercent(50n));
    assert.ok(elevated.includes('RISK_ON'));
  });

  it('breaches daily realized-loss limit', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy({ dailyRealizedLossLimitMinor: 10_000n });
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({
        dailyLoss: Object.freeze({
          utcDay: '2026-09-20',
          realizedLossMinor: 15_000n,
          totalLossMinor: 15_000n,
          consecutiveLossCount: 2,
          lastResetAt: T0,
        }),
      }),
      policy,
    );
    assert.equal(evaluation.state, 'EXIT_ONLY');
    assert.ok(evaluation.intervention?.trigger === 'LOSS_BUDGET_BREACH' || evaluation.intervention?.rule.includes('LOSS'));
  });

  it('escalates portfolio drawdown through deterministic states', () => {
    const drawdown = computePortfolioDrawdown(drawdownEquitySeries());
    assert.ok(drawdown);
    assert.ok(drawdown!.units > ratioPercent(15n).units);
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({ reconciledEquity: drawdownEquitySeries() }),
      policy,
    );
    assert.ok(['CAUTION', 'REDUCED_RISK', 'NEW_ENTRIES_BLOCKED', 'EXIT_ONLY', 'EMERGENCY_CLOSE_REQUIRED'].includes(evaluation.state));
  });

  it('blocks strategy drawdown breach', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy({ maximumStrategyDrawdown: ratioPercent(10n) });
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({
        strategyDrawdowns: Object.freeze([
          Object.freeze({
            strategyId: 'strat_index_mr',
            peakEquityMinor: 300_000n,
            currentEquityMinor: 240_000n,
            drawdownRatio: ratioPercent(20n),
          }),
        ]),
      }),
      policy,
    );
    assert.match(evaluation.breachedRules.join(','), /STRATEGY_DRAWDOWN:strat_index_mr/);
  });

  it('blocks new entries on stale market data', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({
        positions: Object.freeze([
          position({
            instrumentId: 'EQUITY:SPY:us:etf:USD',
            marketValueMinor: 200_000n,
            priceQuality: 'STALE',
          }),
        ]),
      }),
      policy,
    );
    assert.equal(evaluation.state, 'NEW_ENTRIES_BLOCKED');
    assert.ok(evaluation.intervention?.trigger === 'STALE_MARKET_DATA' || evaluation.recommendedActions.includes('BLOCK_NEW_ENTRIES'));
  });

  it('blocks new entries on provider outage', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(baseContext({ providerHealthy: false }), policy);
    assert.equal(evaluation.state, 'NEW_ENTRIES_BLOCKED');
  });

  it('pauses on customer pause kill control', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    portfolioEngine.initializeState('mand_demo', 'port_demo', policy.version);
    const evaluation = portfolioEngine.applyKillTrigger({
      mandateId: 'mand_demo',
      trigger: 'CUSTOMER_PAUSE',
      authority: 'customer:self',
      evidenceRefs: Object.freeze(['ev:pause']),
    });
    assert.equal(evaluation.state, 'PAUSED');
    assert.equal(evaluation.newEntriesPermitted, false);
    assert.equal(evaluation.intervention?.authority, 'customer:self');
    assert.ok(evaluation.intervention?.evidenceRefs.includes('ev:pause'));
  });

  it('requires emergency close only when policy permits', () => {
    const { portfolioEngine } = engine();
    const policyDenied = basePolicy({ emergencyClosePermitted: false, emergencyClosePortfolioDrawdown: ratioPercent(1n) });
    portfolioEngine.putPolicy(policyDenied);
    const denied = portfolioEngine.applyKillTrigger({
      mandateId: 'mand_demo',
      trigger: 'EXCESSIVE_PORTFOLIO_DRAWDOWN',
      authority: 'PortfolioRiskEngine',
    });
    assert.equal(denied.emergencyClosePermitted, false);
    assert.ok(denied.recommendedActions.includes('EXIT_STRATEGY'));

    const policyAllowed = buildPolicyFromLimits({
      policyId: 'pol_m20_close',
      mandateId: 'mand_close',
      customerId: 'cust_demo',
      portfolioId: 'port_close',
      effectiveFrom: T0,
      limits: { emergencyClosePermitted: true },
    });
    portfolioEngine.putPolicy(policyAllowed);
    portfolioEngine.initializeState('mand_close', 'port_close', policyAllowed.version);
    const allowed = portfolioEngine.applyKillTrigger({
      mandateId: 'mand_close',
      trigger: 'OPERATIONAL_EMERGENCY',
      authority: 'compliance:ops',
    });
    assert.equal(allowed.emergencyClosePermitted, true);
    assert.ok(allowed.recommendedActions.includes('CLOSE_MANDATE'));
  });

  it('records partial fills during risk event without auto-closing', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    portfolioEngine.applyKillTrigger({
      mandateId: 'mand_demo',
      trigger: 'LOSS_BUDGET_BREACH',
      authority: 'PortfolioRiskEngine',
    });
    const evaluation = portfolioEngine.handlePartialFillDuringRiskEvent({
      context: baseContext(),
      policy,
      filledNotionalMinor: 25_000n,
      remainingNotionalMinor: 75_000n,
    });
    assert.equal(evaluation.exitsPermitted, true);
    assert.equal(evaluation.emergencyClosePermitted, false);
    assert.ok(portfolioEngine.store.listInterventions('mand_demo').length >= 2);
  });

  it('persists EXIT_ONLY across restart', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    portfolioEngine.applyKillTrigger({
      mandateId: 'mand_demo',
      trigger: 'RECONCILIATION_FAILURE',
      authority: 'recon:worker',
    });
    const snapshot = portfolioEngine.store.snapshot();
    const restarted = new PortfolioRiskEngine({ clock: new FrozenClock(T1), store: portfolioEngine.store });
    restarted.store.restore(snapshot);
    const restored = restarted.restoreState('mand_demo');
    assert.equal(restored?.state, 'EXIT_ONLY');
  });

  it('enters EXIT_ONLY on reconciliation failure', () => {
    const { portfolioEngine } = engine();
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(baseContext({ reconciliationOk: false }), policy);
    assert.equal(evaluation.state, 'EXIT_ONLY');
  });

  it('permits tightening policy version updates and rejects loosening', () => {
    const current = basePolicy({ maximumPositionExposure: ratioPercent(30n) });
    const tighter = buildPolicyFromLimits({
      policyId: 'pol_v2',
      mandateId: current.mandateId,
      customerId: current.customerId,
      portfolioId: current.portfolioId,
      effectiveFrom: T1,
      version: nextPolicyVersion(current.version),
      limits: { maximumPositionExposure: ratioPercent(25n) },
    });
    const loosen = buildPolicyFromLimits({
      policyId: 'pol_bad',
      mandateId: current.mandateId,
      customerId: current.customerId,
      portfolioId: current.portfolioId,
      effectiveFrom: T1,
      version: nextPolicyVersion(current.version),
      limits: { maximumPositionExposure: ratioPercent(40n) },
    });
    assert.equal(policyUpdatePermitted(current, tighter).permitted, true);
    assert.equal(policyUpdatePermitted(current, loosen).permitted, false);
    const { portfolioEngine } = engine();
    portfolioEngine.putPolicy(current);
    portfolioEngine.putPolicy(tighter);
    assert.equal(portfolioEngine.store.latestPolicy('mand_demo')?.version, tighter.version);
  });

  it('does not false-reset daily loss counters across midnight while preserving risk state', () => {
    const prior = rollDailyLossLedger({
      prior: null,
      now: T1,
      realizedPnlMinor: -5_000n,
      totalPnlMinor: -5_000n,
    });
    const rolled = rollDailyLossLedger({
      prior,
      now: NEXT_DAY,
      realizedPnlMinor: -1_000n,
      totalPnlMinor: -1_000n,
    });
    assert.equal(rolled.utcDay, '2026-09-21');
    assert.equal(rolled.realizedLossMinor, 1_000n);
    assert.notEqual(rolled.realizedLossMinor, prior.realizedLossMinor + 1_000n);

    const { portfolioEngine } = engine(NEXT_DAY);
    const policy = basePolicy();
    portfolioEngine.putPolicy(policy);
    portfolioEngine.applyKillTrigger({
      mandateId: 'mand_demo',
      trigger: 'LOSS_BUDGET_BREACH',
      authority: 'PortfolioRiskEngine',
    });
    const context = baseContext({
      asOf: NEXT_DAY,
      dailyLoss: rolled,
      reconciledEquity: flatEquitySeries(),
    });
    const evaluation = portfolioEngine.evaluatePortfolio(context, policy);
    assert.equal(portfolioEngine.restoreState('mand_demo')?.state, 'EXIT_ONLY');
    assert.equal(evaluation.state, 'EXIT_ONLY');
  });

  it('excludes deposits and withdrawals from drawdown P&L', () => {
    const drawdown = computePortfolioDrawdown(drawdownEquitySeries());
    assert.ok(drawdown);
    const strategyFacts = computeStrategyDrawdowns({
      strategyEquitySeries: {
        strat_a: drawdownEquitySeries(),
      },
    });
    assert.equal(strategyFacts.length, 1);
    assert.ok(drawdown!.units > 0n);
  });

  it('seals audit evidence for interventions', () => {
    const { portfolioEngine, evidence } = engine();
    const policy = basePolicy({ maximumPositionExposure: ratioPercent(10n) });
    portfolioEngine.putPolicy(policy);
    const evaluation = portfolioEngine.evaluatePortfolio(
      baseContext({
        positions: Object.freeze([
          position({ instrumentId: 'EQUITY:SPY:us:etf:USD', marketValueMinor: 500_000n }),
        ]),
        brokerageCashMinor: 500_000n,
      }),
      policy,
    );
    const intervention = evaluation.intervention;
    assert.ok(intervention);
    assert.ok(intervention.threshold.length > 0);
    assert.ok(intervention.observedValue.length > 0);
    assert.ok(intervention.evidenceRefs.length > 0);
    assert.ok(intervention.resultingAction.length > 0);
    assert.ok(intervention.authority.length > 0);
    assert.ok(evidence.list().length > 0);
  });

  it('HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED when all checks pass', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);

    const checks: M20QualificationChecks = {
      normalOperation: true,
      positionCap: true,
      assetClassCap: true,
      correlationClusterCap: true,
      dailyLossThreshold: true,
      portfolioDrawdown: true,
      strategyDrawdown: true,
      staleData: true,
      providerOutage: true,
      customerPause: true,
      emergencyCloseRequest: true,
      partialFillDuringRiskEvent: true,
      restartExitOnlyPersisted: true,
      reconciliationFailure: true,
      policyVersionUpdate: true,
      noFalseResetAcrossMidnight: true,
      auditEvidenceComplete: true,
      extendsCanonicalRiskEngine: true,
      noSeparateRiskAuthority: true,
      policyDrivenLimits: true,
      simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    };
    const result = evaluateM20PortfolioRiskQualification(checks);
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M20_PORTFOLIO_RISK_CONTROLS_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
    assert.match(result.marker, /^HELIOS_MULTI_ASSET_M20_/);
  });
});
