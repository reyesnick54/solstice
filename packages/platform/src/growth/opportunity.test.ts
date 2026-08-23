import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import type { PersonalEconomicSnapshot } from '../../../personal-economic-graph/src/snapshot.ts';
import { EconomicGraphService } from '../../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { simulationPolicyPort } from '../policy-port.ts';
import { GrowthOrchestrator } from '../service.ts';
import { defaultOpportunityPreferences } from './opportunity/preferences.ts';
import { SIMULATION_GROWTH_PRODUCTS, SIMULATION_RATE_CATALOG } from './opportunity/products.ts';
import { discoverOpportunities } from './opportunity/discover.ts';
import { runOpportunityDetectors } from './opportunity/detectors.ts';
import { evaluateOpportunityEligibility } from './opportunity/eligibility.ts';
import { explanationFactsText, explanationInputFor } from './opportunity/explain.ts';
import { shouldRecalculateOpportunities } from './opportunity/recompute.ts';
import type { OpportunityDiscoveryContext, OpportunityDiscoveryInput } from './opportunity/types.ts';

const NOW = asUtcInstant('2026-08-22T12:00:00.000Z');
const HERE = dirname(fileURLToPath(import.meta.url));

function asSnapshot(value: object): PersonalEconomicSnapshot {
  return value as unknown as PersonalEconomicSnapshot;
}

function snapshot(overrides: Partial<PersonalEconomicSnapshot> = {}): PersonalEconomicSnapshot {
  return asSnapshot({
    snapshotId: 'peg_s_opp',
    graphId: 'peg_g_opp',
    subjectId: 'id_opp',
    generatedAt: NOW,
    liquidAssetsByCurrency: Object.freeze([
      {
        amount: { minorUnits: '2500000', currency: 'USD' },
        sourceRefs: Object.freeze(['acct_usd_checking']),
        confidence: 'DERIVED',
      },
    ]),
    income: Object.freeze([
      {
        nodeId: 'inc_1',
        label: 'Salary',
        incomeKind: 'SALARY',
        estimatedAmount: { minorUnits: '400000', currency: 'USD' },
        cadence: 'MONTHLY',
        confidence: 'DERIVED',
        sourceRefs: Object.freeze(['evt_sal']),
      },
    ]),
    knownRecurringObligations: Object.freeze([
      {
        nodeId: 'ob_rent',
        kind: 'RENT',
        label: 'Rent',
        estimatedAmount: { minorUnits: '150000', currency: 'USD' },
        cadence: 'MONTHLY',
        confidence: 'DERIVED',
        sourceRefs: Object.freeze(['evt_rent']),
      },
    ]),
    debt: Object.freeze([]),
    investments: Object.freeze([]),
    monthlyCashFlow: Object.freeze([
      {
        currency: 'USD',
        income: { amount: { minorUnits: '400000', currency: 'USD' }, sourceRefs: Object.freeze(['evt_sal']), confidence: 'DERIVED' },
        recurringInflows: { amount: { minorUnits: '400000', currency: 'USD' }, sourceRefs: Object.freeze(['evt_sal']), confidence: 'DERIVED' },
        recurringOutflows: { amount: { minorUnits: '150000', currency: 'USD' }, sourceRefs: Object.freeze(['evt_rent']), confidence: 'DERIVED' },
        variableOutflows: { amount: { minorUnits: '20000', currency: 'USD' }, sourceRefs: Object.freeze([]), confidence: 'DERIVED' },
        netFlow: { amount: { minorUnits: '230000', currency: 'USD' }, sourceRefs: Object.freeze(['evt_sal']), confidence: 'DERIVED' },
      },
    ]),
    goals: Object.freeze([
      {
        nodeId: 'goal_home',
        goalKind: 'HOME_PURCHASE',
        label: 'Home',
        target: { minorUnits: '5000000', currency: 'USD' },
        targetDate: '2027-08-22T00:00:00.000Z',
        priority: 1,
        status: 'ACTIVE',
      },
    ]),
    economicOpportunities: Object.freeze([]),
    valuationContext: null,
    authoritativeBalance: false,
    ledgerWins: true,
    crossCurrencyTotal: null,
    ...overrides,
  });
}

function context(overrides: Partial<OpportunityDiscoveryContext> = {}): OpportunityDiscoveryContext {
  return {
    now: NOW,
    jurisdiction: 'US',
    kycState: 'VERIFIED',
    customerRestricted: false,
    riskProfile: 'BALANCED',
    suitabilityMaxRisk: 'MODERATE',
    products: SIMULATION_GROWTH_PRODUCTS,
    ledgerPositions: Object.freeze([
      {
        accountRef: 'acct_usd_checking',
        currency: 'USD',
        minorUnits: '2500000',
        accountClass: 'DEMAND_DEPOSIT',
        restricted: false,
        frozen: false,
      },
      {
        accountRef: 'acct_usd_savings',
        currency: 'USD',
        minorUnits: '0',
        accountClass: 'SAVINGS_DEPOSIT',
        restricted: false,
        frozen: false,
      },
    ]),
    rateCatalog: SIMULATION_RATE_CATALOG,
    policy: simulationPolicyPort,
    preferences: defaultOpportunityPreferences('id_opp', NOW),
    previous: Object.freeze([]),
    ...overrides,
  };
}

function input(overrides: Partial<OpportunityDiscoveryInput> = {}): OpportunityDiscoveryInput {
  return {
    subjectId: 'id_opp',
    snapshot: snapshot(),
    context: context(),
    ...overrides,
  };
}

function setupActor(actorId: string, identityId: string) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId,
      jurisdiction: asJurisdiction('US'),
      identityId,
      customerId: asCustomerId(`cust_${identityId}`),
      capabilities: ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT', 'VIEW_GROWTH_PLAN', 'CONFIRM_ECONOMIC_MANDATE'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext(actorId);
  if (!actor.ok) {
    throw new Error('actor');
  }
  return { clock, events, evidence, actor: actor.value, peg: new EconomicGraphService({ clock, events }) };
}

describe('opportunity detectors', () => {
  it('detects idle cash above the reserve floor', () => {
    const findings = runOpportunityDetectors(input());
    assert.equal(findings.some((item) => item.detector === 'EXCESS_IDLE_CASH'), true);
    const idle = findings.find((item) => item.detector === 'EXCESS_IDLE_CASH');
    assert.ok(idle?.rateSource);
    assert.equal(idle?.impactKind, 'ESTIMATED_RANGE');
    assert.equal(idle?.rateSource?.authority, 'SIMULATION_CATALOG_NOT_A_PROMISE');
  });

  it('detects an insufficient reserve when liquid is low', () => {
    const findings = runOpportunityDetectors(
      input({
        snapshot: snapshot({
          liquidAssetsByCurrency: Object.freeze([
            {
              amount: { minorUnits: '10000', currency: 'USD' },
              sourceRefs: Object.freeze(['acct_usd_checking']),
              confidence: 'DERIVED',
            },
          ]),
        }),
        context: context({
          ledgerPositions: Object.freeze([
            {
              accountRef: 'acct_usd_checking',
              currency: 'USD',
              minorUnits: '10000',
              accountClass: 'DEMAND_DEPOSIT',
              restricted: false,
              frozen: false,
            },
          ]),
        }),
      }),
    );
    assert.equal(findings.some((item) => item.detector === 'INSUFFICIENT_RESERVE'), true);
  });

  it('detects recurring surplus from monthly cash flow', () => {
    const findings = runOpportunityDetectors(input());
    assert.equal(findings.some((item) => item.detector === 'RECURRING_SURPLUS'), true);
  });

  it('detects a goal funding gap without promising achievement', () => {
    const findings = runOpportunityDetectors(input());
    const gap = findings.find((item) => item.detector === 'GOAL_FUNDING_GAP');
    assert.ok(gap);
    assert.match(gap.assumptions.join(' '), /not promised/i);
  });

  it('detects portfolio concentration only when holding amounts exist', () => {
    const none = runOpportunityDetectors(input());
    assert.equal(none.some((item) => item.detector === 'PORTFOLIO_CONCENTRATION'), false);
    const findings = runOpportunityDetectors(
      input({
        context: context({
          portfolio: {
            holdings: Object.freeze([
              { holdingId: 'etf_a', label: 'ETF A', amount: { minorUnits: '900000', currency: 'USD' } },
              { holdingId: 'etf_b', label: 'ETF B', amount: { minorUnits: '100000', currency: 'USD' } },
            ]),
          },
        }),
      }),
    );
    assert.equal(findings.some((item) => item.detector === 'PORTFOLIO_CONCENTRATION'), true);
  });

  it('detects portfolio drift against stated target weights', () => {
    const findings = runOpportunityDetectors(
      input({
        context: context({
          portfolio: {
            holdings: Object.freeze([
              { holdingId: 'etf_a', label: 'ETF A', amount: { minorUnits: '700000', currency: 'USD' } },
              { holdingId: 'etf_b', label: 'ETF B', amount: { minorUnits: '300000', currency: 'USD' } },
            ]),
            targetWeightsBps: Object.freeze({ etf_a: 5000, etf_b: 5000 }),
          },
        }),
      }),
    );
    assert.equal(findings.some((item) => item.detector === 'PORTFOLIO_DRIFT'), true);
  });

  it('detects uninvested investment cash as a paper review only', () => {
    const findings = runOpportunityDetectors(
      input({
        context: context({
          portfolio: { holdings: Object.freeze([]), investmentCash: { minorUnits: '80000', currency: 'USD' } },
        }),
      }),
    );
    const cash = findings.find((item) => item.detector === 'UNINVESTED_INVESTMENT_CASH');
    assert.ok(cash);
    assert.equal(cash.impactKind, 'SCENARIO_RANGE');
    assert.match(cash.assumptions.join(' '), /unimplemented|not promised|no market outcome/i);
  });

  it('detects currency concentration across two liquid currencies', () => {
    const findings = runOpportunityDetectors(
      input({
        context: context({
          ledgerPositions: Object.freeze([
            {
              accountRef: 'acct_usd_checking',
              currency: 'USD',
              minorUnits: '2500000',
              accountClass: 'DEMAND_DEPOSIT',
              restricted: false,
              frozen: false,
            },
            {
              accountRef: 'acct_gbp_checking',
              currency: 'GBP',
              minorUnits: '10000',
              accountClass: 'DEMAND_DEPOSIT',
              restricted: false,
              frozen: false,
            },
          ]),
        }),
      }),
    );
    assert.equal(findings.some((item) => item.detector === 'CURRENCY_CONCENTRATION'), true);
  });

  it('detects high fees only when a cheaper catalog alternative is supplied', () => {
    const none = runOpportunityDetectors(input());
    assert.equal(none.some((item) => item.detector === 'HIGH_FEES'), false);
    const findings = runOpportunityDetectors(
      input({
        snapshot: snapshot({
          knownRecurringObligations: Object.freeze([
            {
              nodeId: 'ob_fee',
              kind: 'FEE',
              label: 'Account fee',
              estimatedAmount: { minorUnits: '1500', currency: 'USD' },
              cadence: 'MONTHLY',
              confidence: 'DERIVED',
              sourceRefs: Object.freeze(['evt_fee']),
            },
          ]),
        }),
        context: context({
          feeComparisons: Object.freeze([
            {
              obligationRef: 'ob_fee',
              current: { minorUnits: '1500', currency: 'USD' },
              alternative: { minorUnits: '500', currency: 'USD' },
              alternativeLabel: 'lower catalog fee',
            },
          ]),
        }),
      }),
    );
    const fee = findings.find((item) => item.detector === 'HIGH_FEES');
    assert.ok(fee);
    assert.equal(fee.impactKind, 'KNOWN_FINANCIAL_EFFECT');
  });

  it('detects mismatched liquidity when a near-term obligation exceeds cash', () => {
    const findings = runOpportunityDetectors(
      input({
        snapshot: snapshot({
          liquidAssetsByCurrency: Object.freeze([
            {
              amount: { minorUnits: '10000', currency: 'USD' },
              sourceRefs: Object.freeze(['acct_usd_checking']),
              confidence: 'DERIVED',
            },
          ]),
        }),
        context: context({
          ledgerPositions: Object.freeze([
            {
              accountRef: 'acct_usd_checking',
              currency: 'USD',
              minorUnits: '10000',
              accountClass: 'DEMAND_DEPOSIT',
              restricted: false,
              frozen: false,
            },
          ]),
        }),
      }),
    );
    assert.equal(findings.some((item) => item.detector === 'MISMATCHED_LIQUIDITY'), true);
  });
});

describe('opportunity eligibility', () => {
  it('blocks unsupported jurisdictions', () => {
    const finding = runOpportunityDetectors(input())[0];
    assert.ok(finding);
    const result = evaluateOpportunityEligibility({
      finding,
      context: context({ jurisdiction: 'XX' }),
    });
    assert.equal(result.eligible, false);
    assert.equal(result.failedChecks.includes('jurisdiction'), true);
    assert.equal(result.immediatelyExecutable, false);
  });

  it('blocks conservative risk from uncertain-market investment cash', () => {
    const findings = runOpportunityDetectors(
      input({
        context: context({
          portfolio: { holdings: Object.freeze([]), investmentCash: { minorUnits: '80000', currency: 'USD' } },
          riskProfile: 'CONSERVATIVE',
          suitabilityMaxRisk: 'LOW',
        }),
      }),
    );
    const invest = findings.find((item) => item.detector === 'UNINVESTED_INVESTMENT_CASH');
    assert.ok(invest);
    const result = evaluateOpportunityEligibility({
      finding: invest,
      context: context({ riskProfile: 'CONSERVATIVE', suitabilityMaxRisk: 'LOW' }),
    });
    assert.equal(result.eligible, false);
    assert.equal(result.failedChecks.includes('suitability') || result.failedChecks.includes('risk'), true);
  });

  it('marks an unavailable provider ineligible', () => {
    const finding = runOpportunityDetectors(input()).find((item) => item.productId === 'prod_internal_transfer' || item.productId === 'prod_savings_deposit');
    assert.ok(finding);
    const products = SIMULATION_GROWTH_PRODUCTS.map((item) =>
      item.productId === finding.productId ? { ...item, providerAvailable: false } : item,
    );
    const result = evaluateOpportunityEligibility({
      finding,
      context: context({ products }),
    });
    assert.equal(result.eligible, false);
    assert.equal(result.failedChecks.includes('provider'), true);
  });

  it('blocks KYC-gated products when identity is unverified', () => {
    const finding = runOpportunityDetectors(input()).find((item) => item.productId === 'prod_savings_deposit' || item.productId === 'prod_internal_transfer');
    assert.ok(finding);
    const result = evaluateOpportunityEligibility({
      finding,
      context: context({ kycState: 'UNVERIFIED' }),
    });
    assert.equal(result.eligible, false);
    assert.equal(result.failedChecks.includes('kyc'), true);
  });
});

describe('opportunity ranking, lifecycle, and explanation', () => {
  it('ranks reserve gaps above idle-cash estimates', () => {
    const discovered = discoverOpportunities(
      input({
        snapshot: snapshot({
          liquidAssetsByCurrency: Object.freeze([
            {
              amount: { minorUnits: '10000', currency: 'USD' },
              sourceRefs: Object.freeze(['acct_usd_checking']),
              confidence: 'DERIVED',
            },
          ]),
        }),
        context: context({
          ledgerPositions: Object.freeze([
            {
              accountRef: 'acct_usd_checking',
              currency: 'USD',
              minorUnits: '10000',
              accountClass: 'DEMAND_DEPOSIT',
              restricted: false,
              frozen: false,
            },
          ]),
        }),
      }),
    );
    const first = discovered.presented[0] ?? discovered.all.find((item) => item.detector === 'INSUFFICIENT_RESERVE');
    assert.ok(first);
    assert.equal(first.detector, 'INSUFFICIENT_RESERVE');
    assert.equal(first.ranking.version, 'OPPORTUNITY_RANKING_V1');
    assert.ok(first.ranking.reasons.length > 0);
  });

  it('does not re-present an unchanged dismissed opportunity', () => {
    const first = discoverOpportunities(input());
    const idle = first.all.find((item) => item.detector === 'EXCESS_IDLE_CASH');
    assert.ok(idle);
    const dismissed = { ...idle, status: 'DISMISSED' as const, dismissalReason: 'not_now' };
    const second = discoverOpportunities(input({ context: context({ previous: Object.freeze([dismissed]) }) }));
    assert.equal(
      second.presented.some((item) => item.fingerprint === idle.fingerprint),
      false,
    );
    assert.equal(second.all.some((item) => item.fingerprint === idle.fingerprint && item.status === 'DISMISSED'), true);
  });

  it('expires opportunities past expiresAt', () => {
    const discovered = discoverOpportunities(input({ context: context({ now: asUtcInstant('2028-01-01T00:00:00.000Z') }) }));
    assert.ok(discovered.all.every((item) => item.status === 'EXPIRED' || Date.parse(item.expiresAt) > Date.parse('2028-01-01T00:00:00.000Z')));
  });

  it('builds an AI explanation from structured facts only', () => {
    const discovered = discoverOpportunities(input());
    const item = discovered.all[0];
    assert.ok(item);
    const explanation = explanationInputFor(item);
    assert.equal(explanation.inventedNumbersForbidden, true);
    assert.equal(explanation.returnGuaranteeForbidden, true);
    const text = explanationFactsText(explanation);
    assert.match(text, /returnGuaranteed=false/);
    assert.match(text, /opportunityId=/);
    assert.equal(text.includes('guaranteed return'), false);
  });

  it('never encodes a return guarantee on impact', () => {
    const discovered = discoverOpportunities(input());
    for (const item of discovered.all) {
      assert.equal(item.impact.returnGuaranteed, false);
      assert.equal(item.impact.achievementPromised, false);
      assert.equal(item.eligibility.immediatelyExecutable, false);
    }
  });
});

describe('opportunity recalculation', () => {
  it('ignores minor events and small cash changes', () => {
    const minor = shouldRecalculateOpportunities({
      event: { eventType: 'FeePosted', payload: {} } as DomainEvent,
      now: NOW,
    });
    assert.equal(minor.recalculate, false);
    const small = shouldRecalculateOpportunities({
      event: { eventType: 'DepositPosted', payload: {} } as DomainEvent,
      now: NOW,
      previousLiquidMinor: 1_000_000n,
      nextLiquidMinor: 1_001_000n,
    });
    assert.equal(small.recalculate, false);
    const material = shouldRecalculateOpportunities({
      event: { eventType: 'DepositPosted', payload: {} } as DomainEvent,
      now: NOW,
      previousLiquidMinor: 1_000_000n,
      nextLiquidMinor: 1_200_000n,
    });
    assert.equal(material.recalculate, true);
  });
});

describe('GrowthOrchestrator opportunity surface', () => {
  it('lists, dismisses, and starts a proposal without moving money', () => {
    const { clock, events, actor, peg } = setupActor('actor_opp', 'id_opp_orch');
    peg.registerAccountCurrency('acct_usd_checking', 'USD');
    peg.openGraph(actor, 'id_opp_orch', asCustomerId('cust_id_opp_orch'));
    const orchestrator = new GrowthOrchestrator({ clock, events, peg });
    const listed = orchestrator.discoverCustomerOpportunities(actor, 'id_opp_orch', {
      ledgerPositions: Object.freeze([
        {
          accountRef: 'acct_usd_checking',
          currency: 'USD',
          minorUnits: '2500000',
          accountClass: 'DEMAND_DEPOSIT',
          restricted: false,
          frozen: false,
        },
      ]),
    });
    assert.equal(listed.ok, true);
    if (!listed.ok) {
      return;
    }
    assert.equal(listed.value.feed.productionMoneyMovement, false);
    const item = listed.value.all[0];
    assert.ok(item);
    const dismissed = orchestrator.dismissOpportunity(actor, 'id_opp_orch', item.opportunityId);
    assert.equal(dismissed.ok, true);
    const again = orchestrator.discoverCustomerOpportunities(actor, 'id_opp_orch', {
      ledgerPositions: Object.freeze([
        {
          accountRef: 'acct_usd_checking',
          currency: 'USD',
          minorUnits: '2500000',
          accountClass: 'DEMAND_DEPOSIT',
          restricted: false,
          frozen: false,
        },
      ]),
    });
    assert.equal(again.ok, true);
    if (again.ok) {
      assert.equal(
        again.value.feed.cards.some((card) => card.opportunityId === item.opportunityId),
        false,
      );
    }
    const other = listed.value.all.find((row) => row.opportunityId !== item.opportunityId && row.status === 'PRESENTED');
    if (other) {
      const proposal = orchestrator.startOpportunityProposal(actor, 'id_opp_orch', other.opportunityId);
      assert.equal(proposal.ok, true);
      if (proposal.ok) {
        assert.equal(proposal.value.executesMoney, false);
        assert.equal(proposal.value.issuesExecutionAuthority, false);
      }
    }
    const explained = orchestrator.explainOpportunity(actor, 'id_opp_orch', item.opportunityId);
    assert.equal(explained.ok, true);
    if (explained.ok) {
      assert.equal(explained.value.explanation.inventedNumbersForbidden, true);
      assert.match(explained.value.explanation.opportunity.opportunityId, /^gop_/);
    }
  });

  it('denies cross-user opportunity reads', () => {
    const first = setupActor('actor_a', 'id_a');
    const second = setupActor('actor_b', 'id_b');
    first.peg.registerAccountCurrency('acct_a', 'USD');
    first.peg.openGraph(first.actor, 'id_a', asCustomerId('cust_id_a'));
    const orchestrator = new GrowthOrchestrator({ clock: first.clock, events: first.events, peg: first.peg });
    orchestrator.discoverCustomerOpportunities(first.actor, 'id_a', {
      ledgerPositions: Object.freeze([
        {
          accountRef: 'acct_a',
          currency: 'USD',
          minorUnits: '2500000',
          accountClass: 'DEMAND_DEPOSIT',
          restricted: false,
          frozen: false,
        },
      ]),
    });
    const denied = orchestrator.listOpportunities(second.actor, 'id_a');
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'CROSS_USER_DENIED');
    }
  });

  it('does not let preferences override suitability', () => {
    const { clock, events, actor, peg } = setupActor('actor_pref', 'id_pref');
    peg.openGraph(actor, 'id_pref', asCustomerId('cust_id_pref'));
    const orchestrator = new GrowthOrchestrator({ clock, events, peg });
    const prefs = orchestrator.setOpportunityPreferences(actor, 'id_pref', { maxRiskLevel: 'UNCERTAIN_MARKET' }, 'LOW');
    assert.equal(prefs.ok, true);
    if (prefs.ok) {
      assert.equal(prefs.value.maxRiskLevel, 'LOW');
      assert.equal(prefs.value.cannotOverrideSuitability, true);
    }
  });
});

describe('opportunity source guards', () => {
  it('does not use an LLM as the sole detector', () => {
    const source = readFileSync(join(HERE, 'opportunity/detectors.ts'), 'utf8');
    assert.equal(/llm|openai|completeChat|generateText/i.test(source), false);
    assert.match(source, /export function runOpportunityDetectors/);
  });
});
