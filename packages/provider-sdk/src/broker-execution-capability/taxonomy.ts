/**
 * EXEC02 — broker-neutral order and execution taxonomy.
 * Provider-specific semantics stay inside adapters; HELIOS consumes only these symbols.
 */

export const BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION = 'sunrey.broker-execution-protocol.v1' as const;

export const BROKER_ORDER_STATES = [
  'PENDING_NEW',
  'NEW',
  'PARTIALLY_FILLED',
  'FILLED',
  'PENDING_CANCEL',
  'CANCELED',
  'PENDING_REPLACE',
  'REPLACED',
  'REJECTED',
  'EXPIRED',
  'SUSPENDED',
  'DONE_FOR_DAY',
  'UNKNOWN',
] as const;
export type BrokerOrderStateKind = (typeof BROKER_ORDER_STATES)[number];

export const BROKER_EVENT_PURPOSES = [
  'ACKNOWLEDGEMENT',
  'TRADE',
  'CANCEL_ACK',
  'REPLACE_ACK',
  'REJECTION',
  'CORRECTION',
  'BUST',
  'STATUS',
] as const;
export type BrokerEventPurpose = (typeof BROKER_EVENT_PURPOSES)[number];

export const BROKER_TRANSPORT_KINDS = ['REST', 'WEBSOCKET', 'FIX', 'INSTITUTIONAL_API'] as const;
export type BrokerTransportKind = (typeof BROKER_TRANSPORT_KINDS)[number];

export const BROKER_ORDER_SIDES = ['BUY', 'SELL'] as const;
export type BrokerOrderSide = (typeof BROKER_ORDER_SIDES)[number];

export const BROKER_ORDER_TYPES = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'] as const;
export type BrokerOrderType = (typeof BROKER_ORDER_TYPES)[number];

export const BROKER_TIME_IN_FORCE = ['DAY', 'GTC', 'IOC', 'FOK', 'OPG', 'CLS'] as const;
export type BrokerTimeInForce = (typeof BROKER_TIME_IN_FORCE)[number];

/**
 * FIX workflow semantics expressed without binding a single protocol dictionary version.
 * Adapters map native tag dictionaries into these semantic slots.
 */
export const FIX_WORKFLOW_SEMANTIC_FIELDS = [
  'clOrdID',
  'origClOrdID',
  'orderID',
  'execID',
  'ordStatus',
  'execType',
  'ordType',
  'side',
  'symbol',
  'orderQty',
  'leavesQty',
  'cumQty',
  'avgPx',
  'lastPx',
  'lastQty',
  'text',
  'transactTime',
] as const;
export type FixWorkflowSemanticField = (typeof FIX_WORKFLOW_SEMANTIC_FIELDS)[number];
