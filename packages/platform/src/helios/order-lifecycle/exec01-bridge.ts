/**
 * Maps H23 lifecycle records onto EXEC01 broker order-request vocabulary.
 * Canonical broker DTOs live in packages/investments/src/broker-connectivity/.
 */

import type { HeliosProviderOrderPort, ProviderSubmitRequest } from './provider-port.ts';
import type { HeliosOrder } from './types.ts';
import type { HeliosOperationId, HeliosOrderId } from './ids.ts';
import { EXEC01_SANDBOX_HELIOS_PROVIDER_ID, HELIOS_H23_EXEC01_SCHEMA_REF } from './exec01-schema.ts';

export type Exec01BrokerOrderRequest = {
  readonly schema: typeof HELIOS_H23_EXEC01_SCHEMA_REF;
  readonly requestId: string;
  readonly externalOperationId: string;
  readonly brokerAccountId: string;
  readonly providerId: string;
  readonly instrumentId: string;
  readonly side: 'BUY' | 'SELL';
  readonly quantityUnits: string;
  readonly orderType: 'MARKET' | 'LIMIT';
  readonly limitPriceMinorUnits: string | null;
  readonly currency: string;
  readonly timeInForce: string;
  readonly idempotencyKey: string;
  readonly reservationId: string | null;
  readonly submittedAt: import('@solstice/domain').UtcInstant;
  readonly simulation: true;
  readonly liveSecuritiesExecution: false;
};

export function heliosOrderToExec01BrokerOrderRequest(order: HeliosOrder): Exec01BrokerOrderRequest {
  return Object.freeze({
    schema: HELIOS_H23_EXEC01_SCHEMA_REF,
    requestId: order.orderId,
    externalOperationId: order.externalOperationId,
    brokerAccountId: order.providerAccountId,
    providerId: order.providerRoute || EXEC01_SANDBOX_HELIOS_PROVIDER_ID,
    instrumentId: order.instrumentId,
    side: order.side,
    quantityUnits: order.quantityUnits,
    orderType: order.orderType,
    limitPriceMinorUnits: order.limitPriceMinorUnits,
    currency: order.currency,
    timeInForce: order.timeInForce,
    idempotencyKey: order.idempotencyKey,
    reservationId: order.reservationId,
    submittedAt: order.submittedAt ?? order.createdAt,
    simulation: true,
    liveSecuritiesExecution: false,
  });
}

export function exec01BrokerOrderRequestToProviderSubmit(request: Exec01BrokerOrderRequest): ProviderSubmitRequest {
  return Object.freeze({
    externalOperationId: request.externalOperationId,
    operationId: request.requestId as HeliosOperationId,
    orderId: request.requestId as HeliosOrderId,
    instrumentId: request.instrumentId,
    side: request.side,
    quantityUnits: request.quantityUnits,
    orderType: request.orderType,
    limitPriceMinorUnits: request.limitPriceMinorUnits,
    currency: request.currency,
    timeInForce: request.timeInForce,
  });
}

export function describeHeliosProviderAsExec01(provider: HeliosProviderOrderPort): {
  readonly providerId: string;
  readonly environment: HeliosProviderOrderPort['environment'];
  readonly liveProviderConnected: false;
  readonly mappedConnectivityState: 'SANDBOX' | 'READ_ONLY_CONNECTED';
} {
  const mappedConnectivityState =
    provider.environment === 'SIMULATION' || provider.environment === 'SANDBOX' || provider.environment === 'PAPER'
      ? ('SANDBOX' as const)
      : ('READ_ONLY_CONNECTED' as const);
  return Object.freeze({
    providerId: provider.providerId,
    environment: provider.environment,
    liveProviderConnected: false,
    mappedConnectivityState,
  });
}
