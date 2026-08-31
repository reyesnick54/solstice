/**
 * Governed fetch-based provider HTTP transport.
 *
 * Certificate verification is never disabled. Retries are intentionally absent
 * (Wave 1 Prompt 4 handles reliability).
 */

import type { ProviderAuthResolver, ProviderAuthStrategy } from './auth.ts';
import type { ProviderTransportConfig } from './config.ts';
import { parseApprovedEndpoint } from './config.ts';
import {
  invalidResponseError,
  mapHttpStatusToError,
  networkError,
  securityError,
  timeoutError,
} from './errors.ts';
import { createRedactionCatalog, redactErrorMessage, redactHeaderRecord, redactUrlForLog } from './redaction.ts';
import {
  enforceSsrfPolicy,
  parseDestination,
  resolveRedirectLocation,
  buildAbsoluteUrl,
  type ResolvedDestination,
} from './ssrf.ts';
import type {
  HttpProviderRequestContext,
  HttpProviderTransport,
  HttpProviderTransportResponse,
  HttpProviderTransportResult,
  ProviderHttpMethod,
  ProviderParsedBody,
} from './http-transport-types.ts';

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type TransportClock = {
  readonly nowMs: () => number;
  readonly nowIsoUtc: () => string;
};

export const systemClock: TransportClock = Object.freeze({
  nowMs: () => Date.now(),
  nowIsoUtc: () => new Date().toISOString(),
});

export type FetchProviderTransportOptions = {
  readonly config: ProviderTransportConfig;
  readonly authResolver: ProviderAuthResolver;
  readonly authStrategy: ProviderAuthStrategy;
  readonly fetchFn?: FetchLike | undefined;
  readonly clock?: TransportClock | undefined;
};

const SUPPORTED_METHODS = new Set<ProviderHttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export class FetchProviderTransport implements HttpProviderTransport {
  readonly transportId = 'provider-sdk.fetch-http';
  private readonly config: ProviderTransportConfig;
  private readonly authResolver: ProviderAuthResolver;
  private readonly authStrategy: ProviderAuthStrategy;
  private readonly fetchFn: FetchLike;
  private readonly clock: TransportClock;
  private readonly approved: ReturnType<typeof parseApprovedEndpoint>;
  private readonly redactionCatalog: ReturnType<typeof createRedactionCatalog>;

  constructor(options: FetchProviderTransportOptions) {
    this.config = options.config;
    this.authResolver = options.authResolver;
    this.authStrategy = options.authStrategy;
    this.fetchFn = options.fetchFn ?? fetch;
    this.clock = options.clock ?? systemClock;
    this.approved = parseApprovedEndpoint(options.config.endpoint.baseUrl);
    const redactionInput: {
      sensitiveHeaders?: readonly string[];
      sensitiveQueryParams?: readonly string[];
    } = {};
    if (options.config.endpoint.sensitiveHeaders !== undefined) {
      redactionInput.sensitiveHeaders = options.config.endpoint.sensitiveHeaders;
    }
    if (options.config.endpoint.sensitiveQueryParams !== undefined) {
      redactionInput.sensitiveQueryParams = options.config.endpoint.sensitiveQueryParams;
    }
    this.redactionCatalog = createRedactionCatalog(redactionInput);
    Object.freeze(this);
  }

  async request<T = unknown>(context: HttpProviderRequestContext): Promise<HttpProviderTransportResult<T>> {
    const startedAtMs = this.clock.nowMs();
    const startedAtUtc = this.clock.nowIsoUtc();
    const traceId = context.traceId ?? context.requestId;
    const endpoint = this.config.endpoint;

    if (!SUPPORTED_METHODS.has(context.method)) {
      return {
        ok: false,
        error: securityError(context.providerId, context.requestId, `unsupported HTTP method ${context.method}`),
      };
    }
    if (!context.path.startsWith('/')) {
      return {
        ok: false,
        error: securityError(context.providerId, context.requestId, 'request path must start with /'),
      };
    }
    if (context.providerId !== endpoint.providerId) {
      return {
        ok: false,
        error: securityError(context.providerId, context.requestId, 'providerId does not match transport endpoint'),
      };
    }

    const auth = await this.authResolver.resolve(this.authStrategy, {
      providerId: context.providerId,
      requestId: context.requestId,
    });
    if ('kind' in auth) {
      return { ok: false, error: auth };
    }

    const built = buildAbsoluteUrl(endpoint.baseUrl, context.path, context.query, auth.queryParams);
    if (!built.ok) {
      return {
        ok: false,
        error: securityError(context.providerId, context.requestId, built.reason),
      };
    }

    const ssrf = enforceSsrfPolicy(built.destination, {
      allowHttp: endpoint.allowHttp === true,
      environment: this.config.environment,
      approvedHostname: this.approved.hostname,
      approvedPort: this.approved.port,
      approvedScheme: this.approved.scheme,
      allowLoopbackInTest: endpoint.allowLoopbackInTest,
    });
    if (!ssrf.ok) {
      return {
        ok: false,
        error: securityError(context.providerId, context.requestId, ssrf.reason),
      };
    }

    const body = context.body;
    if (body !== undefined) {
      const bytes = Buffer.byteLength(body, 'utf8');
      if (bytes > endpoint.maximumRequestBytes) {
        return {
          ok: false,
          error: securityError(context.providerId, context.requestId, 'request body exceeds maximum size'),
        };
      }
    }

    const timeoutMs = context.timeoutMs ?? endpoint.defaultTimeoutMs;
    const maximumResponseBytes = context.maximumResponseBytes ?? endpoint.maximumResponseBytes;

    const headers: Record<string, string> = {
      accept: contentTypeToAccept(context.expectedContentType ?? 'application/json'),
      'user-agent': `SunRey/${this.config.serviceVersion}`,
      'x-request-id': context.requestId,
      'x-correlation-id': traceId,
      ...auth.headers,
      ...context.headers,
    };
    if (body !== undefined && !hasHeader(headers, 'content-type')) {
      headers['content-type'] = 'application/json';
    }

  const safeLogUrl = redactUrlForLog(built.destination.href, this.redactionCatalog);
  const safeLogHeaders = redactHeaderRecord(headers, this.redactionCatalog);

    try {
      const response = await this.executeWithRedirects({
        method: context.method,
        destination: built.destination,
        headers,
        body,
        timeoutMs,
        maximumResponseBytes,
        providerId: context.providerId,
        requestId: context.requestId,
        redactSecrets: collectSecretsForRedaction(auth),
      });

      if (!response.ok) {
        return { ok: false, error: response.error };
      }

      if (response.status >= 400) {
        return { ok: false, error: mapHttpStatusToError(context.providerId, context.requestId, response.status) };
      }

      const durationMs = this.clock.nowMs() - startedAtMs;
      const parsedBody = parseResponseBody(response.bodyText, response.contentType, context.expectedContentType);
      if (!parsedBody.ok) {
        return {
          ok: false,
          error: invalidResponseError(
            context.providerId,
            context.requestId,
            parsedBody.reason,
            response.status,
          ),
        };
      }

      const metadata = Object.freeze({
        providerId: context.providerId,
        requestId: context.requestId,
        traceId,
        httpStatus: response.status,
        durationMs,
        contentType: response.contentType,
        providerRequestId: extractProviderRequestId(response.headers),
        startedAtUtc,
        finalUrl: safeLogUrl,
      });

      const value: HttpProviderTransportResponse<T> = Object.freeze({
        metadata,
        body: parsedBody.body,
        parsed: parsedBody.body.format === 'json' ? (parsedBody.body.value as T) : undefined,
      });

      return { ok: true, value };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'transport failure';
      const safeMessage = redactErrorMessage(message, collectSecretsForRedaction(auth));
      return {
        ok: false,
        error: networkError(context.providerId, context.requestId, safeMessage),
      };
    } finally {
      void safeLogUrl;
      void safeLogHeaders;
    }
  }

  private async executeWithRedirects(input: {
    readonly method: ProviderHttpMethod;
    readonly destination: ResolvedDestination;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: string | undefined;
    readonly timeoutMs: number;
    readonly maximumResponseBytes: number;
    readonly providerId: string;
    readonly requestId: string;
    readonly redactSecrets: readonly string[];
  }): Promise<
    | {
        readonly ok: true;
        readonly status: number;
        readonly headers: Readonly<Record<string, string>>;
        readonly bodyText: string;
        readonly contentType: string | null;
      }
    | { readonly ok: false; readonly error: ReturnType<typeof securityError> }
  > {
    let current = input.destination;
    let hops = 0;

    while (true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), input.timeoutMs);
      let response: Response;
      try {
        const init: RequestInit = {
          method: input.method,
          headers: { ...input.headers },
          redirect: 'manual',
          signal: controller.signal,
        };
        if (input.body !== undefined && input.method !== 'GET' && input.method !== 'DELETE') {
          init.body = input.body;
        }
        response = await this.fetchFn(current.href, init);
      } catch (cause) {
        clearTimeout(timer);
        const name = cause instanceof Error ? cause.name : '';
        if (name === 'AbortError') {
          return { ok: false, error: timeoutError(input.providerId, input.requestId) };
        }
        const message = cause instanceof Error ? cause.message : 'network failure';
        return {
          ok: false,
          error: networkError(
            input.providerId,
            input.requestId,
            redactErrorMessage(message, input.redactSecrets),
          ),
        };
      } finally {
        clearTimeout(timer);
      }

      if (isRedirectStatus(response.status)) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            ok: false,
            error: securityError(input.providerId, input.requestId, 'redirect response missing Location header'),
          };
        }
        if (hops >= this.config.endpoint.maxRedirects) {
          return {
            ok: false,
            error: securityError(input.providerId, input.requestId, 'redirect chain exceeds maximum hops'),
          };
        }
        const nextUrl = resolveRedirectLocation(current, location);
        const next = parseDestination(nextUrl);
        if (!next.ok) {
          return {
            ok: false,
            error: securityError(input.providerId, input.requestId, next.reason),
          };
        }
        const ssrf = enforceSsrfPolicy(next.destination, {
          allowHttp: this.config.endpoint.allowHttp === true,
          environment: this.config.environment,
          approvedHostname: this.approved.hostname,
          approvedPort: this.approved.port,
          approvedScheme: this.approved.scheme,
          allowLoopbackInTest: this.config.endpoint.allowLoopbackInTest,
        });
        if (!ssrf.ok) {
          return {
            ok: false,
            error: securityError(input.providerId, input.requestId, ssrf.reason),
          };
        }
        current = next.destination;
        hops += 1;
        continue;
      }

      const raw = Buffer.from(await response.arrayBuffer());
      if (raw.byteLength > input.maximumResponseBytes) {
        return {
          ok: false,
          error: securityError(input.providerId, input.requestId, 'response exceeds maximum size'),
        };
      }
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const contentType = headers['content-type'] ?? null;
      if (contentType && !isSupportedContentType(contentType)) {
        return {
          ok: false,
          error: securityError(input.providerId, input.requestId, `unsupported content type ${contentType}`),
        };
      }
      return {
        ok: true,
        status: response.status,
        headers: Object.freeze(headers),
        bodyText: raw.toString('utf8'),
        contentType,
      };
    }
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function hasHeader(headers: Readonly<Record<string, string>>, name: string): boolean {
  const wanted = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === wanted);
}

function contentTypeToAccept(expected: string): string {
  if (expected === '*') {
    return '*/*';
  }
  return expected;
}

function isSupportedContentType(contentType: string): boolean {
  const normalized = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    normalized === 'application/json' ||
    normalized === 'text/json' ||
    normalized === 'text/plain' ||
    normalized === 'text/csv' ||
    normalized === 'application/xml' ||
    normalized === 'text/xml' ||
    normalized === 'application/x-www-form-urlencoded'
  );
}

function parseResponseBody(
  bodyText: string,
  contentType: string | null,
  expected?: string | undefined,
):
  | { readonly ok: true; readonly body: ProviderParsedBody }
  | { readonly ok: false; readonly reason: string } {
  const normalized = (contentType?.split(';')[0] ?? expected ?? 'application/json').trim().toLowerCase();
  if (normalized === 'application/json' || normalized === 'text/json') {
    if (bodyText.length === 0) {
      return { ok: true, body: Object.freeze({ format: 'json', value: {} }) };
    }
    try {
      return { ok: true, body: Object.freeze({ format: 'json', value: JSON.parse(bodyText) as unknown }) };
    } catch {
      return { ok: false, reason: 'response body is not valid JSON' };
    }
  }
  if (normalized === 'text/plain' || normalized === 'text/csv' || normalized === 'application/xml' || normalized === 'text/xml') {
    return { ok: true, body: Object.freeze({ format: 'text', value: bodyText }) };
  }
  return { ok: true, body: Object.freeze({ format: 'raw', value: bodyText }) };
}

function extractProviderRequestId(headers: Readonly<Record<string, string>>): string | null {
  const candidates = ['x-request-id', 'x-correlation-id', 'request-id', 'x-amzn-requestid'];
  for (const name of candidates) {
    const value = headers[name];
    if (value && value.length > 0) {
      return value;
    }
  }
  return null;
}

function collectSecretsForRedaction(auth: { readonly headers: Readonly<Record<string, string>> }): string[] {
  const secrets: string[] = [];
  for (const value of Object.values(auth.headers)) {
    const token = value.replace(/^Bearer\s+/i, '').replace(/^Basic\s+/i, '');
    if (token.length >= 8) {
      secrets.push(token);
    }
  }
  return secrets;
}

export function createFetchProviderTransport(options: FetchProviderTransportOptions): FetchProviderTransport {
  return new FetchProviderTransport(options);
}
