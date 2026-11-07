/**
 * HELIOS EXEC04 — Pre-trade market access and execution safety firewall.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { evaluateMarketAccess } from '../packages/sunrey-exchange/src/regulated/market-access.ts';
import {
  buildPreTradeExecutionRequestFromHeliosOrder,
  deriveEffectiveCreditCapitalLimits,
  evaluateExec04PreTradeFirewallQualification,
  evaluatePreTradeExecutionFirewall,
  HELIOS_EXEC04_PRETRADE_FIREWALL_QUALIFIED,
  type PreTradeExecutionRequest,
} from '../packages/platform/src/helios/execution-connectivity/index.ts';
import {
  HeliosOrderLifecycleService,
  SandboxHeliosProviderPort,
  type CreateHeliosOrderInput,
  type HeliosCapitalPort,
  type HeliosOrderValidationPorts,
} from '../packages/platform/src/helios/order-lifecycle/index.ts';
import { workOrderIdFor } from '../packages/platform/src/helios/ids.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const T0 = asUtcInstant('2026-11-07T16:00:00.000Z');
const CUSTOMER = asCustomerId('cust_exec04');

function baseRequest(overrides: Partial<PreTradeExecutionRequest> = {}): PreTradeExecutionRequest {
  return Object.freeze({
    requestId: 'req_exec04_base',
    evaluatedAt: T0,
    customerId: CUSTOMER,
    accountId: 'acct_exec04',
    workOrderId: workOrderIdFor('cust_exec04', 'exec04'),
    proposalId: 'prop_exec04',
    envelopeId: null,
    providerRoute: 'sandbox_helios_investment_v1',
    environment: 'SANDBOX',
    jurisdiction: 'US',
    marketAccess: Object.freeze({ allowed: true, reasonCodes: Object.freeze(['ELIGIBLE']) }),
    order: Object.freeze({
      operationId: 'op_exec04',
      idempotencyKey: 'idem_exec04',
      side: 'BUY',
      positionEffect: 'OPEN_LONG',
      orderType: 'LIMIT',
      quantityUnits: 100n,
      notionalMinorUnits: 1_000_000n,
      limitPriceMinorUnits: 10_000n,
      currency: 'USD',
      instrumentId: 'inst_spy',
      instrumentAssetClass: 'ETF',
      instrumentDerivativeKind: 'NONE',
      optionCoverage: 'NOT_APPLICABLE',
      marginLeverageRequested: false,
      borrowedSharesRequired: false,
      borrowingCovered: true,
      restrictedSecurity: false,
    }),
    marketData: Object.freeze({
      authoritative: true,
      fresh: true,
      referencePriceMinor: 10_000n,
      observedAt: T0,
    }),
    marketSessionOpen: true,
    instrumentEligible: true,
    customerOwnsAccount: true,
    mandateActive: true,
    envelopeValid: true,
    kernelAuthorized: true,
    capitalReserved: true,
    capitalReservationId: 'rsv_exec04',
    sunreyLimits: Object.freeze({
      maxOrderNotionalMinor: 5_000_000n,
      maxOrderQuantity: 1_000n,
      maxParticipationRateBps: 500n,
      availableBuyingPowerMinor: 2_000_000n,
    }),
    brokerLimits: Object.freeze({
      maxOrderNotionalMinor: 3_000_000n,
      maxOrderQuantity: 2_000n,
      maxParticipationRateBps: 300n,
      availableBuyingPowerMinor: 4_000_000n,
    }),
    sunreyRisk: Object.freeze({
      consulted: true,
      outcome: 'ALLOW_SIMULATION',
      reasonCodes: Object.freeze([]),
      triggeredLimitIds: Object.freeze([]),
    }),
    brokerPreTradeRejection: null,
    dailyLossBreached: false,
    dailyLossReviewBand: false,
    strategyContributionBreached: false,
    duplicateOrderDetected: false,
    participationRateBps: 100n,
    liquidityConstraintViolated: false,
    priceCollarBps: 500n,
    fatFingerThresholdBps: 2_000n,
    structuredProductPosture: Object.freeze({
      shortSaleGoverned: false,
      shortSaleExternallyEnabled: false,
      marginLeverageGoverned: false,
      marginLeverageExternallyEnabled: false,
      derivativesGoverned: false,
      derivativesExternallyEnabled: false,
      nakedOptionsGoverned: false,
      nakedOptionsExternallyEnabled: false,
      uncoveredBorrowingGoverned: false,
      uncoveredBorrowingExternallyEnabled: false,
    }),
    simulationOnly: true,
    liveGatesEnabled: false,
    ...overrides,
  });
}

describe('HELIOS EXEC04 pre-trade execution firewall', () => {
  it('allows a clean sandbox order through all gates', () => {
    const decision = evaluatePreTradeExecutionFirewall(baseRequest());
    assert.equal(decision.outcome, 'ALLOW');
    assert.deepEqual(decision.reasonCodes, ['OK']);
    assert.equal(decision.grantsSubmissionEligibility, true);
  });

  it('uses the most restrictive broker and SunRey credit limits', () => {
    const derived = deriveEffectiveCreditCapitalLimits({
      sunrey: baseRequest().sunreyLimits,
      broker: baseRequest().brokerLimits,
    });
    assert.equal(derived.effective.maxOrderNotionalMinor, 3_000_000n);
    assert.equal(derived.effective.maxParticipationRateBps, 300n);
    assert.equal(derived.limitingSource, 'BOTH');

    const blocked = evaluatePreTradeExecutionFirewall(
      baseRequest({
        order: Object.freeze({
          ...baseRequest().order,
          notionalMinorUnits: 3_500_000n,
        }),
      }),
    );
    assert.equal(blocked.outcome, 'BLOCK');
    assert.ok(blocked.reasonCodes.includes('MAX_ORDER_NOTIONAL_EXCEEDED'));
    assert.ok(blocked.reasonCodes.includes('BROKER_LIMIT_MORE_RESTRICTIVE'));
  });

  it('treats broker-side rejection as authoritative submission ineligibility', () => {
    const decision = evaluatePreTradeExecutionFirewall(
      baseRequest({
        brokerPreTradeRejection: Object.freeze({ rejected: true, reasonCodes: Object.freeze(['BROKER_HARD_STOP']) }),
      }),
    );
    assert.equal(decision.outcome, 'BLOCK');
    assert.ok(decision.reasonCodes.includes('BROKER_PRETRADE_REJECTION'));
    assert.equal(decision.brokerAuthoritativeRejection, true);
    assert.equal(decision.grantsSubmissionEligibility, false);
  });

  it('default-blocks short sales and unsupported structured products', () => {
    const short = evaluatePreTradeExecutionFirewall(
      baseRequest({
        order: Object.freeze({ ...baseRequest().order, positionEffect: 'OPEN_SHORT', side: 'SELL' }),
      }),
    );
    assert.equal(short.outcome, 'BLOCK');
    assert.ok(short.reasonCodes.includes('SHORT_SALE_DEFAULT_BLOCK'));

    const naked = evaluatePreTradeExecutionFirewall(
      baseRequest({
        order: Object.freeze({
          ...baseRequest().order,
          instrumentDerivativeKind: 'OPTION',
          optionCoverage: 'NAKED',
        }),
      }),
    );
    assert.ok(naked.reasonCodes.includes('NAKED_OPTION_DEFAULT_BLOCK'));
  });

  it('maps canonical Risk Engine REQUIRE_REVIEW to REVIEW_REQUIRED without duplicating risk authority', () => {
    const decision = evaluatePreTradeExecutionFirewall(
      baseRequest({
        sunreyRisk: Object.freeze({
          consulted: true,
          outcome: 'REQUIRE_REVIEW',
          reasonCodes: Object.freeze(['rlim_drawdown']),
          triggeredLimitIds: Object.freeze([]),
        }),
      }),
    );
    assert.equal(decision.outcome, 'REVIEW_REQUIRED');
    assert.ok(decision.reasonCodes.includes('RISK_ENGINE_REVIEW_REQUIRED'));
  });

  it('extends market-access evaluation facts from canonical exchange regulated helper', () => {
    const access = evaluateMarketAccess({
      jurisdiction: 'US',
      marketFamily: 'CAPITAL_MARKET',
      complianceState: 'CLEAR',
      listingAllowed: true,
      riskRestricted: false,
      identityClass: 'RETAIL',
    });
    const blocked = evaluatePreTradeExecutionFirewall(
      baseRequest({
        marketAccess: Object.freeze({ allowed: access.allowed, reasonCodes: access.reasonCodes }),
      }),
    );
    assert.equal(blocked.outcome, 'ALLOW');

    const denied = evaluatePreTradeExecutionFirewall(
      baseRequest({
        marketAccess: Object.freeze({ allowed: false, reasonCodes: Object.freeze(['JURISDICTION_DENIED']) }),
      }),
    );
    assert.equal(denied.outcome, 'BLOCK');
    assert.ok(denied.reasonCodes.includes('MARKET_ACCESS_DENIED'));
  });

  it('wires EXEC04 immediately before the broker adapter in H23 order lifecycle', () => {
    const clock = new FrozenClock(T0);
    const provider = new SandboxHeliosProviderPort();
    const validation: HeliosOrderValidationPorts = Object.freeze({
      envelopeValid: () => true,
      mandateActive: () => true,
      accountOwned: () => true,
      capitalAvailable: () => true,
      providerCapable: () => true,
      marketOpen: () => true,
      riskPermits: () => true,
      kernelPermits: () => Object.freeze({ permitted: true, authorityReference: 'ea_exec04' }),
    });
    const capital: HeliosCapitalPort = Object.freeze({
      reserve: (input) => ({ ok: true as const, reservationId: `rsv_${input.orderId}` }),
      release: () => undefined,
    });

    const blockedService = new HeliosOrderLifecycleService({
      clock,
      provider,
      validation,
      capital,
      preTrade: {
        factsFor: (order, now) => ({
          requestId: `req_${order.operationId}`,
          evaluatedAt: now,
          jurisdiction: 'US',
          marketAccessAllowed: true,
          marketAccessReasonCodes: ['ELIGIBLE'],
          instrumentEligible: true,
          marketDataAuthoritative: true,
          marketDataFresh: true,
          referencePriceMinor: 10_000n,
          sunreyLimits: {
            maxOrderNotionalMinor: 100n,
            maxOrderQuantity: 1_000n,
            maxParticipationRateBps: 10_000n,
            availableBuyingPowerMinor: 1_000_000n,
          },
          brokerLimits: null,
          sunreyRisk: { consulted: false, outcome: null, reasonCodes: [], triggeredLimitIds: [] },
          brokerPreTradeRejection: null,
          capitalReserved: true,
          capitalReservationId: order.reservationId,
          duplicateOrderDetected: false,
          dailyLossBreached: false,
          dailyLossReviewBand: false,
          strategyContributionBreached: false,
          participationRateBps: 0n,
          liquidityConstraintViolated: false,
          priceCollarBps: 10_000n,
          fatFingerThresholdBps: 10_000n,
          structuredProductPosture: baseRequest().structuredProductPosture,
        }),
      },
    });

    const input: CreateHeliosOrderInput = Object.freeze({
      customerId: CUSTOMER,
      providerAccountId: 'acct_exec04',
      workOrderId: workOrderIdFor('cust_exec04', 'wire'),
      strategyCapsuleRef: null,
      proposalId: 'prop_wire',
      envelopeId: null,
      instrumentId: 'inst_spy',
      side: 'BUY',
      quantityUnits: '10',
      notionalMinorUnits: '1000000',
      orderType: 'MARKET',
      timeInForce: 'DAY',
      currency: 'USD',
      providerRoute: 'sandbox_helios_investment_v1',
      environment: 'SANDBOX',
      idempotencyKey: 'idem_wire',
      now: T0,
    });

    const created = blockedService.createOrder(input);
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error('create');
    const authorized = blockedService.authorizeOrder(created.value.orderId, CUSTOMER);
    assert.equal(authorized.ok, true);
    const submitted = blockedService.submitOrder(created.value.orderId, CUSTOMER);
    assert.equal(submitted.ok, false);
    if (submitted.ok) throw new Error('expected block');
    assert.equal(submitted.error.code, 'PRETRADE_BLOCKED');
  });

  it('qualifies EXEC04 when certification checks pass', () => {
    const deterministicA = evaluatePreTradeExecutionFirewall(baseRequest());
    const deterministicB = evaluatePreTradeExecutionFirewall(baseRequest());
    assert.deepEqual(deterministicA, deterministicB);

    const qualification = evaluateExec04PreTradeFirewallQualification({
      ownershipMandateEnvelopeKernel: true,
      marketAccessAndSession: true,
      marketDataAuthoritativeFresh: true,
      capitalReservationEnforced: true,
      effectiveBrokerSunreyLimits: true,
      brokerRejectionAuthoritative: true,
      defaultStructuredProductBlocks: true,
      riskEngineConsultedNotDuplicated: true,
      duplicateOrderDetection: true,
      priceCollarAndFatFinger: true,
      reviewRequiredPath: true,
      deterministicEvaluation: true,
      noExecutionAuthorityIssued: true,
      simulationPosture: ENVIRONMENT === 'simulation' && !LIVE_INVESTMENT_EXECUTION && !LIVE_TRADING_ENABLED,
      extendsCanonicalAuthorities: true,
    });
    assert.equal(qualification.marker, HELIOS_EXEC04_PRETRADE_FIREWALL_QUALIFIED);
    assert.equal(qualification.qualified, true);
  });

  it('passes HELIOS boundary lint without competing risk authority', () => {
    const findings = lintHeliosBoundary(process.cwd()).filter(
      (row) => row.file.includes('execution-connectivity') || row.file.includes('pretrade-firewall'),
    );
    assert.deepEqual(findings, []);
  });

  it('bridge composes validation ports with EXEC04 facts', () => {
    const validation: HeliosOrderValidationPorts = Object.freeze({
      envelopeValid: () => true,
      mandateActive: () => true,
      accountOwned: () => true,
      capitalAvailable: () => true,
      providerCapable: () => true,
      marketOpen: () => true,
      riskPermits: () => true,
      kernelPermits: () => Object.freeze({ permitted: true, authorityReference: 'ea_bridge' }),
    });
    const request = buildPreTradeExecutionRequestFromHeliosOrder({
      order: Object.freeze({
        orderId: 'ord_bridge' as never,
        operationId: 'op_bridge',
        externalOperationId: 'ext_bridge',
        customerId: CUSTOMER,
        providerAccountId: 'acct_bridge',
        workOrderId: workOrderIdFor('cust_exec04', 'bridge'),
        strategyCapsuleRef: null,
        proposalId: 'prop_bridge',
        envelopeId: null,
        authorityReference: null,
        instrumentId: 'inst_spy',
        side: 'BUY',
        quantityUnits: '10',
        notionalMinorUnits: '10000',
        orderType: 'MARKET',
        limitPriceMinorUnits: null,
        timeInForce: 'DAY',
        currency: 'USD',
        providerRoute: 'sandbox_helios_investment_v1',
        environment: 'SANDBOX',
        status: 'AUTHORIZED',
        cancelStatus: null,
        providerOrderId: null,
        reservationId: null,
        capitalReservedMinorUnits: '0',
        idempotencyKey: 'idem_bridge',
        createdAt: T0,
        updatedAt: T0,
        submittedAt: null,
        acknowledgedAt: null,
        filledAt: null,
        settledAt: null,
        reconciledAt: null,
        availableAt: null,
        liveExecution: false,
        productionAuthorized: false,
        grantsFinancialEffect: false,
      }),
      now: T0,
      validation,
      facts: {
        requestId: 'req_bridge',
        evaluatedAt: T0,
        jurisdiction: 'US',
        marketAccessAllowed: true,
        marketAccessReasonCodes: ['ELIGIBLE'],
        instrumentEligible: true,
        marketDataAuthoritative: true,
        marketDataFresh: true,
        referencePriceMinor: null,
        sunreyLimits: baseRequest().sunreyLimits,
        brokerLimits: null,
        sunreyRisk: baseRequest().sunreyRisk,
        brokerPreTradeRejection: null,
        capitalReserved: true,
        capitalReservationId: null,
        duplicateOrderDetected: false,
        dailyLossBreached: false,
        dailyLossReviewBand: false,
        strategyContributionBreached: false,
        participationRateBps: 0n,
        liquidityConstraintViolated: false,
        priceCollarBps: 500n,
        fatFingerThresholdBps: 2_000n,
        structuredProductPosture: baseRequest().structuredProductPosture,
      },
    });
    const decision = evaluatePreTradeExecutionFirewall(request);
    assert.equal(decision.outcome, 'ALLOW');
  });
});
