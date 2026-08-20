/**
 * Injected sandbox transport. The only implementations in this chunk
 * are in-process fixtures. No fetch, axios, undici, vendor SDK, or
 * real bank endpoint.
 */

export const PAYMENT_TRANSPORT_OPERATIONS = [
  'SUBMIT',
  'QUERY',
  'CANCEL',
  'WEBHOOK_VERIFY',
  'SETTLEMENT_REPORT',
  'FX_QUOTE',
  'HEALTH',
  'PROVIDER_BALANCE',
] as const;
export type PaymentTransportOperation = (typeof PAYMENT_TRANSPORT_OPERATIONS)[number];

export type PaymentTransportRequest = {
  readonly operation: PaymentTransportOperation;
  readonly providerId: string;
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type PaymentTransportResponse = {
  readonly ok: boolean;
  readonly status: string;
  readonly body: Readonly<Record<string, unknown>>;
  readonly networkUsed: false;
};

export type PaymentProviderTransport = {
  readonly kind: 'FIXTURE' | 'SCRIPTED_SANDBOX';
  readonly networkEnabled: false;
  execute(request: PaymentTransportRequest): PaymentTransportResponse;
};

export type ScriptedTransportOutcome =
  | 'SUCCESS'
  | 'ACCEPTED'
  | 'PENDING'
  | 'REJECTED'
  | 'TIMEOUT_BEFORE_SUBMIT'
  | 'TIMEOUT_AFTER_UNKNOWN'
  | 'AUTH_FAILED'
  | 'OUTAGE'
  | 'RATE_LIMITED'
  | 'SCHEMA_INCOMPATIBLE'
  | 'STALE'
  | 'CANCELLED'
  | 'CANCELLATION_TOO_LATE'
  | 'CANCELLATION_NOT_SUPPORTED'
  | 'RETURNED';

function response(
  ok: boolean,
  status: string,
  body: Readonly<Record<string, unknown>> = {},
): PaymentTransportResponse {
  return Object.freeze({ ok, status, body: Object.freeze({ ...body }), networkUsed: false });
}

export class FixturePaymentTransport implements PaymentProviderTransport {
  readonly kind = 'FIXTURE' as const;
  readonly networkEnabled = false as const;
  readonly calledRealProvider = false;

  execute(request: PaymentTransportRequest): PaymentTransportResponse {
    if (request.operation === 'HEALTH') {
      return response(true, 'AVAILABLE', { health: 'AVAILABLE' });
    }
    if (request.operation === 'FX_QUOTE') {
      return response(true, 'QUOTED', {
        providerQuoteId: `fxq_fixture_${request.providerId}`,
        numerator: '3745',
        denominator: '1000',
        feeMinorUnits: '1500',
      });
    }
    if (request.operation === 'PROVIDER_BALANCE') {
      return response(true, 'BALANCE', { minorUnits: '9990000', currency: 'USD' });
    }
    if (request.operation === 'SETTLEMENT_REPORT') {
      return response(true, 'REPORT', { grossMinorUnits: String(request.payload.amountMinorUnits ?? '0') });
    }
    if (request.operation === 'QUERY') {
      return response(true, 'SETTLED', { providerStatus: 'COMPLETED' });
    }
    if (request.operation === 'CANCEL') {
      return response(true, 'CANCELLED', { providerStatus: 'CANCELED' });
    }
    return response(true, 'ACCEPTED', { providerStatus: 'ACK', providerPaymentId: `ppay_${request.idempotencyKey ?? 'fixture'}` });
  }
}

export class ScriptedSandboxTransport implements PaymentProviderTransport {
  readonly kind = 'SCRIPTED_SANDBOX' as const;
  readonly networkEnabled = false as const;
  readonly calledRealProvider = false;
  private readonly scripts = new Map<string, ScriptedTransportOutcome>();
  private readonly submitted = new Map<string, PaymentTransportResponse>();

  script(key: string, outcome: ScriptedTransportOutcome): void {
    this.scripts.set(key, outcome);
  }

  execute(request: PaymentTransportRequest): PaymentTransportResponse {
    const key = request.idempotencyKey ?? request.correlationId ?? request.providerId;
    if (request.operation === 'SUBMIT' && request.idempotencyKey) {
      const existing = this.submitted.get(request.idempotencyKey);
      if (existing) {
        return existing;
      }
    }
    const outcome = this.scripts.get(key) ?? 'SUCCESS';
    const result = this.resultFor(request, outcome);
    if (request.operation === 'SUBMIT' && request.idempotencyKey && outcome !== 'TIMEOUT_BEFORE_SUBMIT' && outcome !== 'OUTAGE' && outcome !== 'AUTH_FAILED') {
      this.submitted.set(request.idempotencyKey, result);
    }
    return result;
  }

  private resultFor(request: PaymentTransportRequest, outcome: ScriptedTransportOutcome): PaymentTransportResponse {
    if (request.operation === 'FX_QUOTE') {
      if (outcome === 'OUTAGE') {
        return response(false, 'UNAVAILABLE', { reason: 'PROVIDER_UNAVAILABLE' });
      }
      if (outcome === 'AUTH_FAILED') {
        return response(false, 'AUTH_FAILED', { reason: 'AUTH_FAILED' });
      }
      if (outcome === 'RATE_LIMITED') {
        return response(false, 'RATE_LIMITED', { reason: 'RATE_LIMITED' });
      }
      if (outcome === 'SCHEMA_INCOMPATIBLE') {
        return response(false, 'SCHEMA_INCOMPATIBLE', { reason: 'SCHEMA_INCOMPATIBLE' });
      }
      if (outcome === 'STALE') {
        return response(true, 'QUOTED', { providerQuoteId: 'fxq_stale', numerator: '3745', denominator: '1000', stale: true });
      }
      return response(true, 'QUOTED', { providerQuoteId: `fxq_${keyFor(request)}`, numerator: '3745', denominator: '1000' });
    }
    switch (outcome) {
      case 'TIMEOUT_BEFORE_SUBMIT':
        return response(false, 'TIMEOUT', { providerStatus: 'TIMEOUT_BEFORE' });
      case 'TIMEOUT_AFTER_UNKNOWN':
        return response(false, 'SUBMISSION_UNKNOWN', { providerStatus: 'UNKNOWN_SUBMISSION' });
      case 'AUTH_FAILED':
        return response(false, 'AUTH_FAILED', { providerStatus: 'AUTH_FAILED' });
      case 'OUTAGE':
        return response(false, 'UNAVAILABLE', { providerStatus: 'UNAVAILABLE' });
      case 'RATE_LIMITED':
        return response(false, 'RATE_LIMITED', { providerStatus: 'RATE_LIMITED' });
      case 'SCHEMA_INCOMPATIBLE':
        return response(false, 'SCHEMA_INCOMPATIBLE', { providerStatus: 'SCHEMA_INCOMPATIBLE' });
      case 'REJECTED':
        return response(true, 'REJECTED', { providerStatus: 'NACK' });
      case 'PENDING':
        return response(true, 'PENDING', { providerStatus: 'QUEUED' });
      case 'ACCEPTED':
        return response(true, 'ACCEPTED', { providerStatus: 'ACK' });
      case 'CANCELLED':
        return response(true, 'CANCELLED', { providerStatus: 'CANCELED' });
      case 'CANCELLATION_TOO_LATE':
        return response(true, 'CANCELLATION_TOO_LATE', { providerStatus: 'TOO_LATE' });
      case 'CANCELLATION_NOT_SUPPORTED':
        return response(true, 'CANCELLATION_NOT_SUPPORTED', { providerStatus: 'NO_CANCEL' });
      case 'RETURNED':
        return response(true, 'RETURNED', { providerStatus: 'RETURN' });
      case 'STALE':
        return response(false, 'STALE', { providerStatus: 'STALE' });
      default:
        return response(true, 'SETTLED', { providerStatus: 'COMPLETED', providerPaymentId: `ppay_${keyFor(request)}` });
    }
  }
}

function keyFor(request: PaymentTransportRequest): string {
  return request.idempotencyKey ?? request.correlationId ?? request.providerId;
}

export function assertNoOutboundNetwork(transport: PaymentProviderTransport): void {
  if (transport.networkEnabled !== false) {
    throw new Error('payment provider transport must not enable network');
  }
}
