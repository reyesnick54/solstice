import { PersonalEconomyAgent } from '../../agent/src/service.ts';
import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { EvidenceVault } from '../../evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { GrowthOrchestrator } from './service.ts';

const NOW = asUtcInstant('2026-08-15T12:00:00.000Z');

function event<T extends DomainEvent['eventType']>(
  eventType: T,
  occurredAt: string,
  payload: Record<string, unknown>,
  eventId: string,
): DomainEvent {
  return {
    eventType,
    schemaVersion: 1,
    occurredAt: asUtcInstant(occurredAt),
    eventId,
    payload,
  } as DomainEvent;
}

async function main(): Promise<void> {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events, evidence });
  const subjectId = 'id_growth_maya';
  const customerId = asCustomerId('cust_growth_maya');
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_growth_maya',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId,
    capabilities: [
      'VIEW_ACCOUNT',
      'MANAGE_PROFILE',
      'VIEW_ECONOMIC_GRAPH',
      'DECLARE_ECONOMIC_FACT',
      'VIEW_GROWTH_PLAN',
      'CONFIRM_ECONOMIC_MANDATE',
    ],
  });
  if (!provisioned.ok) {
    throw new Error('identity provision failed');
  }
  const actor = identity.service.resolveActorContext('actor_growth_maya');
  if (!actor.ok) {
    throw new Error('actor context failed');
  }

  const peg = new EconomicGraphService({ clock, events });
  peg.registerAccountCurrency('acct_usd_checking', 'USD');
  peg.registerAccountCurrency('acct_usd_savings', 'USD');
  const sourceEvents: DomainEvent[] = [
    event(
      'AccountOpened',
      '2026-05-01T00:00:00.000Z',
      {
        accountId: 'acct_usd_checking',
        ownerId: customerId,
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea_1',
        intentId: 'I-open-usd',
      },
      'evt_open_usd',
    ),
    event(
      'AccountOpened',
      '2026-05-01T00:00:00.000Z',
      {
        accountId: 'acct_usd_savings',
        ownerId: customerId,
        accountClass: 'SAVINGS_DEPOSIT',
        executionAuthorityId: 'ea_2',
        intentId: 'I-open-sav',
      },
      'evt_open_sav',
    ),
    event(
      'DepositPosted',
      '2026-07-01T09:00:00.000Z',
      {
        journalId: 'j_salary_1',
        accountId: 'acct_usd_checking',
        amountMinorUnits: '1000000',
        currency: 'USD',
      },
      'evt_salary_1',
    ),
    event(
      'PaymentSettled',
      '2026-07-01T10:00:00.000Z',
      {
        paymentId: 'pay_rent_1',
        beneficiaryId: 'ben_landlord',
        settlementRef: 'set_rent_1',
        destinationMinorUnits: '200000',
        reconciliation: 'MATCHED',
      },
      'evt_rent_1',
    ),
    event(
      'CardTransactionSettled',
      '2026-06-01T18:00:00.000Z',
      {
        cardId: 'card_maya',
        customerId,
        merchantRef: 'sim_stream',
        amountMinorUnits: '1599',
        currency: 'USD',
        transactionRef: 'stream_0',
      },
      'evt_stream_0',
    ),
    event(
      'CardTransactionSettled',
      '2026-07-01T18:00:00.000Z',
      {
        cardId: 'card_maya',
        customerId,
        merchantRef: 'sim_stream',
        amountMinorUnits: '1599',
        currency: 'USD',
        transactionRef: 'stream_1',
      },
      'evt_stream_1',
    ),
    event(
      'CardTransactionSettled',
      '2026-08-01T18:00:00.000Z',
      {
        cardId: 'card_maya',
        customerId,
        merchantRef: 'sim_stream',
        amountMinorUnits: '1599',
        currency: 'USD',
        transactionRef: 'stream_2',
      },
      'evt_stream_2',
    ),
    event(
      'AccountPositionChanged',
      '2026-08-01T23:00:00.000Z',
      {
        accountId: 'acct_usd_checking',
        amountMinorUnits: '1400000',
        currency: 'USD',
      },
      'evt_pos_usd',
    ),
    event(
      'AccountPositionChanged',
      '2026-08-01T23:00:00.000Z',
      {
        accountId: 'acct_usd_savings',
        amountMinorUnits: '200000',
        currency: 'USD',
      },
      'evt_pos_sav',
    ),
  ];
  peg.registerOverlay({
    sourceEventId: 'evt_salary_1',
    subjectId,
    classification: 'SALARY',
    counterpart: { kind: 'EMPLOYER', ref: 'employer_acme', label: 'Acme Corp' },
  });
  peg.registerOverlay({
    sourceEventId: 'evt_rent_1',
    subjectId,
    accountId: 'acct_usd_checking',
    classification: 'RENT',
    direction: 'OUTFLOW',
    amount: { minorUnits: '200000', currency: 'USD' },
    counterpart: { kind: 'LANDLORD', ref: 'ben_landlord', label: 'Oak Street LLC' },
  });
  peg.registerOverlay({
    sourceEventId: 'evt_stream_0',
    subjectId,
    classification: 'SUBSCRIPTION',
    counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
  });
  peg.registerOverlay({
    sourceEventId: 'evt_stream_1',
    subjectId,
    classification: 'SUBSCRIPTION',
    counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
  });
  peg.registerOverlay({
    sourceEventId: 'evt_stream_2',
    subjectId,
    classification: 'SUBSCRIPTION',
    counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
  });
  peg.openGraph(actor.value, subjectId, customerId);
  peg.ingestAll(sourceEvents, subjectId);
  peg.declareIncomeSource(actor.value, subjectId, {
    incomeKind: 'SALARY',
    label: 'Monthly salary',
    estimatedAmount: { minorUnits: '1000000', currency: 'USD' },
  });
  peg.declareDebt(actor.value, subjectId, {
    debtKind: 'CREDIT',
    label: 'Expensive card debt',
    estimatedBalance: { minorUnits: '450000', currency: 'USD' },
  });
  peg.declareGoal(actor.value, subjectId, {
    goalKind: 'EMERGENCY_RESERVE',
    label: 'Emergency fund',
    target: { minorUnits: '2000000', currency: 'USD' },
    priority: 1,
  });
  peg.materializeRecurring(subjectId);
  peg.proposeOpportunities(subjectId);

  const agent = new PersonalEconomyAgent({ clock });
  const orchestrator = new GrowthOrchestrator({ clock, events, peg, agent, evidence });
  const sourceText =
    'Keep at least $8,000 liquid. Build my emergency fund to $20,000. Reduce expensive debt. Do not make high-risk investments. Ask me before any movement over $1,000.';

  console.log('1. Agent converts request to MandateDraft');
  const compiled = orchestrator.interpretAndCompile(actor.value, { subjectId, sourceText });
  if (!compiled.ok) {
    throw new Error(`compile failed: ${JSON.stringify(compiled.error)}`);
  }
  console.log(`   draft=${compiled.value.draft.draftId} modelTextIsPolicy=${String(compiled.value.draft.modelTextIsPolicy)}`);
  console.log('2. Deterministic compiler validates');
  console.log(`   mandate=${compiled.value.mandate.mandateId} v${String(compiled.value.mandate.version)} state=${compiled.value.mandate.state}`);
  console.log('3. User confirms');
  const active = orchestrator.confirmAndActivate(actor.value, subjectId);
  if (!active.ok) {
    throw new Error(`confirm failed: ${JSON.stringify(active.error)}`);
  }
  console.log(`4. Mandate becomes ${active.value.state} planningEligible=${String(active.value.planningEligible)}`);

  console.log('5. GrowthCycle reads current PEG');
  const planned = orchestrator.plan(actor.value, subjectId);
  if (!planned.ok) {
    throw new Error(`plan failed: ${JSON.stringify(planned.error)}`);
  }
  const { cycle, plan } = planned.value;
  console.log(`   cycle=${cycle.cycleId} state=${cycle.state} snapshot=${plan.pegSnapshotId}`);
  console.log('6. Candidates generated');
  console.log(`   candidates=${String(plan.candidateActions.length)} proposed=${String(plan.orderedProposedActions.length)}`);
  const rejectedFloor = plan.rejectedCandidates.find((item) => item.reasons.includes('LIQUIDITY_FLOOR') || item.reasons.includes('USER_MANDATE'));
  console.log(`7. Liquidity-floor violation rejected=${String(rejectedFloor !== undefined)}`);
  const ranked = plan.orderedProposedActions.map((item) => item.action);
  console.log(`8. Ranked actions: ${ranked.join(', ')}`);
  console.log(`   subscription high rank=${String(ranked[0] === 'REVIEW_SUBSCRIPTION' || ranked.includes('REVIEW_SUBSCRIPTION'))}`);
  const debt = plan.candidateActions.find((item) => item.action === 'REDUCE_DEBT');
  console.log(`9. Debt-reduction evaluated capability=${debt?.executionCapability ?? 'absent'}`);
  const reserve = plan.orderedProposedActions.find((item) => item.action === 'ALLOCATE_TO_EMERGENCY_RESERVE');
  console.log(`10. Emergency allocation proposed=${String(reserve !== undefined)} amount=${reserve?.proposedAmount?.minorUnits ?? 'n/a'}`);
  const overThreshold = plan.orderedProposedActions.filter((item) => item.userConfirmationRequired);
  console.log(`11. Actions over $1,000 marked confirmation-required=${String(overThreshold.length)}`);
  const investment = plan.candidateActions.find((item) => item.action === 'REVIEW_INVESTMENT_OPPORTUNITY_FUTURE');
  console.log(`12. Investment capability=${investment?.executionCapability ?? 'absent'}`);
  const materialized = orchestrator.materializeApprovedAction(
    actor.value,
    subjectId,
    investment?.actionId ?? 'gac_missing',
    true,
  );
  console.log(`13. Nothing executes. Investment materialize ok=${String(materialized.ok)}`);

  peg.declareIncomeSource(actor.value, subjectId, {
    incomeKind: 'SALARY',
    label: 'Monthly salary updated',
    estimatedAmount: { minorUnits: '1200000', currency: 'USD' },
  });
  const stale = orchestrator.ingestPlanningEvent(
    subjectId,
    event('EconomicGraphFactUpdated', clock.now(), { graphId: plan.pegSnapshotId, key: 'income' }, 'evt_income_update'),
  );
  console.log(`14. PEG income updated`);
  console.log(`15. Existing GrowthPlan state=${stale?.state ?? 'missing'}`);
  const recomputed = orchestrator.plan(actor.value, subjectId);
  if (!recomputed.ok) {
    throw new Error(`recompute failed: ${JSON.stringify(recomputed.error)}`);
  }
  console.log(`16. New plan ${recomputed.value.plan.planId} state=${recomputed.value.plan.state} cycle=${recomputed.value.cycle.state}`);
  console.log(`evidenceRecords=${String(evidence.list().length)} events=${String(events.list().length)}`);
}

await main();
