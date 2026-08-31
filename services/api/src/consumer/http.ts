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
import { issuePreviewSession, type PreviewAuthConfig } from './preview-auth.ts';
import { resolvePrincipal } from './session.ts';

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
    await serve(input.runtime, req, res, options);
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
        ...(runtime.previewDiagnostics ? runtime.previewDiagnostics() : {}),
      },
      cors.headers,
    );
    return;
  }

  if (url.pathname === '/ready' && method === 'GET') {
    write(
      res,
      200,
      {
        ready: true,
        service: 'sunrey-consumer-bff',
        environment: 'simulation',
        productionReady: false,
        productionActive: false,
        liveConnectivityEnabled: false,
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

  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  const idempotencyKey =
    typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;
  const accept = typeof req.headers.accept === 'string' ? req.headers.accept : undefined;
  const result = await Promise.resolve(handleConsumerBff(runtime, {
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
