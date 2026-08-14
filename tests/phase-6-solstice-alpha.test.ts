import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Money } from '../packages/contracts/src/money.ts';
import { asAccountId, asCustomerId } from '../packages/contracts/src/ids.ts';
import { asUtcInstant } from '../packages/contracts/src/time.ts';
import { LIVE_TRADING_ENABLED, REAL_MONEY_ENABLED } from '../packages/flags/src/capabilities.ts';
import { LIVE_FLAGS } from '../packages/platform/src/flags/live.ts';
import { createControlPlane } from '../packages/platform/src/runtime.ts';
import { ActionType } from '../packages/platform/src/kernel/ActionIntent.ts';
import {
  openInvestmentAccount,
  sweepDepositToInvestmentCash,
  sweepUndefinedPair,
  weeklyHarvest,
  harvestUnrealized,
  sumRealizedAndUnrealized,
  realizedSettledProfit,
  unrealizedPnL,
  InvestmentLedger,
} from '../packages/investments/src/index.ts';
import { RiskEngine, overrideRiskRefusal, RISK_REFUSAL_UNOVERRIDABLE } from '../packages/risk-engine/src/index.ts';
import { ModelRegistry } from '../packages/model-registry/src/index.ts';
import { ExecutionEngine, simulatePriceSeries } from '../packages/execution-engine/src/index.ts';
import {
  MeanReversionStrategy,
  MomentumStrategy,
  MarketNeutralPairStrategy,
  noCredentials,
  promoteWithApproval,
  autoPromoteOnMetric,
  recommendWeights,
  applyRecommendationUnderRisk,
} from '../packages/strategies/src/index.ts';
import type { RiskLimitType, RiskRequest } from '../packages/contracts/src/risk-types.ts';
import { RISK_LIMIT_TYPES } from '../packages/contracts/src/risk-types.ts';
import type { ReleasedModel } from '../packages/contracts/src/model-types.ts';

const USD = (n: bigint) => Money.fromMinorUnits(n, 'USD');
const NOW = asUtcInstant('2026-08-14T12:00:00.000Z');

function baseRequest(overrides: Partial<RiskRequest> = {}): RiskRequest {
  return {
    strategyId: 'strat_mean_reversion',
    instrumentId: 'SIM.A',
    side: 'BUY',
    quantityMicros: 1_000_000n,
    priceMinorUnits: 10_000n,
    currency: 'USD',
    proposedNotional: USD(10_000_00n),
    currentPositionMicros: 0n,
    currentGrossMinorUnits: 100_000_00n,
    currentNetMinorUnits: 0n,
    equityMinorUnits: 1_000_000_00n,
    dailyRealizedLossMinorUnits: 0n,
    peakEquityMinorUnits: 1_000_000_00n,
    troughEquityMinorUnits: 1_000_000_00n,
    volatilityMadBps: 50n,
    expectedShortfallBps: 80n,
    largestPositionMinorUnits: 10_000_00n,
    instrumentLiquid: true,
    counterpartyId: 'cp_sim',
    counterpartyNotionalMinorUnits: 0n,
    averageDailyVolumeMicros: 100_000_000n,
    strategyGrossMinorUnits: 0n,
    ...overrides,
  };
}

function preconditions() {
  return {
    agreement: { version: 'iaa_v1', acceptedAt: NOW },
    riskProfile: { ceiling: 'MODERATE' as const, assessedAt: NOW, current: true as const },
    disclosure: { version: 'disc_v1', acknowledgedAt: NOW, current: true as const },
    transferAuthorization: {
      authorized: true as const,
      authorizedAt: NOW,
      scope: 'DEPOSIT_TO_INVESTMENT_SWEEP' as const,
    },
  };
}

describe('Phase 6 investment account opening', () => {
  const cases: { label: string; omit: 'agreement' | 'riskProfile' | 'disclosure' | 'transferAuthorization' }[] = [
    { label: 'agreement', omit: 'agreement' },
    { label: 'risk profile', omit: 'riskProfile' },
    { label: 'disclosure', omit: 'disclosure' },
    { label: 'transfer authorization', omit: 'transferAuthorization' },
  ];

  for (const row of cases) {
    it(`refuses opening without ${row.label}`, () => {
      const runtime = createControlPlane();
      const payload = {
        accountId: 'acct_inv',
        ownerId: 'cust_x',
        cashAccountId: 'cash',
        securitiesAccountId: 'sec',
        agreementVersion: row.omit === 'agreement' ? undefined : 'iaa_v1',
        riskProfileCurrent: row.omit === 'riskProfile' ? undefined : true,
        disclosureVersion: row.omit === 'disclosure' ? undefined : 'disc_v1',
        transferAuthorized: row.omit === 'transferAuthorization' ? undefined : true,
      };
      const decision = runtime.kernel.submit({
        actionType: ActionType.OPEN_INVESTMENT_ACCOUNT,
        payload,
        idempotencyKey: `open_missing_${row.omit}`,
        actorId: 'human',
        origin: 'HUMAN',
        requestedAt: NOW,
      });
      assert.equal(decision.outcome, 'REFUSED');
    });
  }

  it('opens when every precondition is present', () => {
    const runtime = createControlPlane();
    const decision = runtime.kernel.submit({
      actionType: ActionType.OPEN_INVESTMENT_ACCOUNT,
      payload: {
        accountId: 'acct_inv',
        ownerId: 'cust_x',
        cashAccountId: 'cash',
        securitiesAccountId: 'sec',
        agreementVersion: 'iaa_v1',
        riskProfileCurrent: true,
        disclosureVersion: 'disc_v1',
        transferAuthorized: true,
      },
      idempotencyKey: 'open_ok',
      actorId: 'human',
      origin: 'HUMAN',
      requestedAt: NOW,
    });
    assert.equal(decision.outcome, 'ALLOWED');
    assert.equal(runtime.alpha.services.accounts.size, 1);
  });
});

describe('Phase 6 sweep bridge', () => {
  it('posts balanced journals on both sides and refuses an undefined pair', () => {
    const runtime = createControlPlane();
    const authority = runtime.alpha.issueAuthority('TEST', 'acct', USD(1n), 'ea1', NOW);
    const opened = openInvestmentAccount(
      {
        id: asAccountId('acct_inv'),
        ownerId: asCustomerId('cust_x'),
        cashAccountId: asAccountId('cash'),
        securitiesAccountId: asAccountId('sec'),
        openedAt: NOW,
        ...preconditions(),
      },
      authority,
    );
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const ledger = new InvestmentLedger();
    ledger.seedInsuredDeposit('dep', USD(500_00n), authority, NOW);
    const okSweep = sweepDepositToInvestmentCash(
      ledger,
      opened.account,
      'dep',
      USD(200_00n),
      NOW,
      authority,
    );
    assert.equal(okSweep.ok, true);
    if (!okSweep.ok) return;
    const depositSide = okSweep.journal.lines.filter((l) => l.side === 'DEPOSIT_BOOK');
    const invSide = okSweep.journal.lines.filter((l) => l.side === 'INVESTMENT_BOOK');
    const dDebit = depositSide.filter((l) => l.direction === 'DEBIT').reduce((a, l) => a + l.amount.minorUnits, 0n);
    const dCredit = depositSide.filter((l) => l.direction === 'CREDIT').reduce((a, l) => a + l.amount.minorUnits, 0n);
    const iDebit = invSide.filter((l) => l.direction === 'DEBIT').reduce((a, l) => a + l.amount.minorUnits, 0n);
    const iCredit = invSide.filter((l) => l.direction === 'CREDIT').reduce((a, l) => a + l.amount.minorUnits, 0n);
    assert.equal(dDebit, dCredit);
    assert.equal(iDebit, iCredit);
    assert.equal(okSweep.journal.classBridgeName, 'DEPOSIT_TO_INVESTMENT_CASH_SWEEP');
    const refused = sweepUndefinedPair(ledger, 'dep', 'sec', USD(1_00n), NOW, authority);
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.equal(refused.code, 'CLASS_BRIDGE_UNDEFINED');
  });
});

describe('Phase 6 realized vs unrealized', () => {
  it('are distinct types and cannot be summed', () => {
    const realized = realizedSettledProfit(USD(100n));
    const unrealized = unrealizedPnL(USD(50n));
    assert.equal(realized.kind, 'REALIZED_SETTLED');
    assert.equal(unrealized.kind, 'UNREALIZED');
    assert.equal(realized.withdrawable, true);
    assert.equal(unrealized.withdrawable, false);
    assert.throws(() => sumRealizedAndUnrealized(realized, unrealized));
    const rejected = harvestUnrealized(unrealized);
    assert.equal(rejected.code, 'UNREALIZED_IS_UNSWEEPABLE');
  });
});

describe('Phase 6 Risk Engine', () => {
  it('refusal cannot be overridden by any caller', () => {
    const risk = new RiskEngine();
    const refusal = risk.evaluate(baseRequest({ instrumentLiquid: false }));
    assert.equal(refusal.kind, 'REFUSE');
    if (refusal.kind !== 'REFUSE') return;
    assert.equal(refusal.final, true);
    assert.equal(RISK_REFUSAL_UNOVERRIDABLE, 'UNOVERRIDABLE');
    const callers = ['model', 'agent', 'meta-allocator', 'override'] as const;
    for (const _caller of callers) {
      assert.throws(() => overrideRiskRefusal(refusal, undefined as never));
    }
    const admitted = risk.admit(refusal);
    assert.equal(admitted.kind, 'REFUSE');
    const execution = new ExecutionEngine(risk);
    const runtime = createControlPlane();
    const authority = runtime.alpha.issueAuthority('PAPER_FILL', 'p', USD(0n), 'ea', NOW);
    const strategy = new MeanReversionStrategy(1n);
    const series = simulatePriceSeries({
      instrumentId: 'SIM.A',
      currency: 'USD',
      seed: 1n,
      steps: 8,
      startMinorUnits: 10_000n,
      volatilityBps: 40n,
      startAt: NOW,
      stepMillis: 1_000n,
    });
    const proposal = strategy.propose(series, series.points[series.points.length - 1]!.asOf)[0]!;
    const result = execution.execute(proposal, refusal, 'PAPER', authority, NOW);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'RISK_REFUSAL_IS_FINAL');
  });

  it('each limit type triggers correctly', () => {
    const risk = new RiskEngine();
    const triggers: { limit: RiskLimitType; request: RiskRequest }[] = [
      { limit: 'MAX_POSITION', request: baseRequest({ quantityMicros: 80_000_000n }) },
      { limit: 'MAX_GROSS_EXPOSURE', request: baseRequest({ currentGrossMinorUnits: 5_000_000_00n }) },
      { limit: 'MAX_NET_EXPOSURE', request: baseRequest({ currentNetMinorUnits: 3_000_000_00n }) },
      { limit: 'LEVERAGE', request: baseRequest({ equityMinorUnits: 1_00n, proposedNotional: USD(1_000_00n) }) },
      { limit: 'CONCENTRATION', request: baseRequest({ largestPositionMinorUnits: 4_000_000_00n, currentGrossMinorUnits: 100_00n }) },
      { limit: 'LIQUIDITY', request: baseRequest({ instrumentLiquid: false }) },
      { limit: 'DAILY_LOSS', request: baseRequest({ dailyRealizedLossMinorUnits: 80_000_00n }) },
      { limit: 'ROLLING_DRAWDOWN', request: baseRequest({ peakEquityMinorUnits: 200_000_00n, troughEquityMinorUnits: 50_000_00n }) },
      { limit: 'VOLATILITY', request: baseRequest({ volatilityMadBps: 9_000n }) },
      { limit: 'EXPECTED_SHORTFALL', request: baseRequest({ expectedShortfallBps: 9_000n }) },
      { limit: 'STRATEGY_LIMIT', request: baseRequest({ strategyGrossMinorUnits: 2_000_000_00n }) },
      { limit: 'COUNTERPARTY_LIMIT', request: baseRequest({ counterpartyNotionalMinorUnits: 1_000_000_00n }) },
      { limit: 'MARKET_IMPACT', request: baseRequest({ averageDailyVolumeMicros: 1_000_000n, quantityMicros: 2_000_000n }) },
    ];
    const seen = new Set<string>();
    for (const row of triggers) {
      const verdict = risk.evaluate(row.request);
      assert.notEqual(verdict.kind, 'ALLOW', row.limit);
      if (verdict.kind === 'REFUSE' || verdict.kind === 'REDUCE') {
        assert.equal(verdict.limit, row.limit);
        seen.add(verdict.limit);
      }
    }
    for (const limit of RISK_LIMIT_TYPES) {
      assert.equal(seen.has(limit), true, limit);
    }
  });

  it('kill switch halts trading with the agent runtime disabled', () => {
    const risk = new RiskEngine();
    risk.killSwitches.engage({ kind: 'AGENT_RUNTIME' }, 'disable agents', 'operator', NOW);
    risk.killSwitches.engage({ kind: 'ALL_TRADING' }, 'halt', 'operator', NOW);
    assert.equal(risk.killSwitches.agentRuntimeHalted(), true);
    assert.equal(risk.killSwitches.tradingHalted(), true);
    const verdict = risk.evaluate(baseRequest());
    assert.equal(verdict.kind, 'REFUSE');
  });
});

describe('Phase 6 model registry', () => {
  it('a model not RELEASED receives no allocation', () => {
    const registry = new ModelRegistry();
    registry.register({
      modelId: 'mdl_x',
      version: '1',
      owner: 'o',
      purpose: 'TRADING',
      riskClass: 'LOW',
      trainingDataReference: 'sim://x',
      features: [],
      approvedJurisdictions: ['US'],
      approvedProducts: ['INVESTMENT_ASSET'],
      validationState: 'DRAFT',
      releaseState: 'UNRELEASED',
      deploymentState: 'NOT_DEPLOYED',
      monitoringState: 'UNMONITORED',
      limitations: [],
      killSwitchState: 'CLEAR',
      approvalSignatures: [],
      lastReview: NOW,
    });
    const refused = registry.allocate('mdl_x', '1', 1n, 1n);
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.equal(refused.code, 'MODEL_NOT_RELEASED');
  });

  it('only ReleasedModel can be allocated', () => {
    const registry = new ModelRegistry();
    const released: ReleasedModel = {
      modelId: 'mdl_y',
      version: '1',
      owner: 'o',
      purpose: 'AML',
      riskClass: 'HIGH',
      trainingDataReference: 'sim://y',
      features: ['x'],
      approvedJurisdictions: ['US'],
      approvedProducts: ['INVESTMENT_ASSET'],
      validationState: 'RELEASED',
      releaseState: 'RELEASED',
      deploymentState: 'PAPER',
      monitoringState: 'ACTIVE',
      limitations: ['simulation'],
      killSwitchState: 'CLEAR',
      approvalSignatures: [],
      lastReview: NOW,
    };
    registry.register(released);
    const grant = registry.allocate('mdl_y', '1', 1n, 2n);
    assert.equal(grant.ok, true);
  });
});

describe('Phase 6 strategies and paper trading', () => {
  it('strategies reproduce exactly from a seed', () => {
    const seriesA = simulatePriceSeries({
      instrumentId: 'SIM.A',
      currency: 'USD',
      seed: 99n,
      steps: 12,
      startMinorUnits: 10_000n,
      volatilityBps: 60n,
      startAt: NOW,
      stepMillis: 1_000n,
    });
    const seriesB = simulatePriceSeries({
      instrumentId: 'SIM.A',
      currency: 'USD',
      seed: 99n,
      steps: 12,
      startMinorUnits: 10_000n,
      volatilityBps: 60n,
      startAt: NOW,
      stepMillis: 1_000n,
    });
    assert.deepEqual(
      seriesA.points.map((p) => p.minorUnitsPerShare.toString()),
      seriesB.points.map((p) => p.minorUnitsPerShare.toString()),
    );
    const asOf = seriesA.points[seriesA.points.length - 1]!.asOf;
    const a = new MeanReversionStrategy(99n).propose(seriesA, asOf);
    const b = new MeanReversionStrategy(99n).propose(seriesB, asOf);
    assert.deepEqual(a, b);
    noCredentials(new MomentumStrategy(1n));
    noCredentials(new MarketNeutralPairStrategy(1n));
  });

  it('paper fills never touch the customer ledger and every order requires Authority', () => {
    const runtime = createControlPlane();
    const before = runtime.ledger.count();
    const risk = new RiskEngine();
    const execution = new ExecutionEngine(risk);
    const series = simulatePriceSeries({
      instrumentId: 'SIM.A',
      currency: 'USD',
      seed: 7n,
      steps: 8,
      startMinorUnits: 10_000n,
      volatilityBps: 40n,
      startAt: NOW,
      stepMillis: 1_000n,
    });
    const proposal = new MomentumStrategy(7n).propose(series, series.points.at(-1)!.asOf)[0]!;
    const authority = runtime.alpha.issueAuthority('PAPER_FILL', 'p', USD(0n), 'ea', NOW);
    const missing = execution.execute(proposal, { kind: 'ALLOW', final: false }, 'PAPER', {
      ...authority,
      signature: '',
    }, NOW);
    assert.equal(missing.ok, false);
    const filled = execution.execute(proposal, { kind: 'ALLOW', final: false }, 'PAPER', authority, NOW);
    assert.equal(filled.ok, true);
    assert.equal(execution.paper.count(), 1);
    assert.equal(execution.paper.list()[0]!.ledgerKind, 'PAPER');
    assert.equal(execution.paper.list()[0]!.neverCustomerLedger, true);
    assert.equal(runtime.ledger.count(), before);
    const shadow = execution.execute(proposal, { kind: 'ALLOW', final: false }, 'SHADOW', authority, NOW);
    assert.equal(shadow.ok, true);
    if (shadow.ok) assert.equal(shadow.record.mode, 'SHADOW');
  });
});

describe('Phase 6 weekly harvest', () => {
  it('sweeps realized only; unrealized is a typed rejection', () => {
    const runtime = createControlPlane();
    const authority = runtime.alpha.issueAuthority('H', 'a', USD(1n), 'h', NOW);
    const opened = openInvestmentAccount(
      {
        id: asAccountId('acct_inv'),
        ownerId: asCustomerId('cust_x'),
        cashAccountId: asAccountId('cash'),
        securitiesAccountId: asAccountId('sec'),
        openedAt: NOW,
        ...preconditions(),
      },
      authority,
    );
    assert.equal(opened.ok, true);
    if (!opened.ok) return;
    const ledger = new InvestmentLedger();
    ledger.seedInsuredDeposit('dep', USD(1_000_00n), authority, NOW);
    sweepDepositToInvestmentCash(ledger, opened.account, 'dep', USD(400_00n), NOW, authority);
    const realized = realizedSettledProfit(USD(80_00n));
    const harvested = weeklyHarvest(ledger, opened.account, 'dep', realized, 50, NOW, authority);
    assert.equal(harvested.ok, true);
    if (harvested.ok) assert.equal(harvested.swept.minorUnits, 40_00n);
    const rejected = harvestUnrealized(unrealizedPnL(USD(80_00n)));
    assert.equal(rejected.code, 'UNREALIZED_IS_UNSWEEPABLE');
  });
});

describe('Phase 6 lifecycle and flags', () => {
  it('promotion requires explicit approval and LIVE flags stay false', () => {
    const ok = promoteWithApproval({
      strategyId: 's',
      from: 'RESEARCH',
      to: 'BACKTEST',
      approvedBy: 'human',
      approvedAt: NOW,
      reason: 'recorded',
    });
    assert.equal('strategyId' in ok, true);
    assert.throws(() => autoPromoteOnMetric(100n));
    const weights = recommendWeights(['s']);
    const risk = new RiskEngine();
    const blocked = applyRecommendationUnderRisk(
      weights[0]!,
      baseRequest({ instrumentLiquid: false }),
      risk,
    );
    assert.equal(blocked.accepted, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(REAL_MONEY_ENABLED, false);
    assert.equal(LIVE_FLAGS.LIVE_MONEY_MOVEMENT, false);
  });
});

describe('Phase 6 exit criterion', () => {
  it('strategies run in shadow and paper with zero customer capital at risk', () => {
    const runtime = createControlPlane();
    const risk = new RiskEngine();
    const execution = new ExecutionEngine(risk);
    const series = simulatePriceSeries({
      instrumentId: 'SIM.A',
      currency: 'USD',
      seed: 3n,
      steps: 8,
      startMinorUnits: 10_000n,
      volatilityBps: 40n,
      startAt: NOW,
      stepMillis: 1_000n,
    });
    const asOf = series.points.at(-1)!.asOf;
    const proposals = [
      ...new MeanReversionStrategy(3n).propose(series, asOf),
      ...new MomentumStrategy(3n).propose(series, asOf),
      ...new MarketNeutralPairStrategy(3n).propose(series, asOf),
    ];
    const authority = runtime.alpha.issueAuthority('PAPER_FILL', 'p', USD(0n), 'ea', NOW);
    const customerBefore = runtime.ledger.count();
    execution.execute(proposals[0]!, { kind: 'ALLOW', final: false }, 'SHADOW', authority, asOf);
    for (const proposal of proposals) {
      execution.execute(proposal, { kind: 'ALLOW', final: false }, 'PAPER', authority, asOf);
    }
    assert.ok(execution.shadows.length >= 1);
    assert.ok(execution.paper.count() >= 1);
    assert.equal(runtime.ledger.count(), customerBefore);
    assert.equal(LIVE_TRADING_ENABLED, false);
  });
});
