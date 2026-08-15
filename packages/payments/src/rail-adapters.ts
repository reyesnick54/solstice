import type { UtcInstant } from '../../domain/src/time.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import type { RailCapability } from './rail-capability.ts';
import { capabilitySupports } from './rail-capability.ts';
import {
  asProviderPaymentId,
  asRailReference,
  asSettlementReference,
  asTraceReference,
  emptyRailReferences,
  type ProviderIdempotencyKey,
  type RailMessageReferences,
} from './rail-ids.ts';
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
} from './rail-port.ts';
import type { SettlementReportId } from './rail-ids.ts';
import { retryClassFor, type CanonicalRailStatus, type RailClass } from './rail-types.ts';

export type SimulatedAdapterMode =
  | 'SUCCESS'
  | 'FAIL_BEFORE_SUBMIT'
  | 'FAIL_AFTER_SUBMIT'
  | 'PENDING'
  | 'RETURNED'
  | 'TIMEOUT_BEFORE'
  | 'TIMEOUT_AFTER_UNKNOWN'
  | 'REJECT'
  | 'UNAVAILABLE';

type StoredSubmission = {
  readonly idempotencyKey: ProviderIdempotencyKey;
  readonly result: RailSubmitResult;
  readonly paymentId: string;
};

/**
 * Deterministic simulated adapter. No network, no live credentials,
 * no ledger access, no Execution Authority issuance.
 *
 * Provider-specific status strings stay here. Callers receive canonical
 * statuses only.
 */
export class SimulatedRailAdapter implements RailAdapter {
  readonly capability: RailCapability;
  private readonly modes = new Map<string, SimulatedAdapterMode>();
  private readonly submitted = new Map<string, StoredSubmission>();
  private readonly byPayment = new Map<string, StoredSubmission>();
  private readonly pending = new Set<string>();

  constructor(capability: RailCapability) {
    this.capability = capability;
  }

  setMode(paymentId: string, mode: SimulatedAdapterMode): void {
    this.modes.set(paymentId, mode);
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
    const key = command.submission.idempotencyKey;
    const existing = this.submitted.get(key);
    if (existing) {
      return existing.result;
    }
    const mode = this.modes.get(command.submission.paymentId) ?? 'SUCCESS';
    const result = this.resultFor(command, mode);
    if (mode !== 'TIMEOUT_BEFORE' && mode !== 'UNAVAILABLE' && mode !== 'FAIL_BEFORE_SUBMIT') {
      const stored = { idempotencyKey: key, result, paymentId: command.submission.paymentId };
      this.submitted.set(key, stored);
      this.byPayment.set(command.submission.paymentId, stored);
    }
    if (mode === 'PENDING') {
      this.pending.add(command.submission.paymentId);
    }
    return result;
  }

  queryPayment(request: RailQueryRequest): RailQueryResponse {
    const stored =
      this.byPayment.get(request.paymentId) ??
      this.submitted.get(request.idempotencyKey);
    if (!stored) {
      return {
        found: false,
        status: 'UNKNOWN',
        references: emptyRailReferences(),
        providerStatus: 'NOT_FOUND',
      };
    }
    return {
      found: true,
      status: stored.result.status,
      references: stored.result.references,
      providerStatus: stored.result.providerStatus,
    };
  }

  cancelPayment(request: RailCancelRequest): RailCancelResult {
    if (!this.capability.cancellationSupported) {
      return {
        outcome: 'CANCELLATION_NOT_SUPPORTED',
        status: request.command.submission.status,
        message: 'rail capability does not support cancellation',
      };
    }
    const stored = this.byPayment.get(request.command.submission.paymentId);
    if (stored && (stored.result.status === 'SETTLED' || stored.result.status === 'RETURNED')) {
      return {
        outcome: 'CANCELLATION_TOO_LATE',
        status: stored.result.status,
        message: 'payment already settled',
      };
    }
    const cancelled: RailSubmitResult = {
      status: 'CANCELLED',
      retryClass: 'PERMANENT_FAILURE',
      rejectionClass: null,
      references: stored?.result.references ?? emptyRailReferences(),
      providerStatus: 'SIM_CANCELLED',
      message: 'simulated cancellation accepted',
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
    this.pending.delete(update.paymentId);
    return update;
  }

  applyReturn(message: RailReturnMessage): RailReturnMessage {
    return message;
  }

  retrieveSettlementReport(_request: SettlementReportRequest): SettlementReportId | null {
    return null;
  }

  health(): RailHealthSnapshot {
    return Object.freeze({
      provider: this.capability.provider,
      rail: this.capability.rail,
      health: this.capability.health,
      connectivity: 'SIMULATION',
      checkedAt: asUtcInstant(new Date().toISOString()),
    });
  }

  complete(paymentId: string, at: UtcInstant): RailSubmitResult | null {
    const stored = this.byPayment.get(paymentId);
    if (!stored || !this.pending.has(paymentId)) {
      return stored?.result ?? null;
    }
    const result = this.successResult(stored.paymentId, 'SIM_COMPLETED');
    this.submitted.set(stored.idempotencyKey, { ...stored, result });
    this.byPayment.set(stored.paymentId, { ...stored, result });
    this.pending.delete(paymentId);
    void at;
    return result;
  }

  private resultFor(command: AuthorizedRailCommand, mode: SimulatedAdapterMode): RailSubmitResult {
    const paymentId = command.submission.paymentId;
    if (mode === 'UNAVAILABLE') {
      return {
        status: 'REJECTED',
        retryClass: 'SAFE_TO_RETRY',
        rejectionClass: 'PRE_SUBMISSION_REJECTION',
        references: emptyRailReferences(),
        providerStatus: 'SIM_UNAVAILABLE',
        message: 'simulated provider unavailable',
      };
    }
    if (mode === 'TIMEOUT_BEFORE' || mode === 'FAIL_BEFORE_SUBMIT') {
      return {
        status: 'REJECTED',
        retryClass: mode === 'TIMEOUT_BEFORE' ? 'SAFE_TO_RETRY' : 'PERMANENT_FAILURE',
        rejectionClass: 'PRE_SUBMISSION_REJECTION',
        references: emptyRailReferences(),
        providerStatus: mode === 'TIMEOUT_BEFORE' ? 'SIM_TIMEOUT' : 'SIM_REJECT_BEFORE',
        message:
          mode === 'TIMEOUT_BEFORE'
            ? 'simulated timeout before submission'
            : 'simulated provider rejected before submission',
      };
    }
    if (mode === 'TIMEOUT_AFTER_UNKNOWN') {
      return {
        status: 'SUBMISSION_UNKNOWN',
        retryClass: 'DO_NOT_RETRY_WITHOUT_QUERY',
        rejectionClass: null,
        references: this.refs(paymentId),
        providerStatus: 'SIM_TIMEOUT_AFTER_SEND',
        message: 'request sent; provider acceptance is unknown',
      };
    }
    if (mode === 'FAIL_AFTER_SUBMIT' || mode === 'REJECT') {
      return {
        status: 'REJECTED',
        retryClass: 'PERMANENT_FAILURE',
        rejectionClass: 'PROVIDER_REJECTION',
        references: this.refs(paymentId),
        providerStatus: 'SIM_REJECT_AFTER',
        message: 'simulated provider rejected after submission',
      };
    }
    if (mode === 'PENDING') {
      return {
        status: 'PENDING',
        retryClass: 'SAFE_TO_RETRY',
        rejectionClass: null,
        references: this.refs(paymentId),
        providerStatus: 'SIM_PENDING',
        message: 'simulated provider accepted; settlement pending',
      };
    }
    if (mode === 'RETURNED') {
      return {
        status: 'RETURNED',
        retryClass: 'PERMANENT_FAILURE',
        rejectionClass: 'POST_SETTLEMENT_RETURN',
        references: this.refs(paymentId),
        providerStatus: 'SIM_RETURNED',
        message: 'simulated provider settled then returned',
      };
    }
    return this.successResult(paymentId, 'SIM_SETTLED');
  }

  private successResult(paymentId: string, providerStatus: string): RailSubmitResult {
    return {
      status: 'SETTLED',
      retryClass: 'PERMANENT_FAILURE',
      rejectionClass: null,
      references: this.refs(paymentId),
      providerStatus,
      message: 'simulated provider settled',
    };
  }

  private refs(paymentId: string): RailMessageReferences {
    return Object.freeze({
      providerPaymentId: asProviderPaymentId(`ppay_${this.capability.provider}_${paymentId}`),
      railReference: asRailReference(`rref_${this.capability.rail}_${paymentId}`),
      settlementReference: asSettlementReference(`sref_${paymentId}`),
      returnReference: null,
      traceReference: asTraceReference(`trc_${paymentId}`),
    });
  }
}

export function adapterForCapability(capability: RailCapability): SimulatedRailAdapter {
  return new SimulatedRailAdapter(capability);
}

export function railClassLabel(rail: RailClass): string {
  return rail;
}
