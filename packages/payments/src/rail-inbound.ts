import type { AccountId } from '../../domain/src/account.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import {
  asInboundPaymentId,
  type InboundPaymentId,
  type OpaqueAccountRef,
  type ProviderId,
  type RailMessageReferences,
} from './rail-ids.ts';
import type { RailClass } from './rail-types.ts';

export const INBOUND_STATUSES = [
  'RECEIVED',
  'VERIFIED',
  'PENDING_COMPLIANCE',
  'PENDING_SETTLEMENT',
  'SETTLED',
  'REJECTED',
  'RETURNED',
] as const;
export type InboundStatus = (typeof INBOUND_STATUSES)[number];

export type InboundRailPayment = {
  readonly inboundId: InboundPaymentId;
  readonly provider: ProviderId;
  readonly rail: RailClass;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly destinationAccountId: AccountId | null;
  readonly destinationCustomerId: CustomerId | null;
  readonly destinationReference: OpaqueAccountRef;
  readonly sourceReference: OpaqueAccountRef;
  readonly purposeReference: string;
  readonly references: RailMessageReferences;
  readonly status: InboundStatus;
  readonly screeningRef: string | null;
  readonly journalIds: readonly string[];
  readonly receivedAt: UtcInstant;
  readonly payloadHash: string;
};

export function freezeInbound(row: InboundRailPayment): InboundRailPayment {
  return Object.freeze({
    ...row,
    inboundId: asInboundPaymentId(row.inboundId),
    references: Object.freeze({ ...row.references }),
    journalIds: Object.freeze([...row.journalIds]),
  });
}
