/**
 * Maps H23 HeliosProviderOrderPort DTOs onto EXEC01 broker connectivity vocabulary.
 */

import type { HeliosProviderOrderPort, ProviderSubmitRequest } from '../../order-lifecycle/provider-port.ts';
import type { HeliosOrder } from '../../order-lifecycle/types.ts';
import { EXEC01_SANDBOX_HELIOS_PROVIDER_ID } from '../../../../../investments/src/broker-connectivity/taxonomy.ts';
import type {
  BrokerOrderRequest,
  BrokerOrderRequestId,
  BrokerProviderId,
  BrokerAccountId,
} from '../../../../../investments/src/broker-connectivity/types.ts';
import { HELIOS_EXEC01_CONNECTIVITY_SCHEMA } from '../../../../../investments/src/broker-connectivity/taxonomy.ts';

export function heliosOrderToBrokerOrderRequest(order: HeliosOrder): BrokerOrderRequest {
  return Object.freeze({
    schema: HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
    requestId: order.orderId as unknown as BrokerOrderRequestId,
    externalOperationId: order.externalOperationId,
    brokerAccountId: order.providerAccountId as BrokerAccountId,
    providerId: (order.providerRoute || EXEC01_SANDBOX_HELIOS_PROVIDER_ID) as BrokerProviderId,
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

export function brokerOrderRequestToProviderSubmit(request: BrokerOrderRequest): ProviderSubmitRequest {
  return Object.freeze({
    externalOperationId: request.externalOperationId,
    operationId: request.requestId as unknown as import('../../order-lifecycle/ids.ts').HeliosOperationId,
    orderId: request.requestId as unknown as import('../../order-lifecycle/ids.ts').HeliosOrderId,
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
