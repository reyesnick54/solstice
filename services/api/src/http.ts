import type { IncomingMessage, ServerResponse } from 'node:http';

import type { RequestContext } from './context.ts';
import { API_VERSION } from './context.ts';
import { corsHeaders, type CorsDecision } from './cors.ts';
import { SECURITY_HEADERS } from './security.ts';

export type JsonBody = unknown;

export function sendJson(
  res: ServerResponse,
  status: number,
  body: JsonBody,
  extras: {
    readonly requestId: string;
    readonly correlationId: string;
    readonly cors: CorsDecision;
    readonly extraHeaders?: Readonly<Record<string, string>>;
  },
): void {
  const json = JSON.stringify(body, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  const headers: Record<string, string | number> = {
    ...SECURITY_HEADERS,
    ...corsHeaders(extras.cors),
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
    'x-request-id': extras.requestId,
    'x-correlation-id': extras.correlationId,
    'x-sunrey-api-version': API_VERSION,
    'x-sunrey-surface': 'PLATFORM_API',
  };
  if (extras.extraHeaders) {
    Object.assign(headers, extras.extraHeaders);
  }
  res.writeHead(status, headers);
  res.end(json);
}

export function queryOf(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    out[key] = value;
  }
  return out;
}

export function headerOf(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function clientIp(req: IncomingMessage): string | null {
  const forwarded = headerOf(req, 'x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    return first && first.length > 0 ? first : null;
  }
  return req.socket.remoteAddress ?? null;
}

export type RouteMatch = {
  readonly params: Readonly<Record<string, string>>;
};

export function matchPath(pattern: string, pathname: string): RouteMatch | null {
  const patternParts = pattern.split('/').filter((part) => part.length > 0);
  const pathParts = pathname.split('/').filter((part) => part.length > 0);
  if (patternParts.length !== pathParts.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i] ?? '';
    const actual = pathParts[i] ?? '';
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(actual);
      continue;
    }
    if (expected !== actual) {
      return null;
    }
  }
  return { params: Object.freeze(params) };
}

export type HandlerResult = {
  readonly status: number;
  readonly body: JsonBody;
  readonly extraHeaders?: Readonly<Record<string, string>>;
};

export type RouteHandler = (input: {
  readonly ctx: RequestContext;
  readonly params: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly rawBody: string;
  readonly body: unknown;
}) => Promise<HandlerResult>;

export type RouteDefinition = {
  readonly method: string;
  readonly path: string;
  readonly endpointClass: 'public' | 'sensitive' | 'test';
  readonly requiresIdempotency: boolean;
  readonly schema?: import('./validation.ts').RequestSchema;
  readonly handler: RouteHandler;
};

export function pickHeaders(req: IncomingMessage, names: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = headerOf(req, name);
    if (value !== undefined) {
      out[name] = value;
    }
  }
  return out;
}
