import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import type { IdentityCapability } from '../packages/identity/src/capability.ts';
import {
  HeliosWorkOrderBindingService,
  createWorkOrderApprovalRef,
  detectMaterialScopeChange,
  intersectWorkOrderScope,
  mandatePermittedScopeFromCompiled,
  workOrderIdFor,
  type CapabilityBindingContext,
  type WorkOrderScope,
} from '../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import { constraintIdFor } from '../packages/platform/src/ids.ts';
import type { CompiledEconomicMandate, HardConstraint } from '../packages/platform/src/mandate/types.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-15T14:00:00.000Z');

function activeMandate(
  subjectId: string,
  extraConstraints: readonly HardConstraint[] = [],
  state: CompiledEconomicMandate['state'] = 'ACTIVE',
): CompiledEconomicMandate {
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
  return Object.freeze({
    ...compiled.value,
    state,
    hardConstraints: Object.freeze([...compiled.value.hardConstraints, ...extraConstraints]),
  });
}

function researchOnlyMandate(subjectId: string): CompiledEconomicMandate {
  return activeMandate(subjectId, [
    Object.freeze({
      constraintId: constraintIdFor('ALLOWED_PROPOSAL_CATEGORIES', `${subjectId}_research`),
      kind: 'ALLOWED_PROPOSAL_CATEGORIES',
      categories: Object.freeze(['RESEARCH', 'ANALYSIS']),
      overrideForbidden: true,
    }),
  ]);
}

function mandateWithCapitalCeiling(subjectId: string, minorUnits: string): CompiledEconomicMandate {
  return activeMandate(subjectId, [
    Object.freeze({
      constraintId: constraintIdFor('MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT', `${subjectId}_cap`),
      kind: 'MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT',
      amount: { minorUnits, currency: 'USD' },
      overrideForbidden: true,
    }),
  ]);
}

function equitiesOnlyMandate(subjectId: string): CompiledEconomicMandate {
  return activeMandate(subjectId, [
    Object.freeze({
      constraintId: constraintIdFor('PROHIBITED_PRODUCT_CATEGORIES', `${subjectId}_crypto`),
      kind: 'PROHIBITED_PRODUCT_CATEGORIES',
      categories: Object.freeze(['CRYPTO', 'DERIVATIVES']),
      overrideForbidden: true,
    }),
  ]);
}

function baseScope(overrides: Partial<WorkOrderScope> = {}): WorkOrderScope {
  return Object.freeze({
    objectiveClasses: Object.freeze(['RESEARCH'] as const),
    activityClasses: Object.freeze(['RESEARCH', 'DATA_ACCESS'] as const),
    productClasses: Object.freeze(['CASH', 'EQUITIES'] as const),
    capitalCeiling: { minorUnits: '100000', currency: 'USD' },
    accountIds: Object.freeze(['acct_checking']),
    jurisdiction: asJurisdiction('US'),
    horizonDays: 30,
    toolIds: Object.freeze(['tool_research']),
    modelIds: Object.freeze(['mdl_s3m']),
    ...overrides,
  });
}

function capabilityContext(
  customerId: string,
  capabilities: readonly IdentityCapability[],
  capabilityStates: CapabilityBindingContext['capabilityStates'] = {},
): CapabilityBindingContext {
  return Object.freeze({
    customerId: asCustomerId(customerId),
    jurisdiction: asJurisdiction('US'),
    legalEntityId: 'le_us_demo',
    environment: 'simulation',
    grantedCapabilities: capabilities,
    capabilityStates,
    contextVersion: 'cap_ctx_v1',
  });
}

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

describe('HELIOS H05 mandate/capability/approval binding', () => {
  it('1. valid mandate binds successfully', () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const service = new HeliosWorkOrderBindingService({ clock, evidence });
    const customerId = asCustomerId('cust_a');
    const subjectId = 'id_a';
    const mandate = activeMandate(subjectId);
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '001'),
      customerId,
      subjectId,
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('create');
    }
    assert.equal(created.value.grantsExecutionAuthority, false);
    assert.equal(created.value.authorizesFinancialExecution, false);
    assert.ok(created.value.effectiveScope);
    assert.equal(evidence.list().length, 1);
  });

  it('2. wrong customer mandate rejected', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const mandate = activeMandate('id_b');
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '002'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected failure');
    }
    assert.equal(created.error.code, 'MANDATE_CUSTOMER_MISMATCH');
  });

  it('3. expired mandate blocks activation', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const mandate = activeMandate('id_a', [], 'EXPIRED');
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '003'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
  });

  it('4. revoked mandate blocks new work', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const mandate = activeMandate('id_a', [], 'REVOKED');
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '004'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected failure');
    }
    assert.equal(created.error.code, 'MANDATE_REVOKED');
  });

  it('5. revocation does not erase prior evidence', () => {
    const clock = new FrozenClock(NOW);
    const evidence = new EvidenceVault(clock);
    const service = new HeliosWorkOrderBindingService({ clock, evidence });
    const workOrderId = workOrderIdFor('cust_a', '005');
    const mandate = activeMandate('id_a');
    const created = service.createWorkOrder({
      workOrderId,
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, true);
    const before = evidence.list().length;
    const revokedMandate = activeMandate('id_a', [], 'REVOKED');
    const effect = service.handleAuthorityRevocation(workOrderId, revokedMandate);
    assert.equal(effect.ok, true);
    assert.equal(evidence.list().length, before);
    assert.equal(service.store.decisionsForWorkOrder(workOrderId).length, 1);
  });

  it('6. smaller work order scope accepted', () => {
    const mandate = mandateWithCapitalCeiling('id_a', '100000');
    const permitted = mandatePermittedScopeFromCompiled(mandate);
    const intersection = intersectWorkOrderScope({
      requested: baseScope({ capitalCeiling: { minorUnits: '50000', currency: 'USD' } }),
      mandate: permitted,
      capabilityPermitted: {
        activityClasses: baseScope().activityClasses,
        productClasses: baseScope().productClasses,
        objectiveClasses: baseScope().objectiveClasses,
      },
      approvalPermitted: null,
      platformPermitted: {
        activityClasses: baseScope().activityClasses,
        productClasses: baseScope().productClasses,
        objectiveClasses: baseScope().objectiveClasses,
      },
    });
    assert.equal(intersection.blocked, false);
    assert.equal(intersection.effective?.capitalCeiling?.minorUnits, '50000');
  });

  it('7. work order broader than mandate rejected', () => {
    const mandate = researchOnlyMandate('id_a');
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '007'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope({
        objectiveClasses: Object.freeze(['FINANCIAL_PROPOSAL'] as const),
        activityClasses: Object.freeze(['FINANCIAL_PROPOSAL'] as const),
      }),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
  });

  it('8. capital ceiling cannot exceed mandate', () => {
    const mandate = mandateWithCapitalCeiling('id_a', '100000');
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '008'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope({ capitalCeiling: { minorUnits: '150000', currency: 'USD' } }),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected failure');
    }
    assert.equal(created.error.code, 'CAPITAL_CEILING_EXCEEDED');
  });

  it('9. product class cannot exceed mandate/capability', () => {
    const mandate = equitiesOnlyMandate('id_a');
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '009'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope({ productClasses: Object.freeze(['CRYPTO'] as const) }),
      mandate,
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
  });

  it('10. disabled capability fails closed', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '010'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', ['VIEW_ACCOUNT'], {
        VIEW_GROWTH_PLAN: 'DISABLED',
      }),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected failure');
    }
    assert.equal(created.error.code, 'CAPABILITY_DISABLED');
  });

  it('11. unknown capability does not become enabled', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '011'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', []),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected failure');
    }
    assert.equal(created.error.code, 'CAPABILITY_UNKNOWN');
  });

  it('12. required approval absent blocks', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '012'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'EXPLICIT_STEP_UP',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected failure');
    }
    assert.equal(created.error.code, 'APPROVAL_MISSING');
  });

  it('13. AI cannot approve', () => {
    const scope = baseScope();
    const approval = createWorkOrderApprovalRef({
      workOrderId: workOrderIdFor('cust_a', '013'),
      approvalId: 'apr_013',
      customerId: asCustomerId('cust_a'),
      actorId: 'agent_bot',
      actorKind: 'AGENT' as never,
      approvalClass: 'EXPLICIT_STEP_UP',
      approvedScope: scope,
      now: NOW,
    });
    assert.equal('code' in approval, true);
    if (!('code' in approval)) {
      throw new Error('expected failure object');
    }
    assert.equal(approval.code, 'AGENT_CANNOT_APPROVE');
  });

  it('14. approval belonging to another customer rejected', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const scope = baseScope();
    const approval = createWorkOrderApprovalRef({
      workOrderId: workOrderIdFor('cust_a', '014'),
      approvalId: 'apr_014',
      customerId: asCustomerId('cust_b'),
      actorId: 'actor_b',
      actorKind: 'CUSTOMER',
      approvalClass: 'EXPLICIT_STEP_UP',
      approvedScope: scope,
      now: NOW,
    });
    if ('code' in approval) {
      throw new Error('approval should be created');
    }
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '014'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: scope,
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: approval,
      requiredApprovalClass: 'EXPLICIT_STEP_UP',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, false);
    if (created.ok) {
      throw new Error('expected failure');
    }
    assert.equal(created.error.code, 'APPROVAL_CUSTOMER_MISMATCH');
  });

  it('15. material scope increase invalidates prior approval', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const scope = baseScope({ capitalCeiling: { minorUnits: '50000', currency: 'USD' } });
    const approval = createWorkOrderApprovalRef({
      workOrderId: workOrderIdFor('cust_a', '015'),
      approvalId: 'apr_015',
      customerId: asCustomerId('cust_a'),
      actorId: 'actor_a',
      actorKind: 'CUSTOMER',
      approvalClass: 'EXPLICIT_STEP_UP',
      approvedScope: scope,
      now: NOW,
    });
    if ('code' in approval) {
      throw new Error('approval');
    }
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '015'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: scope,
      mandate: mandateWithCapitalCeiling('id_a', '200000'),
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: approval,
      requiredApprovalClass: 'EXPLICIT_STEP_UP',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, true);
    const amended = service.amendScope(
      workOrderIdFor('cust_a', '015'),
      baseScope({ capitalCeiling: { minorUnits: '150000', currency: 'USD' } }),
      mandateWithCapitalCeiling('id_a', '200000'),
      capabilityContext('cust_a', FULL_CAPS),
      'actor_a',
      approval,
    );
    assert.equal(amended.ok, false);
    if (amended.ok) {
      throw new Error('expected failure');
    }
    assert.equal(amended.error.code, 'APPROVAL_INVALIDATED');
    assert.equal(detectMaterialScopeChange(scope, baseScope({ capitalCeiling: { minorUnits: '150000', currency: 'USD' } })).material, true);
  });

  it('16. concurrent authority update cannot result in widened scope', () => {
    const mandate = mandateWithCapitalCeiling('id_a', '100000');
    const permitted = mandatePermittedScopeFromCompiled(mandate);
    const first = intersectWorkOrderScope({
      requested: baseScope({ capitalCeiling: { minorUnits: '80000', currency: 'USD' } }),
      mandate: permitted,
      capabilityPermitted: {
        activityClasses: baseScope().activityClasses,
        productClasses: baseScope().productClasses,
        objectiveClasses: baseScope().objectiveClasses,
      },
      approvalPermitted: null,
      platformPermitted: {
        activityClasses: baseScope().activityClasses,
        productClasses: baseScope().productClasses,
        objectiveClasses: baseScope().objectiveClasses,
      },
    });
    const tighterMandate = mandateWithCapitalCeiling('id_a', '50000');
    const second = intersectWorkOrderScope({
      requested: baseScope({ capitalCeiling: { minorUnits: '80000', currency: 'USD' } }),
      mandate: mandatePermittedScopeFromCompiled(tighterMandate),
      capabilityPermitted: {
        activityClasses: baseScope().activityClasses,
        productClasses: baseScope().productClasses,
        objectiveClasses: baseScope().objectiveClasses,
      },
      approvalPermitted: null,
      platformPermitted: {
        activityClasses: baseScope().activityClasses,
        productClasses: baseScope().productClasses,
        objectiveClasses: baseScope().objectiveClasses,
      },
    });
    assert.equal(first.effective?.capitalCeiling?.minorUnits, '80000');
    assert.equal(second.effective?.capitalCeiling?.minorUnits, '50000');
  });

  it('17. restart preserves references/history', () => {
    const clock = new FrozenClock(NOW);
    const storeA = new HeliosWorkOrderBindingService({ clock }).store;
    const serviceA = new HeliosWorkOrderBindingService({ clock, store: storeA });
    const workOrderId = workOrderIdFor('cust_a', '017');
    const created = serviceA.createWorkOrder({
      workOrderId,
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, true);
    const storeB = new HeliosWorkOrderBindingService({ clock }).store;
    storeB.hydrate({
      workOrders: storeA.listWorkOrdersForCustomer(asCustomerId('cust_a')),
      decisions: storeA.decisionsForWorkOrder(workOrderId),
    });
    const serviceB = new HeliosWorkOrderBindingService({ clock, store: storeB });
    const revalidated = serviceB.revalidateAtCheckpoint(
      workOrderId,
      activeMandate('id_a'),
      capabilityContext('cust_a', FULL_CAPS),
      'RESUME',
      'actor_a',
    );
    assert.equal(revalidated.ok, true);
    const hydrated = storeB.getWorkOrder(workOrderId);
    assert.ok(hydrated);
    assert.equal(hydrated.mandateRef.mandateId, created.ok ? created.value.mandateRef.mandateId : '');
    assert.equal(storeB.decisionsForWorkOrder(workOrderId).length, 2);
  });

  it('18. revocation during queued work prevents new dependent dispatch', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const workOrderId = workOrderIdFor('cust_a', '018');
    const created = service.createWorkOrder({
      workOrderId,
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, true);
    const activation = service.activateWorkOrder(
      workOrderId,
      activeMandate('id_a'),
      capabilityContext('cust_a', FULL_CAPS),
      'actor_a',
    );
    assert.equal(activation.ok, true);
    const revoked = service.handleAuthorityRevocation(workOrderId, activeMandate('id_a', [], 'REVOKED'));
    assert.equal(revoked.ok, true);
    if (!revoked.ok) {
      throw new Error('revoked');
    }
    assert.equal(revoked.value.state, 'REVOKED');
    const dispatch = service.revalidateAtCheckpoint(
      workOrderId,
      activeMandate('id_a', [], 'REVOKED'),
      capabilityContext('cust_a', FULL_CAPS),
      'TASK_DISPATCH',
      'actor_a',
    );
    assert.equal(dispatch.ok, false);
  });

  it('19. customer isolation across all binding objects', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const workOrderId = workOrderIdFor('cust_a', '019');
    const created = service.createWorkOrder({
      workOrderId,
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope(),
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, true);
    const crossCustomer = service.activateWorkOrder(
      workOrderId,
      activeMandate('id_a'),
      capabilityContext('cust_b', FULL_CAPS),
      'actor_b',
    );
    assert.equal(crossCustomer.ok, false);
    const copiedId = service.store.getWorkOrder(workOrderIdFor('cust_b', '019'));
    assert.equal(copiedId, undefined);
  });

  it('20. work order has no direct financial execution authority', () => {
    const clock = new FrozenClock(NOW);
    const service = new HeliosWorkOrderBindingService({ clock });
    const created = service.createWorkOrder({
      workOrderId: workOrderIdFor('cust_a', '020'),
      customerId: asCustomerId('cust_a'),
      subjectId: 'id_a',
      growObjectiveId: 'grow_obj_1',
      requestedScope: baseScope({
        objectiveClasses: Object.freeze(['FINANCIAL_PROPOSAL'] as const),
        activityClasses: Object.freeze(['FINANCIAL_PROPOSAL'] as const),
      }),
      mandate: activeMandate('id_a'),
      capabilityContext: capabilityContext('cust_a', FULL_CAPS),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      actorId: 'actor_a',
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      throw new Error('create');
    }
    assert.equal(created.value.grantsExecutionAuthority, false);
    assert.equal(created.value.authorizesFinancialExecution, false);
    const findings = lintHeliosBoundary(process.cwd());
    assert.equal(findings.length, 0);
  });
});
