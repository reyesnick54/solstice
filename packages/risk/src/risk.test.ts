import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { ModelRegistry, seedCanonicalRiskModel } from '../../model-registry/src/registry.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { ratioPercent, shareOf } from './arithmetic.ts';
import { DEFAULT_RISK_POLICY_VERSION, RiskEngine, defaultSimulationBudget } from './engine.ts';
import { escalateWithInvestmentRisk } from './kernel-facts.ts';
import { asPortfolioRiskSnapshotId } from './ids.ts';
import { EQUITY_SHOCK_NEGATIVE_20 } from './stress.ts';
import type { PortfolioRiskSnapshot, ProposedPaperTrade, RiskPositionFact } from './types.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function humanActor() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const identity = new SimulatedIdentityAdapter({ clock, keys, events: new DomainEventLog() });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'operator_1',
      jurisdiction: asJurisdiction('GB'),
      identityId: 'id_risk_op',
      customerId: asCustomerId('cust_risk_op'),
      capabilities: ['VIEW_ACCOUNT'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('operator_1');
  assert.equal(actor.ok, true);
  if (!actor.ok) {
    throw new Error('actor');
  }
  return { actor: actor.value, clock };
}

function position(overrides: Partial<RiskPositionFact> = {}): RiskPositionFact {
  return Object.freeze({
    instrumentId: 'SIM-ETF-1',
    instrumentType: 'ETF',
    currency: 'USD',
    quantityUnits: 1_000_000_000n,
    marketValueMinor: 100_000n,
    priceMinor: 10_000n,
    priceTimestamp: NOW,
    priceQuality: 'CURRENT',
    liquidityClass: 'HIGH',
    sourceRef: 'fixture:position',
    ...overrides,
  });
}

function snapshot(overrides: Partial<PortfolioRiskSnapshot> = {}): PortfolioRiskSnapshot {
  return Object.freeze({
    snapshotId: asPortfolioRiskSnapshotId('prs_demo_portfolio'),
    portfolioId: 'inv_demo',
    subjectId: 'cust_risk',
    asOf: NOW,
    currency: 'USD',
    positions: Object.freeze([position()]),
    brokerageCashMinor: 100_000n,
    unsettledCashMinor: 0n,
    pendingOrderNotionalMinor: 0n,
    realizedPnlMinor: 0n,
    unrealizedPnlMinor: 0n,
    observations: Object.freeze([]),
    sourceRefs: Object.freeze(['fixture:portfolio']),
    simulationOnly: true,
    ...overrides,
  });
}

function buy(notionalMinor: bigint, proposalRef: string): ProposedPaperTrade {
  return Object.freeze({
    proposalRef,
    instrumentId: 'SIM-ETF-1',
    instrumentType: 'ETF',
    currency: 'USD',
    side: 'BUY',
    quantityUnits: (notionalMinor * 100_000_000n) / 10_000n,
    quantityScale: 8,
    priceMinor: 10_000n,
    notionalMinor,
    feeMinor: 0n,
    liquidityClass: 'HIGH',
  });
}

function engine() {
  const { actor, clock } = humanActor();
  const registry = new ModelRegistry();
  const seeded = seedCanonicalRiskModel(registry, actor, NOW);
  assert.equal(seeded.ok, true);
  return new RiskEngine({ clock, registry, events: new DomainEventLog() });
}

describe('investment risk engine', () => {
  it('blocks an 80 percent concentration buy and allows a 55 percent buy', () => {
    const risk = engine();
    const budget = defaultSimulationBudget({
      subjectId: 'cust_risk',
      portfolioId: 'inv_demo',
      reviewBy: NOW,
      maxInstrumentConcentration: ratioPercent(60n),
    });
    const blocked = risk.assessPreTrade({
      snapshot: snapshot(),
      proposed: buy(60_000n, 'ord_block'),
      budget,
    });
    assert.equal(blocked.outcome, 'BLOCK');
    assert.equal(blocked.triggeredLimits.some((row) => row.dimension === 'INSTRUMENT_CONCENTRATION'), true);
    assert.equal(blocked.guaranteedOutcome, false);
    const allowed = risk.assessPreTrade({
      snapshot: snapshot(),
      proposed: buy(10_000n, 'ord_allow'),
      budget,
    });
    assert.equal(allowed.outcome, 'ALLOW_SIMULATION');
    const postBlock = shareOf(160_000n, 200_000n);
    const postAllow = shareOf(110_000n, 200_000n);
    assert.equal(postBlock.units, 80_000_000n);
    assert.equal(postAllow.units, 55_000_000n);
  });

  it('enforces a hard mandate cash floor that the risk budget cannot loosen', () => {
    const risk = engine();
    const budget = defaultSimulationBudget({
      subjectId: 'cust_risk',
      portfolioId: 'inv_demo',
      reviewBy: NOW,
    });
    const decision = risk.assessPreTrade({
      snapshot: snapshot({ brokerageCashMinor: 800_000n, positions: Object.freeze([]) }),
      proposed: buy(500_000n, 'ord_mandate'),
      budget,
      mandate: {
        kind: 'MINIMUM_CASH_RESERVE',
        minimumLiquidMinor: 800_000n,
        currency: 'USD',
        overrideForbidden: true,
        sourceRef: 'mandate:active',
      },
    });
    assert.equal(decision.outcome, 'BLOCK');
    assert.equal(decision.triggeredLimits.some((row) => row.priority === 'HARD_MANDATE_CONSTRAINT'), true);
  });

  it('does not treat stale prices as current', () => {
    const risk = engine();
    const decision = risk.assessPreTrade({
      snapshot: snapshot({
        positions: Object.freeze([position({ priceQuality: 'STALE' })]),
      }),
      proposed: buy(10_000n, 'ord_stale'),
      budget: defaultSimulationBudget({ subjectId: 'cust_risk', portfolioId: 'inv_demo', reviewBy: NOW }),
    });
    assert.notEqual(decision.outcome, 'ALLOW_SIMULATION');
    assert.equal(decision.staleOrMissingFacts.some((row) => row.includes('STALE')), true);
  });

  it('runs equity stress without mutating financial state', () => {
    const risk = engine();
    const snap = snapshot();
    const beforeCash = snap.brokerageCashMinor;
    const run = risk.runStress(snap, EQUITY_SHOCK_NEGATIVE_20);
    assert.equal(run.estimatedLossMinor, 20_000n);
    assert.equal(run.mutatesFinancialState, false);
    assert.equal(run.placesOrders, false);
    assert.equal(snap.brokerageCashMinor, beforeCash);
  });

  it('preserves an extreme growth goal without relaxing limits or promising the outcome', () => {
    const risk = engine();
    const analysis = risk.analyzeExtremeGoal({
      goalText: '$1,000 → $1,300 in one week.',
      baselineMinor: 100_000n,
      targetMinor: 130_000n,
      intervalDays: 7n,
      budget: defaultSimulationBudget({
        subjectId: 'cust_risk',
        portfolioId: 'inv_demo',
        reviewBy: NOW,
        maxInstrumentConcentration: ratioPercent(60n),
      }),
    });
    assert.equal(analysis.preservedGoal.includes('$1,300'), true);
    assert.equal(analysis.impliedGrowth.units, 30_000_000n);
    assert.equal(analysis.guaranteed, false);
    assert.equal(analysis.limitsRelaxed, false);
    assert.equal(analysis.compatibleWithCurrentLimits, true);
    const tighter = risk.analyzeExtremeGoal({
      goalText: '$1,000 → $1,300 in one week.',
      baselineMinor: 100_000n,
      targetMinor: 130_000n,
      intervalDays: 7n,
      budget: defaultSimulationBudget({
        subjectId: 'cust_risk',
        portfolioId: 'inv_demo',
        reviewBy: NOW,
        maxInstrumentConcentration: ratioPercent(10n),
      }),
    });
    assert.equal(tighter.compatibleWithCurrentLimits, false);
  });

  it('is reproducible for the same snapshot, trade, limits, and model', () => {
    const risk = engine();
    const input = {
      snapshot: snapshot(),
      proposed: buy(60_000n, 'ord_repro'),
      budget: defaultSimulationBudget({
        subjectId: 'cust_risk',
        portfolioId: 'inv_demo',
        reviewBy: NOW,
      }),
    };
    const first = risk.assessPreTrade(input);
    const second = risk.assessPreTrade(input);
    assert.equal(first.assessmentId, second.assessmentId);
    assert.equal(first.outcome, second.outcome);
    assert.deepEqual(
      first.triggeredLimits.map((row) => row.limitId),
      second.triggeredLimits.map((row) => row.limitId),
    );
  });

  it('escalates Kernel Risk facts monotonically and cannot be overridden to ALLOW', () => {
    const escalated = escalateWithInvestmentRisk('ALLOW', {
      assessmentId: 'ras_block',
      outcome: 'BLOCK',
      triggeredLimitIds: Object.freeze(['rlim_instrument_concentration']),
      modelId: 'mdl_investment_pretrade',
      modelVersion: 'risk-model-v1',
      generatedAt: NOW,
    });
    assert.equal(escalated.status, 'BLOCK');
    const unchanged = escalateWithInvestmentRisk('REQUIRE_MANUAL_REVIEW', {
      assessmentId: 'ras_allow',
      outcome: 'ALLOW_SIMULATION',
      triggeredLimitIds: Object.freeze([]),
      modelId: 'mdl_investment_pretrade',
      modelVersion: 'risk-model-v1',
      generatedAt: NOW,
    });
    assert.equal(unchanged.status, 'REQUIRE_MANUAL_REVIEW');
  });

  it('lets Growth query proposal-mode compatibility without executing', () => {
    const risk = engine();
    const annotation = risk.annotateGrowthCandidate({
      candidateRef: 'cand_a',
      snapshot: snapshot(),
      proposed: buy(60_000n, 'cand_a'),
      budget: defaultSimulationBudget({ subjectId: 'cust_risk', portfolioId: 'inv_demo', reviewBy: NOW }),
    });
    assert.equal(annotation.compatible, false);
    assert.equal(annotation.outcome, 'BLOCK');
    assert.match(annotation.reason, /concentration/);
  });

  it('exposes PEVE context that does not convert risk into human value', () => {
    const risk = engine();
    const decision = risk.assessPreTrade({
      snapshot: snapshot(),
      proposed: buy(10_000n, 'ord_peve'),
      budget: defaultSimulationBudget({ subjectId: 'cust_risk', portfolioId: 'inv_demo', reviewBy: NOW }),
    });
    const context = risk.peveContext(decision);
    assert.equal(context.higherRiskIsNotHigherValue, true);
    assert.equal(context.unrealizedUpsideIsNotRealizedValue, true);
  });

  it('lets RDT preview a looser candidate budget without applying it', () => {
    const risk = engine();
    const current = defaultSimulationBudget({ subjectId: 'cust_risk', portfolioId: 'inv_demo', reviewBy: NOW });
    const candidate = defaultSimulationBudget({
      subjectId: 'cust_risk',
      portfolioId: 'inv_demo',
      reviewBy: NOW,
      maxInstrumentConcentration: ratioPercent(90n),
    });
    const preview = risk.previewBudgetChange(current, candidate);
    assert.equal(preview.wouldLoosenCurrentLimits, true);
    assert.equal(preview.applied, false);
  });

  it('uses the default policy version token', () => {
    assert.equal(DEFAULT_RISK_POLICY_VERSION, 'risk-policy-v1');
  });
});
