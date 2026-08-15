import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { PaymentId } from './ids.ts';
import type { RailCapability } from './rail-capability.ts';
import type {
  CancellationOutcome,
  CanonicalRailStatus,
  RailClass,
  RailHealthState,
  RailRetryClass,
  RejectionClass,
  ReturnReasonCode,
} from './rail-types.ts';
import type {
  InboundPaymentId,
  OpaqueAccountRef,
  ProviderEventId,
  ProviderId,
  ProviderIdempotencyKey,
  ProviderPaymentId,
  RailMessageReferences,
  RailSubmissionId,
  SettlementReportId,
} from './rail-ids.ts';
import type { RailSubmission } from './rail-submission.ts';

/**
 * Authorized command handed to an adapter. The adapter receives an
 * already-authorized context. It must not issue Execution Authority
 * and must not post ledger journals.
 */
export type AuthorizedRailCommand = {
  readonly authorityId: string;
  readonly actionType: 'INITIATE_PAYMENT' | 'CANCEL_PAYMENT' | 'ACCEPT_INBOUND_PAYMENT';
  readonly submission: RailSubmission;
};

export type RailValidateRouteRequest = {
  readonly rail: RailClass;
  readonly provider: ProviderId;
  readonly sourceCountry: string;
  readonly destinationCountry: string;
  readonly currency: string;
  readonly amount: Money;
  readonly direction: 'INBOUND' | 'OUTBOUND';
};

export type RailValidateRouteResponse =
  | { readonly ok: true; readonly capability: RailCapability }
  | { readonly ok: false; readonly reason: string };

export type RailSubmitResult = {
  readonly status: CanonicalRailStatus;
  readonly retryClass: RailRetryClass;
  readonly rejectionClass: RejectionClass | null;
  readonly references: RailMessageReferences;
  readonly providerStatus: string;
  readonly message: string;
};

export type RailQueryRequest = {
  readonly paymentId: PaymentId;
  readonly idempotencyKey: ProviderIdempotencyKey;
  readonly providerPaymentId: ProviderPaymentId | null;
};

export type RailQueryResponse = {
  readonly found: boolean;
  readonly status: CanonicalRailStatus;
  readonly references: RailMessageReferences;
  readonly providerStatus: string;
};

export type RailCancelRequest = {
  readonly command: AuthorizedRailCommand;
};

export type RailCancelResult = {
  readonly outcome: CancellationOutcome;
  readonly status: CanonicalRailStatus;
  readonly message: string;
};

export type RailStatusUpdate = {
  readonly paymentId: PaymentId;
  readonly railSubmissionId: RailSubmissionId;
  readonly provider: ProviderId;
  readonly status: CanonicalRailStatus;
  readonly references: RailMessageReferences;
  readonly providerEventId: ProviderEventId | null;
  readonly occurredAt: UtcInstant;
  readonly payloadHash: string;
};

export type RailReturnMessage = {
  readonly paymentId: PaymentId;
  readonly originalSubmissionId: RailSubmissionId;
  readonly reason: ReturnReasonCode;
  readonly amount: Money;
  readonly references: RailMessageReferences;
  readonly occurredAt: UtcInstant;
};

export type SettlementReportRequest = {
  readonly provider: ProviderId;
  readonly currency: string;
  readonly settlementDate: string;
};

export type RailReconRequest = {
  readonly paymentId: PaymentId;
  readonly railSubmissionId: RailSubmissionId | null;
};

export type RailHealthSnapshot = {
  readonly provider: ProviderId;
  readonly rail: RailClass;
  readonly health: RailHealthState;
  readonly connectivity: 'SIMULATION';
  readonly checkedAt: UtcInstant;
};

export type InboundRailNotice = {
  readonly inboundId: InboundPaymentId;
  readonly provider: ProviderId;
  readonly rail: RailClass;
  readonly amount: Money;
  readonly destinationReference: OpaqueAccountRef;
  readonly sourceReference: OpaqueAccountRef;
  readonly references: RailMessageReferences;
  readonly purposeReference: string;
};

/**
 * Canonical rail / provider adapter port.
 *
 * Every simulated (and future sandbox) adapter implements this contract.
 * Provider-specific DTOs stay inside the adapter. The payments domain
 * consumes only these types.
 */
export type RailAdapter = {
  readonly capability: RailCapability;
  validateRoute(request: RailValidateRouteRequest): RailValidateRouteResponse;
  submitPayment(command: AuthorizedRailCommand): RailSubmitResult;
  queryPayment(request: RailQueryRequest): RailQueryResponse;
  cancelPayment(request: RailCancelRequest): RailCancelResult;
  acknowledge(update: RailStatusUpdate): RailStatusUpdate;
  applyStatusUpdate(update: RailStatusUpdate): RailStatusUpdate;
  applyReturn(message: RailReturnMessage): RailReturnMessage;
  retrieveSettlementReport(request: SettlementReportRequest): SettlementReportId | null;
  health(): RailHealthSnapshot;
};
