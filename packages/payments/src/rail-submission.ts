import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { BeneficiaryId, PaymentId } from './ids.ts';
import {
  asOpaqueAccountRef,
  asProviderIdempotencyKey,
  asRailSubmissionId,
  emptyRailReferences,
  type OpaqueAccountRef,
  type ProviderId,
  type ProviderIdempotencyKey,
  type RailMessageReferences,
  type RailSubmissionId,
} from './rail-ids.ts';
import type { CanonicalRailStatus, RailClass, RejectionClass, SettlementClass } from './rail-types.ts';

export type RequestedSettlementMetadata = {
  readonly settlementClass: SettlementClass;
  readonly requestedAt: UtcInstant | null;
};

export type RailSubmission = {
  readonly railSubmissionId: RailSubmissionId;
  readonly paymentId: PaymentId;
  readonly provider: ProviderId;
  readonly rail: RailClass;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly sourceReference: OpaqueAccountRef;
  readonly destinationReference: OpaqueAccountRef;
  readonly beneficiaryReference: BeneficiaryId;
  readonly purposeReference: string;
  readonly idempotencyKey: ProviderIdempotencyKey;
  readonly correlationId: string;
  readonly submittedAt: UtcInstant;
  readonly requestedSettlement: RequestedSettlementMetadata;
  readonly status: CanonicalRailStatus;
  readonly executionUnknown: boolean;
  readonly references: RailMessageReferences;
  readonly rejectionClass: RejectionClass | null;
};

export type RailSubmissionDraft = Omit<
  RailSubmission,
  | 'railSubmissionId'
  | 'submittedAt'
  | 'status'
  | 'executionUnknown'
  | 'references'
  | 'rejectionClass'
  | 'idempotencyKey'
  | 'sourceReference'
  | 'destinationReference'
> & {
  readonly railSubmissionId?: string;
  readonly idempotencyKey: string;
  readonly sourceReference: string;
  readonly destinationReference: string;
};

export function freezeRailSubmission(input: RailSubmission): RailSubmission {
  return Object.freeze({
    ...input,
    requestedSettlement: Object.freeze({ ...input.requestedSettlement }),
    references: Object.freeze({ ...input.references }),
  });
}

export function createRailSubmission(draft: RailSubmissionDraft, submittedAt: UtcInstant): RailSubmission {
  return freezeRailSubmission({
    railSubmissionId: asRailSubmissionId(draft.railSubmissionId ?? `rsub_${draft.paymentId}`),
    paymentId: draft.paymentId,
    provider: draft.provider,
    rail: draft.rail,
    amount: draft.amount,
    currency: draft.currency,
    sourceReference: asOpaqueAccountRef(draft.sourceReference),
    destinationReference: asOpaqueAccountRef(draft.destinationReference),
    beneficiaryReference: draft.beneficiaryReference,
    purposeReference: draft.purposeReference,
    idempotencyKey: asProviderIdempotencyKey(draft.idempotencyKey),
    correlationId: draft.correlationId,
    submittedAt,
    requestedSettlement: draft.requestedSettlement,
    status: 'PENDING',
    executionUnknown: false,
    references: emptyRailReferences(),
    rejectionClass: null,
  });
}

export function withSubmissionStatus(
  submission: RailSubmission,
  status: CanonicalRailStatus,
  patch: Partial<Pick<RailSubmission, 'executionUnknown' | 'references' | 'rejectionClass'>> = {},
): RailSubmission {
  return freezeRailSubmission({
    ...submission,
    status,
    executionUnknown: status === 'SUBMISSION_UNKNOWN' ? true : (patch.executionUnknown ?? false),
    references: patch.references ?? submission.references,
    rejectionClass: patch.rejectionClass ?? submission.rejectionClass,
  });
}

export function providerIdempotencyKeyFor(paymentId: string, intentIdempotencyKey: string): ProviderIdempotencyKey {
  return asProviderIdempotencyKey(`prov_${intentIdempotencyKey}_${paymentId}`);
}
