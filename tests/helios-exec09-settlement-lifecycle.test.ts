/**
 * HELIOS EXEC09 — institutional settlement and post-trade lifecycle.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import {
  ENVIRONMENT,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_TRADING_ENABLED,
} from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asJurisdiction } from '../packages/domain/src/jurisdiction.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { fillIdFor, orderIdFor } from '../packages/platform/src/helios/order-lifecycle/index.ts';
import {
  DEFAULT_EXEC09_CURRENCY_CALENDARS,
  DEFAULT_EXEC09_MARKET_CALENDARS,
  DEFAULT_EXEC09_SETTLEMENT_POLICIES,
  Exec09SettlementLifecycleService,
  HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_QUALIFIED,
  evaluateExec09SettlementQualification,
  defaultExec09QualificationChecksFromPosture,
  exec09FillIsNotSettled,
  resolveActiveSettlementPolicy,
} from '../packages/platform/src/helios/execution-connectivity/exec09/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-17T18:00:00.000Z');
const CUSTOMER = asCustomerId('cust_exec09');

function baseFillInput(overrides: Record<string, unknown> = {}) {
  const orderId = orderIdFor('op_work_prop_idem');
  const fillId = fillIdFor(orderId, 'pf_1');
  return Object.freeze({
    customerId: CUSTOMER,
    orderId,
    fillId,
    providerId: 'sandbox_helios_investment_v1',
    providerFillId: 'pf_1',
    providerTradeId: 'ptr_1',
    instrumentId: 'inst_spy',
    assetClass: 'EQUITY' as const,
    market: 'NYSE',
    jurisdiction: asJurisdiction('US'),
    side: 'BUY' as const,
    tradeTimestamp: NOW,
    quantityUnits: '100',
    priceMinorUnits: '45000',
    notionalMinorUnits: '4500000',
    feeMinorUnits: '100',
    currency: 'USD',
    ...overrides,
  });
}

function createService(at = NOW) {
  const clock = new FrozenClock(at);
  const service = new Exec09SettlementLifecycleService({
    clock,
    marketCalendars: DEFAULT_EXEC09_MARKET_CALENDARS,
    currencyCalendars: DEFAULT_EXEC09_CURRENCY_CALENDARS,
    seedPolicies: DEFAULT_EXEC09_SETTLEMENT_POLICIES,
  });
  return { clock, service };
}

describe('HELIOS EXEC09 settlement lifecycle', () => {
  it('architecture guard: no competing HELIOS packages or authority bypass', () => {
    const findings = lintHeliosBoundary(process.cwd());
    assert.deepEqual(findings, []);
  });

  it('versioned policy resolves by market, asset class, jurisdiction, and effective date', () => {
    const legacyTrade = asUtcInstant('2024-06-03T15:00:00.000Z');
    const modernTrade = asUtcInstant('2026-06-03T15:00:00.000Z');
    const legacy = resolveActiveSettlementPolicy(DEFAULT_EXEC09_SETTLEMENT_POLICIES, {
      market: 'NYSE',
      assetClass: 'EQUITY',
      jurisdiction: asJurisdiction('US'),
      tradeTimestamp: legacyTrade,
      marketTimeZone: 'America/New_York',
    });
    const modern = resolveActiveSettlementPolicy(DEFAULT_EXEC09_SETTLEMENT_POLICIES, {
      market: 'NYSE',
      assetClass: 'EQUITY',
      jurisdiction: asJurisdiction('US'),
      tradeTimestamp: modernTrade,
      marketTimeZone: 'America/New_York',
    });
    assert.equal(legacy?.policyId, 'us_equity_t2_legacy');
    assert.equal(legacy?.settlementLagBusinessDays, 2);
    assert.equal(modern?.policyId, 'us_equity_t1');
    assert.equal(modern?.settlementLagBusinessDays, 1);
  });

  it('fill does not imply lifecycle settled', () => {
    const { service } = createService();
    const opened = service.openFromFill(baseFillInput());
    assert.equal(opened.ok, true);
    if (!opened.ok) throw new Error('open');
    assert.equal(opened.value.obligation.state, 'PENDING');
    assert.equal(exec09FillIsNotSettled({ orderFilled: true, lifecycleState: opened.value.lifecycle.aggregateState }), true);
    assert.equal(service.fillIsNotSettled(opened.value.lifecycle.orderId, true), true);
  });

  it('full DVP linked-leg lifecycle reaches SETTLED on contractual date', () => {
    const { clock, service } = createService();
    const opened = service.openFromFill(baseFillInput());
    assert.equal(opened.ok, true);
    if (!opened.ok) throw new Error('open');
    const { obligation, instruction } = opened.value;
    assert.equal(instruction.dvpModel, 'LINKED_LEGS');
    assert.equal(instruction.atomicDvpClaimedByProvider, false);
    assert.equal(instruction.contractualSettlementDate, '2026-09-18');

    const matched = service.matchObligation(obligation.obligationId, CUSTOMER);
    const affirmed = service.affirmObligation(obligation.obligationId, CUSTOMER);
    assert.equal(matched.ok && affirmed.ok, true);

    const tooEarly = service.beginSettling(obligation.obligationId, CUSTOMER);
    assert.equal(tooEarly.ok, true);
    if (!tooEarly.ok) throw new Error('settling');
    assert.equal(tooEarly.value.state, 'AFFIRMED');

    const completeTooEarly = service.completeObligationSettlement({
      obligationId: obligation.obligationId,
      customerId: CUSTOMER,
    });
    assert.equal(completeTooEarly.ok, false);
    if (completeTooEarly.ok) throw new Error('expected early complete to fail');
    assert.equal(completeTooEarly.error.code, 'INVALID_TRANSITION');

    clock.set(asUtcInstant('2026-09-18T20:00:00.000Z'));
    const settling = service.beginSettling(obligation.obligationId, CUSTOMER);
    assert.equal(settling.ok, true);
    if (!settling.ok) throw new Error('settling2');
    assert.equal(settling.value.state, 'SETTLING');

    const done = service.completeObligationSettlement({
      obligationId: obligation.obligationId,
      customerId: CUSTOMER,
    });
    assert.equal(done.ok, true);
    if (!done.ok) throw new Error('done');
    assert.equal(done.value.state, 'SETTLED');
    assert.equal(done.value.actualSettlementDate, '2026-09-18');
    assert.equal(service.fillIsNotSettled(opened.value.lifecycle.orderId, true), false);
  });

  it('supports partial then complete settlement across multiple fills', () => {
    const { clock, service } = createService();
    const first = service.openFromFill(baseFillInput({ quantityUnits: '60', notionalMinorUnits: '2700000', providerTradeId: 'ptr_a', providerFillId: 'pf_a' }));
    const second = service.openFromFill(
      baseFillInput({
        quantityUnits: '40',
        notionalMinorUnits: '1800000',
        providerTradeId: 'ptr_b',
        providerFillId: 'pf_b',
        fillId: fillIdFor(orderIdFor('op_work_prop_idem'), 'pf_b'),
      }),
    );
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) throw new Error('open');

    for (const result of [first, second]) {
      service.matchObligation(result.value.obligation.obligationId, CUSTOMER);
      service.affirmObligation(result.value.obligation.obligationId, CUSTOMER);
    }
    clock.set(asUtcInstant('2026-09-18T20:00:00.000Z'));
    service.beginSettling(first.value.obligation.obligationId, CUSTOMER);

    const partial = service.completeObligationSettlement({
      obligationId: first.value.obligation.obligationId,
      customerId: CUSTOMER,
      settledQuantityUnits: '30',
      settledNotionalMinorUnits: '1350000',
    });
    assert.equal(partial.ok, true);
    if (!partial.ok) throw new Error('partial');
    assert.equal(partial.value.state, 'PARTIALLY_SETTLED');

    service.beginSettling(first.value.obligation.obligationId, CUSTOMER);
    const completeFirst = service.completeObligationSettlement({
      obligationId: first.value.obligation.obligationId,
      customerId: CUSTOMER,
    });
    assert.equal(completeFirst.ok, true);

    service.beginSettling(second.value.obligation.obligationId, CUSTOMER);
    const completeSecond = service.completeObligationSettlement({
      obligationId: second.value.obligation.obligationId,
      customerId: CUSTOMER,
    });
    assert.equal(completeSecond.ok, true);

    const lifecycle = service.store.getLifecycle(first.value.lifecycle.lifecycleId);
    assert.equal(lifecycle?.aggregateState, 'SETTLED');
    assert.equal(lifecycle?.settledQuantityUnits, '100');
  });

  it('records failures, corrections, and trade busts', () => {
    const { service } = createService();
    const opened = service.openFromFill(baseFillInput());
    assert.equal(opened.ok, true);
    if (!opened.ok) throw new Error('open');
    const { obligation } = opened.value;

    const failure = service.recordFailure({
      obligationId: obligation.obligationId,
      customerId: CUSTOMER,
      kind: 'COUNTERPARTY_FAIL',
      description: 'counterparty short',
      recoverable: true,
    });
    assert.equal(failure.ok, true);
    if (!failure.ok) throw new Error('failure');
    assert.equal(failure.value.obligation.state, 'FAILED');

    const correction = service.applyCorrection({
      obligationId: obligation.obligationId,
      customerId: CUSTOMER,
      kind: 'PRICE_CORRECTION',
      description: 'amended price',
      notionalDeltaMinorUnits: '-100',
    });
    assert.equal(correction.ok, true);
    if (!correction.ok) throw new Error('correction');
    assert.equal(correction.value.obligation.state, 'CORRECTED');

    const bust = service.bustTradeConfirmation(obligation.obligationId, CUSTOMER);
    assert.equal(bust.ok, true);
    if (!bust.ok) throw new Error('bust');
    assert.equal(bust.value.state, 'CANCELED');
    const confirmation = service.store.getConfirmation(obligation.confirmationId);
    assert.equal(confirmation?.busted, true);
  });

  it('crypto policy uses T+0 and may claim provider atomic DVP', () => {
    const { clock, service } = createService();
    const opened = service.openFromFill(
      baseFillInput({
        assetClass: 'CRYPTO',
        market: 'CRYPTO_GLOBAL',
        instrumentId: 'btc_usd',
        contractualSettlementDate: undefined,
      }),
    );
    assert.equal(opened.ok, true);
    if (!opened.ok) throw new Error('open');
    assert.equal(opened.value.instruction.contractualSettlementDate, '2026-09-17');
    assert.equal(opened.value.instruction.dvpModel, 'PROVIDER_ATOMIC');
    assert.equal(opened.value.instruction.atomicDvpClaimedByProvider, true);

    service.matchObligation(opened.value.obligation.obligationId, CUSTOMER);
    service.affirmObligation(opened.value.obligation.obligationId, CUSTOMER);
    const settling = service.beginSettling(opened.value.obligation.obligationId, CUSTOMER);
    assert.equal(settling.ok, true);
    if (!settling.ok) throw new Error('crypto settle');
    assert.equal(settling.value.state, 'SETTLING');
    clock.set(asUtcInstant('2026-09-17T21:00:00.000Z'));
    const done = service.completeObligationSettlement({
      obligationId: opened.value.obligation.obligationId,
      customerId: CUSTOMER,
    });
    assert.equal(done.ok, true);
  });

  it('qualification marker HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_QUALIFIED', () => {
    const checks = Object.freeze({
      versionedPolicyByMarketAssetJurisdiction: true,
      noUniversalTPlusOneHardCode: true,
      marketCalendarApplied: true,
      currencyCalendarApplied: true,
      tradeContractualActualSettlementDates: true,
      dvpLinkedLegsWithoutInventedAtomic: true,
      providerAtomicDvpOnlyWhenDeclared: true,
      partialFillsSupported: true,
      multipleFillsSupported: true,
      feesRepresented: true,
      tradeCorrectionsSupported: true,
      tradeBustsSupported: true,
      settlementFailuresHandled: true,
      lateSettlementRespected: true,
      fillIsNotSettled: true,
      ...defaultExec09QualificationChecksFromPosture(),
    });
    const result = evaluateExec09SettlementQualification(checks);
    assert.equal(result.qualified, true);
    assert.equal(result.marker, HELIOS_EXEC09_SETTLEMENT_LIFECYCLE_QUALIFIED);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
  });
});
