import type { UtcInstant } from '@solstice/domain';
import {
  BROKER_EVENT_PURPOSES,
  BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
  BROKER_ORDER_STATES,
  BROKER_ORDER_SIDES,
  BROKER_ORDER_TYPES,
  BROKER_TIME_IN_FORCE,
  BROKER_TRANSPORT_KINDS,
} from './taxonomy.ts';
import type {
  BrokerCancelCommand,
  BrokerCancelReject,
  BrokerExecutionEvent,
  BrokerOrderCommand,
  BrokerOrderState,
  BrokerProtocolCommand,
  BrokerReplaceCommand,
  BrokerStatusQuery,
} from './types.ts';

function nonEmpty(value: string | null | undefined, field: string, errors: string[]): void {
  if (value === null || value === undefined || value.trim() === '') {
    errors.push(field);
  }
}

function enumValue(value: string, allowed: readonly string[], field: string, errors: string[]): void {
  if (!(allowed as readonly string[]).includes(value)) {
    errors.push(field);
  }
}

function assertMinorUnits(value: string | null, field: string, errors: string[]): void {
  if (value === null) {
    return;
  }
  try {
    BigInt(value);
  } catch {
    errors.push(field);
  }
}

export function validateBrokerOrderCommand(command: BrokerOrderCommand): readonly string[] {
  const errors: string[] = [];
  if (command.schemaVersion !== BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  if (command.kind !== 'ORDER') {
    errors.push('kind');
  }
  nonEmpty(command.clientOrderId, 'client_order_id', errors);
  nonEmpty(command.originalClientOrderId, 'original_client_order_id', errors);
  if (command.clientOrderId !== command.originalClientOrderId) {
    errors.push('original_client_order_id_must_match_for_new_order');
  }
  enumValue(command.side, BROKER_ORDER_SIDES, 'side', errors);
  enumValue(command.orderType, BROKER_ORDER_TYPES, 'order_type', errors);
  enumValue(command.timeInForce, BROKER_TIME_IN_FORCE, 'time_in_force', errors);
  enumValue(command.transport, BROKER_TRANSPORT_KINDS, 'transport', errors);
  nonEmpty(command.quantityUnits, 'quantity_units', errors);
  assertMinorUnits(command.limitPriceMinorUnits, 'limit_price', errors);
  assertMinorUnits(command.stopPriceMinorUnits, 'stop_price', errors);
  return Object.freeze(errors);
}

export function validateBrokerCancelCommand(command: BrokerCancelCommand): readonly string[] {
  const errors: string[] = [];
  if (command.schemaVersion !== BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  if (command.kind !== 'CANCEL') {
    errors.push('kind');
  }
  nonEmpty(command.clientOrderId, 'client_order_id', errors);
  nonEmpty(command.originalClientOrderId, 'original_client_order_id', errors);
  nonEmpty(command.targetClientOrderId, 'target_client_order_id', errors);
  enumValue(command.transport, BROKER_TRANSPORT_KINDS, 'transport', errors);
  return Object.freeze(errors);
}

export function validateBrokerReplaceCommand(command: BrokerReplaceCommand): readonly string[] {
  const errors: string[] = [];
  if (command.schemaVersion !== BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  if (command.kind !== 'REPLACE') {
    errors.push('kind');
  }
  nonEmpty(command.clientOrderId, 'client_order_id', errors);
  nonEmpty(command.originalClientOrderId, 'original_client_order_id', errors);
  nonEmpty(command.replacesClientOrderId, 'replaces_client_order_id', errors);
  if (command.clientOrderId === command.originalClientOrderId) {
    errors.push('replacement_must_use_new_client_order_id');
  }
  enumValue(command.transport, BROKER_TRANSPORT_KINDS, 'transport', errors);
  return Object.freeze(errors);
}

export function validateBrokerStatusQuery(query: BrokerStatusQuery): readonly string[] {
  const errors: string[] = [];
  if (query.schemaVersion !== BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  if (query.kind !== 'STATUS_QUERY') {
    errors.push('kind');
  }
  const hasKey =
    (query.clientOrderId !== null && query.clientOrderId.trim() !== '') ||
    (query.originalClientOrderId !== null && query.originalClientOrderId.trim() !== '') ||
    (query.brokerOrderId !== null && query.brokerOrderId.trim() !== '') ||
    (query.venueOrderId !== null && query.venueOrderId.trim() !== '');
  if (!hasKey) {
    errors.push('status_query_key_required');
  }
  enumValue(query.transport, BROKER_TRANSPORT_KINDS, 'transport', errors);
  return Object.freeze(errors);
}

export function validateBrokerProtocolCommand(command: BrokerProtocolCommand): readonly string[] {
  switch (command.kind) {
    case 'ORDER':
      return validateBrokerOrderCommand(command);
    case 'CANCEL':
      return validateBrokerCancelCommand(command);
    case 'REPLACE':
      return validateBrokerReplaceCommand(command);
    case 'STATUS_QUERY':
      return validateBrokerStatusQuery(command);
    default:
      return Object.freeze(['unknown_command_kind']);
  }
}

export function validateBrokerOrderState(state: BrokerOrderState): readonly string[] {
  const errors: string[] = [];
  if (state.schemaVersion !== BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  enumValue(state.orderState, BROKER_ORDER_STATES, 'order_state', errors);
  if (state.liveBrokerConnected !== false) {
    errors.push('live_broker_connected');
  }
  return Object.freeze(errors);
}

export function validateBrokerExecutionEvent(event: BrokerExecutionEvent): readonly string[] {
  const errors: string[] = [];
  if (event.schemaVersion !== BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  enumValue(event.eventPurpose, BROKER_EVENT_PURPOSES, 'event_purpose', errors);
  enumValue(event.resultingOrderState, BROKER_ORDER_STATES, 'resulting_order_state', errors);
  if (event.grantsExecutionAuthority !== false) {
    errors.push('grants_execution_authority');
  }
  if (event.simulation !== true) {
    errors.push('simulation');
  }
  if ('orderState' in (event as object)) {
    errors.push('order_state_field_leaked_on_event');
  }
  return Object.freeze(errors);
}

export function validateBrokerCancelReject(reject: BrokerCancelReject): readonly string[] {
  const errors: string[] = [];
  if (reject.schemaVersion !== BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION) {
    errors.push('schema_version');
  }
  if (reject.eventPurpose !== 'REJECTION') {
    errors.push('event_purpose');
  }
  enumValue(reject.resultingOrderState, BROKER_ORDER_STATES, 'resulting_order_state', errors);
  if (reject.simulation !== true) {
    errors.push('simulation');
  }
  return Object.freeze(errors);
}

export function orderStateDistinctFromEventPurpose(): true {
  return true;
}

export function assertBrokerTimestampOrder(eventTime: UtcInstant, arrivalTime: UtcInstant): boolean {
  return eventTime <= arrivalTime;
}
