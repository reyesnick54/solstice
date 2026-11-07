import type { CustomerId, UtcInstant } from '@solstice/domain';

import { executionDropCopyEventIdFor } from './ids.ts';
import { HELIOS_EXEC12_SCHEMA, type ExecutionDropCopyIngestKind } from './taxonomy.ts';
import type { ExecutionDropCopyEvent } from './types.ts';

export type IngestDropCopyInput = {
  readonly ingestKind: ExecutionDropCopyIngestKind;
  readonly providerId: string;
  readonly brokerAccountId: string;
  readonly customerId: CustomerId;
  readonly brokerOrderId?: string | null;
  readonly externalOperationId?: string | null;
  readonly clientOrderId?: string | null;
  readonly instrumentId?: string | null;
  readonly quantityUnits?: string | null;
  readonly priceMinorUnits?: string | null;
  readonly feeMinorUnits?: string | null;
  readonly cashDeltaMinorUnits?: string | null;
  readonly currency?: string | null;
  readonly settlementId?: string | null;
  readonly corporateActionId?: string | null;
  readonly providerTimestamp: UtcInstant;
  readonly now: UtcInstant;
  readonly dedupeKey: string;
  readonly rawPayloadRef: string;
};

export function materializeExecutionDropCopyEvent(input: IngestDropCopyInput): ExecutionDropCopyEvent {
  return Object.freeze({
    eventId: executionDropCopyEventIdFor(input.dedupeKey),
    schemaVersion: HELIOS_EXEC12_SCHEMA,
    ingestKind: input.ingestKind,
    providerId: input.providerId,
    brokerAccountId: input.brokerAccountId,
    customerId: input.customerId,
    brokerOrderId: input.brokerOrderId ?? null,
    externalOperationId: input.externalOperationId ?? null,
    clientOrderId: input.clientOrderId ?? null,
    instrumentId: input.instrumentId ?? null,
    quantityUnits: input.quantityUnits ?? null,
    priceMinorUnits: input.priceMinorUnits ?? null,
    feeMinorUnits: input.feeMinorUnits ?? null,
    cashDeltaMinorUnits: input.cashDeltaMinorUnits ?? null,
    currency: input.currency ?? null,
    settlementId: input.settlementId ?? null,
    corporateActionId: input.corporateActionId ?? null,
    providerTimestamp: input.providerTimestamp,
    ingestedAt: input.now,
    dedupeKey: input.dedupeKey,
    rawPayloadRef: input.rawPayloadRef,
    simulation: true,
    liveBrokerConnected: false,
  });
}

/** Map ingest kinds required by EXEC12 contract. */
export const EXEC12_REQUIRED_INGEST_KINDS = Object.freeze([
  'ORDER_ACKNOWLEDGEMENT',
  'EXECUTION_REPORT',
  'TRADE_CORRECTION',
  'BUST',
  'CANCEL_ACKNOWLEDGEMENT',
  'POSITION',
  'CASH',
  'FEE',
  'SETTLEMENT',
  'CORPORATE_ACTION',
] as const satisfies readonly ExecutionDropCopyIngestKind[]);
