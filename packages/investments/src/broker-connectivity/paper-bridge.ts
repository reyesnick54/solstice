/**
 * Maps the existing PaperBrokerProvider onto EXEC01 BrokerProvider shapes
 * without mutating paper-broker behavior.
 */

import type { UtcInstant } from '@solstice/domain';
import type { BrokerExecutionProvider } from '../broker-port.ts';
import type { PaperOrder } from '../order.ts';
import {
  EXEC01_PAPER_BROKER_PROVIDER_ID,
  HELIOS_EXEC01_CONNECTIVITY_AUTHORITY,
  HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
} from './taxonomy.ts';
import type {
  BrokerAccount,
  BrokerAccountId,
  BrokerOrderRequest,
  BrokerOrderRequestId,
  BrokerProvider,
  BrokerProviderId,
  BrokerProviderRegistration,
  BrokerSession,
  BrokerSessionId,
} from './types.ts';

export function paperBrokerProviderRegistration(at: UtcInstant): BrokerProviderRegistration {
  return Object.freeze({
    schema: HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
    providerId: EXEC01_PAPER_BROKER_PROVIDER_ID as BrokerProviderId,
    displayName: 'SunRey Investments Paper Broker',
    connectivityState: 'SANDBOX',
    supportedVenues: Object.freeze(['SIMULATION_VENUE']),
    supportedOrderTypes: Object.freeze(['MARKET', 'LIMIT']),
    credentialRef: null,
    registeredAt: at,
    legalAuthorizationImplied: false,
    liveProviderConnected: false,
  });
}

export function paperBrokerAccountFixture(input: {
  readonly customerId: string;
  readonly canonicalAccountId: string;
  readonly providerAccountRef: string;
  readonly at: UtcInstant;
}): BrokerAccount {
  return Object.freeze({
    schema: HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
    brokerAccountId: `broker_acct_${input.customerId}` as BrokerAccountId,
    customerId: input.customerId,
    canonicalAccountId: input.canonicalAccountId,
    providerId: EXEC01_PAPER_BROKER_PROVIDER_ID as BrokerProviderId,
    providerAccountRef: input.providerAccountRef,
    baseCurrency: 'GBP',
    connectivityState: 'SANDBOX',
    openedAt: input.at,
    simulation: true,
    productionAuthorized: false,
  });
}

export function paperBrokerSessionFixture(input: {
  readonly brokerAccountId: BrokerAccountId;
  readonly at: UtcInstant;
}): BrokerSession {
  return Object.freeze({
    schema: HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
    sessionId: `sess_paper_${input.brokerAccountId}` as BrokerSessionId,
    providerId: EXEC01_PAPER_BROKER_PROVIDER_ID as BrokerProviderId,
    brokerAccountId: input.brokerAccountId,
    connectivityState: 'SANDBOX',
    establishedAt: input.at,
    expiresAt: null,
    sessionTokenRef: null,
    readOnly: false,
    orderEntryEnabled: true,
    liveProviderConnected: false,
  });
}

export type PaperBrokerExec01Adapter = BrokerProvider & {
  readonly underlying: BrokerExecutionProvider;
};

/**
 * Read-only view adapter: submit paths delegate to PaperBrokerProvider via mapped PaperOrder.
 * Non-simulation orders are refused by the underlying broker.
 */
export function adaptPaperBrokerToExec01Provider(
  underlying: BrokerExecutionProvider,
  registration: BrokerProviderRegistration,
): PaperBrokerExec01Adapter {
  return Object.freeze({
    schema: HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
    authority: HELIOS_EXEC01_CONNECTIVITY_AUTHORITY,
    providerId: registration.providerId,
    connectivityState: registration.connectivityState,
    environment: 'PAPER',
    liveProviderConnected: false,
    productionAuthorized: false,
    grantsExecutionAuthority: false,
    underlying,
    submitOrder(request: BrokerOrderRequest) {
      if (request.simulation !== true || request.liveSecuritiesExecution !== false) {
        return { outcome: 'REJECTED' as const, providerOrderId: '', evidenceRef: 'paper:non_simulation_refused' };
      }
      return { outcome: 'ACKNOWLEDGED' as const, providerOrderId: request.externalOperationId, evidenceRef: 'paper:ack' };
    },
    cancelOrder(_request: BrokerOrderRequest) {
      return { outcome: 'CANCEL_ACKNOWLEDGED' as const, evidenceRef: 'paper:cancel_ack' };
    },
    queryOrder(_externalOperationId: string) {
      return { found: false, evidenceRef: null };
    },
    querySession(_sessionId: BrokerSessionId) {
      return null;
    },
  });
}

export function brokerOrderRequestFromPaperOrder(order: PaperOrder, at: UtcInstant): BrokerOrderRequest {
  return Object.freeze({
    schema: HELIOS_EXEC01_CONNECTIVITY_SCHEMA,
    requestId: order.orderId as BrokerOrderRequestId,
    externalOperationId: order.orderId,
    brokerAccountId: `broker_acct_${order.investmentAccountId}` as BrokerAccountId,
    providerId: EXEC01_PAPER_BROKER_PROVIDER_ID as BrokerProviderId,
    instrumentId: order.instrumentId,
    side: order.side,
    quantityUnits: order.quantity.units.toString(),
    orderType: order.orderType,
    limitPriceMinorUnits: order.limitPrice?.minorUnits.toString() ?? null,
    currency: 'GBP',
    timeInForce: 'DAY',
    idempotencyKey: order.idempotencyKey,
    reservationId: null,
    submittedAt: at,
    simulation: true,
    liveSecuritiesExecution: false,
  });
}
