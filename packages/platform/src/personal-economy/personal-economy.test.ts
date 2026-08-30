import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PersonalEconomyAgent } from '../../../agent/src/service.ts';
import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asAccountId } from '../../../domain/src/account.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { GrowthOrchestrator } from '../service.ts';
import { PERSONAL_ECONOMY_INVARIANTS, PERSONAL_ECONOMY_RECOMMENDATION_TYPES } from './taxonomy.ts';
import { PersonalEconomyService } from './service.ts';
import { scenarioFromNaturalLanguage } from './scenario.ts';

const NOW = asUtcInstant('2026-08-30T09:00:00.000Z');

function world() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const subjectId = 'id_pe_test';
  const customerId = asCustomerId('cust_pe_test');
  identity.provisionSimulatedActor({
    actorId: 'actor_pe_test',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId,
    capabilities: ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT', 'VIEW_GROWTH_PLAN'],
  });
  const actor = identity.service.resolveActorContext('actor_pe_test');
  if (!actor.ok) {
    throw new Error('actor missing');
  }
  const peg = new EconomicGraphService({ clock, events });
  peg.registerAccountCurrency('acct_pe_cash', 'USD');
  peg.ingestAll(
    [
      {
        eventType: 'AccountOpened',
        schemaVersion: 1,
        occurredAt: asUtcInstant('2026-05-01T00:00:00.000Z'),
        eventId: 'evt_pe_open',
        payload: {
          accountId: asAccountId('acct_pe_cash'),
          ownerId: customerId,
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea_pe',
          intentId: 'I-pe-open',
        },
      },
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: asUtcInstant('2026-07-01T09:00:00.000Z'),
        eventId: 'evt_pe_deposit',
        payload: {
          journalId: 'j_pe_deposit',
          accountId: asAccountId('acct_pe_cash'),
          amountMinorUnits: '2500000',
          currency: 'USD',
        },
      },
    ],
    subjectId,
  );
  const orchestrator = new GrowthOrchestrator({
    clock,
    events,
    peg,
    agent: new PersonalEconomyAgent({ clock }),
  });
  const service = new PersonalEconomyService({ clock, peg, orchestrator });
  return { actor: actor.value, subjectId, service };
}

describe('ACCESS-20 PersonalEconomyService', () => {
  it('builds a unified snapshot projection without authoritative balances', () => {
    const { actor, subjectId, service } = world();
    const snapshot = service.buildSnapshot(actor, subjectId, {
      investmentLabels: [{ label: 'Portfolio', minorUnits: '10000000', currency: 'USD' }],
      sunReyHoldings: {
        assetId: 'SUNREY_COIN',
        label: 'SunRey Coin',
        quantityMinorUnits: '100',
        valuationCurrency: 'USD',
        estimatedValueMinorUnits: '10000',
        authoritativeBalance: false,
        simulationOnly: true,
      },
    });
    assert.ok(snapshot.ok);
    assert.equal(snapshot.value.authoritativeBalance, false);
    assert.equal(snapshot.value.ledgerWins, true);
    assert.equal(snapshot.value.guaranteedOutcome, false);
    assert.equal(snapshot.value.investments[0]?.estimatedValue.minorUnits, '10000000');
    assert.equal(snapshot.value.sunReyHoldings?.quantityMinorUnits, '100');
  });

  it('produces a plan with constraints, objective, and proposal-only recommendations', () => {
    const { actor, subjectId, service } = world();
    const plan = service.buildPlan({
      actor,
      subjectId,
      constraints: {
        minimumEmergencyCash: { minorUnits: '1500000', currency: 'USD' },
        maximumInvestmentRisk: 'MODERATE',
        desiredTravelAccessUnits: 2,
      },
      ports: {
        plannedAccessDemand: [
          {
            category: 'TRAVEL',
            label: 'Two vacations',
            plannedUnits: 2,
            targetWindow: '2027',
            premiumTopUpRequiredMinorUnits: '300000',
            currency: 'USD',
          },
        ],
      },
      goalSummary: 'Preserve access for two vacations while growing wealth',
    });
    assert.ok(plan.ok);
    assert.equal(plan.value.autoExecution, false);
    assert.equal(plan.value.guaranteedOutcome, false);
    assert.equal(plan.value.objective.optimizesHumanWorth, false);
    assert.ok(plan.value.recommendations.length > 0);
    for (const rec of plan.value.recommendations) {
      assert.equal(rec.executable, false);
      assert.equal(rec.requiresApproval, true);
      assert.equal(rec.autoExecutionPermitted, false);
      assert.ok(PERSONAL_ECONOMY_RECOMMENDATION_TYPES.includes(rec.recommendationType));
    }
  });

  it('parses natural-language what-if scenarios as simulations only', () => {
    assert.deepEqual(scenarioFromNaturalLanguage('What if I invest $5,000?'), {
      kind: 'FIAT_INVESTMENT',
      amountMinorUnits: '500000',
      currency: 'USD',
    });
    const { actor, subjectId, service } = world();
    const outcome = service.simulateScenario({
      actor,
      subjectId,
      scenario: 'What if markets fall 20%?',
    });
    assert.ok(outcome.ok);
    assert.equal(outcome.value.guaranteedOutcome, false);
    assert.equal(outcome.value.simulationOnly, true);
  });

  it('preserves ACCESS-20 invariants', () => {
    assert.deepEqual([...PERSONAL_ECONOMY_INVARIANTS], [
      'AGENT_CANNOT_SELF_APPROVE',
      'AGENT_CANNOT_ISSUE_EXECUTION_AUTHORITY',
      'AGENT_CANNOT_MINT_SR',
      'AGENT_CANNOT_MINT_MR',
      'AGENT_CANNOT_INVENT_ACCESS',
      'AGENT_CANNOT_PROMISE_RETURNS',
      'AGENT_CANNOT_OPTIMIZE_FOR_HUMAN_WORTH',
      'AGENT_CANNOT_OVERRIDE_USER_RISK_CONSTRAINTS',
      'NO_DEPOSIT_COUNTED_AS_INVESTMENT_PERFORMANCE',
    ]);
  });
});
