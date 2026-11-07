/**
 * REST and WebSocket broker adapter port — maps native payloads into canonical broker protocol.
 */

import type { UtcInstant } from '@solstice/domain';
import { BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION } from '../taxonomy.ts';
import type { BrokerTransportKind } from '../taxonomy.ts';
import type { BrokerCancelReject, BrokerExecutionEvent, BrokerOrderState, BrokerOrderStateKind } from '../types.ts';
import type { BrokerEventPurpose } from '../taxonomy.ts';

export type RestWsInboundContext = Readonly<{
  readonly transport: Extract<BrokerTransportKind, 'REST' | 'WEBSOCKET'>;
  readonly providerAccountId: string;
  readonly operationId: string;
  readonly eventTime: UtcInstant;
  readonly arrivalTime: UtcInstant;
  readonly evidenceRef: string | null;
}>;

/** Provider maps its native status string into canonical order state before returning. */
export type RestWsOrderStateSnapshot = Readonly<{
  readonly clientOrderId: string;
  readonly originalClientOrderId: string;
  readonly brokerOrderId: string | null;
  readonly venueOrderId: string | null;
  readonly orderState: BrokerOrderStateKind;
  readonly filledQuantityUnits: string;
  readonly remainingQuantityUnits: string;
  readonly averagePriceMinorUnits: string | null;
}>;

export type RestWsExecutionPayload = Readonly<{
  readonly eventPurpose: BrokerEventPurpose;
  readonly executionId: string;
  readonly clientOrderId: string;
  readonly originalClientOrderId: string;
  readonly brokerOrderId: string | null;
  readonly venueOrderId: string | null;
  readonly resultingOrderState: BrokerOrderStateKind;
  readonly fillQuantityUnits: string | null;
  readonly fillPriceMinorUnits: string | null;
  readonly feeMinorUnits: string | null;
  readonly currency: string | null;
}>;

export type RestWsCancelRejectPayload = Readonly<{
  readonly clientOrderId: string;
  readonly originalClientOrderId: string;
  readonly brokerOrderId: string | null;
  readonly venueOrderId: string | null;
  readonly rejectReasonCode: string;
  readonly rejectReasonText: string | null;
  readonly resultingOrderState: BrokerOrderStateKind;
}>;

/**
 * Adapter implementors own provider JSON / stream field names.
 * HELIOS only sees normalized snapshots and events.
 */
export interface RestWsBrokerAdapterPort {
  readonly transport: Extract<BrokerTransportKind, 'REST' | 'WEBSOCKET'>;
  readonly liveBrokerConnected: false;
  normalizeOrderState(snapshot: RestWsOrderStateSnapshot, context: RestWsInboundContext): BrokerOrderState;
  normalizeExecution(payload: RestWsExecutionPayload, context: RestWsInboundContext): BrokerExecutionEvent;
  normalizeCancelReject(payload: RestWsCancelRejectPayload, context: RestWsInboundContext): BrokerCancelReject;
}

export function restWsOrderStateFromSnapshot(
  snapshot: RestWsOrderStateSnapshot,
  context: RestWsInboundContext,
): BrokerOrderState {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    clientOrderId: snapshot.clientOrderId,
    originalClientOrderId: snapshot.originalClientOrderId,
    brokerOrderId: snapshot.brokerOrderId,
    venueOrderId: snapshot.venueOrderId,
    providerAccountId: context.providerAccountId,
    orderState: snapshot.orderState,
    filledQuantityUnits: snapshot.filledQuantityUnits,
    remainingQuantityUnits: snapshot.remainingQuantityUnits,
    averagePriceMinorUnits: snapshot.averagePriceMinorUnits,
    lastUpdatedAt: context.arrivalTime,
    liveBrokerConnected: false,
  });
}

export function restWsExecutionFromPayload(
  payload: RestWsExecutionPayload,
  context: RestWsInboundContext,
): BrokerExecutionEvent {
  return Object.freeze({
    schemaVersion: BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
    eventPurpose: payload.eventPurpose,
    executionId: payload.executionId,
    operationId: context.operationId,
    clientOrderId: payload.clientOrderId,
    originalClientOrderId: payload.originalClientOrderId,
    brokerOrderId: payload.brokerOrderId,
    venueOrderId: payload.venueOrderId,
    providerAccountId: context.providerAccountId,
    resultingOrderState: payload.resultingOrderState,
    eventTime: context.eventTime,
    arrivalTime: context.arrivalTime,
    transport: context.transport,
    fillQuantityUnits: payload.fillQuantityUnits,
    fillPriceMinorUnits: payload.fillPriceMinorUnits,
    feeMinorUnits: payload.feeMinorUnits,
    currency: payload.currency,
    evidenceRef: context.evidenceRef,
    simulation: true,
    grantsExecutionAuthority: false,
  });
}
