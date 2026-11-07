import type { UtcInstant } from '@solstice/domain';
import { BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION } from './taxonomy.ts';
import type { BrokerTransportKind } from './taxonomy.ts';

/** Client-supplied idempotency key for a single order attempt. */
export type BrokerClientOrderId = string;

/** Root client id for an immutable cancel/replace chain. */
export type BrokerOriginalClientOrderId = string;

/** Broker-assigned order identifier (may differ from venue). */
export type BrokerOrderId = string;

/** Venue or exchange-assigned order identifier. */
export type BrokerVenueOrderId = string;

/** Unique fill / execution identifier from the broker or venue. */
export type BrokerExecutionId = string;

/** HELIOS-side correlation for a broker operation (submit/cancel/replace/query). */
export type BrokerOperationId = string;

/** Provider account scope for the order. */
export type BrokerProviderAccountId = string;

export type BrokerOrderIdentifiers = Readonly<{
  readonly clientOrderId: BrokerClientOrderId;
  readonly originalClientOrderId: BrokerOriginalClientOrderId;
  readonly brokerOrderId: BrokerOrderId | null;
  readonly venueOrderId: BrokerVenueOrderId | null;
  readonly providerAccountId: BrokerProviderAccountId;
}>;

export type BrokerExecutionIdentifiers = Readonly<{
  readonly executionId: BrokerExecutionId;
  readonly operationId: BrokerOperationId;
  readonly clientOrderId: BrokerClientOrderId;
  readonly originalClientOrderId: BrokerOriginalClientOrderId;
  readonly brokerOrderId: BrokerOrderId | null;
  readonly venueOrderId: BrokerVenueOrderId | null;
}>;

export type BrokerCommandEnvelope = Readonly<{
  readonly schemaVersion: typeof BROKER_EXECUTION_PROTOCOL_SCHEMA_VERSION;
  readonly operationId: BrokerOperationId;
  readonly providerAccountId: BrokerProviderAccountId;
  readonly transport: BrokerTransportKind;
  readonly submittedAt: UtcInstant;
  readonly idempotencyKey: string;
}>;
