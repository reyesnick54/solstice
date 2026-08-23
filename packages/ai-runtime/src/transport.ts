import { err, ok, type Result } from '../../domain/src/result.ts';
import type { SecretReference } from '../../security/src/secrets.ts';
import type { AiCancellationToken } from './types.ts';
import type { AiFailureCode } from './taxonomy.ts';

export const HTTPS_SCHEMES = ['HTTPS'] as const;
export type HttpsScheme = (typeof HTTPS_SCHEMES)[number];

export type HttpsTransportRequest = {
  readonly scheme: HttpsScheme;
  readonly host: string;
  readonly path: string;
  readonly method: 'POST' | 'GET';
  readonly timeoutMs: number;
  readonly correlationId: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Readonly<Record<string, unknown>>;
  readonly credentialRef: SecretReference | null;
  readonly cancel?: AiCancellationToken;
};

export type HttpsTransportSuccess = {
  readonly ok: true;
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
  readonly latencyMs: number;
};

export type HttpsTransportFailure = {
  readonly ok: false;
  readonly code: AiFailureCode;
  readonly detail: string;
  readonly retryable: boolean;
  readonly status: number | null;
};

export type HttpsTransportResult = HttpsTransportSuccess | HttpsTransportFailure;

/**
 * Production-quality HTTPS transport port.
 * Implementations must honor timeout, cancellation, typed errors, and
 * secret-reference credentials. This package does not perform live I/O.
 */
export type HttpsInferenceTransport = {
  readonly kind: 'HTTPS_INFERENCE_TRANSPORT';
  readonly liveConnectivity: false;
  exchange(request: HttpsTransportRequest): HttpsTransportResult;
};

export type FixtureHttpsCase = {
  readonly host: string;
  readonly path: string;
  readonly result: HttpsTransportResult;
};

/**
 * Deterministic HTTPS transport for tests and sandbox. No live sockets.
 */
export class FixtureHttpsTransport implements HttpsInferenceTransport {
  readonly kind = 'HTTPS_INFERENCE_TRANSPORT' as const;
  readonly liveConnectivity = false as const;
  private readonly cases: readonly FixtureHttpsCase[];
  readonly observed: HttpsTransportRequest[] = [];

  constructor(cases: readonly FixtureHttpsCase[] = []) {
    this.cases = cases;
  }

  exchange(request: HttpsTransportRequest): HttpsTransportResult {
    this.observed.push(request);
    if (request.scheme !== 'HTTPS') {
      return fail('MODEL_PROVIDER_ERROR', 'only HTTPS is permitted', false);
    }
    if (request.cancel?.cancelled) {
      return fail('MODEL_CANCELLED', 'request was cancelled before dispatch', false);
    }
    if (request.timeoutMs <= 0) {
      return fail('MODEL_TIMEOUT', 'timeout must be a positive integer', false);
    }
    if (request.credentialRef && !request.credentialRef.href.startsWith('secret:')) {
      return fail('SECRET_IN_PAYLOAD', 'credentials must be secret references', false);
    }
    const matched = this.cases.find((item) => item.host === request.host && item.path === request.path);
    if (!matched) {
      return fail('MODEL_UNAVAILABLE', 'no fixture transport case for host/path', true);
    }
    return matched.result;
  }
}

export function httpsOk(body: Readonly<Record<string, unknown>>, latencyMs = 4, status = 200): HttpsTransportSuccess {
  return Object.freeze({ ok: true, status, body, latencyMs });
}

export function httpsFail(
  code: AiFailureCode,
  detail: string,
  retryable: boolean,
  status: number | null = null,
): HttpsTransportFailure {
  return fail(code, detail, retryable, status);
}

export function classifyHttpsStatus(status: number): Result<true, HttpsTransportFailure> {
  if (status === 429) {
    return err(fail('MODEL_RATE_LIMITED', 'provider rate-limited the request', true, status));
  }
  if (status === 408 || status === 504) {
    return err(fail('MODEL_TIMEOUT', 'provider timed out', true, status));
  }
  if (status >= 500) {
    return err(fail('MODEL_UNAVAILABLE', 'provider server error', true, status));
  }
  if (status >= 400) {
    return err(fail('MODEL_PROVIDER_ERROR', 'provider rejected the request', false, status));
  }
  return ok(true);
}

export function isIdempotentSafeRetry(failure: HttpsTransportFailure): boolean {
  return failure.retryable && (failure.code === 'MODEL_TIMEOUT' || failure.code === 'MODEL_UNAVAILABLE');
}

function fail(
  code: AiFailureCode,
  detail: string,
  retryable: boolean,
  status: number | null = null,
): HttpsTransportFailure {
  return Object.freeze({ ok: false, code, detail, retryable, status });
}
