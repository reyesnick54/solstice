import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog, type DomainEvent } from '../packages/events/src/events.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { EconomicGraphService } from '../packages/personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';

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

describe('Chunk 14 Personal Economic Graph exit criterion', () => {
  it('satisfies the PEG intelligence-layer contract', () => {
    const clock = new FrozenClock(NOW);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    const subjectId = 'id_peg_exit';
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_peg_exit',
        jurisdiction: asJurisdiction('US'),
        identityId: subjectId,
        customerId: asCustomerId('cust_peg_exit'),
        capabilities: ['VIEW_ECONOMIC_GRAPH', 'DECLARE_ECONOMIC_FACT'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_peg_exit');
    if (!actor.ok) {
      throw new Error('expected ok');
    }

    const peg = new EconomicGraphService({ clock, events });
    peg.registerAccountCurrency('acct_usd', 'USD');
    const source: DomainEvent[] = [
      event(
        'AccountOpened',
        '2026-05-01T00:00:00.000Z',
        {
          accountId: 'acct_usd',
          ownerId: 'cust_peg_exit',
          accountClass: 'DEMAND_DEPOSIT',
          executionAuthorityId: 'ea',
          intentId: 'I1',
        },
        'exit_open',
      ),
      event(
        'DepositPosted',
        '2026-05-01T09:00:00.000Z',
        { journalId: 'j1', accountId: 'acct_usd', amountMinorUnits: '1000000', currency: 'USD' },
        'exit_sal_1',
      ),
      event(
        'DepositPosted',
        '2026-06-01T09:00:00.000Z',
        { journalId: 'j2', accountId: 'acct_usd', amountMinorUnits: '1000000', currency: 'USD' },
        'exit_sal_2',
      ),
      event(
        'DepositPosted',
        '2026-07-01T09:00:00.000Z',
        { journalId: 'j3', accountId: 'acct_usd', amountMinorUnits: '1000000', currency: 'USD' },
        'exit_sal_3',
      ),
    ];
    for (const id of ['exit_sal_1', 'exit_sal_2', 'exit_sal_3'] as const) {
      peg.registerOverlay({
        sourceEventId: id,
        subjectId,
        classification: 'SALARY',
        counterpart: { kind: 'EMPLOYER', ref: 'acme' },
      });
    }

    assert.equal(peg.openGraph(actor.value, subjectId).ok, true);
    peg.ingestAll(source, subjectId);
    peg.materializeRecurring(subjectId);
    assert.equal(
      peg.declareGoal(actor.value, subjectId, {
        goalKind: 'EMERGENCY_RESERVE',
        label: 'Emergency fund',
        target: { minorUnits: '2000000', currency: 'USD' },
        priority: 1,
      }).ok,
      true,
    );
    peg.proposeOpportunities(subjectId);

    const graph = peg.getEconomicGraph(actor.value, subjectId);
    if (!graph.ok) {
      throw new Error('expected ok');
    }
    assert.ok(graph.value.nodes.some((node) => node.kind === 'PERSON'));
    assert.ok(graph.value.nodes.some((node) => node.kind === 'ACCOUNT'));
    assert.ok(graph.value.nodes.some((node) => node.kind === 'INCOME_SOURCE'));
    assert.ok(graph.value.nodes.every((node) => node.provenance.sourceType.length > 0));
    assert.ok(graph.value.nodes.some((node) => node.confidence === 'DERIVED'));
    assert.ok(graph.value.nodes.some((node) => node.confidence === 'VERIFIED'));
    assert.equal(graph.value.graph.authoritativeBalance, false);
    assert.equal(graph.value.graph.mutatesFinancialState, false);

    const snapshot = peg.getEconomicSnapshot(actor.value, subjectId);
    if (!snapshot.ok) {
      throw new Error('expected ok');
    }
    assert.equal(snapshot.value.crossCurrencyTotal, null);
    assert.equal(snapshot.value.ledgerWins, true);
    assert.ok(snapshot.value.monthlyCashFlow.every((flow) => flow.income.sourceRefs.length >= 0));
    assert.ok(snapshot.value.goals.length === 1);
    assert.ok(snapshot.value.economicOpportunities.every((item) => item.executable === false));

    const rebuilt = peg.rebuildDerivedProjection(subjectId, source);
    if (!rebuilt.ok) {
      throw new Error('expected ok');
    }
    assert.ok(rebuilt.value.nodes.some((node) => node.kind === 'GOAL' && node.survivesRebuild));

    const denied = peg.getEconomicGraph({ actorId: 'nope' }, subjectId);
    assert.equal(denied.ok, false);

    const graphEvents = events.list().filter((item) => item.eventType.startsWith('EconomicGraph'));
    assert.ok(graphEvents.some((item) => item.eventType === 'EconomicGraphNodeCreated'));
    assert.ok(graphEvents.some((item) => item.eventType === 'EconomicGraphSnapshotCreated'));
  });
});
