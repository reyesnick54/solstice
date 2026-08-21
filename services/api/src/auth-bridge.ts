/**
 * Mounts packages/identity AuthenticationService on the Platform API.
 *
 * This is not a second identity or auth runtime. Session validation lives
 * in AuthenticationService. The API only dispatches and maps envelopes.
 */

import {
  AuthenticationService,
  authenticateRequestMiddleware,
  dispatchAuthHttp,
} from '../../../packages/identity/src/index.ts';

import type { AuthenticatedPrincipal, Authenticator } from './context.ts';
import { apiError, type ApiErrorCode } from './errors.ts';
import type { RouteDefinition, RouteHandler } from './http.ts';

const AUTH_ROUTE_SPECS = [
  { method: 'POST', path: '/api/v1/auth/register', endpointClass: 'public' },
  { method: 'POST', path: '/api/v1/auth/login', endpointClass: 'public' },
  { method: 'POST', path: '/api/v1/auth/logout', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/refresh', endpointClass: 'public' },
  { method: 'GET', path: '/api/v1/auth/sessions', endpointClass: 'sensitive' },
  { method: 'DELETE', path: '/api/v1/auth/sessions/others', endpointClass: 'sensitive' },
  { method: 'DELETE', path: '/api/v1/auth/sessions/:id', endpointClass: 'sensitive' },
  { method: 'GET', path: '/api/v1/auth/devices', endpointClass: 'sensitive' },
  { method: 'DELETE', path: '/api/v1/auth/devices/:id', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/devices/:id/trust', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/mfa/enroll', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/mfa/enroll/confirm', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/mfa/begin', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/mfa/verify', endpointClass: 'public' },
  { method: 'POST', path: '/api/v1/auth/passkey/register/begin', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/passkey/register/complete', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/passkey/authenticate/begin', endpointClass: 'public' },
  { method: 'POST', path: '/api/v1/auth/passkey/authenticate/complete', endpointClass: 'public' },
  { method: 'POST', path: '/api/v1/auth/recovery/begin', endpointClass: 'public' },
  { method: 'POST', path: '/api/v1/auth/recovery/complete', endpointClass: 'public' },
  { method: 'POST', path: '/api/v1/auth/credentials/password', endpointClass: 'sensitive' },
  { method: 'GET', path: '/api/v1/auth/me', endpointClass: 'sensitive' },
  { method: 'POST', path: '/api/v1/auth/step-up/evaluate', endpointClass: 'sensitive' },
] as const;

export function createIdentityAuthenticator(auth: AuthenticationService): Authenticator {
  return {
    async authenticate(input): Promise<AuthenticatedPrincipal | null> {
      const token = bearer(input.authorizationHeader);
      if (!token) {
        return null;
      }
      const result = authenticateRequestMiddleware(auth, token);
      if (!result.ok) {
        return null;
      }
      return {
        userId: result.context.identityId,
        sessionId: result.context.session.sessionId,
        ...(result.context.device ? { deviceId: result.context.device.deviceId } : {}),
      };
    },
  };
}

export function createAuthRoutes(auth: AuthenticationService): readonly RouteDefinition[] {
  return Object.freeze(
    AUTH_ROUTE_SPECS.map((spec) =>
      Object.freeze({
        method: spec.method,
        path: spec.path,
        endpointClass: spec.endpointClass,
        requiresIdempotency: false,
        handler: (async (input) => {
          const response = await dispatchAuthHttp(auth, {
            method: spec.method,
            path: materializePath(spec.path, input.params),
            headers: {
              authorization: input.headers.authorization,
              'content-type': input.headers['content-type'],
              ...(input.ctx.security.userAgent ? { 'user-agent': input.ctx.security.userAgent } : {}),
            },
            body: input.body,
            ...(input.ctx.security.ip ? { ip: input.ctx.security.ip } : {}),
            requestId: input.ctx.requestId,
          });
          return {
            status: response.status,
            body: adaptAuthBody(response.status, response.body, input.ctx.requestId),
          };
        }) satisfies RouteHandler,
      }),
    ),
  );
}

function materializePath(pattern: string, params: Readonly<Record<string, string>>): string {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name: string) => params[name] ?? `:${name}`);
}

function bearer(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : header.trim();
}

function adaptAuthBody(status: number, body: unknown, requestId: string): unknown {
  if (status < 400 || !isRecord(body) || typeof body.error_code !== 'string') {
    return body;
  }
  const code = platformErrorCode(body.error_code);
  return apiError({
    code,
    message: typeof body.message === 'string' ? body.message : 'authentication failed',
    requestId,
    retryable: body.retryable === true,
    metadata: isRecord(body.details_safe_for_client)
      ? Object.fromEntries(
          Object.entries(body.details_safe_for_client).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {},
  });
}

function platformErrorCode(authCode: string): ApiErrorCode {
  switch (authCode) {
    case 'RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'AUTH_REQUIRED':
      return 'AUTHENTICATION_REQUIRED';
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    case 'MALFORMED':
      return 'VALIDATION_FAILED';
    case 'INTERNAL':
      return 'INTERNAL_ERROR';
    default:
      return 'AUTHENTICATION_INVALID';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
