import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { asDecisionValidityEnvelopeId } from '../packages/platform/src/helios/decision-validity/ids.ts';
import {
  CAPITAL_LIFECYCLE_ORDER_STATUSES,
  HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN,
  HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED,
  HeliosExecutionPlanService,
  InMemoryHeliosExecutionPlanStore,
  evaluateM21Qualification,
  type CreateExecutionPlanInput,
  type CreateExecutionPlanLegInput,
  type ExecutionPlanConstraints,
  type ExecutionPlanId,
  type ExecutionPlanValidationPorts,
  type M21QualificationChecks,
} from '../packages/platform/src/helios/execution-plan/index.ts';
import { workOrderIdFor } from '../packages/platform/src/helios/ids.ts';
import { strategyCapsuleIdFor } from '../packages/platform/src/helios/strategy-capsule/ids.ts';
import type { StrategyCapsuleRef } from '../packages/platform/src/helios/strategy-capsule/types.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-21T10:00:00.000Z');
const VALID_UNTIL = asUtcInstant('2026-09-21T12:00:00.000Z');
const EXPIRED_UNTIL = asUtcInstant('2026-09-21T09:00:00.000Z');

function defaultConstraints(overrides: Partial<ExecutionPlanConstraints> = {}): ExecutionPlanConstraints {
  return Object.freeze({
    venueProvider: Object.freeze({
      permittedProviders: Object.freeze(['sandbox_helios_investment_v1']),
      excludedProviders: Object.freeze([]),
      preferredProvider: 'sandbox_helios_investment_v1',
      routePolicyVersion: 'helios.route.v1',
      ...(overrides.venueProvider ?? {}),
    }),
    orderStyle: Object.freeze({
      orderIntent: 'LIMIT_REQUIRED' as const,
      allowPartialFills: true,
      minimumFillRatioBps: null,
      ...(overrides.orderStyle ?? {}),
    }),
    price: Object.freeze({
      limitPriceMinorUnits: '4500000',
      maxPriceMinorUnits: null,
      minPriceMinorUnits: null,
      referencePriceMinorUnits: '4490000',
      priceBandBps: 50,
      ...(overrides.price ?? {}),
    }),
    time: Object.freeze({
      validFrom: NOW,
      validUntil: VALID_UNTIL,
      sessionOnly: true,
      avoidAuctionPeriods: true,
      ...(overrides.time ?? {}),
    }),
    slippage: Object.freeze({
      maxSlippageBps: 25,
      estimatedSlippageBps: 8,
      ...(overrides.slippage ?? {}),
    }),
    spread: Object.freeze({
      maxSpreadBps: 15,
      referenceSpreadBps: 5,
      ...(overrides.spread ?? {}),
    }),
    liquidity: Object.freeze({
      minimumLiquidityScoreBps: 7000,
      maxParticipationRateBps: 500,
      averageDailyVolumeMinor: '50000000',
      ...(overrides.liquidity ?? {}),
    }),
  });
}

function capsule(workOrderId: ReturnType<typeof workOrderIdFor>, key = 'm21'): StrategyCapsuleRef {
  return Object.freeze({
    capsuleId: strategyCapsuleIdFor(workOrderId, key),
    version: '1.0.0',
    contentHash: 'sha256_capsule_m21_v1',
    promotionState: 'PROMOTED',
    qualificationState: 'QUALIFIED',
    validUntil: asUtcInstant('2026-12-31T00:00:00.000Z'),
    modelDependencies: Object.freeze(['mdl_s3m']),
    policyVersion: 'helios-strategy-capsule-v1',
    grantsExecutionAuthority: false as const,
  });
}

type ValidationState = {
  envelopeValid: boolean;
  mandateActive: boolean;
  instrumentExecutable: boolean;
  marketStateValid: boolean;
  riskApproved: boolean;
  complianceApproved: boolean;
  capitalReserved: boolean;
  providerCapable: boolean;
  strategyVersionMatches: boolean;
  withinApprovedSize: boolean;
};

function defaultValidation(state: Partial<ValidationState> = {}): ExecutionPlanValidationPorts {
  const s: ValidationState = {
    envelopeValid: true,
    mandateActive: true,
    instrumentExecutable: true,
    marketStateValid: true,
    riskApproved: true,
    complianceApproved: true,
    capitalReserved: true,
    providerCapable: true,
    strategyVersionMatches: true,
    withinApprovedSize: true,
    ...state,
  };
  return Object.freeze({
    envelopeValid: () => s.envelopeValid,
    mandateActive: () => s.mandateActive,
    instrumentExecutable: () => s.instrumentExecutable,
    marketStateValid: () => s.marketStateValid,
    riskApproved: () =>
      Object.freeze({
        approved: s.riskApproved,
        reference: s.riskApproved ? 'risk_auth_m21' : null,
      }),
    complianceApproved: () =>
      Object.freeze({
        approved: s.complianceApproved,
        reference: s.complianceApproved ? 'compliance_auth_m21' : null,
      }),
    capitalReserved: () =>
      Object.freeze({
        reserved: s.capitalReserved,
        reference: s.capitalReserved ? 'cap_res_m21' : null,
      }),
    providerCapable: () => s.providerCapable,
    strategyVersionMatches: () => s.strategyVersionMatches,
    withinApprovedSize: () => s.withinApprovedSize,
  });
}

function leg(
  overrides: Partial<CreateExecutionPlanLegInput> & Pick<CreateExecutionPlanLegInput, 'legId' | 'instrumentId' | 'assetClass'>,
): CreateExecutionPlanLegInput {
  return Object.freeze({
    legIndex: 0,
    direction: 'LONG',
    targetQuantityUnits: '100',
    targetNotionalMinorUnits: '4500000',
    maximumApprovedQuantityUnits: '100',
    maximumApprovedNotionalMinorUnits: '4500000',
    executionCurrency: 'USD',
    constraints: defaultConstraints(),
    ...overrides,
  });
}

function planInput(
  customerKey: string,
  legs: readonly CreateExecutionPlanLegInput[],
  overrides: Partial<CreateExecutionPlanInput> = {},
): CreateExecutionPlanInput {
  const customerId = asCustomerId(customerKey);
  const workOrderId = workOrderIdFor(customerKey, 'm21');
  const capsuleRef = capsule(workOrderId);
  return Object.freeze({
    customerId,
    mandateId: `mandate_${customerKey}`,
    workOrderId,
    opportunityId: `opp_${customerKey}`,
    strategyCapsuleRef: capsuleRef,
    envelopeId: asDecisionValidityEnvelopeId(`dve_${workOrderId}_opp_${customerKey}`),
    decisionValidUntil: VALID_UNTIL,
    legs,
    evidenceRefs: Object.freeze(['ev_m21_base']),
    idempotencyKey: `idem_${customerKey}`,
    now: NOW,
    ...overrides,
  });
}

type Harness = {
  readonly clock: FrozenClock;
  readonly service: HeliosExecutionPlanService;
  readonly validationState: ValidationState;
};

function createHarness(state: Partial<ValidationState> = {}): Harness {
  const clock = new FrozenClock(NOW);
  const evidence = new EvidenceVault(clock);
  const validationState: ValidationState = {
    envelopeValid: true,
    mandateActive: true,
    instrumentExecutable: true,
    marketStateValid: true,
    riskApproved: true,
    complianceApproved: true,
    capitalReserved: true,
    providerCapable: true,
    strategyVersionMatches: true,
    withinApprovedSize: true,
    ...state,
  };
  const service = new HeliosExecutionPlanService({
    clock,
    evidence,
    validation: defaultValidation(validationState),
  });
  return { clock, service, validationState };
}

function advanceToAuthorized(h: Harness, planId: ExecutionPlanId, customerId: ReturnType<typeof asCustomerId>) {
  assert.equal(h.service.approveRisk(planId, customerId, 'risk_1').ok, true);
  assert.equal(h.service.approveCompliance(planId, customerId, 'comp_1').ok, true);
  assert.equal(h.service.authorizePlan(planId, customerId, 'auth_1').ok, true);
}

describe('HELIOS Multi-Asset M21 — Universal Multi-Asset Execution Plan', () => {
  it('architecture guard: no competing HELIOS packages or authority bypass', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.deepEqual(findings, []);
  });

  it('single equity trade plan (long)', () => {
    const h = createHarness();
    const input = planInput('cust_m21_equity', [
      leg({ legId: 'leg_equity', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY', direction: 'LONG' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(created.value.legs.length, 1);
    assert.equal(created.value.legs[0]!.assetClass, 'EQUITY');
    assert.equal(created.value.legs[0]!.direction, 'LONG');
    assert.equal(created.value.status, 'DRAFT');
    assert.equal(created.value.grantsExecutionAuthority, false);
  });

  it('crypto trade plan', () => {
    const h = createHarness();
    const input = planInput('cust_m21_crypto', [
      leg({
        legId: 'leg_btc',
        legIndex: 0,
        instrumentId: 'inst_btc_usd',
        assetClass: 'CRYPTO',
        direction: 'LONG',
        constraints: defaultConstraints({
          orderStyle: Object.freeze({ orderIntent: 'MARKET_ALLOWED', allowPartialFills: true, minimumFillRatioBps: null }),
        }),
      }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(created.value.legs[0]!.assetClass, 'CRYPTO');
    assert.equal(created.value.legs[0]!.constraints.orderStyle.orderIntent, 'MARKET_ALLOWED');
  });

  it('futures trade plan (short where permitted)', () => {
    const h = createHarness();
    const input = planInput('cust_m21_futures', [
      leg({
        legId: 'leg_es',
        legIndex: 0,
        instrumentId: 'inst_es_dec26',
        assetClass: 'FUTURE',
        direction: 'SHORT',
        constraints: defaultConstraints({
          orderStyle: Object.freeze({ orderIntent: 'PASSIVE_PREFERRED', allowPartialFills: false, minimumFillRatioBps: 10000 }),
        }),
      }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(created.value.legs[0]!.direction, 'SHORT');
    assert.equal(created.value.legs[0]!.assetClass, 'FUTURE');
  });

  it('multi-leg stat-arb plan with coordination metadata', () => {
    const h = createHarness();
    const input = planInput(
      'cust_m21_statarb',
      [
        leg({ legId: 'leg_long', legIndex: 0, instrumentId: 'inst_xlk', assetClass: 'EQUITY', direction: 'LONG', hedgeRole: 'PRIMARY' }),
        leg({
          legId: 'leg_short',
          legIndex: 1,
          instrumentId: 'inst_xlv',
          assetClass: 'EQUITY',
          direction: 'SHORT',
          hedgeRole: 'HEDGE',
          targetQuantityUnits: '80',
          targetNotionalMinorUnits: '3600000',
          maximumApprovedQuantityUnits: '80',
          maximumApprovedNotionalMinorUnits: '3600000',
        }),
      ],
      {
        multiLegCoordination: Object.freeze({
          legOrdering: 'HEDGE_AFTER_PRIMARY',
          hedgeRelationships: Object.freeze(['leg_long hedges leg_short']),
          acceptableLegImbalanceBps: 150,
          timeoutMs: 30_000,
          unwindRequiredOnFailure: true,
          atomicityPreference: 'BEST_EFFORT',
        }),
        aiRecommendedCharacteristics: Object.freeze(['passive_entry_preferred']),
      },
    );
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(created.value.legs.length, 2);
    assert.ok(created.value.multiLegCoordination);
    assert.equal(created.value.multiLegCoordination!.unwindRequiredOnFailure, true);
    assert.equal(created.value.aiRecommendedCharacteristics.length, 1);
  });

  it('rejects expired Decision-Validity Envelope', () => {
    const h = createHarness();
    const input = planInput(
      'cust_m21_exp_env',
      [leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' })],
      { decisionValidUntil: EXPIRED_UNTIL, now: NOW },
    );
    const created = h.service.createPlan(input);
    assert.equal(created.ok, false);
    if (created.ok) throw new Error('expected failure');
    assert.equal(created.error.code, 'ENVELOPE_EXPIRED');
  });

  it('rejects missing risk approval on transition', () => {
    const h = createHarness({ riskApproved: false });
    const input = planInput('cust_m21_no_risk', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    const risk = h.service.approveRisk(created.value.executionPlanId, input.customerId, 'risk_fail');
    assert.equal(risk.ok, false);
    if (risk.ok) throw new Error('expected failure');
    assert.equal(risk.error.code, 'RISK_APPROVAL_MISSING');
  });

  it('rejects missing compliance approval on transition', () => {
    const h = createHarness({ complianceApproved: false });
    const input = planInput('cust_m21_no_comp', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(h.service.approveRisk(created.value.executionPlanId, input.customerId, 'risk_ok').ok, true);
    const compliance = h.service.approveCompliance(created.value.executionPlanId, input.customerId, 'comp_fail');
    assert.equal(compliance.ok, false);
    if (compliance.ok) throw new Error('expected failure');
    assert.equal(compliance.error.code, 'COMPLIANCE_APPROVAL_MISSING');
  });

  it('rejects insufficient capital at ready-for-routing', () => {
    const h = createHarness({ capitalReserved: false });
    const input = planInput('cust_m21_no_cap', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    void advanceToAuthorized(h, created.value.executionPlanId, input.customerId);
    const ready = h.service.markReadyForRouting(created.value.executionPlanId, input.customerId, 'ready_fail');
    assert.equal(ready.ok, false);
    if (ready.ok) throw new Error('expected failure');
    assert.equal(ready.error.code, 'CAPITAL_RESERVATION_MISSING');
  });

  it('rejects paused mandate', () => {
    const h = createHarness({ mandateActive: false });
    const input = planInput('cust_m21_pause', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, false);
    if (created.ok) throw new Error('expected failure');
    assert.equal(created.error.code, 'MANDATE_PAUSED');
  });

  it('rejects expired futures contract instrument', () => {
    const h = createHarness({ instrumentExecutable: false });
    const input = planInput('cust_m21_exp_fut', [
      leg({ legId: 'leg_exp', legIndex: 0, instrumentId: 'inst_es_expired', assetClass: 'FUTURE' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, false);
    if (created.ok) throw new Error('expected failure');
    assert.equal(created.error.code, 'INSTRUMENT_NOT_EXECUTABLE');
  });

  it('rejects stale market state', () => {
    const h = createHarness({ marketStateValid: false });
    const input = planInput('cust_m21_stale', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, false);
    if (created.ok) throw new Error('expected failure');
    assert.equal(created.error.code, 'MARKET_STATE_INVALID');
  });

  it('restart persistence round-trips plan and transition state', () => {
    const h = createHarness();
    const input = planInput('cust_m21_restart', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(h.service.approveRisk(created.value.executionPlanId, input.customerId, 'risk_restart').ok, true);

    const snapshot = h.service.store.snapshot();
    const restored = new InMemoryHeliosExecutionPlanStore();
    restored.restore(snapshot);
    const restarted = new HeliosExecutionPlanService({
      clock: h.clock,
      validation: defaultValidation(),
      store: restored,
    });
    const plan = restarted.store.getPlan(created.value.executionPlanId);
    assert.ok(plan);
    assert.equal(plan!.status, 'RISK_APPROVED');
    assert.equal(restarted.store.getTransitionsForPlan(created.value.executionPlanId).length, 1);
  });

  it('idempotent state transitions return same plan without duplicate records', () => {
    const h = createHarness();
    const input = planInput('cust_m21_idem', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    const first = h.service.approveRisk(created.value.executionPlanId, input.customerId, 'risk_idem');
    const second = h.service.approveRisk(created.value.executionPlanId, input.customerId, 'risk_idem');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) throw new Error('approve');
    assert.equal(first.value.executionPlanId, second.value.executionPlanId);
    assert.equal(h.service.store.getTransitionsForPlan(created.value.executionPlanId).length, 1);
  });

  it('customer isolation prevents cross-customer transitions', () => {
    const h = createHarness();
    const input = planInput('cust_m21_a', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    const other = h.service.approveRisk(created.value.executionPlanId, asCustomerId('cust_m21_b'), 'risk_x');
    assert.equal(other.ok, false);
    if (other.ok) throw new Error('expected failure');
    assert.equal(other.error.code, 'CUSTOMER_MISMATCH');
  });

  it('preserves downstream capital lifecycle order states taxonomy', () => {
    assert.deepEqual(CAPITAL_LIFECYCLE_ORDER_STATUSES, [
      'PROPOSED',
      'AUTHORIZED',
      'SUBMITTED',
      'ACKNOWLEDGED',
      'PARTIALLY_FILLED',
      'FILLED',
      'SETTLED',
      'RECONCILED',
      'AVAILABLE',
    ]);
  });

  it('AI recommendations are stored but do not authorize execution', () => {
    const h = createHarness();
    const input = planInput(
      'cust_m21_ai',
      [leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' })],
      { aiRecommendedCharacteristics: Object.freeze(['urgency_preferred', 'passive_limit']) },
    );
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    assert.equal(created.value.aiRecommendedCharacteristics.length, 2);
    assert.equal(created.value.grantsExecutionAuthority, false);
    assert.equal(created.value.authorizesFinancialExecution, false);
  });

  it('full lifecycle: draft through executed', () => {
    const h = createHarness();
    const input = planInput('cust_m21_full', [
      leg({ legId: 'leg_1', legIndex: 0, instrumentId: 'inst_spy', assetClass: 'EQUITY' }),
    ]);
    const created = h.service.createPlan(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    const planId = created.value.executionPlanId;
    const customerId = input.customerId;
    assert.equal(h.service.approveRisk(planId, customerId, 'r1').ok, true);
    assert.equal(h.service.approveCompliance(planId, customerId, 'c1').ok, true);
    assert.equal(h.service.authorizePlan(planId, customerId, 'a1').ok, true);
    assert.equal(h.service.markReadyForRouting(planId, customerId, 'rr1').ok, true);
    assert.equal(h.service.markRouted(planId, customerId, 'rt1').ok, true);
    assert.equal(h.service.markPartiallyExecuted(planId, customerId, 'pe1').ok, true);
    const executed = h.service.markExecuted(planId, customerId, 'ex1');
    assert.equal(executed.ok, true);
    if (!executed.ok) throw new Error('executed');
    assert.equal(executed.value.status, 'EXECUTED');
    assert.ok(executed.value.authorizationRefs.riskAuthorizationReference);
    assert.ok(executed.value.authorizationRefs.complianceAuthorizationReference);
    assert.ok(executed.value.authorizationRefs.capitalReservationReference);
  });

  it('HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED when all checks pass', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN, 'HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN');

    const checks: M21QualificationChecks = {
      singleEquityTradePlan: true,
      cryptoTradePlan: true,
      futuresTradePlan: true,
      longDirectionSupported: true,
      shortDirectionPermitted: true,
      multiLegStatArbPlan: true,
      expiredEnvelopeRejected: true,
      missingRiskApprovalRejected: true,
      missingComplianceApprovalRejected: true,
      insufficientCapitalRejected: true,
      pausedMandateRejected: true,
      expiredFuturesContractRejected: true,
      staleMarketRejected: true,
      restartPersistence: true,
      idempotentStateTransitions: true,
      customerIsolation: true,
      capitalLifecyclePreserved: true,
      noSecondExecutionAuthority: true,
      noSecondOrderManager: true,
      noSecondRiskEngine: true,
      aiCannotAuthorize: true,
      simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
    };

    const result = evaluateM21Qualification(checks);
    assert.equal(result.marker, HELIOS_MULTI_ASSET_M21_EXECUTION_PLAN_QUALIFIED, result.blockers.join('; '));
    assert.match(result.marker, /^HELIOS_MULTI_ASSET_M21_/);
  });
});
