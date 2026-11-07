/**
 * HELIOS EXEC02 — broker-neutral order and execution protocol qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/index.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  BROKER_EVENT_PURPOSES,
  BROKER_ORDER_STATES,
  BROKER_TRANSPORT_KINDS,
  appendBrokerReplacementLink,
  activeBrokerChainClientOrderId,
  brokerCancelCommandFixture,
  brokerOrderCommandFixture,
  brokerOrderStateFixture,
  brokerReplaceCommandFixture,
  brokerStatusQueryFixture,
  brokerTradeEventFixture,
  createBrokerOrderChain,
  createFixExecutionReportNormalizer,
  orderStateDistinctFromEventPurpose,
  restWsExecutionFromPayload,
  validateBrokerCancelReject,
  validateBrokerExecutionEvent,
  validateBrokerOrderState,
  validateBrokerProtocolCommand,
} from '../packages/provider-sdk/src/broker-execution-capability/index.ts';
import {
  evaluateExec02Qualification,
  EXEC02_CANONICAL_OWNER,
  HELIOS_EXEC02_BROKER_PROTOCOL_QUALIFIED,
  normalizeInstitutionalApiExecution,
} from '../packages/platform/src/helios/execution-connectivity/exec02/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ARRIVAL = asUtcInstant('2026-11-07T16:00:01.000Z');
const EVENT = asUtcInstant('2026-11-07T16:00:00.500Z');

describe('HELIOS EXEC02 broker protocol', () => {
  it('preserves simulation posture', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('declares canonical order states and event purposes separately', () => {
    assert.equal(BROKER_ORDER_STATES.length, 13);
    assert.equal(BROKER_EVENT_PURPOSES.length, 8);
    assert.equal(orderStateDistinctFromEventPurpose(), true);
    assert.ok(!BROKER_EVENT_PURPOSES.includes('NEW' as never));
    assert.ok(!BROKER_ORDER_STATES.includes('TRADE' as never));
  });

  it('validates command, state, and execution surfaces', () => {
    assert.deepEqual(validateBrokerProtocolCommand(brokerOrderCommandFixture()), []);
    assert.deepEqual(validateBrokerProtocolCommand(brokerCancelCommandFixture()), []);
    assert.deepEqual(validateBrokerProtocolCommand(brokerReplaceCommandFixture()), []);
    assert.deepEqual(validateBrokerProtocolCommand(brokerStatusQueryFixture()), []);
    assert.deepEqual(validateBrokerOrderState(brokerOrderStateFixture()), []);
    assert.deepEqual(validateBrokerExecutionEvent(brokerTradeEventFixture()), []);
  });

  it('maintains immutable cancel/replace chain without overwriting original identity', () => {
    const chain = createBrokerOrderChain('clord_root_1', EVENT);
    const replaced = appendBrokerReplacementLink(chain, {
      clientOrderId: 'clord_replace_2',
      brokerOrderId: 'broker_ord_100',
      replacesClientOrderId: 'clord_root_1',
      recordedAt: ARRIVAL,
    });
    if ('ok' in replaced) {
      assert.fail(`unexpected reject: ${replaced.reason}`);
    }
    assert.equal(replaced.originalClientOrderId, 'clord_root_1');
    assert.equal(replaced.links.length, 2);
    assert.equal(replaced.links[0]?.supersededByClientOrderId, 'clord_replace_2');
    assert.equal(activeBrokerChainClientOrderId(replaced), 'clord_replace_2');
  });

  it('maps FIX semantic fields to canonical state without binding a protocol version', () => {
    const normalizer = createFixExecutionReportNormalizer();
    const ack = normalizer.normalizeExecutionReport(
      Object.freeze({
        clOrdID: 'clord_root_1',
        orderID: 'broker_ord_99',
        ordStatus: '0',
        execType: '0',
        execID: 'fix_exec_ack',
      }),
      Object.freeze({
        transport: 'FIX',
        providerAccountId: 'pacct_sim_1',
        operationId: 'bop_fix_1',
        eventTime: EVENT,
        arrivalTime: ARRIVAL,
        evidenceRef: 'evidence://fix/ack',
      }),
    );
    assert.equal(ack.eventPurpose, 'ACKNOWLEDGEMENT');
    assert.equal(ack.resultingOrderState, 'NEW');
    assert.deepEqual(validateBrokerExecutionEvent(ack), []);
  });

  it('maps REST/WebSocket and institutional API payloads to the same canonical event', () => {
    const payload = Object.freeze({
      eventPurpose: 'TRADE' as const,
      executionId: 'rest_exec_1',
      clientOrderId: 'clord_root_1',
      originalClientOrderId: 'clord_root_1',
      brokerOrderId: 'broker_ord_99',
      venueOrderId: 'venue_ord_77',
      resultingOrderState: 'FILLED' as const,
      fillQuantityUnits: '10',
      fillPriceMinorUnits: '15000',
      feeMinorUnits: '10',
      currency: 'USD',
    });
    const rest = restWsExecutionFromPayload(payload, {
      transport: 'REST',
      providerAccountId: 'pacct_sim_1',
      operationId: 'bop_rest_1',
      eventTime: EVENT,
      arrivalTime: ARRIVAL,
      evidenceRef: null,
    });
    const institutional = normalizeInstitutionalApiExecution(payload, {
      transport: 'INSTITUTIONAL_API',
      providerAccountId: 'pacct_sim_1',
      operationId: 'bop_inst_1',
      eventTime: EVENT,
      arrivalTime: ARRIVAL,
      evidenceRef: null,
    });
    assert.equal(rest.eventPurpose, institutional.eventPurpose);
    assert.equal(rest.resultingOrderState, institutional.resultingOrderState);
    assert.equal(rest.grantsExecutionAuthority, false);
    assert.equal(BROKER_TRANSPORT_KINDS.includes('FIX'), true);
  });

  it('qualifies HELIOS_EXEC02_BROKER_PROTOCOL_QUALIFIED', () => {
    const qualification = evaluateExec02Qualification({
      allCommandTypesDeclared: true,
      allOrderStatesDeclared: BROKER_ORDER_STATES.length === 13,
      eventPurposeDistinctFromOrderState: true,
      identifiersPresent: true,
      orderChainImmutable: true,
      fixAdapterVersionAgnostic: true,
      restWsAdapterAligned: true,
      noExecutionAuthority: brokerTradeEventFixture().grantsExecutionAuthority === false,
      simulationPosture: ENVIRONMENT === 'simulation' && LIVE_TRADING_ENABLED === false,
      extendsCanonicalOwners: EXEC02_CANONICAL_OWNER.includes('broker-execution-capability'),
    });
    assert.equal(qualification.marker, HELIOS_EXEC02_BROKER_PROTOCOL_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.deepEqual(qualification.blockers, []);
  });

  it('cancel reject validates as rejection event surface', () => {
    const normalizer = createFixExecutionReportNormalizer();
    const reject = normalizer.normalizeOrderCancelReject(
      Object.freeze({
        clOrdID: 'clord_root_1',
        orderID: 'broker_ord_99',
        ordStatus: '6',
        text: 'too_late_to_cancel',
      }),
      Object.freeze({
        transport: 'FIX',
        providerAccountId: 'pacct_sim_1',
        operationId: 'bop_fix_cancel_reject',
        eventTime: EVENT,
        arrivalTime: ARRIVAL,
        evidenceRef: null,
      }),
    );
    assert.deepEqual(validateBrokerCancelReject(reject), []);
    assert.equal(reject.eventPurpose, 'REJECTION');
  });

  it('passes HELIOS boundary lint', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });
});
