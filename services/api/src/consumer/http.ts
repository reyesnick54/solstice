/**
 * Mountable Node HTTP adapter for the Consumer BFF.
 * This is application-facing orchestration only; it is not a second ledger,
 * Kernel, Exchange, Agent runtime, or compliance plane.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { asSessionId } from '../../../../packages/identity/src/ids.ts';
import { SECURITY_HEADERS } from '../security.ts';
import { isBffError, statusForError } from './errors.ts';
import { handleConsumerBff, type ConsumerBffRuntime } from './handler.ts';
import { evaluateConsumerBffReadiness } from './readiness.ts';
import { issuePreviewSession, type PreviewAuthConfig } from './preview-auth.ts';
import { resolvePrincipal } from './session.ts';
import { authorizeConsumerRoute } from './authorization.ts';
import type { DurableInternalPaymentSurface } from './durable-internal-payments.ts';
import type { DurableWalletSurface } from './durable-wallets.ts';

const BODY_LIMIT = 64 * 1024;
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export type ConsumerBffHttpOptions = {
  readonly allowedOrigins?: readonly string[];
  readonly allowLocalOrigins?: boolean;
  readonly allowSandboxPersonas?: boolean;
  readonly allowPreviewAuth?: boolean;
  readonly previewAuth?: PreviewAuthConfig;
};

export type RunningConsumerBff = {
  readonly url: string;
  readonly close: () => Promise<void>;
};

export async function startConsumerBff(input: {
  readonly runtime: ConsumerBffRuntime;
  readonly durableInternalPayments?: DurableInternalPaymentSurface;
  readonly durableWallets?: DurableWalletSurface;
  readonly host?: string;
  readonly port?: number;
  readonly allowedOrigins?: readonly string[];
  readonly allowLocalOrigins?: boolean;
  readonly allowSandboxPersonas?: boolean;
  readonly allowPreviewAuth?: boolean;
  readonly previewAuth?: PreviewAuthConfig;
}): Promise<RunningConsumerBff> {
  const host = input.host ?? '127.0.0.1';
  const options: ConsumerBffHttpOptions = {
    allowedOrigins: input.allowedOrigins ?? [],
    allowLocalOrigins: input.allowLocalOrigins !== false,
    allowSandboxPersonas: input.allowSandboxPersonas === true,
    allowPreviewAuth: input.allowPreviewAuth === true,
    previewAuth: input.previewAuth ?? {},
  };
  const server: Server = createServer(async (req, res) => {
    await serve(input.runtime, req, res, options, input.durableInternalPayments, input.durableWallets);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(input.port ?? 0, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('consumer BFF failed to bind');
  }
  return {
    url: `http://${host}:${address.port}`,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

export async function serve(
  runtime: ConsumerBffRuntime,
  req: IncomingMessage,
  res: ServerResponse,
  options: ConsumerBffHttpOptions = {},
  durableInternalPayments?: DurableInternalPaymentSurface,
  durableWallets?: DurableWalletSurface,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const rawUrl = req.url ?? '/';
  const url = new URL(rawUrl, 'http://127.0.0.1');
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const cors = corsHeaders(origin, options);

  if (origin && !cors.allowed) {
    write(
      res,
      403,
      {
        errorCode: 'ORIGIN_FORBIDDEN',
        category: 'AUTHORIZATION',
        message: 'origin is not allowed',
        retryable: false,
        detailsSafeForClient: {},
        requestId: 'req_cors',
        apiVersion: 'v1',
      },
      cors.headers,
    );
    return;
  }

  if (method === 'OPTIONS') {
    res.writeHead(204, { ...SECURITY_HEADERS, ...cors.headers });
    res.end();
    return;
  }

  if (url.pathname === '/health' && method === 'GET') {
    write(
      res,
      200,
      {
        ok: true,
        service: 'sunrey-consumer-bff',
        environment: 'simulation',
        productionReady: false,
        productionActive: false,
        liveConnectivityEnabled: false,
        durableInternalTransfersBound: Boolean(durableInternalPayments),
        durableWalletsBound: Boolean(durableWallets),
        ...(process.env.SUNREY_BUILD_GIT_SHA ? { gitSha: process.env.SUNREY_BUILD_GIT_SHA } : {}),
        ...(process.env.SUNREY_RELEASE_TAG ? { releaseTag: process.env.SUNREY_RELEASE_TAG } : {}),
        ...(runtime.previewDiagnostics ? runtime.previewDiagnostics() : {}),
      },
      cors.headers,
    );
    return;
  }

  if (url.pathname === '/ready' && method === 'GET') {
    const report = await evaluateConsumerBffReadiness();
    write(
      res,
      report.ready ? 200 : 503,
      {
        ...report,
        durableInternalTransfersBound: Boolean(durableInternalPayments),
        durableWalletsBound: Boolean(durableWallets),
        ...(process.env.SUNREY_BUILD_GIT_SHA ? { gitSha: process.env.SUNREY_BUILD_GIT_SHA } : {}),
        ...(process.env.SUNREY_RELEASE_TAG ? { releaseTag: process.env.SUNREY_RELEASE_TAG } : {}),
      },
      cors.headers,
    );
    return;
  }

  if (
    url.pathname === '/api/v1/sandbox/personas' &&
    method === 'GET' &&
    options.allowSandboxPersonas !== true
  ) {
    notFound(res, cors.headers, 'req_sandbox_disabled');
    return;
  }

  if (
    url.pathname.startsWith('/api/v1/auth/preview') &&
    options.allowPreviewAuth !== true
  ) {
    notFound(res, cors.headers, 'req_preview_auth_disabled');
    return;
  }

  let body: unknown = {};
  if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
    try {
      const raw = await readBody(req, BODY_LIMIT);
      body = raw.length === 0 ? {} : JSON.parse(raw);
    } catch {
      write(
        res,
        400,
        {
          errorCode: 'MALFORMED',
          category: 'VALIDATION',
          message: 'malformed JSON',
          retryable: false,
          detailsSafeForClient: {},
          requestId: 'req_malformed',
          apiVersion: 'v1',
        },
        cors.headers,
      );
      return;
    }
  }

  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;

  if (url.pathname === '/api/v1/auth/preview/session' && method === 'POST') {
    const result = issuePreviewSession({
      body,
      sessions: runtime.sessions,
      identity: runtime.identity,
      config: options.previewAuth ?? {},
      requestId: 'req_preview_login',
    });
    if (isBffError(result)) {
      write(res, statusForError(result), result, cors.headers);
      return;
    }
    write(res, 200, result, { ...cors.headers, 'cache-control': 'no-store, no-cache, private' });
    return;
  }

  if (url.pathname === '/api/v1/auth/session' && method === 'GET') {
    const principal = resolvePrincipal({
      authorization,
      requestId: 'req_auth_session',
      directory: runtime.sessions,
      ...(runtime.identity ? { identity: runtime.identity } : {}),
    });
    if (isBffError(principal)) {
      write(res, statusForError(principal), principal, cors.headers);
      return;
    }
    write(
      res,
      200,
      {
        schema: 'sunrey.auth-session.v1',
        authenticated: true,
        environment: 'simulation',
        production: false,
        sessionId: principal.sessionId,
        customerId: principal.customerId,
        identityId: principal.identityId,
        sandboxPersona: principal.sandboxPersona,
        verification: principal.verification,
        risk: principal.risk,
      },
      { ...cors.headers, 'cache-control': 'no-store, no-cache, private' },
    );
    return;
  }

  if (url.pathname === '/api/v1/auth/logout' && method === 'POST') {
    const principal = resolvePrincipal({
      authorization,
      requestId: 'req_auth_logout',
      directory: runtime.sessions,
      ...(runtime.identity ? { identity: runtime.identity } : {}),
    });
    if (isBffError(principal)) {
      write(res, statusForError(principal), principal, cors.headers);
      return;
    }
    if (runtime.identity && runtime.identity.getSession(asSessionId(principal.sessionId))) {
      runtime.identity.logout(asSessionId(principal.sessionId));
    } else {
      const token = bearerToken(authorization);
      if (token) runtime.sessions.delete(token);
    }
    write(
      res,
      200,
      {
        schema: 'sunrey.auth-logout.v1',
        authenticated: false,
        environment: 'simulation',
        production: false,
      },
      { ...cors.headers, 'cache-control': 'no-store, no-cache, private' },
    );
    return;
  }

  const idempotencyKey =
    typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;

  if (durableWallets && url.pathname === '/api/v1/wallets' && method === 'POST') {
    const requestId =
      typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : 'req_durable_wallet';
    const principal = resolvePrincipal({
      authorization,
      requestId,
      directory: runtime.sessions,
      ...(runtime.identity ? { identity: runtime.identity } : {}),
    });
    if (isBffError(principal)) {
      write(res, statusForError(principal), principal, cors.headers);
      return;
    }
    const authFailure = authorizeConsumerRoute(principal, method, url.pathname, requestId);
    if (authFailure) {
      write(res, statusForError(authFailure), authFailure, cors.headers);
      return;
    }
    const rec = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const outcome = await durableWallets.createWallet(principal, {
      assetId: typeof rec.assetId === 'string' ? rec.assetId : '',
      idempotencyKey:
        idempotencyKey ??
        (typeof rec.idempotencyKey === 'string' ? rec.idempotencyKey : ''),
    });
    if (outcome.outcome === 'OK') {
      write(
        res,
        outcome.replay ? 200 : 201,
        outcome.value,
        {
          ...cors.headers,
          'cache-control': 'no-store, no-cache, private',
          'x-sunrey-authority': 'POSTGRES_CUSTODY_PRODUCT',
          'x-sunrey-idempotent-replay': outcome.replay ? 'true' : 'false',
        },
      );
      return;
    }
    write(
      res,
      statusForDurableWalletRejection(outcome.code),
      {
        errorCode: outcome.code,
        category: outcome.code === 'WALLET_NOT_ELIGIBLE' ? 'AUTHORIZATION' : 'VALIDATION',
        message: outcome.message,
        retryable: false,
        detailsSafeForClient: { code: outcome.code },
        requestId,
        apiVersion: 'v1',
      },
      cors.headers,
    );
    return;
  }

  if (durableInternalPayments && isDurableInternalPaymentRoute(method, url.pathname)) {
    const requestId =
      typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : 'req_durable_payment';
    const principal = resolvePrincipal({
      authorization,
      requestId,
      directory: runtime.sessions,
      ...(runtime.identity ? { identity: runtime.identity } : {}),
    });
    if (isBffError(principal)) {
      write(res, statusForError(principal), principal, cors.headers);
      return;
    }
    const authFailure = authorizeConsumerRoute(principal, method, url.pathname, requestId);
    if (authFailure) {
      write(res, statusForError(authFailure), authFailure, cors.headers);
      return;
    }

    if (method === 'GET' && url.pathname === '/api/v1/payments') {
      const items = await durableInternalPayments.list(principal);
      write(res, 200, { items }, { ...cors.headers, 'cache-control': 'no-store, no-cache, private' });
      return;
    }
    if (method === 'GET') {
      const paymentId = decodeURIComponent(url.pathname.slice('/api/v1/payments/'.length));
      const payment = await durableInternalPayments.get(principal, paymentId);
      if (!payment) {
        write(
          res,
          404,
          {
            errorCode: 'NOT_FOUND',
            category: 'NOT_FOUND',
            message: 'payment does not exist',
            retryable: false,
            detailsSafeForClient: {},
            requestId,
            apiVersion: 'v1',
          },
          cors.headers,
        );
        return;
      }
      write(res, 200, payment, { ...cors.headers, 'cache-control': 'no-store, no-cache, private' });
      return;
    }

    const rec = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
    const outcome = await durableInternalPayments.create(principal, {
      sourceAccountId: typeof rec.sourceAccountId === 'string' ? rec.sourceAccountId : '',
      destinationAccountId: typeof rec.destinationAccountId === 'string' ? rec.destinationAccountId : '',
      amountMinorUnits: typeof rec.amountMinorUnits === 'string' ? rec.amountMinorUnits : String(rec.amountMinorUnits ?? ''),
      currency: typeof rec.currency === 'string' ? rec.currency : 'USD',
      idempotencyKey:
        idempotencyKey ??
        (typeof rec.idempotencyKey === 'string' ? rec.idempotencyKey : `idem_${requestId}`),
      ...(typeof rec.paymentId === 'string' ? { paymentId: rec.paymentId } : {}),
      ...(typeof rec.purpose === 'string' ? { purpose: rec.purpose } : {}),
      ...(typeof rec.reference === 'string' ? { reference: rec.reference } : {}),
    });
    if (outcome.outcome === 'OK') {
      write(
        res,
        outcome.replay ? 200 : 201,
        outcome.value,
        {
          ...cors.headers,
          'cache-control': 'no-store, no-cache, private',
          'x-sunrey-authority': 'POSTGRES_LEDGER',
          'x-sunrey-idempotent-replay': outcome.replay ? 'true' : 'false',
        },
      );
      return;
    }
    write(
      res,
      statusForDurableTransferRejection(outcome.code),
      {
        errorCode: outcome.code,
        category: outcome.code === 'RESOURCE_NOT_OWNED' ? 'AUTHORIZATION' : 'VALIDATION',
        message: outcome.message,
        retryable: false,
        detailsSafeForClient: { code: outcome.code },
        requestId,
        apiVersion: 'v1',
      },
      cors.headers,
    );
    return;
  }

  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  const accept = typeof req.headers.accept === 'string' ? req.headers.accept : undefined;
  const result = await handleConsumerBff(runtime, {
    method,
    path: url.pathname,
    query,
    body,
    authorization,
    ...(idempotencyKey ? { idempotencyKey } : {}),
    ...(accept ? { accept } : {}),
  });
  const responseHeaders = { ...result.headers, ...cors.headers };
  if (result.eventStream) {
    res.writeHead(result.status, {
      ...SECURITY_HEADERS,
      ...responseHeaders,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
    });
    res.end(result.eventStream);
    return;
  }
  write(res, result.status, result.body, responseHeaders);
}

function isDurableInternalPaymentRoute(method: string, path: string): boolean {
  if (path === '/api/v1/payments') {
    return method === 'GET' || method === 'POST';
  }
  if (method !== 'GET' || !path.startsWith('/api/v1/payments/')) {
    return false;
  }
  const suffix = path.slice('/api/v1/payments/'.length);
  return suffix.length > 0 && !suffix.includes('/') && suffix !== 'quote';
}

function statusForDurableWalletRejection(code: string): number {
  switch (code) {
    case 'WALLET_NOT_ELIGIBLE':
      return 403;
    case 'IDEMPOTENCY_CONFLICT':
    case 'WALLET_ALREADY_EXISTS':
      return 409;
    case 'IDEMPOTENCY_KEY_REQUIRED':
    case 'UNSUPPORTED_ASSET':
      return 422;
    default:
      return 500;
  }
}

function statusForDurableTransferRejection(code: string): number {
  switch (code) {
    case 'ACCOUNT_NOT_FOUND':
      return 404;
    case 'RESOURCE_NOT_OWNED':
      return 403;
    case 'IDEMPOTENCY_CONFLICT':
      return 409;
    case 'KERNEL_REFUSED':
      return 403;
    default:
      return 422;
  }
}

function corsHeaders(
  origin: string | undefined,
  options: ConsumerBffHttpOptions,
): { readonly allowed: boolean; readonly headers: Readonly<Record<string, string>> } {
  if (!origin) {
    return { allowed: true, headers: {} };
  }
  const configured = options.allowedOrigins ?? [];
  const allowed = configured.includes(origin) || (options.allowLocalOrigins !== false && LOCAL_ORIGIN.test(origin));
  if (!allowed) {
    return { allowed: false, headers: { vary: 'Origin' } };
  }
  return {
    allowed: true,
    headers: Object.freeze({
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers':
        'authorization,content-type,idempotency-key,x-request-id,x-correlation-id,x-sunrey-client',
      'access-control-expose-headers': 'x-request-id,x-sunrey-api-version,retry-after',
      'access-control-max-age': '600',
      vary: 'Origin',
    }),
  };
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  return authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim() || null
    : authorization.trim() || null;
}

function notFound(
  res: ServerResponse,
  headers: Readonly<Record<string, string>>,
  requestId: string,
): void {
  write(
    res,
    404,
    {
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'route not found',
      retryable: false,
      detailsSafeForClient: {},
      requestId,
      apiVersion: 'v1',
    },
    headers,
  );
}

function write(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  if (typeof body === 'string' && (headers['content-type'] ?? '').startsWith('text/event-stream')) {
    res.writeHead(status, {
      ...SECURITY_HEADERS,
      ...headers,
      'content-type': headers['content-type'] ?? 'text/event-stream; charset=utf-8',
      'content-length': Buffer.byteLength(body),
    });
    res.end(body);
    return;
  }
  const json = JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    ...headers,
    'content-type': headers['content-type'] ?? 'application/json',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let oversized = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        oversized = true;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (oversized) {
        reject(new Error('OVERSIZED_REQUEST'));
        return;
      }
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}
