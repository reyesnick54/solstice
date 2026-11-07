import { asUtcInstant } from '@solstice/domain';
import { BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION } from './taxonomy.ts';
import type {
  BrokerCancelCommand,
  BrokerExecutionEvent,
  BrokerOrderCommand,
  BrokerOrderState,
  BrokerReplaceCommand,
  BrokerStatusQuery,
} from './types.ts';

const NOW = asUtcInstant('2026-11-07T16:00:00.000Z');

export function brokerOrderCommandFixture(): BrokerOrderCommand {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    kind: 'ORDER',
    operationId: 'bop_order_1',
    providerAccountId: 'pacct_sim_1',
    transport: 'REST',
    submittedAt: NOW,
    idempotencyKey: 'idem_broker_order_1',
    clientOrderId: 'clord_root_1',
    originalClientOrderId: 'clord_root_1',
    instrumentId: 'inst_AAPL',
    side: 'BUY',
    orderType: 'LIMIT',
    quantityUnits: '10',
    limitPriceMinorUnits: '15000',
    stopPriceMinorUnits: null,
    timeInForce: 'DAY',
    currency: 'USD',
  });
}

export function brokerCancelCommandFixture(): BrokerCancelCommand {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    kind: 'CANCEL',
    operationId: 'bop_cancel_1',
    providerAccountId: 'pacct_sim_1',
    transport: 'WEBSOCKET',
    submittedAt: NOW,
    idempotencyKey: 'idem_broker_cancel_1',
    clientOrderId: 'clord_cancel_1',
    originalClientOrderId: 'clord_root_1',
    brokerOrderId: 'broker_ord_99',
    venueOrderId: 'venue_ord_77',
    targetClientOrderId: 'clord_root_1',
  });
}

export function brokerReplaceCommandFixture(): BrokerReplaceCommand {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    kind: 'REPLACE',
    operationId: 'bop_replace_1',
    providerAccountId: 'pacct_sim_1',
    transport: 'FIX',
    submittedAt: NOW,
    idempotencyKey: 'idem_broker_replace_1',
    clientOrderId: 'clord_replace_2',
    originalClientOrderId: 'clord_root_1',
    replacesClientOrderId: 'clord_root_1',
    brokerOrderId: 'broker_ord_99',
    venueOrderId: 'venue_ord_77',
    instrumentId: 'inst_AAPL',
    side: 'BUY',
    orderType: 'LIMIT',
    quantityUnits: '12',
    limitPriceMinorUnits: '15100',
    stopPriceMinorUnits: null,
    timeInForce: 'DAY',
    currency: 'USD',
  });
}

export function brokerStatusQueryFixture(): BrokerStatusQuery {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    kind: 'STATUS_QUERY',
    operationId: 'bop_status_1',
    providerAccountId: 'pacct_sim_1',
    transport: 'INSTITUTIONAL_API',
    submittedAt: NOW,
    idempotencyKey: 'idem_broker_status_1',
    clientOrderId: 'clord_root_1',
    originalClientOrderId: 'clord_root_1',
    brokerOrderId: 'broker_ord_99',
    venueOrderId: null,
  });
}

export function brokerOrderStateFixture(): BrokerOrderState {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    clientOrderId: 'clord_root_1',
    originalClientOrderId: 'clord_root_1',
    brokerOrderId: 'broker_ord_99',
    venueOrderId: 'venue_ord_77',
    providerAccountId: 'pacct_sim_1',
    orderState: 'NEW',
    filledQuantityUnits: '0',
    remainingQuantityUnits: '10',
    averagePriceMinorUnits: null,
    lastUpdatedAt: NOW,
    liveBrokerConnected: false,
  });
}

export function brokerTradeEventFixture(): BrokerExecutionEvent {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    eventPurpose: 'TRADE',
    executionId: 'exec_fill_1',
    operationId: 'bop_order_1',
    clientOrderId: 'clord_root_1',
    originalClientOrderId: 'clord_root_1',
    brokerOrderId: 'broker_ord_99',
    venueOrderId: 'venue_ord_77',
    providerAccountId: 'pacct_sim_1',
    resultingOrderState: 'PARTIALLY_FILLED',
    eventTime: NOW,
    arrivalTime: NOW,
    transport: 'FIX',
    fillQuantityUnits: '4',
    fillPriceMinorUnits: '15000',
    feeMinorUnits: '25',
    currency: 'USD',
    evidenceRef: 'evidence://fixture/exec_fill_1',
    simulation: true,
    grantsExecutionAuthority: false,
  });
}
