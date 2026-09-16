import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import type { IdentityCapability } from '../packages/identity/src/capability.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import type { CapabilityBindingContext } from '../packages/platform/src/helios/index.ts';
import {
  AuthorityBoundWorkOrderService,
  scopeFromCoordinationWorkOrder,
} from '../packages/platform/src/work-order/index.ts';
import { asGrowthPlanId, asGrowthPlanVersion, asMandateVersion } from '../packages/platform/src/ids.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import type { CreateEconomicWorkOrderInput } from '../packages/platform/src/work-order/types.ts';

const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');
const EXPIRES = asUtcInstant('2026-10-15T14:00:00.000Z');

const FULL_CAPS: readonly IdentityCapability[] = Object.freeze([
  'VIEW_GROWTH_PLAN',
  'VIEW_ECONOMIC_GRAPH',
  'CONSENT_VIEW_OWN',
  'AGENT_USE',
  'OPERATE_GROWTH_ORCHESTRATOR',
  'INVESTMENT_PROPOSE',
  'VIEW_ACCOUNT',
  'EXCHANGE_OPERATE_REQUEST',
  'FX_QUOTE_REQUEST',
]);

function activeMandate(subjectId: string, state: CompiledEconomicMandate['state'] = 'ACTIVE'): CompiledEconomicMandate {
  const interpretation = interpretMandateLanguage({
    subjectId,
    sourceText:
      'Keep at least $8,000 liquid. Build my emergency fund to $20,000. Do not make high-risk investments. Ask me before any movement over $1,000.',
    now: NOW,
  });
  if (!interpretation.ok) {
    throw new Error('interpretation');
  }
  const draft = mandateDraftFromInterpretation(interpretation.value, NOW);
  const compiled = compileEconomicMandate({ draft, now: NOW });
  if (!compiled.ok) {
    throw new Error('compile');
  }
  return Object.freeze({ ...compiled.value, state });
}

function capabilityContext(customerId: string): CapabilityBindingContext {
  return Object.freeze({
    customerId: asCustomerId(customerId),
    jurisdiction: asJurisdiction('US'),
    legalEntityId: 'le_us_demo',
    environment: 'simulation',
    grantedCapabilities: FULL_CAPS,
    capabilityStates: {},
    contextVersion: 'cap_ctx_v1',
  });
}

function coordinationInput(
  subjectId: string,
  customerId: string,
  idempotencyKey: string,
  mandate: CompiledEconomicMandate,
): CreateEconomicWorkOrderInput {
  return {
    subjectId,
    customerId,
    idempotencyKey,
    planId: asGrowthPlanId('gpl_h04_h05'),
    planVersion: asGrowthPlanVersion(1),
    objectiveReference: 'grow_obj_h04_h05',
    objective: {
      description: 'Research growth allocation within mandate bounds',
      objectiveType: 'GROWTH_ALLOCATION',
      horizon: { kind: 'DURATION_DAYS', days: 30 },
      completionCriteria: Object.freeze(['proposal delivered or abandoned']),
      terminationCriteria: Object.freeze(['mandate revoked']),
      priority: 1,
    },
    authorityReferences: {
      mandateId: mandate.mandateId,
      mandateVersion: asMandateVersion(mandate.version),
      approvalReference: null,
      capabilityContextReference: 'cap_ctx_v1',
      jurisdiction: 'US',
      legalEntityId: null,
    },
    capitalBoundary: {
      maxCapitalEnvelope: { minorUnits: '100000', currency: 'USD' },
      accountId: 'acct_checking',
      portfolioId: null,
      liquidityRetentionReference: null,
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
      permittedActionCategories: Object.freeze(['RESEARCH', 'OPPORTUNITY_DISCOVERY']),
      unrestrictedFinancialMutation: false,
      agentAuthorityEscalation: false,
    },
    completion: {
      completionCriteria: Object.freeze(['disposition recorded']),
      expirationAt: EXPIRES,
    },
  };
}

function setup() {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'actor_a',
      jurisdiction: asJurisdiction('US'),
      identityId: 'subj_a',
      customerId: asCustomerId('cust_a'),
      capabilities: ['VIEW_GROWTH_PLAN', 'OPERATE_GROWTH_ORCHESTRATOR', 'CONFIRM_ECONOMIC_MANDATE'],
    }).ok,
    true,
  );
  const actor = identity.service.resolveActorContext('actor_a');
  if (!actor.ok) {
    throw new Error('actor');
  }
  const service = new AuthorityBoundWorkOrderService({ clock, events, evidence });
  return { clock, events, evidence, service, actor: actor.value, mandate: activeMandate('subj_a') };
}

describe('HELIOS H04+H05 authority-bound work orders', () => {
  it('creates coordination and binding records with shared work order id', () => {
    const { service, actor, mandate } = setup();
    const created = service.createWithAuthority(
      actor,
      coordinationInput('subj_a', 'cust_a', 'idem_bind_create', mandate),
      {
        mandate,
        capabilityContext: capabilityContext('cust_a'),
        approvalRef: null,
        requiredApprovalClass: 'NONE',
        growObjectiveId: 'grow_obj_h04_h05',
      },
      'actor_a',
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.coordination.workOrderId, created.value.binding.workOrderId);
    assert.equal(created.value.coordination.createsFinancialAuthority, false);
    assert.equal(created.value.binding.grantsExecutionAuthority, false);
    assert.equal(created.value.binding.authorizesFinancialExecution, false);
    assert.ok(created.value.binding.effectiveScope);
  });

  it('blocks activation when mandate is revoked', () => {
    const { service, actor, mandate } = setup();
    const created = service.createWithAuthority(
      actor,
      coordinationInput('subj_a', 'cust_a', 'idem_bind_revoke', mandate),
      {
        mandate,
        capabilityContext: capabilityContext('cust_a'),
        approvalRef: null,
        requiredApprovalClass: 'NONE',
        growObjectiveId: 'grow_obj_h04_h05',
      },
      'actor_a',
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const revokedMandate = activeMandate('subj_a', 'REVOKED');
    const activated = service.activateWithAuthority(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
      {
        mandate: revokedMandate,
        capabilityContext: capabilityContext('cust_a'),
        approvalRef: null,
      },
      'actor_a',
    );
    assert.equal(activated.ok, false);
    if (activated.ok) {
      return;
    }
    assert.equal(activated.error.code, 'MANDATE_REVOKED');
    const loaded = service.coordination.getEconomicWorkOrder(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
    );
    assert.equal(loaded.ok, true);
    if (!loaded.ok) {
      return;
    }
    assert.equal(loaded.value.state, 'CREATED');
  });

  it('revalidates authority on resume after pause', () => {
    const { service, actor, mandate } = setup();
    const created = service.createWithAuthority(
      actor,
      coordinationInput('subj_a', 'cust_a', 'idem_bind_resume', mandate),
      {
        mandate,
        capabilityContext: capabilityContext('cust_a'),
        approvalRef: null,
        requiredApprovalClass: 'NONE',
        growObjectiveId: 'grow_obj_h04_h05',
      },
      'actor_a',
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const activated = service.activateWithAuthority(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
      { mandate, capabilityContext: capabilityContext('cust_a'), approvalRef: null },
      'actor_a',
    );
    assert.equal(activated.ok, true);
    const paused = service.coordination.pauseEconomicWorkOrder(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
      'pause',
    );
    assert.equal(paused.ok, true);
    const resumed = service.resumeWithAuthority(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
      { mandate, capabilityContext: capabilityContext('cust_a'), approvalRef: null },
      'actor_a',
    );
    assert.equal(resumed.ok, true);
    if (!resumed.ok) {
      return;
    }
    assert.equal(resumed.value.coordination.state, 'ACTIVE');
    assert.equal(service.binding.store.decisionsForWorkOrder(created.value.binding.workOrderId).length >= 3, true);
  });

  it('enforces customer isolation across binding and coordination', () => {
    const { service, actor, mandate } = setup();
    const created = service.createWithAuthority(
      actor,
      coordinationInput('subj_a', 'cust_a', 'idem_bind_isolation', mandate),
      {
        mandate,
        capabilityContext: capabilityContext('cust_a'),
        approvalRef: null,
        requiredApprovalClass: 'NONE',
        growObjectiveId: 'grow_obj_h04_h05',
      },
      'actor_a',
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const crossCapability = capabilityContext('cust_b');
    const activated = service.activateWithAuthority(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
      { mandate, capabilityContext: crossCapability, approvalRef: null },
      'actor_b',
    );
    assert.equal(activated.ok, false);
  });

  it('maps coordination envelope to binding scope without widening', () => {
    const { service, actor, mandate } = setup();
    const created = service.createWithAuthority(
      actor,
      coordinationInput('subj_a', 'cust_a', 'idem_bind_scope', mandate),
      {
        mandate,
        capabilityContext: capabilityContext('cust_a'),
        approvalRef: null,
        requiredApprovalClass: 'NONE',
        growObjectiveId: 'grow_obj_h04_h05',
      },
      'actor_a',
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const mapped = scopeFromCoordinationWorkOrder(created.value.coordination);
    assert.equal(mapped.capitalCeiling?.minorUnits, '100000');
    assert.ok(mapped.activityClasses.includes('RESEARCH'));
    assert.ok(mapped.toolIds.includes('tool_peg_query'));
    assert.ok(created.value.binding.effectiveScope);
    if (!created.value.binding.effectiveScope) {
      return;
    }
    assert.ok(
      BigInt(created.value.binding.effectiveScope.capitalCeiling?.minorUnits ?? '0') <=
        BigInt(mapped.capitalCeiling?.minorUnits ?? '0'),
    );
  });

  it('preserves evidence after revocation without erasing history', () => {
    const { service, actor, mandate, evidence } = setup();
    const created = service.createWithAuthority(
      actor,
      coordinationInput('subj_a', 'cust_a', 'idem_bind_evidence', mandate),
      {
        mandate,
        capabilityContext: capabilityContext('cust_a'),
        approvalRef: null,
        requiredApprovalClass: 'NONE',
        growObjectiveId: 'grow_obj_h04_h05',
      },
      'actor_a',
    );
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    const activated = service.activateWithAuthority(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
      { mandate, capabilityContext: capabilityContext('cust_a'), approvalRef: null },
      'actor_a',
    );
    assert.equal(activated.ok, true);
    const before = evidence.list().length;
    const revokedMandate = Object.freeze({ ...mandate, state: 'REVOKED' as const });
    const revoked = service.handleAuthorityRevocation(
      actor,
      created.value.coordination.workOrderId,
      'cust_a',
      revokedMandate,
    );
    assert.equal(revoked.ok, true);
    assert.equal(evidence.list().length, before);
    assert.equal(revoked.ok && revoked.value.coordination.state, 'BLOCKED');
  });
});
