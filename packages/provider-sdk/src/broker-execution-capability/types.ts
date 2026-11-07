import type { UtcInstant } from '@solstice/domain';
import { BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION } from './taxonomy.ts';
import type {
  BrokerEventPurpose,
  BrokerOrderSide,
  BrokerOrderStateKind,
  BrokerOrderType,
  BrokerTimeInForce,
  BrokerTransportKind,
} from './taxonomy.ts';
import type { BrokerCommandEnvelope } from './identifiers.ts';

export type BrokerOrderCommand = Readonly<
  BrokerCommandEnvelope & {
    readonly kind: 'ORDER';
    readonly clientOrderId: string;
    readonly originalClientOrderId: string;
    readonly instrumentId: string;
    readonly side: BrokerOrderSide;
    readonly orderType: BrokerOrderType;
    readonly quantityUnits: string;
    readonly limitPriceMinorUnits: string | null;
    readonly stopPriceMinorUnits: string | null;
    readonly timeInForce: BrokerTimeInForce;
    readonly currency: string;
  }
>;

export type BrokerCancelCommand = Readonly<
  BrokerCommandEnvelope & {
    readonly kind: 'CANCEL';
    readonly clientOrderId: string;
    readonly originalClientOrderId: string;
    readonly brokerOrderId: string | null;
    readonly venueOrderId: string | null;
    readonly targetClientOrderId: string;
  }
>;

export type BrokerReplaceCommand = Readonly<
  BrokerCommandEnvelope & {
    readonly kind: 'REPLACE';
    readonly clientOrderId: string;
    readonly originalClientOrderId: string;
    readonly replacesClientOrderId: string;
    readonly brokerOrderId: string | null;
    readonly venueOrderId: string | null;
    readonly instrumentId: string;
    readonly side: BrokerOrderSide;
    readonly orderType: BrokerOrderType;
    readonly quantityUnits: string;
    readonly limitPriceMinorUnits: string | null;
    readonly stopPriceMinorUnits: string | null;
    readonly timeInForce: BrokerTimeInForce;
    readonly currency: string;
  }
>;

export type BrokerStatusQuery = Readonly<
  BrokerCommandEnvelope & {
    readonly kind: 'STATUS_QUERY';
    readonly clientOrderId: string | null;
    readonly originalClientOrderId: string | null;
    readonly brokerOrderId: string | null;
    readonly venueOrderId: string | null;
  }
>;

/**
 * Snapshot of canonical order state. Distinct from {@link BrokerExecutionEvent} which carries event purpose.
 */
export type BrokerOrderState = Readonly<{
  readonly schemaVersion: typeof BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION;
  readonly clientOrderId: string;
  readonly originalClientOrderId: string;
  readonly brokerOrderId: string | null;
  readonly venueOrderId: string | null;
  readonly providerAccountId: string;
  readonly orderState: BrokerOrderStateKind;
  readonly filledQuantityUnits: string;
  readonly remainingQuantityUnits: string;
  readonly averagePriceMinorUnits: string | null;
  readonly lastUpdatedAt: UtcInstant;
  readonly liveBrokerConnected: false;
}>;

export type BrokerExecutionEvent = Readonly<{
  readonly schemaVersion: typeof BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION;
  readonly eventPurpose: BrokerEventPurpose;
  readonly executionId: string;
  readonly operationId: string;
  readonly clientOrderId: string;
  readonly originalClientOrderId: string;
  readonly brokerOrderId: string | null;
  readonly venueOrderId: string | null;
  readonly providerAccountId: string;
  /** Observed order state after this event — not interchangeable with eventPurpose. */
  readonly resultingOrderState: BrokerOrderStateKind;
  readonly eventTime: UtcInstant;
  readonly arrivalTime: UtcInstant;
  readonly transport: BrokerTransportKind;
  readonly fillQuantityUnits: string | null;
  readonly fillPriceMinorUnits: string | null;
  readonly feeMinorUnits: string | null;
  readonly currency: string | null;
  readonly evidenceRef: string | null;
  readonly simulation: true;
  readonly grantsExecutionAuthority: false;
}>;

export type BrokerCancelReject = Readonly<{
  readonly schemaVersion: typeof BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION;
  readonly eventPurpose: 'REJECTION';
  readonly operationId: string;
  readonly clientOrderId: string;
  readonly originalClientOrderId: string;
  readonly brokerOrderId: string | null;
  readonly venueOrderId: string | null;
  readonly providerAccountId: string;
  readonly rejectReasonCode: string;
  readonly rejectReasonText: string | null;
  readonly resultingOrderState: BrokerOrderStateKind;
  readonly eventTime: UtcInstant;
  readonly arrivalTime: UtcInstant;
  readonly transport: BrokerTransportKind;
  readonly evidenceRef: string | null;
  readonly simulation: true;
}>;

export type BrokerProtocolCommand = BrokerOrderCommand | BrokerCancelCommand | BrokerReplaceCommand | BrokerStatusQuery;
