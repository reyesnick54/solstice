import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog, type DomainEvent } from '../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { EconomicGraphService } from './service.ts';

const NOW = asUtcInstant('2026-07-15T12:00:00.000Z');

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
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const subjectId = 'id_peg_maya';
  const customerId = asCustomerId('cust_peg_maya');
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_peg_maya',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId,
    capabilities: ['VIEW_ACCOUNT', 'MANAGE_PROFILE', 'VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT'],
  });
  if (!provisioned.ok) {
    throw new Error('identity provision failed');
  }
  const actor = identity.service.resolveActorContext('actor_peg_maya');
  if (!actor.ok) {
    throw new Error('actor context failed');
  }

  const peg = new EconomicGraphService({ clock, events });
  peg.registerAccountCurrency('acct_usd_checking', 'USD');
  peg.registerAccountCurrency('acct_sar', 'SAR');
  peg.registerAccountCurrency('acct_usd_savings', 'USD');

  const opened = [
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
        accountId: 'acct_sar',
        ownerId: customerId,
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea_2',
        intentId: 'I-open-sar',
      },
      'evt_open_sar',
    ),
    event(
      'AccountOpened',
      '2026-05-01T00:00:00.000Z',
      {
        accountId: 'acct_usd_savings',
        ownerId: customerId,
        accountClass: 'SAVINGS_DEPOSIT',
        executionAuthorityId: 'ea_3',
        intentId: 'I-open-sav',
      },
      'evt_open_sav',
    ),
  ];

  const months = ['2026-05-01', '2026-06-01', '2026-07-01'] as const;
  const salary: DomainEvent[] = [];
  const rent: DomainEvent[] = [];
  const loan: DomainEvent[] = [];
  const stream: DomainEvent[] = [];
  for (const [index, day] of months.entries()) {
    const n = String(index + 1);
    salary.push(
      event(
        'DepositPosted',
        `${day}T09:00:00.000Z`,
        {
          journalId: `j_salary_${n}`,
          accountId: 'acct_usd_checking',
          amountMinorUnits: '1000000',
          currency: 'USD',
        },
        `evt_salary_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `evt_salary_${n}`,
      subjectId,
      classification: 'SALARY',
      counterpart: { kind: 'EMPLOYER', ref: 'employer_acme', label: 'Acme Corp' },
    });
    rent.push(
      event(
        'PaymentSettled',
        `${day}T10:00:00.000Z`,
        {
          paymentId: `pay_rent_${n}`,
          beneficiaryId: 'ben_landlord',
          settlementRef: `set_rent_${n}`,
          destinationMinorUnits: '200000',
          reconciliation: 'MATCHED',
        },
        `evt_rent_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `evt_rent_${n}`,
      subjectId,
      accountId: 'acct_usd_checking',
      classification: 'RENT',
      direction: 'OUTFLOW',
      amount: { minorUnits: '200000', currency: 'USD' },
      counterpart: { kind: 'LANDLORD', ref: 'ben_landlord', label: 'Oak Street LLC' },
    });
    loan.push(
      event(
        'WithdrawalPosted',
        `${day}T11:00:00.000Z`,
        {
          journalId: `j_loan_${n}`,
          accountId: 'acct_usd_checking',
          amountMinorUnits: '40000',
          currency: 'USD',
        },
        `evt_loan_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `evt_loan_${n}`,
      subjectId,
      classification: 'LOAN_PAYMENT',
      counterpart: { kind: 'LENDER', ref: 'lender_sim', label: 'Sim Credit Union' },
    });
    stream.push(
      event(
        'CardTransactionSettled',
        `${day}T18:00:00.000Z`,
        {
          cardId: 'card_maya',
          customerId,
          merchantRef: 'sim_stream',
          amountMinorUnits: '1599',
          currency: 'USD',
          transactionRef: `stream_${n}`,
        },
        `evt_stream_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `evt_stream_${n}`,
      subjectId,
      classification: 'SUBSCRIPTION',
      counterpart: { kind: 'MERCHANT', ref: 'sim_stream', label: 'SimStream' },
    });
  }

  const extras: DomainEvent[] = [
    event(
      'BeneficiaryCreated',
      '2026-05-01T08:00:00.000Z',
      {
        beneficiaryId: 'ben_landlord',
        ownerId: customerId,
        destinationCountry: 'US',
        currency: 'USD',
        status: 'ACTIVE',
        screeningRef: null,
        coordinateHint: 'opaque',
      },
      'evt_ben_landlord',
    ),
    event(
      'DepositPosted',
      '2026-05-02T09:00:00.000Z',
      {
        journalId: 'j_sar_1',
        accountId: 'acct_sar',
        amountMinorUnits: '500000',
        currency: 'SAR',
      },
      'evt_sar_1',
    ),
    event(
      'InternalTransferPosted',
      '2026-05-03T09:00:00.000Z',
      {
        journalId: 'j_save_1',
        sourceAccountId: 'acct_usd_checking',
        destinationAccountId: 'acct_usd_savings',
        amountMinorUnits: '200000',
        currency: 'USD',
        classBridgeName: null,
      },
      'evt_save_1',
    ),
    event(
      'CardTransactionSettled',
      '2026-05-12T15:00:00.000Z',
      {
        cardId: 'card_maya',
        customerId,
        merchantRef: 'sim_grocery',
        amountMinorUnits: '8743',
        currency: 'USD',
        transactionRef: 'groc_1',
      },
      'evt_groc_1',
    ),
    event(
      'CardTransactionSettled',
      '2026-06-18T15:00:00.000Z',
      {
        cardId: 'card_maya',
        customerId,
        merchantRef: 'sim_grocery',
        amountMinorUnits: '6120',
        currency: 'USD',
        transactionRef: 'groc_2',
      },
      'evt_groc_2',
    ),
    event(
      'AccountPositionChanged',
      '2026-07-01T23:00:00.000Z',
      {
        accountId: 'acct_usd_checking',
        amountMinorUnits: '2342538',
        currency: 'USD',
      },
      'evt_pos_usd',
    ),
    event(
      'AccountPositionChanged',
      '2026-07-01T23:00:00.000Z',
      {
        accountId: 'acct_sar',
        amountMinorUnits: '500000',
        currency: 'SAR',
      },
      'evt_pos_sar',
    ),
    event(
      'AccountPositionChanged',
      '2026-07-01T23:00:00.000Z',
      {
        accountId: 'acct_usd_savings',
        amountMinorUnits: '200000',
        currency: 'USD',
      },
      'evt_pos_sav',
    ),
  ];
  peg.registerOverlay({ sourceEventId: 'evt_sar_1', subjectId, classification: 'UNKNOWN' });
  peg.registerOverlay({ sourceEventId: 'evt_save_1', subjectId, classification: 'TRANSFER' });
  peg.registerOverlay({ sourceEventId: 'evt_groc_1', subjectId, classification: 'CARD_SPEND' });
  peg.registerOverlay({ sourceEventId: 'evt_groc_2', subjectId, classification: 'CARD_SPEND' });
  peg.registerOverlay({ sourceEventId: 'evt_pos_usd', subjectId, classification: 'UNKNOWN' });
  peg.registerOverlay({ sourceEventId: 'evt_pos_sar', subjectId, classification: 'UNKNOWN' });
  peg.registerOverlay({ sourceEventId: 'evt_pos_sav', subjectId, classification: 'UNKNOWN' });

  const sourceEvents = [...opened, ...extras, ...salary, ...rent, ...loan, ...stream];
  peg.openGraph(actor.value, subjectId, customerId);
  peg.ingestAll(sourceEvents, subjectId);

  const mortgage = peg.declareLiability(actor.value, subjectId, {
    liabilityKind: 'MORTGAGE',
    label: 'Primary residence mortgage',
    estimatedBalance: { minorUnits: '35000000', currency: 'USD' },
  });
  if (!mortgage.ok) {
    throw new Error(mortgage.error.message);
  }
  const home = peg.declareAsset(actor.value, subjectId, {
    assetKind: 'HOME',
    label: 'Primary residence',
    estimatedValue: { minorUnits: '52000000', currency: 'USD' },
  });
  if (!home.ok) {
    throw new Error(home.error.message);
  }
  const goal = peg.declareGoal(actor.value, subjectId, {
    goalKind: 'EMERGENCY_RESERVE',
    label: 'Emergency fund',
    target: { minorUnits: '2000000', currency: 'USD' },
    priority: 1,
  });
  if (!goal.ok) {
    throw new Error(goal.error.message);
  }

  peg.materializeRecurring(subjectId);
  peg.proposeOpportunities(subjectId);
  const graph = peg.getEconomicGraph(actor.value, subjectId);
  if (!graph.ok) {
    throw new Error(graph.error.message);
  }
  const snapshot = peg.getEconomicSnapshot(actor.value, subjectId);
  if (!snapshot.ok) {
    throw new Error(snapshot.error.message);
  }

  console.log('Personal Economic Graph — simulated customer Maya');
  console.log(`subject=${subjectId} graph=${graph.value.graph.graphId}`);
  console.log(`authoritativeBalance=${graph.value.graph.authoritativeBalance} (ledger wins)`);
  console.log('Nodes:');
  for (const node of graph.value.nodes) {
    console.log(`  ${node.kind} ${node.nodeId} confidence=${node.confidence} source=${node.provenance.sourceType}`);
  }
  console.log('Edges:');
  for (const edge of graph.value.edges) {
    console.log(`  ${edge.kind} ${edge.fromNodeId} -> ${edge.toNodeId}`);
  }
  console.log('Snapshot liquid assets by currency (derived, ledger wins):');
  for (const asset of snapshot.value.liquidAssetsByCurrency) {
    console.log(
      `  ${asset.amount.currency} ${asset.amount.minorUnits} provenance=${asset.sourceRefs.join(',')} confidence=${asset.confidence}`,
    );
  }
  console.log('Monthly cash flow:');
  for (const flow of snapshot.value.monthlyCashFlow) {
    console.log(
      `  ${flow.currency} income=${flow.income.amount.minorUnits} net=${flow.netFlow.amount.minorUnits} sources=${flow.netFlow.sourceRefs.length}`,
    );
  }
  console.log('Recurring obligations:');
  for (const item of snapshot.value.knownRecurringObligations) {
    console.log(`  ${item.kind} ${item.label} ${item.estimatedAmount.minorUnits} ${item.estimatedAmount.currency}`);
  }
  console.log('Goals:');
  for (const item of snapshot.value.goals) {
    console.log(`  ${item.goalKind} ${item.label} target=${item.target.minorUnits} ${item.target.currency}`);
  }
  console.log('Opportunities (proposal-only, not executable):');
  for (const item of snapshot.value.economicOpportunities) {
    console.log(`  ${item.kind} ${item.title} executable=${item.executable}`);
  }
  console.log(`crossCurrencyTotal=${String(snapshot.value.crossCurrencyTotal)} valuationContext=${String(snapshot.value.valuationContext)}`);
}

await main();
