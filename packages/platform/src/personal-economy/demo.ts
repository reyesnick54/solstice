/**
 * ACCESS-20 E2E demo — unified Personal Economy Agent simulation plan.
 * Cash $25,000, Investments $100,000, SR 100, MR 100, emergency $15,000,
 * two vacations next year, moderate risk. Proposal-only; no auto-execution.
 */

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
import { PersonalEconomyService } from './service.ts';

const NOW = asUtcInstant('2026-08-30T09:00:00.000Z');

async function main(): Promise<void> {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const subjectId = 'id_access20_demo';
  const customerId = asCustomerId('cust_access20_demo');
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_access20_demo',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId,
    capabilities: ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT', 'VIEW_GROWTH_PLAN'],
  });
  if (!provisioned.ok) {
    throw new Error('identity provision failed');
  }
  const actor = identity.service.resolveActorContext('actor_access20_demo');
  if (!actor.ok) {
    throw new Error('actor resolution failed');
  }

  const peg = new EconomicGraphService({ clock, events });
  peg.registerAccountCurrency('acct_access20_cash', 'USD');
  peg.ingestAll(
    [
      {
        eventType: 'AccountOpened',
        schemaVersion: 1,
        occurredAt: asUtcInstant('2026-05-01T00:00:00.000Z'),
        eventId: 'evt_access20_open',
        payload: {
          accountId: asAccountId('acct_access20_cash'),
          ownerId: customerId,
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea_access20',
          intentId: 'I-access20-open',
        },
      },
      {
        eventType: 'DepositPosted',
        schemaVersion: 1,
        occurredAt: asUtcInstant('2026-07-01T09:00:00.000Z'),
        eventId: 'evt_access20_deposit',
        payload: {
          journalId: 'j_access20_deposit',
          accountId: asAccountId('acct_access20_cash'),
          amountMinorUnits: '2500000',
          currency: 'USD',
        },
      },
    ],
    subjectId,
  );
  peg.declareGoal(actor.value, subjectId, {
    goalKind: 'EMERGENCY_RESERVE',
    label: 'Emergency reserve',
    target: { minorUnits: '1500000', currency: 'USD' },
    priority: 1,
    status: 'ACTIVE',
  });

  const orchestrator = new GrowthOrchestrator({
    clock,
    events,
    peg,
    agent: new PersonalEconomyAgent({ clock }),
  });
  const personalEconomy = new PersonalEconomyService({ clock, peg, orchestrator });

  const ports = {
    investmentLabels: Object.freeze([
      { label: 'Brokerage portfolio', minorUnits: '10000000', currency: 'USD' },
    ]),
    sunReyHoldings: Object.freeze({
      assetId: 'SUNREY_COIN' as const,
      label: 'SunRey Coin',
      quantityMinorUnits: '100',
      valuationCurrency: 'USD',
      estimatedValueMinorUnits: '10000',
      authoritativeBalance: false as const,
      simulationOnly: true as const,
    }),
    moonReyHoldings: Object.freeze({
      assetId: 'MOONREY_COIN' as const,
      label: 'MoonRey Coin',
      quantityMinorUnits: '100',
      valuationCurrency: 'USD',
      estimatedValueMinorUnits: '8000',
      authoritativeBalance: false as const,
      simulationOnly: true as const,
    }),
    accessEntitlements: Object.freeze([
      Object.freeze({
        category: 'TRAVEL',
        label: 'Travel access',
        remainingUnits: 1,
        expiresAt: asUtcInstant('2027-01-01T00:00:00.000Z'),
        reservationRef: null,
      }),
    ]),
    plannedAccessDemand: Object.freeze([
      Object.freeze({
        category: 'TRAVEL',
        label: 'Two vacations next year',
        plannedUnits: 2,
        targetWindow: '2027',
        premiumTopUpRequiredMinorUnits: '300000',
        currency: 'USD',
      }),
    ]),
    productiveContributionOpportunities: Object.freeze([
      Object.freeze({
        opportunityId: 'prod_gpu_spare',
        kind: 'PRODUCTIVE_CAPACITY' as const,
        title: 'Contribute spare GPU capacity',
        category: 'COMPUTE',
        executable: false as const,
        rationale: 'Productive contribution may support MoonRey network goals without promising returns.',
      }),
    ]),
  };

  const plan = personalEconomy.buildPlan({
    actor: actor.value,
    subjectId,
    constraints: {
      minimumEmergencyCash: { minorUnits: '1500000', currency: 'USD' },
      maximumInvestmentRisk: 'MODERATE',
      desiredTravelAccessUnits: 2,
      timeHorizonMonths: 12,
    },
    riskProfile: 'MODERATE',
    ports,
    goalSummary: 'Grow wealth while preserving access for two vacations next year',
  });
  if (!plan.ok) {
    throw new Error(plan.error.message);
  }

  const scenarios = [
    personalEconomy.simulateScenario({
      actor: actor.value,
      subjectId,
      scenario: 'What if I invest $5,000?',
      ports,
    }),
    personalEconomy.simulateScenario({
      actor: actor.value,
      subjectId,
      scenario: 'What if I want two major trips next year?',
      ports,
    }),
    personalEconomy.simulateScenario({
      actor: actor.value,
      subjectId,
      scenario: { kind: 'MARKET_SHOCK', marketShockBps: -2000 },
      ports,
    }),
  ];

  console.log(
    JSON.stringify(
      {
        schema: 'sunrey.personal-economy.demo.v1',
        productionActive: false,
        autoExecution: false,
        guaranteedOutcome: false,
        snapshot: (() => {
          const built = personalEconomy.buildSnapshot(actor.value, subjectId, ports);
          if (!built.ok) {
            throw new Error(built.error.message);
          }
          return built.value;
        })(),
        plan: plan.value,
        scenarios: scenarios.map((row) => (row.ok ? row.value : row.error)),
        invariants: plan.value.invariants,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
