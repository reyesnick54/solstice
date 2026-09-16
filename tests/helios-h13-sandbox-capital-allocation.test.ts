import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { interpretMandateLanguage } from '../packages/agent/src/interpretation.ts';
import {
  ENVIRONMENT,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
} from '../packages/config/src/flags.ts';
import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import type { IdentityCapability } from '../packages/identity/src/capability.ts';
import { SimulatedIdentityAdapter } from '../packages/identity/src/simulation.ts';
import { asAccountId } from '../packages/domain/src/account.ts';
import { Money } from '../packages/money/src/money.ts';
import { asIntentId } from '../packages/permissions/src/action-intent.ts';
import { ACTION_TYPES } from '../packages/permissions/src/action-types.ts';
import { createSimulationKeyProvider } from '../packages/security/src/simulation.ts';
import type { CapabilityBindingContext } from '../packages/platform/src/helios/index.ts';
import { compileEconomicMandate, mandateDraftFromInterpretation } from '../packages/platform/src/mandate/compiler.ts';
import type { CompiledEconomicMandate } from '../packages/platform/src/mandate/types.ts';
import {
  AuthorityBoundWorkOrderService,
  GrowSandboxAllocationService,
  InMemoryGrowSandboxAllocationStore,
} from '../packages/platform/src/work-order/index.ts';
import type { CreateEconomicWorkOrderInput } from '../packages/platform/src/work-order/types.ts';
import { asGrowthPlanId, asGrowthPlanVersion, asMandateVersion } from '../packages/platform/src/ids.ts';
import { createSimulationRuntime } from '../services/accounts/src/index.ts';
import { GrowSandboxAllocationAdapter } from '../services/api/src/consumer/grow-sandbox-allocation-adapter.ts';
import type { SimulationRuntime } from '../services/accounts/src/runtime.ts';
import { activateCustomer, openIntent } from '../services/accounts/src/test-helpers.ts';
import { lintGrowthBoundary } from '../tools/architectural-linter/src/growth-guards.ts';

const NOW = asUtcInstant('2026-09-16T15:00:00.000Z');
const EXPIRES = asUtcInstant('2026-10-16T15:00:00.000Z');

function deposit(runtime: SimulationRuntime, accountId: string, amount: bigint, currency: string, key: string) {
  return runtime.money.deposit({
    id: asIntentId(key),
    actionType: ACTION_TYPES.POST_DEPOSIT,
    idempotencyKey: key,
    actorId: 'operator_1',
    requestedAt: NOW,
    purpose: 'CUSTOMER_FUNDING',
    payload: { accountId: asAccountId(accountId), amount: Money.fromMinorUnits(amount, currency) },
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

function allocatableMandate(subjectId: string): CompiledEconomicMandate {
  const base = activeMandate(subjectId);
  return Object.freeze({
    ...base,
    hardConstraints: Object.freeze(
      base.hardConstraints.filter(
        (item) =>
          item.kind !== 'NEVER_SPEND_BELOW_LIQUIDITY_FLOOR' && item.kind !== 'MINIMUM_CASH_RESERVE',
      ),
    ),
  });
}

function mandateWithSingleActionLimit(
  subjectId: string,
  limitMinorUnits: string,
): CompiledEconomicMandate {
  const base = allocatableMandate(subjectId);
  return Object.freeze({
    ...base,
    hardConstraints: Object.freeze([
      ...base.hardConstraints,
      Object.freeze({
        constraintId: 'emc_max_single_h13',
        kind: 'MAXIMUM_SINGLE_PROPOSED_ACTION_AMOUNT',
        amount: { minorUnits: limitMinorUnits, currency: 'USD' },
        overrideForbidden: true,
      }),
    ]),
  });
}

function accountPosition(world: ReturnType<typeof setupWorld>) {
  const position = world.runtime.accountProduct.balanceOf(world.accountId);
  assert.equal(position.ok, true);
  if (!position.ok) {
    throw new Error(position.error.message);
  }
  return position.value;
}

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
    contextVersion: 'cap_ctx_h13',
  });
}

function coordinationInput(
  subjectId: string,
  customerId: string,
  accountId: string,
  idempotencyKey: string,
  mandate: CompiledEconomicMandate,
  envelopeMinorUnits = '1000000',
): CreateEconomicWorkOrderInput {
  return {
    subjectId,
    customerId,
    idempotencyKey,
    planId: asGrowthPlanId('gpl_h13'),
    planVersion: asGrowthPlanVersion(1),
    objectiveReference: 'grow_obj_h13',
    objective: {
      description: 'Grow sandbox allocation within mandate bounds',
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
      capabilityContextReference: 'cap_ctx_h13',
      jurisdiction: 'US',
      legalEntityId: null,
    },
    capitalBoundary: {
      maxCapitalEnvelope: { minorUnits: envelopeMinorUnits, currency: 'USD' },
      accountId,
      portfolioId: null,
      liquidityRetentionReference: 'mandate_liquidity_floor',
      isBalance: false,
      isAuthorizationEnvelope: true,
    },
    researchBoundary: {
      budgetReference: 'research_budget_h13',
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

function defaultContext(mandate: CompiledEconomicMandate) {
  return {
    mandate,
    capabilityContext: capabilityContext('cust_h13_a'),
    approvalRef: null,
    riskFacts: {
      kycComplete: true,
      jurisdictionPermitted: true,
      accountRestricted: false,
      customerEligible: true,
      riskProfile: 'MODERATE' as const,
      proposalRiskClass: 'MODERATE' as const,
    },
    complianceFacts: {
      suitability: 'SUITABLE' as const,
      kernelPolicy: 'ALLOW' as const,
      jurisdictionPermitted: true,
      kycComplete: true,
      accountRestricted: false,
      providerAvailable: true,
      productAvailable: true,
    },
    actorId: 'actor_h13_a',
  };
}

function setupWorld(balanceMinorUnits = 1_000_000n) {
  const clock = new FrozenClock(NOW);
  const keys = createSimulationKeyProvider({ clock: { now: () => clock.now() } });
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const identity = new SimulatedIdentityAdapter({ clock, keys, events });
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'actor_h13_a',
      jurisdiction: asJurisdiction('US'),
      identityId: 'subj_h13_a',
      customerId: asCustomerId('cust_h13_a'),
      capabilities: ['VIEW_GROWTH_PLAN', 'OPERATE_GROWTH_ORCHESTRATOR', 'CONFIRM_ECONOMIC_MANDATE'],
    }).ok,
    true,
  );
  assert.equal(
    identity.provisionSimulatedActor({
      actorId: 'actor_h13_b',
      jurisdiction: asJurisdiction('US'),
      identityId: 'subj_h13_b',
      customerId: asCustomerId('cust_h13_b'),
      capabilities: ['VIEW_GROWTH_PLAN', 'OPERATE_GROWTH_ORCHESTRATOR', 'CONFIRM_ECONOMIC_MANDATE'],
    }).ok,
    true,
  );
  const actorA = identity.service.resolveActorContext('actor_h13_a');
  const actorB = identity.service.resolveActorContext('actor_h13_b');
  if (!actorA.ok || !actorB.ok) {
    throw new Error('actor');
  }
  const runtime = createSimulationRuntime({ clock });
  const customerA = activateCustomer(runtime, 'cust_h13_a');
  const customerB = activateCustomer(runtime, 'cust_h13_b');
  const openedA = runtime.accountsService.open(
    openIntent({ id: 'open_h13_a', accountId: 'acct_h13_a', ownerId: customerA.id }),
  );
  const openedB = runtime.accountsService.open(
    openIntent({ id: 'open_h13_b', accountId: 'acct_h13_b', ownerId: customerB.id }),
  );
  assert.equal(openedA.outcome, 'OPENED');
  assert.equal(openedB.outcome, 'OPENED');
  if (openedA.outcome !== 'OPENED' || openedB.outcome !== 'OPENED') {
    throw new Error('open');
  }
  if (balanceMinorUnits > 0n) {
    assert.equal(deposit(runtime, openedA.account.id, balanceMinorUnits, 'USD', 'dep_h13_a').outcome, 'POSTED');
  }
  const mandate = activeMandate('subj_h13_a');
  const authority = new AuthorityBoundWorkOrderService({ clock, events, evidence });
  const adapter = new GrowSandboxAllocationAdapter({
    ledger: runtime.ledger,
    holds: runtime.holds,
    accounts: runtime.accounts,
    clock,
  });
  const allocationService = new GrowSandboxAllocationService({
    clock,
    evidence,
    funds: adapter,
    reservations: adapter,
    authority,
  });
  return {
    clock,
    evidence,
    runtime,
    actorA: actorA.value,
    actorB: actorB.value,
    mandate,
    authority,
    allocationService,
    accountId: openedA.account.id,
    customerA: customerA.id,
    customerB: customerB.id,
  } as {
    clock: FrozenClock;
    evidence: EvidenceVault;
    runtime: ReturnType<typeof createSimulationRuntime>;
    actorA: (typeof actorA)['value'];
    actorB: (typeof actorB)['value'];
    mandate: CompiledEconomicMandate;
    authority: AuthorityBoundWorkOrderService;
    allocationService: GrowSandboxAllocationService;
    accountId: string;
    customerA: string;
    customerB: string;
  };
}

async function activateWorkOrder(
  world: ReturnType<typeof setupWorld>,
  idempotencyKey: string,
  customerId = 'cust_h13_a',
  accountId = 'acct_h13_a',
  envelopeMinorUnits = '1000000',
) {
  const created = world.authority.createWithAuthority(
    world.actorA,
    coordinationInput('subj_h13_a', customerId, accountId, idempotencyKey, world.mandate, envelopeMinorUnits),
    {
      mandate: world.mandate,
      capabilityContext: capabilityContext(customerId),
      approvalRef: null,
      requiredApprovalClass: 'NONE',
      growObjectiveId: 'grow_obj_h13',
    },
    'actor_h13_a',
  );
  assert.equal(created.ok, true);
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  const activated = world.authority.activateWithAuthority(
    world.actorA,
    created.value.coordination.workOrderId,
    customerId,
    {
      mandate: world.mandate,
      capabilityContext: capabilityContext(customerId),
      approvalRef: null,
    },
    'actor_h13_a',
  );
  assert.equal(activated.ok, true);
  if (!activated.ok) {
    throw new Error(activated.error.message);
  }
  return activated.value.coordination;
}

describe('HELIOS H13 — sandbox capital allocation', () => {
  it('architecture guard: allocation service does not post journals', () => {
    const findings = lintGrowthBoundary('packages/platform/src/work-order/sandbox-allocation/service.ts');
    assert.equal(findings.length, 0);
  });

  it('1. valid sandbox allocation reserves canonical cash', async () => {
    const world = setupWorld(1_000_000n);
    const workOrder = await activateWorkOrder(world, 'wo_h13_valid');
    const result = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_valid_1',
        executionMode: 'SANDBOX',
      },
      defaultContext(world.mandate),
    );
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.value.status, 'RESERVED');
    assert.equal(result.value.reservedAmountMinorUnits, '100000');
    assert.equal(result.value.executionMode, 'SANDBOX');
    assert.equal(result.value.environment, 'simulation');
    assert.equal(result.value.postsLedger, false);
    assert.equal(result.value.createsFinancialAuthority, false);
    assert.equal(result.value.impliesLiveProvider, false);
    assert.ok(result.value.holdId);
    const position = accountPosition(world);
    assert.equal(position.available.minorUnits, 900_000n);
    assert.equal(position.held.minorUnits, 100_000n);
  });

  it('2. insufficient funds refuses without reservation', async () => {
    const world = setupWorld(0n);
    world.mandate = allocatableMandate('subj_h13_a');
    const workOrder = await activateWorkOrder(world, 'wo_h13_insufficient');
    const result = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '500000', currency: 'USD' },
        idempotencyKey: 'alloc_insufficient',
        executionMode: 'PAPER',
      },
      defaultContext(world.mandate),
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'INSUFFICIENT_FUNDS');
    assert.equal(world.runtime.holds.list().length, 0);
  });

  it('3. retained liquidity blocks allocation below mandate floor', async () => {
    const world = setupWorld(800_000n);
    const workOrder = await activateWorkOrder(world, 'wo_h13_liquidity');
    const result = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_liquidity',
        executionMode: 'SANDBOX',
      },
      defaultContext(world.mandate),
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'LIQUIDITY_RETAINED');
  });

  it('4. wrong customer/account is rejected', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_wrong_customer');
    const result = await world.allocationService.requestAllocation(
      world.actorB,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_b',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_wrong_customer',
        executionMode: 'SANDBOX',
      },
      {
        ...defaultContext(world.mandate),
        capabilityContext: capabilityContext('cust_h13_b'),
      },
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'WORK_ORDER_CUSTOMER_MISMATCH');
  });

  it('5. wrong currency is rejected', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_currency');
    const result = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'EUR' },
        idempotencyKey: 'alloc_currency',
        executionMode: 'SANDBOX',
      },
      defaultContext(world.mandate),
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'CURRENCY_MISMATCH');
  });

  it('6. mandate limit blocks oversized allocation', async () => {
    const world = setupWorld(2_000_000n);
    world.mandate = mandateWithSingleActionLimit('subj_h13_a', '100000');
    const workOrder = await activateWorkOrder(world, 'wo_h13_mandate', 'cust_h13_a', 'acct_h13_a', '100000');
    const result = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '150000', currency: 'USD' },
        idempotencyKey: 'alloc_mandate',
        executionMode: 'SANDBOX',
      },
      defaultContext(world.mandate),
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'MANDATE_LIMIT');
  });

  it('7. risk refusal blocks allocation', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_risk');
    const result = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_risk',
        executionMode: 'SANDBOX',
      },
      {
        ...defaultContext(world.mandate),
        riskFacts: {
          kycComplete: true,
          jurisdictionPermitted: true,
          accountRestricted: false,
          customerEligible: true,
          riskProfile: 'LOW',
          proposalRiskClass: 'HIGH',
        },
      },
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'RISK_REFUSED');
  });

  it('8. compliance refusal blocks allocation', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_compliance');
    const result = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_compliance',
        executionMode: 'SANDBOX',
      },
      {
        ...defaultContext(world.mandate),
        complianceFacts: {
          suitability: 'SUITABLE',
          kernelPolicy: 'BLOCK',
          jurisdictionPermitted: true,
          kycComplete: true,
          accountRestricted: false,
          providerAvailable: true,
          productAvailable: true,
        },
      },
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.error.code, 'COMPLIANCE_REFUSED');
  });

  it('9. concurrent allocations cannot over-reserve available cash', async () => {
    const world = setupWorld(1_000_000n);
    const workOrderA = await activateWorkOrder(world, 'wo_h13_conc_a');
    const workOrderB = await activateWorkOrder(world, 'wo_h13_conc_b');
    const [first, second] = await Promise.all([
      world.allocationService.requestAllocation(
        world.actorA,
        {
          workOrderId: workOrderA.workOrderId,
          customerId: 'cust_h13_a',
          requestedAmount: { minorUnits: '700000', currency: 'USD' },
          idempotencyKey: 'alloc_conc_a',
          executionMode: 'SANDBOX',
        },
        defaultContext(world.mandate),
      ),
      world.allocationService.requestAllocation(
        world.actorA,
        {
          workOrderId: workOrderB.workOrderId,
          customerId: 'cust_h13_a',
          requestedAmount: { minorUnits: '700000', currency: 'USD' },
          idempotencyKey: 'alloc_conc_b',
          executionMode: 'SANDBOX',
        },
        defaultContext(world.mandate),
      ),
    ]);
    const successes = [first, second].filter((result) => result.ok);
    assert.ok(successes.length >= 1);
    const totalReserved = successes.reduce(
      (sum, result) => sum + BigInt(result.ok ? result.value.reservedAmountMinorUnits : '0'),
      0n,
    );
    assert.ok(totalReserved <= 200_000n);
    const position = accountPosition(world);
    assert.equal(position.held.minorUnits, totalReserved);
    assert.equal(position.available.minorUnits, 1_000_000n - totalReserved);
  });

  it('10. duplicate request is idempotent', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_idem');
    const input = {
      workOrderId: workOrder.workOrderId,
      customerId: 'cust_h13_a',
      requestedAmount: { minorUnits: '100000', currency: 'USD' },
      idempotencyKey: 'alloc_idem',
      executionMode: 'SANDBOX' as const,
    };
    const first = await world.allocationService.requestAllocation(
      world.actorA,
      input,
      defaultContext(world.mandate),
    );
    const second = await world.allocationService.requestAllocation(
      world.actorA,
      input,
      defaultContext(world.mandate),
    );
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }
    assert.equal(first.value.allocationId, second.value.allocationId);
    assert.equal(world.runtime.holds.list().length, 1);
  });

  it('11. reservation release restores available cash', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_release');
    const allocated = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '200000', currency: 'USD' },
        idempotencyKey: 'alloc_release',
        executionMode: 'PAPER',
      },
      defaultContext(world.mandate),
    );
    assert.equal(allocated.ok, true);
    if (!allocated.ok) {
      return;
    }
    const released = await world.allocationService.releaseAllocation({
      allocationId: allocated.value.allocationId,
      customerId: 'cust_h13_a',
      reason: 'proposal rejected before paper action',
    });
    assert.equal(released.ok, true);
    if (!released.ok) {
      return;
    }
    assert.equal(released.value.status, 'RELEASED');
    assert.equal(released.value.reservedAmountMinorUnits, '0');
    const position = accountPosition(world);
    assert.equal(position.held.minorUnits, 0n);
    assert.equal(position.available.minorUnits, 1_000_000n);
  });

  it('12. restart persistence preserves allocation and reservation semantics', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_restart');
    const allocated = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '150000', currency: 'USD' },
        idempotencyKey: 'alloc_restart',
        executionMode: 'SANDBOX',
      },
      defaultContext(world.mandate),
    );
    assert.equal(allocated.ok, true);
    if (!allocated.ok) {
      return;
    }
    const snapshot = world.allocationService.store.snapshot();
    const restartedStore = new InMemoryGrowSandboxAllocationStore();
    restartedStore.hydrate(snapshot);
    const reloaded = restartedStore.get(allocated.value.allocationId, 'cust_h13_a');
    assert.ok(reloaded);
    assert.equal(reloaded?.reservedAmountMinorUnits, '150000');
    assert.equal(reloaded?.holdId, allocated.value.holdId);
    assert.equal(world.runtime.holds.getByIdempotencyKey('alloc_restart')?.amountMinorUnits, 150_000n);
  });

  it('13. allocation record is not a shadow balance', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_shadow');
    const allocated = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_shadow',
        executionMode: 'SANDBOX',
      },
      defaultContext(world.mandate),
    );
    assert.equal(allocated.ok, true);
    if (!allocated.ok) {
      return;
    }
    const ledgerBalance = accountPosition(world).posted;
    assert.equal(ledgerBalance.minorUnits, 1_000_000n);
    assert.notEqual(allocated.value.availableAtRequestMinorUnits, allocated.value.reservedAmountMinorUnits);
    assert.equal(Object.hasOwn(allocated.value, 'balance'), false);
  });

  it('14. reservation does not create realized P&L', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_pnl');
    const allocated = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_pnl',
        executionMode: 'SANDBOX',
      },
      defaultContext(world.mandate),
    );
    assert.equal(allocated.ok, true);
    if (!allocated.ok) {
      return;
    }
    assert.equal(world.runtime.growth.list().length, 0);
    assert.equal(world.runtime.ledger.listJournals().length, 1);
  });

  it('15. allocation retains sandbox/paper semantics only', async () => {
    const world = setupWorld();
    const workOrder = await activateWorkOrder(world, 'wo_h13_paper');
    const allocated = await world.allocationService.requestAllocation(
      world.actorA,
      {
        workOrderId: workOrder.workOrderId,
        customerId: 'cust_h13_a',
        requestedAmount: { minorUnits: '100000', currency: 'USD' },
        idempotencyKey: 'alloc_paper',
        executionMode: 'PAPER',
      },
      defaultContext(world.mandate),
    );
    assert.equal(allocated.ok, true);
    if (!allocated.ok) {
      return;
    }
    assert.equal(allocated.value.executionMode, 'PAPER');
    assert.equal(allocated.value.impliesLiveProvider, false);
    assert.equal(allocated.value.environment, 'simulation');
  });

  it('16. production/live flags remain OFF', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
  });
});
