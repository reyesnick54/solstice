import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../../config/src/clock.ts';
import { asCustomerId } from '../../../domain/src/customer.ts';
import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { asUtcInstant } from '../../../domain/src/time.ts';
import { DomainEventLog } from '../../../events/src/events.ts';
import type { IdentityCapability } from '../../../identity/src/capability.ts';
import { SimulatedIdentityAdapter } from '../../../identity/src/simulation.ts';
import { EconomicGraphService } from '../../../personal-economic-graph/src/service.ts';
import { createSimulationKeyProvider } from '../../../security/src/simulation.ts';
import { asEconomicMandateId, asGrowthPlanId, asGrowthPlanVersion, asMandateVersion } from '../ids.ts';
import { GrowthOrchestrator } from '../service.ts';
import { InMemoryGrowthStore } from '../store.ts';
import { EconomicWorkOrderService } from './service.ts';
import { InMemoryWorkOrderStore } from './store.ts';
import type { CreateEconomicWorkOrderInput, EconomicWorkOrder } from './types.ts';

const NOW = asUtcInstant('2026-09-15T12:00:00.000Z');
const EXPIRES = asUtcInstant('2026-10-15T12:00:00.000Z');

function baseInput(subjectId: string, customerId: string, idempotencyKey: string): CreateEconomicWorkOrderInput {
  return {
    subjectId,
    customerId,
    idempotencyKey,
    planId: asGrowthPlanId('gpl_h04_demo'),
    planVersion: asGrowthPlanVersion(1),
    objectiveReference: 'grow_objective_demo',
    objective: {
      description: 'Investigate growth allocation opportunities within mandate bounds',
      objectiveType: 'GROWTH_ALLOCATION',
      horizon: { kind: 'DURATION_DAYS', days: 30 },
      completionCriteria: Object.freeze(['proposal delivered or abandoned']),
      terminationCriteria: Object.freeze(['mandate revoked']),
      priority: 1,
    },
    authorityReferences: {
      mandateId: asEconomicMandateId('emd_h04_demo'),
      mandateVersion: asMandateVersion(1),
      approvalReference: null,
      capabilityContextReference: 'cap_grow_demo',
      jurisdiction: 'US',
      legalEntityId: null,
    },
    capitalBoundary: {
      maxCapitalEnvelope: { minorUnits: '500000', currency: 'USD' },
      accountId: 'acct_cash',
      portfolioId: null,
      liquidityRetentionReference: 'liq_min_8000',
      isBalance: false,
      isAuthorizationEnvelope: true,
    },
    researchBoundary: {
      budgetReference: 'research_budget_demo',
      budgetUnits: Object.freeze(['USD']),
      deadline: EXPIRES,
      permittedCategories: Object.freeze(['OPPORTUNITY', 'ALLOCATION']),
      permittedToolClasses: Object.freeze(['PEG_QUERY', 'OPPORTUNITY_SCAN']),
      permittedModelClasses: Object.freeze(['DETERMINISTIC', 'SIMULATION']),
      maxConcurrency: 2,
      stopConditions: Object.freeze(['mandate constraint violated']),
    },
    actionBoundary: {
      permittedActionCategories: Object.freeze(['RESEARCH', 'OPPORTUNITY_DISCOVERY', 'PROPOSAL_GENERATION']),
      unrestrictedFinancialMutation: false,
      agentAuthorityEscalation: false,
    },
    completion: {
      completionCriteria: Object.freeze(['disposition recorded']),
      expirationAt: EXPIRES,
    },
  };
}

function setupActors() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  const provision = (
    actorId: string,
    identityId: string,
    customerId: string,
    capabilities: readonly IdentityCapability[],
  ) => {
    assert.equal(
      identity.provisionSimulatedActor({
        actorId,
        jurisdiction: asJurisdiction('US'),
        identityId,
        customerId: asCustomerId(customerId),
        capabilities,
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext(actorId);
    if (!actor.ok) {
      throw new Error('actor');
    }
    return actor.value;
  };
  const actorA = provision('actor_a', 'subj_a', 'cust_a', [
    'VIEW_GROWTH_PLAN',
    'OPERATE_GROWTH_ORCHESTRATOR',
    'CONFIRM_ECONOMIC_MANDATE',
  ]);
  const actorB = provision('actor_b', 'subj_b', 'cust_b', [
    'VIEW_GROWTH_PLAN',
    'OPERATE_GROWTH_ORCHESTRATOR',
    'CONFIRM_ECONOMIC_MANDATE',
  ]);
  const service = new EconomicWorkOrderService({ clock, events });
  return { clock, events, service, actorA, actorB };
}

describe('Economic Work Order H04', () => {
  it('creates a valid work order with stable persisted ID', () => {
    const { service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_create_1'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.match(created.value.workOrderId, /^ewo_/);
    assert.equal(created.value.customerId, 'cust_a');
    assert.equal(created.value.state, 'CREATED');
    assert.equal(created.value.revision, 1);
    assert.equal(created.value.createsFinancialAuthority, false);
    assert.equal(created.value.postsLedger, false);
    assert.equal(created.value.capitalBoundary.isBalance, false);
    assert.equal(created.value.capitalBoundary.isAuthorizationEnvelope, true);
    assert.equal(created.value.capitalBoundary.maxCapitalEnvelope.minorUnits, '500000');
    assert.equal(created.value.authorityReferences.mandateId, 'emd_h04_demo');
  });

  it('requires mandate reference', () => {
    const { service, actorA } = setupActors();
    const input = baseInput('subj_a', 'cust_a', 'idem_no_mandate');
    const created = service.createEconomicWorkOrder(actorA, {
      ...input,
      authorityReferences: {
        ...input.authorityReferences,
        mandateId: '' as ReturnType<typeof asEconomicMandateId>,
      },
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      return;
    }
    assert.equal(created.error.code, 'MANDATE_REFERENCE_REQUIRED');
  });

  it('idempotent replay does not create duplicates', () => {
    const { service, actorA } = setupActors();
    const input = baseInput('subj_a', 'cust_a', 'idem_replay');
    const first = service.createEconomicWorkOrder(actorA, input);
    const second = service.createEconomicWorkOrder(actorA, input);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.value.workOrderId, second.value.workOrderId);
    const listed = service.listEconomicWorkOrders(actorA, 'cust_a', 'subj_a');
    assert.equal(listed.ok, true);
    if (!listed.ok) {
      return;
    }
    assert.equal(listed.value.filter((row) => row.idempotencyKey === 'idem_replay').length, 1);
  });

  it('rejects invalid transitions and records failed transition metrics', () => {
    const { service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_invalid_tx'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const invalid = service.transitionEconomicWorkOrder(
      actorA,
      created.value.workOrderId,
      'cust_a',
      'COMPLETED',
      'skip states',
    );
    assert.equal(invalid.ok, false);
    assert.equal(service.metrics.snapshot().failedTransitionAttempts, 1);
  });

  it('supports activate, pause, cancel, and completion lifecycle', () => {
    const { service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_lifecycle'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const activated = service.activateEconomicWorkOrder(actorA, created.value.workOrderId, 'cust_a');
    assert.equal(activated.ok, true);
    if (!activated.ok) {
      return;
    }
    assert.equal(activated.value.state, 'ACTIVE');
    const paused = service.pauseEconomicWorkOrder(actorA, created.value.workOrderId, 'cust_a', 'user pause');
    assert.equal(paused.ok, true);
    if (!paused.ok) {
      return;
    }
    assert.equal(paused.value.state, 'PAUSED');
    const resumed = service.transitionEconomicWorkOrder(
      actorA,
      created.value.workOrderId,
      'cust_a',
      'ACTIVE',
      'resume',
    );
    assert.equal(resumed.ok, true);
    const cancelled = service.cancelEconomicWorkOrder(
      actorA,
      created.value.workOrderId,
      'cust_a',
      'user cancelled',
    );
    assert.equal(cancelled.ok, true);
    if (!cancelled.ok) {
      return;
    }
    assert.equal(cancelled.value.state, 'CANCELLED');
    assert.ok(cancelled.value.transitions.length >= 3);
  });

  it('enforces customer isolation', () => {
    const { service, actorA, actorB } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_isolation'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const crossRead = service.getEconomicWorkOrder(actorB, created.value.workOrderId, 'cust_b');
    assert.equal(crossRead.ok, false);
    if (crossRead.ok) {
      return;
    }
    assert.equal(crossRead.error.code, 'CUSTOMER_MISMATCH');
    const crossMutate = service.pauseEconomicWorkOrder(
      actorB,
      created.value.workOrderId,
      'cust_a',
      'cross customer',
    );
    assert.equal(crossMutate.ok, false);
  });

  it('expires work orders when expiration criteria are met', () => {
    const clock = new FrozenClock(EXPIRES);
    const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
    const events = new DomainEventLog();
    const identity = new SimulatedIdentityAdapter({ clock, keys, events });
    assert.equal(
      identity.provisionSimulatedActor({
        actorId: 'actor_exp',
        jurisdiction: asJurisdiction('US'),
        identityId: 'subj_exp',
        customerId: asCustomerId('cust_exp'),
        capabilities: ['VIEW_GROWTH_PLAN', 'OPERATE_GROWTH_ORCHESTRATOR'],
      }).ok,
      true,
    );
    const actor = identity.service.resolveActorContext('actor_exp');
    if (!actor.ok) {
      throw new Error('actor');
    }
    const service = new EconomicWorkOrderService({ clock, events });
    const created = service.createEconomicWorkOrder(
      actor.value,
      baseInput('subj_exp', 'cust_exp', 'idem_expire'),
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const loaded = service.getEconomicWorkOrder(actor.value, created.value.workOrderId, 'cust_exp');
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    assert.equal(loaded.value.state, 'EXPIRED');
  });

  it('persist/reload equality through store snapshot', () => {
    const { service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_persist'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const activated = service.activateEconomicWorkOrder(actorA, created.value.workOrderId, 'cust_a');
    assert.equal(activated.ok, true);
    const snapshot = service.store.snapshot();
    const restoredStore = new InMemoryWorkOrderStore();
    restoredStore.loadState(snapshot);
    const reloaded = restoredStore.get(created.value.workOrderId);
    assert.ok(reloaded);
    assert.deepEqual(reloaded, activated.ok ? activated.value : created.value);
  });

  it('rehydrates after service restart from store snapshot', () => {
    const { clock, events, service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_restart'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const snapshot = service.store.snapshot();
    const restarted = new EconomicWorkOrderService({
      clock,
      events,
      store: new InMemoryWorkOrderStore(),
    });
    restarted.store.loadState(snapshot);
    const loaded = restarted.getEconomicWorkOrder(actorA, created.value.workOrderId, 'cust_a');
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    assert.equal(loaded.value.workOrderId, created.value.workOrderId);
    assert.equal(loaded.value.customerId, 'cust_a');
  });

  it('emits typed work order events', () => {
    const { events, service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_events'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const types = events.list().map((event) => event.eventType);
    assert.ok(types.includes('WorkOrderCreated'));
    service.activateEconomicWorkOrder(actorA, created.value.workOrderId, 'cust_a');
    const afterActivate = events.list().map((event) => event.eventType);
    assert.ok(afterActivate.includes('WorkOrderActivated'));
  });

  it('rejects optimistic concurrency conflicts on transition', () => {
    const { service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_version'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const ready = service.transitionEconomicWorkOrder(
      actorA,
      created.value.workOrderId,
      'cust_a',
      'READY',
      'prepare',
    );
    assert.equal(ready.ok, true);
    const conflict = service.store.put(created.value, created.value.revision);
    assert.equal(typeof conflict === 'object' && 'code' in conflict, true);
    if (typeof conflict !== 'object' || !('code' in conflict)) {
      return;
    }
    assert.equal(conflict.code, 'VERSION_CONFLICT');
  });

  it('does not post ledger journals on work order creation', () => {
    const { service, actorA } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_no_ledger'));
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.postsLedger, false);
    assert.equal(created.value.createsFinancialAuthority, false);
    assert.equal(typeof (service as Record<string, unknown>).postJournal, 'undefined');
  });

  it('cannot directly execute financial actions', () => {
    const { service } = setupActors();
    const serviceProto = Object.getPrototypeOf(service) as Record<string, unknown>;
    assert.equal(typeof serviceProto.postJournal, 'undefined');
    assert.equal(typeof serviceProto.executeProposal, 'undefined');
    assert.equal(typeof serviceProto.issueExecutionAuthority, 'undefined');
    const workOrder: EconomicWorkOrder = {
      workOrderId: 'ewo_static_check' as EconomicWorkOrder['workOrderId'],
      subjectId: 'subj_a',
      customerId: 'cust_a',
      planId: null,
      planVersion: null,
      objectiveReference: null,
      revision: 1 as EconomicWorkOrder['revision'],
      environment: 'simulation',
      state: 'CREATED',
      createdAt: NOW,
      updatedAt: NOW,
      idempotencyKey: 'static',
      objective: baseInput('subj_a', 'cust_a', 'static').objective,
      authorityReferences: baseInput('subj_a', 'cust_a', 'static').authorityReferences,
      capitalBoundary: baseInput('subj_a', 'cust_a', 'static').capitalBoundary,
      researchBoundary: baseInput('subj_a', 'cust_a', 'static').researchBoundary,
      actionBoundary: baseInput('subj_a', 'cust_a', 'static').actionBoundary,
      completion: Object.freeze({
        completionCriteria: Object.freeze(['done']),
        expirationAt: null,
        disposition: null,
        blockReason: null,
      }),
      transitions: Object.freeze([]),
      createsFinancialAuthority: false,
      postsLedger: false,
    };
    assert.equal(typeof (workOrder as Record<string, unknown>).postJournal, 'undefined');
    assert.equal(workOrder.actionBoundary.unrestrictedFinancialMutation, false);
  });

  it('list endpoints do not leak another customer work orders', () => {
    const { service, actorA, actorB } = setupActors();
    const created = service.createEconomicWorkOrder(actorA, baseInput('subj_a', 'cust_a', 'idem_list_iso'));
    assert.equal(created.ok, true);
    const listedB = service.listEconomicWorkOrders(actorB, 'cust_b', 'subj_b');
    assert.equal(listedB.ok, true);
    if (!listedB.ok || !created.ok) {
      return;
    }
    assert.equal(listedB.value.some((row) => row.workOrderId === created.value.workOrderId), false);
    const listedAllB = service.listEconomicWorkOrders(actorB, 'cust_b');
    assert.equal(listedAllB.ok, true);
    if (!listedAllB.ok) {
      return;
    }
    assert.equal(listedAllB.value.some((row) => row.customerId === 'cust_a'), false);
  });

  it('does not widen action envelope through creation', () => {
    const { service, actorA } = setupActors();
    const input = baseInput('subj_a', 'cust_a', 'idem_envelope');
    const created = service.createEconomicWorkOrder(actorA, input);
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.actionBoundary.unrestrictedFinancialMutation, false);
    assert.equal(created.value.actionBoundary.agentAuthorityEscalation, false);
    assert.deepEqual(created.value.actionBoundary.permittedActionCategories, input.actionBoundary.permittedActionCategories);
  });

  it('existing Growth Orchestrator behavior remains regression-green', () => {
    const clock = new FrozenClock(NOW);
    const events = new DomainEventLog();
    const peg = new EconomicGraphService({ clock, events });
    const orchestrator = new GrowthOrchestrator({
      clock,
      events,
      peg,
      store: new InMemoryGrowthStore(),
    });
    const compiled = orchestrator.interpretAndCompile({} as never, {
      subjectId: 'subj_regression',
      sourceText: 'Keep liquidity and grow conservatively.',
    });
    assert.equal(compiled.ok, false);
    if (!compiled.ok && 'message' in compiled.error) {
      assert.match(compiled.error.message, /ActorContext|CAPABILITY/);
    }
  });
});
