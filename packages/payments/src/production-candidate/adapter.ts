import { asUtcInstant } from '../../../domain/src/time.ts';
import type { RailCapability } from '../rail-capability.ts';
import { capabilitySupports } from '../rail-capability.ts';
import {
  asProviderPaymentId,
  asRailReference,
  asSettlementReference,
  asTraceReference,
  emptyRailReferences,
  type ProviderIdempotencyKey,
  type RailMessageReferences,
} from '../rail-ids.ts';
import type {
  AuthorizedRailCommand,
  RailAdapter,
  RailCancelRequest,
  RailCancelResult,
  RailHealthSnapshot,
  RailQueryRequest,
  RailQueryResponse,
  RailReturnMessage,
  RailStatusUpdate,
  RailSubmitResult,
  RailValidateRouteRequest,
  RailValidateRouteResponse,
  SettlementReportRequest,
} from '../rail-port.ts';
import type { SettlementReportId } from '../rail-ids.ts';
import { decideRetry } from '../rail-retry.ts';
import { normalizeProviderStatus, retryClassFor, type CanonicalRailStatus } from '../rail-types.ts';
import type { CandidateProviderAuthenticator, CandidateProviderAuthConfig } from './auth.ts';
import type { PaymentRailProviderCandidateProfile } from './rail-profile.ts';
import type { PaymentProviderTransport } from './transport.ts';

type StoredSubmission = {
  readonly idempotencyKey: ProviderIdempotencyKey;
  readonly result: RailSubmitResult;
  readonly paymentId: string;
};

/**
 * External provider candidate adapter. Implements the canonical
 * RailAdapter. Receives an already-authorized command. Does not issue
 * Execution Authority and does not post ledger journals.
 */
export class CandidateRailAdapter implements RailAdapter {
  readonly capability: RailCapability;
  readonly canIssueExecutionAuthority = false as const;
  readonly canPostLedger = false as const;
  readonly calledRealProvider = false;
  private readonly profile: PaymentRailProviderCandidateProfile;
  private readonly transport: PaymentProviderTransport;
  private readonly authenticator: CandidateProviderAuthenticator;
  private readonly auth: CandidateProviderAuthConfig;
  private readonly submitted = new Map<string, StoredSubmission>();
  private readonly byPayment = new Map<string, StoredSubmission>();

  constructor(input: {
    readonly capability: RailCapability;
    readonly profile: PaymentRailProviderCandidateProfile;
    readonly transport: PaymentProviderTransport;
    readonly authenticator: CandidateProviderAuthenticator;
    readonly auth: CandidateProviderAuthConfig;
  }) {
    this.capability = input.capability;
    this.profile = input.profile;
    this.transport = input.transport;
    this.authenticator = input.authenticator;
    this.auth = input.auth;
  }

  validateRoute(request: RailValidateRouteRequest): RailValidateRouteResponse {
    if (request.rail !== this.capability.rail || request.provider !== this.capability.provider) {
      return { ok: false, reason: 'adapter_mismatch' };
    }
    const reason = capabilitySupports(this.capability, request);
    if (reason) {
      return { ok: false, reason };
    }
    return { ok: true, capability: this.capability };
  }

  submitPayment(command: AuthorizedRailCommand): RailSubmitResult {
    if (!command.submission.idempotencyKey) {
      return this.fail('REJECTED', 'PRE_SUBMISSION_REJECTION', 'idempotency_required', 'provider idempotency key is mandatory');
    }
    const existing = this.submitted.get(command.submission.idempotencyKey);
    if (existing) {
      return existing.result;
    }
    if (command.submission.executionUnknown || command.submission.status === 'SUBMISSION_UNKNOWN') {
      const decision = decideRetry('SUBMIT', 'SUBMISSION_UNKNOWN', { executionUnknown: true });
      return {
        status: 'SUBMISSION_UNKNOWN',
        retryClass: decision.retryClass,
        rejectionClass: null,
        references: command.submission.references,
        providerStatus: 'QUERY_REQUIRED',
        message: 'SUBMISSION_UNKNOWN requires query before another submit',
      };
    }
    const auth = this.authenticator.resolveCredential(this.auth);
    if (!auth.ok) {
      return this.fail('REJECTED', 'PRE_SUBMISSION_REJECTION', 'AUTH_FAILED', auth.reason);
    }
    const sent = this.transport.execute({
      operation: 'SUBMIT',
      providerId: this.profile.providerId,
      idempotencyKey: command.submission.idempotencyKey,
      correlationId: command.submission.correlationId,
      payload: {
        paymentId: command.submission.paymentId,
        amountMinorUnits: command.submission.amount.minorUnits.toString(),
        currency: command.submission.currency,
      },
    });
    const result = this.mapSubmit(command, sent);
    if (result.status !== 'REJECTED' || result.rejectionClass !== 'PRE_SUBMISSION_REJECTION' || sent.status === 'SUBMISSION_UNKNOWN') {
      const stored = {
        idempotencyKey: command.submission.idempotencyKey,
        result,
        paymentId: command.submission.paymentId,
      };
      if (sent.status !== 'TIMEOUT' && sent.status !== 'UNAVAILABLE' && sent.status !== 'AUTH_FAILED') {
        this.submitted.set(command.submission.idempotencyKey, stored);
        this.byPayment.set(command.submission.paymentId, stored);
      }
    }
    return result;
  }

  queryPayment(request: RailQueryRequest): RailQueryResponse {
    const stored = this.byPayment.get(request.paymentId) ?? this.submitted.get(request.idempotencyKey);
    const queried = this.transport.execute({
      operation: 'QUERY',
      providerId: this.profile.providerId,
      idempotencyKey: request.idempotencyKey,
      payload: { paymentId: request.paymentId, providerPaymentId: request.providerPaymentId },
    });
    if (stored) {
      const status = normalizeProviderStatus(String(queried.body.providerStatus ?? queried.status));
      return {
        found: true,
        status: queried.ok || stored.result.status === 'SUBMISSION_UNKNOWN' ? (queried.ok ? status : stored.result.status) : stored.result.status,
        references: stored.result.references,
        providerStatus: String(queried.body.providerStatus ?? queried.status),
      };
    }
    if (!queried.ok) {
      return { found: false, status: 'UNKNOWN', references: emptyRailReferences(), providerStatus: queried.status };
    }
    return {
      found: true,
      status: normalizeProviderStatus(String(queried.body.providerStatus ?? queried.status)),
      references: emptyRailReferences(),
      providerStatus: String(queried.body.providerStatus ?? queried.status),
    };
  }

  cancelPayment(request: RailCancelRequest): RailCancelResult {
    if (!this.profile.supportsCancellation || !this.capability.cancellationSupported) {
      return {
        outcome: 'CANCELLATION_NOT_SUPPORTED',
        status: request.command.submission.status,
        message: 'cancellation is not supported by this rail candidate',
      };
    }
    const stored = this.byPayment.get(request.command.submission.paymentId);
    if (stored && (stored.result.status === 'SETTLED' || stored.result.status === 'RETURNED')) {
      return {
        outcome: 'CANCELLATION_TOO_LATE',
        status: stored.result.status,
        message: 'payment already settled or returned',
      };
    }
    const sent = this.transport.execute({
      operation: 'CANCEL',
      providerId: this.profile.providerId,
      idempotencyKey: request.command.submission.idempotencyKey,
      payload: { paymentId: request.command.submission.paymentId },
    });
    if (sent.status === 'CANCELLATION_TOO_LATE') {
      return { outcome: 'CANCELLATION_TOO_LATE', status: stored?.result.status ?? 'UNKNOWN', message: 'provider refused late cancel' };
    }
    if (sent.status === 'CANCELLATION_NOT_SUPPORTED') {
      return { outcome: 'CANCELLATION_NOT_SUPPORTED', status: stored?.result.status ?? request.command.submission.status, message: 'provider cannot cancel' };
    }
    if (!sent.ok) {
      return { outcome: 'CANCELLATION_UNKNOWN', status: stored?.result.status ?? 'UNKNOWN', message: 'provider cancel result unknown' };
    }
    const cancelled: RailSubmitResult = {
      status: 'CANCELLED',
      retryClass: 'PERMANENT_FAILURE',
      rejectionClass: null,
      references: stored?.result.references ?? emptyRailReferences(),
      providerStatus: String(sent.body.providerStatus ?? 'CANCELED'),
      message: 'provider cancelled',
    };
    if (stored) {
      this.submitted.set(stored.idempotencyKey, { ...stored, result: cancelled });
      this.byPayment.set(stored.paymentId, { ...stored, result: cancelled });
    }
    return { outcome: 'CANCELLED', status: 'CANCELLED', message: 'cancelled' };
  }

  acknowledge(update: RailStatusUpdate): RailStatusUpdate {
    return update;
  }

  applyStatusUpdate(update: RailStatusUpdate): RailStatusUpdate {
    const stored = this.byPayment.get(update.paymentId);
    if (stored) {
      const next: RailSubmitResult = {
        ...stored.result,
        status: update.status,
        retryClass: retryClassFor(update.status, 'CALLBACK'),
      };
      this.submitted.set(stored.idempotencyKey, { ...stored, result: next });
      this.byPayment.set(stored.paymentId, { ...stored, result: next });
    }
    return update;
  }

  applyReturn(message: RailReturnMessage): RailReturnMessage {
    return message;
  }

  retrieveSettlementReport(_request: SettlementReportRequest): SettlementReportId | null {
    return null;
  }

  health(): RailHealthSnapshot {
    const sent = this.transport.execute({
      operation: 'HEALTH',
      providerId: this.profile.providerId,
      payload: {},
    });
    return Object.freeze({
      provider: this.capability.provider,
      rail: this.capability.rail,
      health: sent.ok ? 'AVAILABLE' : 'UNAVAILABLE',
      connectivity: 'SIMULATION',
      checkedAt: asUtcInstant(new Date().toISOString()),
    });
  }

  private mapSubmit(command: AuthorizedRailCommand, sent: { readonly ok: boolean; readonly status: string; readonly body: Readonly<Record<string, unknown>> }): RailSubmitResult {
    if (sent.status === 'TIMEOUT') {
      return this.fail('REJECTED', 'PRE_SUBMISSION_REJECTION', 'TIMEOUT_BEFORE', 'timeout before submit');
    }
    if (sent.status === 'UNAVAILABLE' || sent.status === 'AUTH_FAILED' || sent.status === 'RATE_LIMITED') {
      return this.fail('REJECTED', 'PRE_SUBMISSION_REJECTION', sent.status, 'provider unavailable before submit');
    }
    if (sent.status === 'SUBMISSION_UNKNOWN') {
      return {
        status: 'SUBMISSION_UNKNOWN',
        retryClass: 'DO_NOT_RETRY_WITHOUT_QUERY',
        rejectionClass: null,
        references: this.refs(command.submission.paymentId, sent.body),
        providerStatus: 'UNKNOWN_SUBMISSION',
        message: 'request may have been sent; query before retry',
      };
    }
    const status = normalizeProviderStatus(String(sent.body.providerStatus ?? sent.status));
    return {
      status,
      retryClass: retryClassFor(status, 'SUBMIT'),
      rejectionClass: status === 'REJECTED' ? 'PROVIDER_REJECTION' : null,
      references: this.refs(command.submission.paymentId, sent.body),
      providerStatus: String(sent.body.providerStatus ?? sent.status),
      message: 'candidate provider response',
    };
  }

  private fail(
    status: CanonicalRailStatus,
    rejectionClass: 'PRE_SUBMISSION_REJECTION' | 'PROVIDER_REJECTION',
    providerStatus: string,
    message: string,
  ): RailSubmitResult {
    return {
      status,
      retryClass: retryClassFor(status, 'SUBMIT'),
      rejectionClass,
      references: emptyRailReferences(),
      providerStatus,
      message,
    };
  }

  private refs(paymentId: string, body: Readonly<Record<string, unknown>>): RailMessageReferences {
    const providerPaymentId = String(body.providerPaymentId ?? `ppay_${this.profile.providerId}_${paymentId}`);
    return Object.freeze({
      providerPaymentId: asProviderPaymentId(providerPaymentId),
      railReference: asRailReference(`rref_${this.profile.railClass}_${paymentId}`),
      settlementReference: asSettlementReference(`sref_${paymentId}`),
      returnReference: null,
      traceReference: asTraceReference(`trc_${paymentId}`),
    });
  }
}
