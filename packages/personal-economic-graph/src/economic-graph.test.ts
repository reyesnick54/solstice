import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asCustomerId } from '../../domain/src/customer.ts';
import { asJurisdiction } from '../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { DomainEventLog, type DomainEvent } from '../../events/src/events.ts';
import { createSimulationKeyProvider } from '../../security/src/simulation.ts';
import { SimulatedIdentityAdapter } from '../../identity/src/simulation.ts';
import { assertFactConfidence } from './provenance.ts';
import { detectRecurringPatterns } from './recurring.ts';
import { EconomicGraphService } from './service.ts';
import { InMemoryEconomicGraphStore, type EconomicActivity } from './store.ts';
import {
  asEconomicActivityId,
  asEconomicFactId,
  asEconomicGraphId,
  asEconomicNodeId,
  asEconomicSourceId,
  deterministicActivityId,
} from './ids.ts';

const NOW = asUtcInstant('2026-07-15T12:00:00.000Z');

function event(
  eventType: DomainEvent['eventType'],
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

function harness(capabilities: readonly string[] = ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT']) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const subjectId = 'id_peg_test';
  const provisioned = identity.provisionSimulatedActor({
    actorId: 'actor_peg_test',
    jurisdiction: asJurisdiction('US'),
    identityId: subjectId,
    customerId: asCustomerId('cust_peg_test'),
    capabilities: capabilities as never,
  });
  assert.equal(provisioned.ok, true);
  const actor = identity.service.resolveActorContext('actor_peg_test');
  assert.equal(actor.ok, true);
  if (!actor.ok) {
    throw new Error('actor');
  }
  const peg = new EconomicGraphService({ clock, events });
  return { clock, events, identity, subjectId, actor: actor.value, peg };
}

function seedCanonicalLife(peg: EconomicGraphService, subjectId: string): DomainEvent[] {
  peg.registerAccountCurrency('acct_usd', 'USD');
  peg.registerAccountCurrency('acct_sar', 'SAR');
  peg.registerAccountCurrency('acct_sav', 'USD');
  const source: DomainEvent[] = [
    event(
      'AccountOpened',
      '2026-05-01T00:00:00.000Z',
      {
        accountId: 'acct_usd',
        ownerId: 'cust_peg_test',
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea',
        intentId: 'I1',
      },
      'e_open_usd',
    ),
    event(
      'AccountOpened',
      '2026-05-01T00:00:00.000Z',
      {
        accountId: 'acct_sar',
        ownerId: 'cust_peg_test',
        accountClass: 'DEMAND_DEPOSIT',
        executionAuthorityId: 'ea',
        intentId: 'I2',
      },
      'e_open_sar',
    ),
    event(
      'AccountOpened',
      '2026-05-01T00:00:00.000Z',
      {
        accountId: 'acct_sav',
        ownerId: 'cust_peg_test',
        accountClass: 'SAVINGS_DEPOSIT',
        executionAuthorityId: 'ea',
        intentId: 'I3',
      },
      'e_open_sav',
    ),
  ];
  const months = ['2026-05-01', '2026-06-01', '2026-07-01'] as const;
  for (const [index, day] of months.entries()) {
    const n = String(index + 1);
    source.push(
      event(
        'DepositPosted',
        `${day}T09:00:00.000Z`,
        { journalId: `j_sal_${n}`, accountId: 'acct_usd', amountMinorUnits: '1000000', currency: 'USD' },
        `e_sal_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `e_sal_${n}`,
      subjectId,
      classification: 'SALARY',
      counterpart: { kind: 'EMPLOYER', ref: 'acme', label: 'Acme' },
    });
    source.push(
      event(
        'WithdrawalPosted',
        `${day}T10:00:00.000Z`,
        { journalId: `j_rent_${n}`, accountId: 'acct_usd', amountMinorUnits: '200000', currency: 'USD' },
        `e_rent_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `e_rent_${n}`,
      subjectId,
      classification: 'RENT',
      counterpart: { kind: 'LANDLORD', ref: 'oak', label: 'Oak St' },
    });
    source.push(
      event(
        'WithdrawalPosted',
        `${day}T11:00:00.000Z`,
        { journalId: `j_loan_${n}`, accountId: 'acct_usd', amountMinorUnits: '40000', currency: 'USD' },
        `e_loan_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `e_loan_${n}`,
      subjectId,
      classification: 'LOAN_PAYMENT',
      counterpart: { kind: 'LENDER', ref: 'simcu', label: 'Sim CU' },
    });
    source.push(
      event(
        'CardTransactionSettled',
        `${day}T18:00:00.000Z`,
        {
          cardId: 'card_1',
          customerId: 'cust_peg_test',
          merchantRef: 'sim_stream',
          amountMinorUnits: '1599',
          currency: 'USD',
        },
        `e_sub_${n}`,
      ),
    );
    peg.registerOverlay({
      sourceEventId: `e_sub_${n}`,
      subjectId,
      classification: 'SUBSCRIPTION',
      counterpart: { kind: 'MERCHANT', ref: 'sim_stream' },
    });
  }
  peg.registerOverlay({ sourceEventId: 'e_open_usd', subjectId, classification: 'UNKNOWN' });
  peg.registerOverlay({ sourceEventId: 'e_open_sar', subjectId, classification: 'UNKNOWN' });
  peg.registerOverlay({ sourceEventId: 'e_open_sav', subjectId, classification: 'UNKNOWN' });
  return source;
}

describe('Personal Economic Graph', () => {
  it('creates a canonical typed graph from Solstice events', () => {
    const { peg, actor, subjectId } = harness();
    const source = seedCanonicalLife(peg, subjectId);
    assert.equal(peg.openGraph(actor, subjectId).ok, true);
    peg.ingestAll(source, subjectId);
    peg.materializeRecurring(subjectId);
    const graph = peg.getEconomicGraph(actor, subjectId);
    assert.equal(graph.ok, true);
    if (!graph.ok) {
      return;
    }
    const kinds = new Set(graph.value.nodes.map((node) => node.kind));
    assert.ok(kinds.has('PERSON'));
    assert.ok(kinds.has('ACCOUNT'));
    assert.ok(kinds.has('INCOME_SOURCE'));
    assert.ok(kinds.has('EXPENSE'));
    assert.ok(kinds.has('SUBSCRIPTION'));
    assert.ok(kinds.has('DEBT'));
    const edges = new Set(graph.value.edges.map((edge) => edge.kind));
    assert.ok(edges.has('OWNS'));
    assert.ok(edges.has('RECEIVES_FROM'));
    assert.ok(edges.has('PAYS_TO'));
    assert.ok(edges.has('SUBSCRIBES_TO'));
    assert.ok(edges.has('OWES'));
    assert.equal(graph.value.graph.authoritativeBalance, false);
    assert.equal(graph.value.graph.mutatesFinancialState, false);
  });

  it('attaches provenance and refuses inferred-as-authoritative facts', () => {
    const rejected = assertFactConfidence('DERIVED', 'AUTHORITATIVE', 'amount');
    assert.equal(rejected.ok, false);
    const masquerade = assertFactConfidence('USER_DECLARED', 'VERIFIED');
    assert.equal(masquerade.ok, false);
    const balance = assertFactConfidence('CANONICAL_LEDGER', 'AUTHORITATIVE', 'balance');
    assert.equal(balance.ok, false);
    const okFact = assertFactConfidence('CANONICAL_LEDGER', 'VERIFIED', 'account_exists');
    assert.equal(okFact.ok, true);
  });

  it('keeps temporal history when a position fact is superseded', () => {
    const { peg, actor, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    peg.registerOverlay({ sourceEventId: 'pos1', subjectId, classification: 'UNKNOWN' });
    peg.registerOverlay({ sourceEventId: 'pos2', subjectId, classification: 'UNKNOWN' });
    peg.ingest(
      event(
        'AccountPositionChanged',
        '2026-05-01T00:00:00.000Z',
        { accountId: 'acct_usd', amountMinorUnits: '100', currency: 'USD' },
        'pos1',
      ),
      subjectId,
    );
    peg.ingest(
      event(
        'AccountPositionChanged',
        '2026-06-01T00:00:00.000Z',
        { accountId: 'acct_usd', amountMinorUnits: '200', currency: 'USD' },
        'pos2',
      ),
      subjectId,
    );
    const graph = peg.getEconomicGraph(actor, subjectId);
    assert.equal(graph.ok, true);
    if (!graph.ok) {
      return;
    }
    const positions = graph.value.facts.filter((fact) => fact.key === 'derived_position');
    assert.equal(positions.length, 1);
    assert.equal(positions[0]?.value.type === 'MONEY' && positions[0].value.minorUnits, '200');
    const historical = peg.store
      .exportState()
      .facts.filter((fact) => fact.key === 'derived_position');
    assert.equal(historical.length, 2);
    assert.ok(historical.some((fact) => fact.supersededBy !== null));
  });

  it('does not treat every credit as income', () => {
    const { peg, actor, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    peg.registerOverlay({ sourceEventId: 'xfer', subjectId, classification: 'TRANSFER' });
    peg.ingest(
      event(
        'DepositPosted',
        '2026-05-01T00:00:00.000Z',
        { journalId: 'j_x', accountId: 'acct_usd', amountMinorUnits: '5000', currency: 'USD' },
        'xfer',
      ),
      subjectId,
    );
    peg.materializeRecurring(subjectId);
    const income = peg.getIncomeSources(actor, subjectId);
    assert.equal(income.ok, true);
    if (!income.ok) {
      return;
    }
    assert.equal(income.value.length, 0);
  });

  it('detects recurring salary, rent, subscription, and loan payment as DERIVED', () => {
    const { peg, actor, subjectId } = harness();
    const source = seedCanonicalLife(peg, subjectId);
    peg.openGraph(actor, subjectId);
    peg.ingestAll(source, subjectId);
    const created = peg.materializeRecurring(subjectId);
    assert.ok(created.some((node) => node.kind === 'INCOME_SOURCE' && node.confidence === 'DERIVED'));
    assert.ok(created.some((node) => node.kind === 'SUBSCRIPTION' && node.confidence === 'DERIVED'));
    assert.ok(created.some((node) => node.kind === 'DEBT' && node.confidence === 'DERIVED'));
    assert.ok(created.some((node) => node.kind === 'EXPENSE' && node.confidence === 'DERIVED'));
    const subscriptions = created.filter((node) => node.kind === 'SUBSCRIPTION');
    assert.equal(subscriptions[0]?.attributes.kind === 'SUBSCRIPTION' && subscriptions[0].attributes.cancellationCapability, 'NOT_IMPLEMENTED');
  });

  it('keeps user-declared mortgage distinct from verified holdings', () => {
    const { peg, actor, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    const declared = peg.declareLiability(actor, subjectId, {
      liabilityKind: 'MORTGAGE',
      label: 'Home loan',
      estimatedBalance: { minorUnits: '35000000', currency: 'USD' },
    });
    assert.equal(declared.ok, true);
    if (!declared.ok) {
      return;
    }
    assert.equal(declared.value.confidence, 'USER_DECLARED');
    assert.equal(declared.value.survivesRebuild, true);
    assert.equal(declared.value.attributes.kind === 'LIABILITY' && declared.value.attributes.holdingKind, 'USER_DECLARED');
  });

  it('stores goals and proposal-only opportunities', () => {
    const { peg, actor, subjectId } = harness();
    peg.openGraph(actor, subjectId);
    const goal = peg.declareGoal(actor, subjectId, {
      goalKind: 'EMERGENCY_RESERVE',
      label: 'Emergency fund',
      target: { minorUnits: '2000000', currency: 'USD' },
      priority: 1,
    });
    assert.equal(goal.ok, true);
    peg.proposeOpportunities(subjectId);
    const opportunities = peg.getOpportunities(actor, subjectId);
    assert.equal(opportunities.ok, true);
    if (!opportunities.ok) {
      return;
    }
    for (const item of opportunities.value) {
      assert.equal(item.executable, false);
      assert.equal(item.status, 'PROPOSAL');
    }
    assert.equal('executeOpportunity' in peg, false);
  });

  it('builds a snapshot without a cross-currency total', () => {
    const { peg, actor, subjectId } = harness();
    const source = seedCanonicalLife(peg, subjectId);
    peg.openGraph(actor, subjectId);
    peg.ingestAll(source, subjectId);
    peg.materializeRecurring(subjectId);
    peg.declareGoal(actor, subjectId, {
      goalKind: 'EMERGENCY_RESERVE',
      label: 'Emergency fund',
      target: { minorUnits: '2000000', currency: 'USD' },
      priority: 1,
    });
    peg.proposeOpportunities(subjectId);
    const snapshot = peg.getEconomicSnapshot(actor, subjectId);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok) {
      return;
    }
    assert.equal(snapshot.value.crossCurrencyTotal, null);
    assert.equal(snapshot.value.valuationContext, null);
    assert.equal(snapshot.value.authoritativeBalance, false);
    assert.equal(snapshot.value.ledgerWins, true);
    assert.ok(snapshot.value.liquidAssetsByCurrency.length >= 1);
    assert.ok(snapshot.value.monthlyCashFlow.length >= 1);
    for (const flow of snapshot.value.monthlyCashFlow) {
      assert.equal(flow.income.confidence, 'DERIVED');
      assert.ok(flow.netFlow.sourceRefs.length > 0);
    }
    const usd = snapshot.value.monthlyCashFlow.find((flow) => flow.currency === 'USD');
    assert.ok(usd);
    assert.equal(usd.income.amount.minorUnits, '1000000');
  });

  it('requires verified ActorContext and subject match', () => {
    const { peg, subjectId } = harness();
    const denied = peg.getEconomicGraph({ actorId: 'forged' }, subjectId);
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.error.code, 'ACTOR_CONTEXT_REQUIRED');
    }
    const other = harness(['VIEW_ECONOMIC_GRAPH']);
    const mismatch = other.peg.getEconomicGraph(other.actor, subjectId);
    assert.equal(mismatch.ok, false);
  });

  it('rebuilds derived projection and keeps user-declared facts', () => {
    const { peg, actor, subjectId } = harness();
    const source = seedCanonicalLife(peg, subjectId);
    peg.openGraph(actor, subjectId);
    peg.ingestAll(source, subjectId);
    peg.materializeRecurring(subjectId);
    peg.proposeOpportunities(subjectId);
    peg.declareLiability(actor, subjectId, {
      liabilityKind: 'MORTGAGE',
      label: 'Home loan',
      estimatedBalance: { minorUnits: '35000000', currency: 'USD' },
    });
    const before = peg.getEconomicGraph(actor, subjectId);
    assert.equal(before.ok, true);
    if (!before.ok) {
      return;
    }
    const rebuilt = peg.rebuildDerivedProjection(subjectId, source);
    assert.equal(rebuilt.ok, true);
    if (!rebuilt.ok) {
      return;
    }
    const afterKinds = rebuilt.value.nodes.map((node) => `${node.kind}:${node.confidence}`).sort();
    const beforeKinds = before.value.nodes.map((node) => `${node.kind}:${node.confidence}`).sort();
    assert.deepEqual(afterKinds, beforeKinds);
    assert.ok(rebuilt.value.nodes.some((node) => node.kind === 'LIABILITY' && node.survivesRebuild));
  });

  it('marks conflicting non-authoritative facts instead of choosing one', () => {
    const store = new InMemoryEconomicGraphStore();
    const graphId = asEconomicGraphId('peg_g_conflict');
    store.putGraph({
      graphId,
      subjectId: 'id_conflict',
      createdAt: NOW,
      authoritativeBalance: false,
      mutatesFinancialState: false,
    });
    const nodeId = asEconomicNodeId('peg_n_asset_home');
    const sourceA = asEconomicSourceId('peg_src_user_declared_a');
    const sourceB = asEconomicSourceId('peg_src_user_declared_b');
    store.putNode({
      nodeId,
      graphId,
      kind: 'ASSET',
      attributes: { kind: 'ASSET', assetKind: 'HOME', holdingKind: 'USER_DECLARED', label: 'Home' },
      quality: 'CURRENT',
      confidence: 'USER_DECLARED',
      provenance: {
        sourceId: sourceA,
        sourceType: 'USER_DECLARED',
        sourceRef: 'a',
        observedAt: NOW,
        effectiveAt: NOW,
        confidence: 'USER_DECLARED',
        version: 1,
      },
      createdAt: NOW,
      survivesRebuild: true,
    });
    store.putFact({
      factId: asEconomicFactId('peg_f_home_value_v1'),
      graphId,
      nodeId,
      key: 'estimated_value',
      value: { type: 'MONEY', minorUnits: '100', currency: 'USD' },
      confidence: 'USER_DECLARED',
      quality: 'CURRENT',
      provenance: {
        sourceId: sourceA,
        sourceType: 'USER_DECLARED',
        sourceRef: 'a',
        observedAt: NOW,
        effectiveAt: NOW,
        confidence: 'USER_DECLARED',
        version: 1,
      },
      validFrom: NOW,
      validTo: null,
      observedAt: NOW,
      effectiveAt: NOW,
      supersededBy: null,
      version: 1,
      survivesRebuild: true,
    });
    store.putFact({
      factId: asEconomicFactId('peg_f_home_value_v2'),
      graphId,
      nodeId,
      key: 'estimated_value',
      value: { type: 'MONEY', minorUnits: '200', currency: 'USD' },
      confidence: 'USER_DECLARED',
      quality: 'CURRENT',
      provenance: {
        sourceId: sourceB,
        sourceType: 'USER_DECLARED',
        sourceRef: 'b',
        observedAt: NOW,
        effectiveAt: NOW,
        confidence: 'USER_DECLARED',
        version: 1,
      },
      validFrom: NOW,
      validTo: null,
      observedAt: NOW,
      effectiveAt: NOW,
      supersededBy: null,
      version: 1,
      survivesRebuild: true,
    });
    const facts = store.currentFactsFor(graphId, NOW).filter((fact) => fact.key === 'estimated_value');
    assert.equal(facts.length, 2);
    assert.ok(facts.every((fact) => fact.quality === 'CONFLICTED'));
  });

  it('detects monthly cadence with integer day math only', () => {
    const graphId = asEconomicGraphId('peg_g_rec');
    const activities: EconomicActivity[] = ['2026-05-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z'].map(
      (at, index) => ({
        activityId: deterministicActivityId(`sal_${String(index)}`),
        graphId,
        subjectId: 'id',
        direction: 'INFLOW',
        amount: { minorUnits: '1000000', currency: 'USD' },
        occurredAt: asUtcInstant(at),
        counterpart: { kind: 'EMPLOYER', ref: 'acme' },
        classification: 'UNKNOWN',
        sourceType: 'CANONICAL_LEDGER',
        sourceRef: `j_${String(index)}`,
        sourceEventType: 'DepositPosted',
        sourceEventId: `e_${String(index)}`,
      }),
    );
    const patterns = detectRecurringPatterns(activities);
    assert.equal(patterns.length, 1);
    assert.equal(patterns[0]?.cadence, 'MONTHLY');
    assert.equal(patterns[0]?.classification, 'SALARY');
    assert.equal(patterns[0]?.confidence, 'DERIVED');
    assert.ok(asEconomicActivityId(activities[0]!.activityId));
  });

  it('graph IDs are not ledger IDs', () => {
    assert.throws(() => asEconomicGraphId('acct_usd'), /peg_g_/);
    assert.throws(() => asEconomicGraphId('journal_1'), /peg_g_/);
  });
});
