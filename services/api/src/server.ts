import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { addMs, systemClock, type Clock } from '../../../packages/config/src/clock.ts';

import type { PlatformApiConfig } from './config.ts';
import { deriveRequestContext, nullAuthenticator, type Authenticator, type RequestContext } from './context.ts';
import { corsHeaders, resolveCors } from './cors.ts';
import {
  apiError,
  envelopeFromError,
  failClosedInternal,
  PlatformApiError,
} from './errors.ts';
import { clientIp, headerOf, matchPath, pickHeaders, queryOf, sendJson, type RouteDefinition } from './http.ts';
import {
  identityScopeKey,
  requestFingerprint,
  requireIdempotencyKey,
  type IdempotencyRepository,
} from './idempotency.ts';
import { createLogger } from './logging.ts';
import { enforceRateLimit, policyForEndpoint, type RateLimitRepository } from './rate-limit.ts';
import { parseJsonBody, validateRequest } from './validation.ts';
import { assertContentType, readBody, SECURITY_HEADERS } from './security.ts';

export type PlatformApiDependencies = {
  readonly config: PlatformApiConfig;
  readonly routes: readonly RouteDefinition[];
  readonly idempotency: IdempotencyRepository;
  readonly rateLimit: RateLimitRepository;
  readonly authenticator?: Authenticator;
  readonly clock?: Clock;
  readonly logSink?: (line: string) => void;
};

export type RunningPlatformApi = {
  readonly url: string;
  readonly host: string;
  readonly port: number;
  readonly config: PlatformApiConfig;
  readonly close: () => Promise<void>;
};

export async function startPlatformApi(deps: PlatformApiDependencies): Promise<RunningPlatformApi> {
  const config = deps.config;
  const authenticator = deps.authenticator ?? nullAuthenticator;
  const clock = deps.clock ?? systemClock;
  const logger = createLogger(config, deps.logSink);
  let inFlight = 0;
  let accepting = true;

  const server: Server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const started = Date.now();
    const method = (req.method ?? 'GET').toUpperCase();
    const rawUrl = req.url ?? '/';
    const url = new URL(rawUrl, 'http://127.0.0.1');
    const path = url.pathname;
    const origin = headerOf(req, 'origin');
    const cors = resolveCors(config, origin);
    const requestIdHint = headerOf(req, 'x-request-id');
    const correlationHint = headerOf(req, 'x-correlation-id');
    let ctx: RequestContext | undefined;

    const finish = (status: number, body: unknown, extraHeaders?: Readonly<Record<string, string>>): void => {
      const requestId = ctx?.requestId ?? requestIdHint ?? 'unknown';
      const correlationId = ctx?.correlationId ?? correlationHint ?? requestId;
      sendJson(res, status, body, {
        requestId,
        correlationId,
        cors,
        ...(extraHeaders ? { extraHeaders } : {}),
      });
      if (ctx) {
        logger.request(ctx, status, Date.now() - started);
      }
    };

    try {
      if (!accepting) {
        finish(503, apiError({
          code: 'TEMPORARY_UNAVAILABLE',
          message: 'server is shutting down',
          requestId: requestIdHint ?? 'shutdown',
          retryable: true,
        }));
        return;
      }

      if (origin && !cors.allowed && method === 'OPTIONS') {
        finish(403, apiError({
          code: 'ORIGIN_FORBIDDEN',
          message: 'origin is not allowed',
          requestId: requestIdHint ?? 'cors',
        }));
        return;
      }

      if (method === 'OPTIONS') {
        const provisional = deriveRequestContext({
          config,
          method,
          route: path,
          requestIdHeader: requestIdHint,
          correlationIdHeader: correlationHint,
          ip: clientIp(req),
          userAgent: headerOf(req, 'user-agent'),
          origin,
          forwardedFor: headerOf(req, 'x-forwarded-for'),
          principal: null,
          nowIso: clock.now(),
        });
        ctx = provisional;
        res.writeHead(204, {
          ...SECURITY_HEADERS,
          ...corsHeaders(cors),
          'x-request-id': provisional.requestId,
          'x-correlation-id': provisional.correlationId,
          'x-sunrey-api-version': 'v1',
        });
        res.end();
        logger.request(provisional, 204, Date.now() - started);
        return;
      }

      if (/^\/api\/v[0-9]+\//.test(path) && !path.startsWith('/api/v1/')) {
        const provisional = deriveRequestContext({
          config,
          method,
          route: path,
          requestIdHeader: requestIdHint,
          correlationIdHeader: correlationHint,
          ip: clientIp(req),
          userAgent: headerOf(req, 'user-agent'),
          origin,
          forwardedFor: headerOf(req, 'x-forwarded-for'),
          principal: null,
          nowIso: clock.now(),
        });
        ctx = provisional;
        finish(404, apiError({
          code: 'UNKNOWN_API_VERSION',
          message: 'unknown API version',
          requestId: provisional.requestId,
        }));
        return;
      }

      const principal = await authenticator.authenticate({
        authorizationHeader: headerOf(req, 'authorization'),
        requestId: requestIdHint ?? 'auth',
      });

      const matched = matchRoute(deps.routes, method, path);
      const routePath = matched?.route.path ?? path;
      const requestContext = deriveRequestContext({
        config,
        method,
        route: routePath,
        requestIdHeader: requestIdHint,
        correlationIdHeader: correlationHint,
        ip: clientIp(req),
        userAgent: headerOf(req, 'user-agent'),
        origin,
        forwardedFor: headerOf(req, 'x-forwarded-for'),
        principal,
        nowIso: clock.now(),
      });
      ctx = requestContext;

      if (origin && !cors.allowed) {
        throw new PlatformApiError({
          code: 'ORIGIN_FORBIDDEN',
          message: 'origin is not allowed',
          category: 'AUTHORIZATION',
          retryable: false,
          httpStatus: 403,
        });
      }

      const clientHeader = headerOf(req, 'x-sunrey-client');
      await enforceRateLimit({
        repository: deps.rateLimit,
        policy: policyForEndpoint(matched?.route.endpointClass ?? 'public', config.rateLimitPerMinute),
        keys: {
          endpointClass: matched?.route.endpointClass ?? 'public',
          ...(ctx.security.ip ? { ip: ctx.security.ip } : {}),
          ...(ctx.userId ? { user: ctx.userId } : {}),
          ...(ctx.sessionId ? { session: ctx.sessionId } : {}),
          ...(ctx.deviceId ? { device: ctx.deviceId } : {}),
          ...(ctx.clientId ? { client: ctx.clientId } : clientHeader ? { client: clientHeader } : {}),
        },
        nowMs: Date.parse(ctx.timestamp),
      });

      if (!matched) {
        const methodExists = deps.routes.some((route) => matchPath(route.path, path));
        throw new PlatformApiError({
          code: methodExists ? 'METHOD_NOT_ALLOWED' : 'NOT_FOUND',
          message: methodExists ? 'method not allowed' : 'route not found',
          category: methodExists ? 'VALIDATION' : 'NOT_FOUND',
          retryable: false,
          httpStatus: methodExists ? 405 : 404,
        });
      }

      assertContentType(req, method);
      const rawBody = method === 'GET' || method === 'HEAD' ? '' : await readBody(req, config);
      const body = rawBody.length > 0 ? parseJsonBody(rawBody) : undefined;
      const headers = pickHeaders(req, [
        'authorization',
        'content-type',
        'idempotency-key',
        'x-request-id',
        'x-correlation-id',
        'x-sunrey-client',
      ]);
      if (matched.route.schema) {
        validateRequest(matched.route.schema, {
          params: matched.params,
          query: queryOf(url),
          headers,
          body,
        });
      }

      inFlight += 1;
      try {
        const result = await withIdempotency({
          route: matched.route,
          ctx: requestContext,
          rawBody,
          path,
          method,
          repository: deps.idempotency,
          ttlSeconds: config.idempotencyTtlSeconds,
          clock,
          idempotencyKeyHeader: headerOf(req, 'idempotency-key'),
          run: () =>
            matched.route.handler({
              ctx: requestContext,
              params: matched.params,
              query: queryOf(url),
              headers,
              rawBody,
              body,
            }),
        });
        finish(result.status, result.body, result.extraHeaders);
      } finally {
        inFlight -= 1;
      }
    } catch (error) {
      const requestId = ctx?.requestId ?? requestIdHint ?? 'unknown';
      if (error instanceof PlatformApiError) {
        const extra =
          error.code === 'RATE_LIMITED' && error.metadata.retryAfterMs
            ? { 'retry-after': String(Math.ceil(Number(error.metadata.retryAfterMs) / 1000)) }
            : undefined;
        finish(error.httpStatus, envelopeFromError(error, requestId), extra);
        logger.log('warn', 'http_error', {
          requestId,
          code: error.code,
          category: error.category,
        });
        return;
      }
      logger.log('error', 'http_internal_error', { requestId, name: error instanceof Error ? error.name : 'Error' });
      finish(500, failClosedInternal(requestId));
    }
  }

  await listen(server, config.host, config.port);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  const host = config.host;

  return {
    url: `http://${host}:${port}`,
    host,
    port,
    config,
    close: async () => {
      accepting = false;
      const deadline = Date.now() + config.shutdownTimeoutMs;
      while (inFlight > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

function matchRoute(
  routes: readonly RouteDefinition[],
  method: string,
  path: string,
): { readonly route: RouteDefinition; readonly params: Readonly<Record<string, string>> } | null {
  for (const route of routes) {
    if (route.method !== method) {
      continue;
    }
    const match = matchPath(route.path, path);
    if (match) {
      return { route, params: match.params };
    }
  }
  return null;
}

async function withIdempotency(input: {
  readonly route: RouteDefinition;
  readonly ctx: RequestContext;
  readonly rawBody: string;
  readonly path: string;
  readonly method: string;
  readonly repository: IdempotencyRepository;
  readonly ttlSeconds: number;
  readonly clock: Clock;
  readonly idempotencyKeyHeader: string | undefined;
  readonly run: () => Promise<{ status: number; body: unknown; extraHeaders?: Readonly<Record<string, string>> }>;
}): Promise<{ status: number; body: unknown; extraHeaders?: Readonly<Record<string, string>> }> {
  if (!input.route.requiresIdempotency) {
    return input.run();
  }
  const idempotencyKey = requireIdempotencyKey(input.idempotencyKeyHeader);
  const fingerprint = requestFingerprint({
    method: input.method,
    path: input.path,
    body: input.rawBody,
  });
  const nowIso = input.clock.now();
  const expiresAt = addMs(nowIso, input.ttlSeconds * 1000);
  const scopeKey = identityScopeKey({
    userId: input.ctx.userId,
    clientId: input.ctx.clientId,
    ip: input.ctx.security.ip,
    route: input.route.path,
  });
  const begun = await input.repository.begin({
    scopeKey,
    idempotencyKey,
    fingerprint,
    nowIso,
    expiresAt,
  });
  if (begun.outcome === 'REPLAY') {
    const replayed = begun.record.responseBody ? JSON.parse(begun.record.responseBody) : {};
    return {
      status: begun.record.statusCode ?? 200,
      body: replayed,
      extraHeaders: { 'x-sunrey-idempotency': 'replay' },
    };
  }
  if (begun.outcome === 'IN_PROGRESS') {
    throw new PlatformApiError({
      code: 'CONFLICT',
      message: 'an identical request is already in progress',
      category: 'CONFLICT',
      retryable: true,
      httpStatus: 409,
    });
  }
  const result = await input.run();
  await input.repository.complete({
    scopeKey,
    idempotencyKey,
    fingerprint,
    statusCode: result.status,
    responseBody: JSON.stringify(result.body),
    nowIso: input.clock.now(),
  });
  return {
    ...result,
    extraHeaders: { ...result.extraHeaders, 'x-sunrey-idempotency': 'executed' },
  };
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

export { addMs };
