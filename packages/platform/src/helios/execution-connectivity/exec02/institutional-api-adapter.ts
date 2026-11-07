/**
 * Proprietary institutional API transport — same canonical surfaces as REST/WS/FIX.
 */

import type { UtcInstant } from '@solstice/domain';
import {
  BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION,
  type BrokerExecutionEvent,
  type BrokerTransportKind,
  type RestWsExecutionPayload,
} from '@solstice/provider-sdk';

export type InstitutionalApiInboundContext = Readonly<{
  readonly transport: Extract<BrokerTransportKind, 'INSTITUTIONAL_API'>;
  readonly providerAccountId: string;
  readonly operationId: string;
  readonly eventTime: UtcInstant;
  readonly arrivalTime: UtcInstant;
  readonly evidenceRef: string | null;
}>;

export function normalizeInstitutionalApiExecution(
  payload: RestWsExecutionPayload,
  context: InstitutionalApiInboundContext,
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

export const INSTITUTIONAL_API_BROKER_SCHEMA = BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION;
