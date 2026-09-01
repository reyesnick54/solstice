import { err, ok, type Result } from '../../domain/src/result.ts';
import { execFileSync } from 'node:child_process';
import type { SecretProvider, SecretReference } from '../../security/src/secrets.ts';
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
  readonly liveConnectivity: boolean;
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

export type NodeHttpsInferenceTransportOptions = {
  readonly enabled?: boolean;
  readonly secrets: SecretProvider;
};

/**
 * Explicit preview-only HTTPS adapter. It is intentionally synchronous because
 * the canonical inference ports are synchronous. It uses no shell and resolves
 * credentials only inside this boundary; fixture transport remains the CI path.
 */
export class NodeHttpsInferenceTransport implements HttpsInferenceTransport {
  readonly kind = 'HTTPS_INFERENCE_TRANSPORT' as const;
  readonly liveConnectivity: boolean;
  private readonly enabled: boolean;
  private readonly secrets: SecretProvider;

  constructor(options: NodeHttpsInferenceTransportOptions) {
    this.enabled = options.enabled === true;
    this.liveConnectivity = this.enabled;
    this.secrets = options.secrets;
  }

  exchange(request: HttpsTransportRequest): HttpsTransportResult {
    if (!this.enabled) return fail('EXTERNAL_NETWORK_DISABLED', 'external AI preview connectivity is disabled', false);
    if (request.scheme !== 'HTTPS' || request.method !== 'POST') return fail('MODEL_POLICY_BLOCKED', 'only HTTPS POST is permitted', false);
    if (request.cancel?.cancelled) return fail('MODEL_CANCELLED', 'request was cancelled before dispatch', false);
    if (request.timeoutMs <= 0) return fail('MODEL_TIMEOUT', 'timeout must be positive', false);
    if (!request.credentialRef) return fail('AUTHORIZATION_REQUIRED', 'a credential reference is required', false);
    const resolved = this.secrets.resolve(request.credentialRef);
    if (!resolved.ok) return fail('AUTHORIZATION_REQUIRED', 'provider credential could not be resolved', false);
    const url = `https:${'//'}${request.host}${request.path.startsWith('/') ? request.path : `/${request.path}`}`;
    const args = [
      '--silent', '--show-error', '--request', 'POST', '--max-time',
      String(Math.ceil(request.timeoutMs / 1000)), '--header', 'content-type: application/json',
      '--header', `x-request-id: ${request.correlationId}`, '--header', `authorization: Bearer ${resolved.value.revealUtf8()}`,
      '--data-binary', JSON.stringify(request.body), '--write-out', '\n__SUNREY_STATUS:%{http_code}', url,
    ];
    const started = Date.now();
    try {
      const output = execFileSync('curl', args, { encoding: 'utf8', timeout: request.timeoutMs + 250, windowsHide: true });
      const marker = '\n__SUNREY_STATUS:';
      const at = output.lastIndexOf(marker);
      const status = Number(output.slice(at + marker.length).trim());
      const bodyText = at >= 0 ? output.slice(0, at) : output;
      const parsed: unknown = JSON.parse(bodyText);
      if (!parsed || typeof parsed !== 'object') return fail('MODEL_OUTPUT_INVALID', 'provider response was not a JSON object', false, status);
      const classified = classifyHttpsStatus(status, parsed as Readonly<Record<string, unknown>>);
      if (!classified.ok) return classified.error;
      return httpsOk(parsed as Readonly<Record<string, unknown>>, Date.now() - started, status);
    } catch (error) {
      if (request.cancel?.cancelled) return fail('MODEL_CANCELLED', 'request was cancelled', false);
      const detail = error instanceof Error ? error.message.toLowerCase() : '';
      return fail(detail.includes('timed out') || detail.includes('timeout') ? 'MODEL_TIMEOUT' : 'MODEL_UNAVAILABLE',
        'external AI preview provider request failed', true);
    }
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

export function classifyHttpsStatus(
  status: number,
  body?: Readonly<Record<string, unknown>> | null,
): Result<true, HttpsTransportFailure> {
  if (status === 401) {
    return err(fail('AUTHENTICATION_FAILURE', 'provider rejected credentials', false, status));
  }
  if (status === 402) {
    return err(fail('BILLING_DISABLED', 'provider billing is disabled for this account', false, status));
  }
  if (status === 429) {
    const bodyText = extractBodyText(body);
    const code = bodyText.includes('quota') ? 'INSUFFICIENT_QUOTA' : 'MODEL_RATE_LIMITED';
    return err(fail(code, 'provider rate-limited or quota exhausted', true, status));
  }
  if (status === 408 || status === 504) {
    return err(fail('MODEL_TIMEOUT', 'provider timed out', true, status));
  }
  if (status === 404) {
    const bodyText = extractBodyText(body);
    const code = bodyText.includes('model') ? 'MODEL_NOT_AVAILABLE' : 'MODEL_UNAVAILABLE';
    return err(fail(code, 'provider resource not found', false, status));
  }
  if (status >= 500) {
    return err(fail('MODEL_UNAVAILABLE', 'provider server error', true, status));
  }
  if (status >= 400) {
    const bodyText = extractBodyText(body);
    if (bodyText.includes('billing') || bodyText.includes('payment required')) {
      return err(fail('BILLING_DISABLED', 'provider billing blocked the request', false, status));
    }
    if (bodyText.includes('model') && (bodyText.includes('not found') || bodyText.includes('unavailable'))) {
      return err(fail('MODEL_NOT_AVAILABLE', 'configured model is not available', false, status));
    }
    return err(fail('MODEL_PROVIDER_ERROR', 'provider rejected the request', false, status));
  }
  return ok(true);
}

function extractBodyText(body: Readonly<Record<string, unknown>> | null | undefined): string {
  if (!body) {
    return '';
  }
  const parts: string[] = [];
  if (typeof body.error === 'string') parts.push(body.error);
  if (body.error && typeof body.error === 'object') {
    const error = body.error as Record<string, unknown>;
    if (typeof error.message === 'string') parts.push(error.message);
    if (typeof error.code === 'string') parts.push(error.code);
  }
  if (typeof body.message === 'string') parts.push(body.message);
  return parts.join(' ').toLowerCase();
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
