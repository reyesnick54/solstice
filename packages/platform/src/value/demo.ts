import { PersonalEconomyAgent } from '../../../agent/src/service.ts';
import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { EvidenceVault } from '../../../evidence/src/vault.ts';
import { DomainEventLog, type DomainEvent } from '../../../events/src/events.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { GrowthOrchestrator } from '../service.ts';
import { FORMULA_V1, FORMULA_V2, MODEL_V1, MODEL_V2 } from './formula.ts';
import { PersonalEconomicValueEngine } from './service.ts';

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
  const subjectId = 'id_peve_maya';
  const customerId = asCustomerId('cust_peve_maya');
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_peve_maya',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId,
    capabilities: [
      'VIEW_ACCOUNT',
      'MANAGE_PROFILE',
      'VIEW_ECONOMIC_GRAPH',
      'DECLARE_ECONOMIC_FACT',
      'VIEW_GROWTH_PLAN',
      'VIEW_ECONOMIC_VALUE',
      'CONFIRM_ECONOMIC_MANDATE',
    ],
  });
  if (!provisioned.ok) {
    throw new Error('identity provision failed');
  }
  const actor = identity.service.resolveActorContext('actor_peve_maya');
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
        amountMinorUnits: '500000',
        currency: 'USD',
      },
      'evt_salary_1',
    ),
    event(
      'PaymentSettled',
      '2026-06-01T10:00:00.000Z',
      {
        paymentId: 'pay_rent_0',
        beneficiaryId: 'ben_landlord',
        settlementRef: 'set_rent_0',
        destinationMinorUnits: '200000',
        reconciliation: 'MATCHED',
      },
      'evt_rent_0',
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
      'AccountPositionChanged',
      '2026-08-01T23:00:00.000Z',
      {
        accountId: 'acct_usd_checking',
        amountMinorUnits: '600000',
        currency: 'USD',
      },
      'evt_pos_usd',
    ),
    event(
      'AccountPositionChanged',
      '2026-08-01T23:00:00.000Z',
      {
        accountId: 'acct_usd_savings',
        amountMinorUnits: '400000',
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
    sourceEventId: 'evt_rent_0',
    subjectId,
    accountId: 'acct_usd_checking',
    classification: 'RENT',
    direction: 'OUTFLOW',
    amount: { minorUnits: '200000', currency: 'USD' },
    counterpart: { kind: 'LANDLORD', ref: 'ben_landlord', label: 'Oak Street LLC' },
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
  peg.openGraph(actor.value, subjectId, customerId);
  peg.ingestAll(sourceEvents, subjectId);
  peg.declareIncomeSource(actor.value, subjectId, {
    incomeKind: 'SALARY',
    label: 'Monthly salary',
    estimatedAmount: { minorUnits: '500000', currency: 'USD' },
  });
  peg.declareDebt(actor.value, subjectId, {
    debtKind: 'CREDIT',
    label: 'Card debt',
    estimatedBalance: { minorUnits: '250000', currency: 'USD' },
  });
  peg.declareGoal(actor.value, subjectId, {
    goalKind: 'EMERGENCY_RESERVE',
    label: 'Emergency fund',
    target: { minorUnits: '1500000', currency: 'USD' },
    priority: 1,
  });
  peg.materializeRecurring(subjectId);
  peg.proposeOpportunities(subjectId);

  const agent = new PersonalEconomyAgent({ clock });
  const peve = new PersonalEconomicValueEngine({ clock, events, evidence, agent });
  const orchestrator = new GrowthOrchestrator({ clock, events, peg, agent, evidence, peve });
  const compiled = orchestrator.interpretAndCompile(actor.value, {
    subjectId,
    sourceText: 'Keep at least $2,000 liquid. Build an emergency fund. Reduce fees.',
  });
  if (!compiled.ok) {
    throw new Error(`compile failed: ${JSON.stringify(compiled.error)}`);
  }
  const active = orchestrator.confirmAndActivate(actor.value, subjectId);
  if (!active.ok) {
    throw new Error(`confirm failed: ${JSON.stringify(active.error)}`);
  }
  const planned = orchestrator.plan(actor.value, subjectId);
  if (!planned.ok) {
    throw new Error(`plan failed: ${JSON.stringify(planned.error)}`);
  }
  const pegSnapshot = peg.getEconomicSnapshot(actor.value, subjectId);
  if (!pegSnapshot.ok) {
    throw new Error('peg snapshot failed');
  }

  console.log('1. Generate baseline PEVE snapshot');
  const baseline = peve.generateSnapshot(actor.value, {
    subjectId,
    peg: pegSnapshot.value,
    mandate: active.value,
    plan: planned.value.plan,
  });
  if (!baseline.ok) {
    throw new Error(`baseline snapshot failed: ${JSON.stringify(baseline.error)}`);
  }
  const liquidity = baseline.value.vector.dimensions.find((item) => item.kind === 'LIQUIDITY_RESILIENCE');
  const cashFlow = baseline.value.cashFlowCapacity[0];
  const debt = baseline.value.debtBurden[0];
  const goal = baseline.value.goalProgress[0];
  console.log(`   snapshot=${baseline.value.snapshotId} completeness=${baseline.value.completeness} confidence=${baseline.value.confidence}`);
  console.log(`2. Liquidity resilience index=${liquidity?.measure.points} companion=${liquidity?.moneyCompanion?.amount.minorUnits ?? 'n/a'} ${liquidity?.moneyCompanion?.amount.currency ?? ''}`);
  console.log(`3. Cash-flow capacity quality=${cashFlow?.quality ?? 'n/a'} surplus=${cashFlow?.surplus?.minorUnits ?? 'n/a'}`);
  console.log(`4. Debt burden notCreditScore=${String(debt?.notCreditScore)} pressure=${debt?.pressure ? `${debt.pressure.numerator}/${debt.pressure.denominator}` : 'n/a'}`);
  console.log(`5. Goal progress ${goal?.label ?? 'n/a'} remaining=${goal?.remaining?.minorUnits ?? 'n/a'} unrealizedCounted=${String(goal?.unrealizedMarketCounted)}`);
  console.log(`6. Completeness=${baseline.value.completeness} composite=${baseline.value.composite.measure.points} (index, not money)`);

  const feeBaseline = peve.recordBaseline(actor.value, {
    baselineId: peve.newBaselineId('FEE', 'card_15'),
    subjectId,
    kind: 'CURRENT_FEE_VS_ALTERNATIVE',
    assumptions: Object.freeze(['The previous $15 card fee would have been charged this month.']),
    comparisonPeriod: { from: NOW, to: NOW },
    sourceFacts: Object.freeze([{ ref: 'evt_fee_15', confidence: 'VERIFIED', key: 'fee' }]),
    confidence: 'VERIFIED',
    method: 'observed_fee_minus_alternative_fee',
    formulaVersion: FORMULA_V1,
    guaranteed: false,
    survivesRebuild: true,
  });
  if (!feeBaseline.ok) {
    throw new Error('baseline failed');
  }
  console.log('7. Record a $15 REALIZED fee saving');
  const realized = peve.recordAttribution(actor.value, {
    subjectId,
    sourceEventId: 'evt_fee_15',
    observedResult: 'card purchase fee reduced by 1500 minor units',
    amount: { minorUnits: '1500', currency: 'USD' },
    attributionType: 'FEE_AVOIDED',
    realization: 'REALIZED',
    calculationMethod: 'baseline_fee_minus_observed_fee',
    confidence: 'VERIFIED',
    formulaVersion: FORMULA_V1,
    recordedAt: NOW,
    baselineId: feeBaseline.value.baselineId,
    growthPlanId: planned.value.plan.planId,
    contributions: Object.freeze([
      { system: 'GROWTH_ORCHESTRATOR', shareNumerator: 1, shareDenominator: 3, causalCertainty: 'IDENTIFIED' },
      { system: 'TREASURY', shareNumerator: 1, shareDenominator: 3, causalCertainty: 'CONTRIBUTED' },
      { system: 'PAYMENTS', shareNumerator: 1, shareDenominator: 3, causalCertainty: 'EXECUTED' },
    ]),
  });
  if (!realized.ok) {
    throw new Error(`realized attribution failed: ${JSON.stringify(realized.error)}`);
  }
  console.log('8. Record a projected future $180 annualized saving separately');
  const projected = peve.recordAttribution(actor.value, {
    subjectId,
    sourceEventId: 'evt_fee_15_year',
    sourceKey: 'evt_fee_15_annualized',
    observedResult: 'estimated twelve months of the same fee reduction',
    amount: { minorUnits: '18000', currency: 'USD' },
    attributionType: 'FEE_AVOIDED',
    realization: 'PROJECTED',
    calculationMethod: 'realized_month * 12',
    confidence: 'ESTIMATED',
    formulaVersion: FORMULA_V1,
    recordedAt: NOW,
  });
  if (!projected.ok) {
    throw new Error(`projected attribution failed: ${JSON.stringify(projected.error)}`);
  }
  const realizedTotal = peve.attribution.realizedTotal(subjectId, 'USD');
  const projectedTotal = peve.attribution.projectedTotal(subjectId, 'USD');
  console.log(`9. Realized total=${realizedTotal.minorUnits} projected total=${projectedTotal.minorUnits} projectedExcludedFromRealized=${String(realizedTotal.minorUnits === '1500')}`);
  console.log('10. Record a second attempted attribution to the same $15 source');
  const duplicate = peve.recordAttribution(actor.value, {
    subjectId,
    sourceEventId: 'evt_fee_15',
    observedResult: 'same benefit relabeled as routing savings',
    amount: { minorUnits: '1500', currency: 'USD' },
    attributionType: 'PAYMENT_FEE_REDUCED',
    realization: 'REALIZED',
    calculationMethod: 'same_benefit_relabeled',
    confidence: 'VERIFIED',
    formulaVersion: FORMULA_V1,
    recordedAt: NOW,
  });
  console.log(`11. Double-count rejected=${String(!duplicate.ok)} code=${!duplicate.ok ? duplicate.error.code : 'none'}`);

  console.log('12. Generate new PEVE snapshot');
  const next = peve.generateSnapshot(actor.value, {
    subjectId,
    peg: pegSnapshot.value,
    mandate: active.value,
    plan: planned.value.plan,
  });
  if (!next.ok) {
    throw new Error(`second snapshot failed: ${JSON.stringify(next.error)}`);
  }
  const explanations = peve.getValueChangeExplanation(actor.value, subjectId);
  if (!explanations.ok) {
    throw new Error('explanation failed');
  }
  const attributed = explanations.value.find((item) => item.dimension.kind === 'ATTRIBUTED_VALUE_CREATED');
  console.log(`13. ATTRIBUTED_VALUE_CREATED points=${attributed?.value.points} change=${attributed?.change ?? 'n/a'} money=${attributed?.dimension.moneyCompanion?.amount.minorUnits ?? 'n/a'}`);
  const agentExplanation = peve.explainWithAgent(actor.value, subjectId);
  if (!agentExplanation.ok) {
    throw new Error('agent explanation failed');
  }
  console.log(`    agent translated only executable=${String(agentExplanation.value.executable)}`);

  console.log('14. Change formula version');
  const activated = peve.activateModel(actor.value, subjectId, FORMULA_V2, MODEL_V2);
  if (!activated.ok) {
    throw new Error('activate failed');
  }
  const historical = peve.getEconomicValueSnapshot(actor.value, subjectId, baseline.value.snapshotId);
  if (!historical.ok) {
    throw new Error('historical snapshot missing');
  }
  console.log(`15. Historical snapshot remains ${historical.value.formulaVersion} composite=${historical.value.composite.measure.points}`);
  const compared = peve.compareModels(
    actor.value,
    subjectId,
    { formulaVersion: FORMULA_V1, modelVersion: MODEL_V1 },
    { formulaVersion: FORMULA_V2, modelVersion: MODEL_V2 },
    pegSnapshot.value,
    { mandate: active.value, plan: planned.value.plan },
  );
  if (!compared.ok) {
    throw new Error(`compare failed: ${JSON.stringify(compared.error)}`);
  }
  console.log(`16. Model comparison weightsChanged=${String(compared.value.weightsChanged.length)} left=${compared.value.outputDifference?.leftComposite} right=${compared.value.outputDifference?.rightComposite}`);
  console.log(`17. No money moves. PEVE postsJournals=false attributionCount=${String(peve.attribution.count())} evidence=${String(evidence.list().length)} events=${String(events.list().length)}`);
}

await main();
