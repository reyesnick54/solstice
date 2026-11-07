/**
 * HELIOS EXECUTION CONNECTIVITY — EXEC10 financing controls.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_INVESTMENT_EXECUTION, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  DEFAULT_GROW_FINANCING_POSTURE,
  HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED,
  buildBorrowState,
  buildCashBalanceState,
  buildFinancingState,
  buildMarginState,
  computeEffectiveBuyingPower,
  defaultExec10QualificationChecks,
  evaluateExec10FinancingQualification,
  marginWouldBeEnabled,
  providerBuyingPowerInformationalOnly,
  shortingWouldBeEnabled,
} from '../packages/platform/src/helios/execution-connectivity/exec10/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-11-07T16:00:00.000Z');
const CUSTOMER = asCustomerId('cust_exec10_a');

describe('HELIOS EXEC10 — financing controls', () => {
  it('distinguishes cash, settled, unsettled, reserved, availableToTrade, availableToWithdraw', () => {
    const cash = buildCashBalanceState({
      customerId: CUSTOMER,
      brokerageAccountId: 'brk_exec10',
      currency: 'USD',
      settledCashMinor: '1000000',
      unsettledCashMinor: '200000',
      reservedCashMinor: '150000',
      reconciliationBlocks: false,
      asOf: NOW,
    });
    assert.equal(cash.cashMinor, '1200000');
    assert.equal(cash.settledCashMinor, '1000000');
    assert.equal(cash.unsettledCashMinor, '200000');
    assert.equal(cash.reservedCashMinor, '150000');
    assert.equal(cash.availableToTradeMinor, '650000');
    assert.equal(cash.availableToWithdrawMinor, '650000');
  });

  it('fail-closes availability when reconciliation blocks', () => {
    const cash = buildCashBalanceState({
      customerId: CUSTOMER,
      brokerageAccountId: 'brk_exec10',
      currency: 'USD',
      settledCashMinor: '500000',
      unsettledCashMinor: '0',
      reservedCashMinor: '0',
      reconciliationBlocks: true,
      asOf: NOW,
    });
    assert.equal(cash.availableToTradeMinor, '0');
    assert.equal(cash.availableToWithdrawMinor, '0');
  });

  it('effective executable buying power is the minimum of four caps', () => {
    const result = computeEffectiveBuyingPower({
      brokerAvailableMinor: '900000',
      sunreyCapitalAllocationMinor: '400000',
      riskAllocationMinor: '600000',
      customerMandateMinor: '750000',
    });
    assert.equal(result.executableBuyingPowerMinor, '400000');
    assert.equal(result.limitingSource, 'SUNREY_CAPITAL');
  });

  it('does not allow broker margin report to increase executable power under CASH_ONLY', () => {
    const state = buildFinancingState({
      customerId: CUSTOMER,
      brokerageAccountId: 'brk_exec10',
      currency: 'USD',
      providerId: 'fixture_broker',
      brokerReportedAvailableMinor: '5000000',
      brokerReportedMarginExcessMinor: '4500000',
      caps: {
        brokerAvailableMinor: '5000000',
        sunreyCapitalAllocationMinor: '5000000',
        riskAllocationMinor: '5000000',
        customerMandateMinor: '5000000',
      },
      cash: {
        settledCashMinor: '800000',
        unsettledCashMinor: '0',
        reservedCashMinor: '100000',
        reconciliationBlocks: false,
      },
      asOf: NOW,
    });
    assert.equal(state.executableBuyingPowerMinor, '700000');
    assert.equal(state.buyingPower.limitingSource, 'CASH_POSTURE');
    assert.ok(
      providerBuyingPowerInformationalOnly({
        brokerReportedAvailableMinor: state.buyingPower.brokerReportedAvailableMinor,
        executableBuyingPowerMinor: state.executableBuyingPowerMinor,
        posture: state.posture,
      }),
    );
  });

  it('default Grow posture is cash-only without margin, shorting, or naked options', () => {
    assert.deepEqual(DEFAULT_GROW_FINANCING_POSTURE, [
      'CASH_ONLY',
      'NO_MARGIN',
      'NO_SHORTING',
      'NO_NAKED_OPTIONS',
      'NO_UNBOUNDED_DERIVATIVE_EXPOSURE',
    ]);
    const margin = buildMarginState({ brokerReportedExcessMinor: '100', asOf: NOW });
    assert.equal(margin.marginEnabled, false);
    assert.equal(margin.ignoredForExecution, true);
    assert.equal(marginWouldBeEnabled({ asOf: NOW }), false);

    const borrow = buildBorrowState({ asOf: NOW });
    assert.equal(borrow.shortingEnabled, false);
    assert.equal(borrow.borrowAvailable, false);
    assert.equal(shortingWouldBeEnabled({ asOf: NOW }), false);
  });

  it('margin gates must all be open before margin could be enabled (still false in v1)', () => {
    assert.equal(
      marginWouldBeEnabled({
        asOf: NOW,
        gateOverrides: { REGULATORY: true, PROVIDER: true, EXTERNAL: true },
      }),
      true,
    );
    const margin = buildMarginState({
      asOf: NOW,
      gateOverrides: { REGULATORY: true, PROVIDER: true, EXTERNAL: true },
    });
    assert.equal(margin.marginEnabled, false);
  });

  it('HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED when engineering checks pass', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);

    const result = evaluateExec10FinancingQualification(defaultExec10QualificationChecks());
    assert.equal(result.marker, HELIOS_EXEC10_FINANCING_CONTROLS_QUALIFIED, result.blockers.join('; '));
    assert.equal(result.qualified, true);
  });

  it('does not introduce competing HELIOS packages or execution authority', () => {
    const findings = lintHeliosBoundary(process.cwd());
    const exec10Findings = findings.filter((row) => row.file.includes('execution-connectivity'));
    assert.equal(exec10Findings.length, 0, exec10Findings.map((f) => f.message).join('; '));
  });
});
