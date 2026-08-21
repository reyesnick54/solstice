/**
 * Mountable authentication HTTP handlers.
 *
 * This is not a second API runtime. Handlers are dispatched by method + path
 * so Phase B Prompt 1 (canonical API gateway) can mount them. Tests call
 * `dispatchAuthHttp` directly.
 *
 * Paths follow `/api/v1/auth/*`. Identity is never taken from the request body.
 */

import { asJurisdiction } from '../../../domain/src/jurisdiction.ts';
import { newCorrelationId } from '../../../security/src/random.ts';
import type { AuthenticationAssurance } from '../assurance.ts';
import {
  AuthenticationService,
  isMfaRequired,
  type AuthenticatedRequestContext,
  type AuthFailure,
} from '../authentication-service.ts';
import { asDeviceId, asSessionId } from '../ids.ts';

export const AUTH_API_VERSION = 'v1' as const;

export type AuthHttpRequest = {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: unknown;
  readonly ip?: string | undefined;
  readonly requestId?: string | undefined;
};

export type AuthApiError = {
  readonly error_code: string;
  readonly category: 'VALIDATION' | 'AUTHENTICATION' | 'AUTHORIZATION' | 'RATE_LIMIT' | 'NOT_FOUND' | 'INTERNAL';
  readonly message: string;
  readonly retryable: boolean;
  readonly details_safe_for_client: Readonly<Record<string, string>>;
  readonly request_id: string;
  readonly api_version: 'v1';
};

export type AuthHttpResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
};

const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json',
  'x-sunrey-api-version': 'v1',
  'x-sunrey-surface': 'AUTH_API',
});

export async function dispatchAuthHttp(
  auth: AuthenticationService,
  request: AuthHttpRequest,
): Promise<AuthHttpResponse> {
  const requestId = request.requestId ?? newCorrelationId();
  const method = request.method.toUpperCase();
  const path = normalizePath(request.path);
  const userAgent = request.headers['user-agent'];
  const body = isRecord(request.body) ? request.body : {};

  const rejectUserId = rejectClientIdentity(body, requestId);
  if (rejectUserId) {
    return rejectUserId;
  }

  try {
    if (method === 'POST' && path === '/api/v1/auth/register') {
      const result = await auth.register({
        email: asString(body.email),
        phone: asString(body.phone),
        password: asString(body.password) ?? '',
        homeJurisdiction: asJurisdiction(asString(body.homeJurisdiction) ?? 'GB'),
        termsVersion: asString(body.termsVersion) ?? '',
        ip: request.ip,
        userAgent,
      });
      return fromResult(result, requestId, 201, (value) => ({
        identity_id: value.identityId,
        actor_id: value.actorId,
        verification_state: value.verificationState,
        kyc_completed: value.kycCompleted,
        terms_version: value.termsVersion,
      }));
    }

    if (method === 'POST' && path === '/api/v1/auth/login') {
      const result = await auth.authenticate({
        email: asString(body.email),
        phone: asString(body.phone),
        password: asString(body.password) ?? '',
        deviceRef: asString(body.deviceRef),
        ip: request.ip,
        userAgent,
      });
      if (!result.ok) {
        return errorFromFailure(result.error, requestId);
      }
      if (isMfaRequired(result.value)) {
        return json(200, {
          status: 'MFA_REQUIRED',
          mfa_token: result.value.mfaToken,
          methods: result.value.methods,
        });
      }
      return json(200, tokenBody(result.value));
    }

    if (method === 'POST' && path === '/api/v1/auth/logout') {
      const token = bearer(request.headers);
      if (!token) {
        return authRequired(requestId);
      }
      return fromResult(auth.logout(token), requestId, 200, (session) => ({
        session_id: session.sessionId,
        revoked: true,
      }));
    }

    if (method === 'POST' && path === '/api/v1/auth/refresh') {
      const result = auth.refreshSession({
        refreshToken: asString(body.refreshToken) ?? '',
        ip: request.ip,
        userAgent,
      });
      return fromResult(result, requestId, 200, tokenBody);
    }

    if (method === 'GET' && path === '/api/v1/auth/sessions') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return json(200, {
        sessions: caller.value.list.map((session) => ({
          session_id: session.sessionId,
          created_at: session.issuedAt,
          last_seen_at: session.lastUsedAt,
          expires_at: session.expiresAt,
          revoked_at: session.revokedAt,
          device_id: session.deviceId,
          authentication_strength: session.authenticationStrength,
          risk_state: session.riskState,
          revocation_state: session.revocationState,
          current: session.sessionId === caller.value.ctx.session.sessionId,
        })),
      });
    }

    if (method === 'DELETE' && path.startsWith('/api/v1/auth/sessions/')) {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      const sessionId = path.slice('/api/v1/auth/sessions/'.length);
      if (sessionId === 'others') {
        return fromResult(auth.revokeAllOtherSessions(caller.value.ctx), requestId, 200, (value) => value);
      }
      return fromResult(auth.revokeSession(asSessionId(sessionId), caller.value.ctx), requestId, 200, (session) => ({
        session_id: session.sessionId,
        revoked: true,
      }));
    }

    if (method === 'GET' && path === '/api/v1/auth/devices') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return json(200, {
        devices: auth.listTrustedDevices(caller.value.ctx).map((device) => ({
          device_id: device.deviceId,
          first_seen_at: device.firstSeenAt,
          last_seen_at: device.lastSeenAt,
          revoked_at: device.revokedAt,
          trusted: device.trustState === 'TRUSTED',
          trust_state: device.trustState,
          risk_state: device.riskState,
          authentication_strength: device.authenticationStrength,
        })),
      });
    }

    if (method === 'DELETE' && path.startsWith('/api/v1/auth/devices/')) {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      const deviceId = path.slice('/api/v1/auth/devices/'.length);
      return fromResult(auth.revokeDevice(caller.value.ctx, asDeviceId(deviceId)), requestId, 200, (device) => ({
        device_id: device.deviceId,
        trust_state: device.trustState,
      }));
    }

    if (method === 'POST' && path.startsWith('/api/v1/auth/devices/') && path.endsWith('/trust')) {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      const deviceId = path.slice('/api/v1/auth/devices/'.length, -'/trust'.length);
      return fromResult(auth.trustDevice(caller.value.ctx, asDeviceId(deviceId)), requestId, 200, (device) => ({
        device_id: device.deviceId,
        trust_state: device.trustState,
      }));
    }

    if (method === 'POST' && path === '/api/v1/auth/mfa/enroll') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return fromResult(auth.enrollTotp(caller.value.ctx), requestId, 200, (value) => ({
        secret_base32: value.secretBase32,
        otpauth: value.otpauth,
        enroll_token: value.enrollToken,
      }));
    }

    if (method === 'POST' && path === '/api/v1/auth/mfa/enroll/confirm') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return fromResult(
        auth.confirmTotpEnrollment(caller.value.ctx, asString(body.enrollToken) ?? '', asString(body.code) ?? ''),
        requestId,
        200,
        (value) => value,
      );
    }

    if (method === 'POST' && path === '/api/v1/auth/mfa/begin') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return fromResult(auth.beginMfa(caller.value.ctx), requestId, 200, (value) => ({
        mfa_token: value.mfaToken,
        methods: value.methods,
      }));
    }

    if (method === 'POST' && path === '/api/v1/auth/mfa/verify') {
      const result = await auth.verifyMfa({
        mfaToken: asString(body.mfaToken) ?? '',
        code: asString(body.code) ?? '',
        deviceRef: asString(body.deviceRef),
        ip: request.ip,
        userAgent,
      });
      return fromResult(result, requestId, 200, tokenBody);
    }

    if (method === 'POST' && path === '/api/v1/auth/passkey/register/begin') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return fromResult(
        auth.beginPasskeyRegistration(caller.value.ctx, asString(body.rpId), asString(body.origin)),
        requestId,
        200,
        (challenge) => challenge,
      );
    }

    if (method === 'POST' && path === '/api/v1/auth/passkey/register/complete') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return fromResult(
        auth.completePasskeyRegistration(caller.value.ctx, body as never, asString(body.deviceRef)),
        requestId,
        200,
        (credential) => ({ credential_id: credential.credentialId }),
      );
    }

    if (method === 'POST' && path === '/api/v1/auth/passkey/authenticate/begin') {
      return fromResult(
        auth.beginPasskeyAuthentication({ email: asString(body.email), phone: asString(body.phone) }, asString(body.rpId), asString(body.origin), request.ip),
        requestId,
        200,
        (challenge) => challenge,
      );
    }

    if (method === 'POST' && path === '/api/v1/auth/passkey/authenticate/complete') {
      return fromResult(
        auth.verifyPasskey({
          response: body as never,
          deviceRef: asString(body.deviceRef),
          ip: request.ip,
          userAgent,
        }),
        requestId,
        200,
        tokenBody,
      );
    }

    if (method === 'POST' && path === '/api/v1/auth/recovery/begin') {
      return fromResult(
        auth.beginRecovery({
          email: asString(body.email),
          phone: asString(body.phone),
          ip: request.ip,
          userAgent,
        }),
        requestId,
        200,
        (value) => value,
      );
    }

    if (method === 'POST' && path === '/api/v1/auth/recovery/complete') {
      const result = await auth.completeRecovery({
        recoveryToken: asString(body.recoveryToken) ?? '',
        newPassword: asString(body.newPassword) ?? '',
        totpCode: asString(body.totpCode),
        ip: request.ip,
        userAgent,
      });
      return fromResult(result, requestId, 200, (value) => value);
    }

    if (method === 'POST' && path === '/api/v1/auth/credentials/password') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      const result = await auth.changePassword(
        caller.value.ctx,
        asString(body.currentPassword) ?? '',
        asString(body.newPassword) ?? '',
      );
      return fromResult(result, requestId, 200, (value) => value);
    }

    if (method === 'GET' && path === '/api/v1/auth/me') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      return json(200, {
        identity_id: caller.value.ctx.identityId,
        actor_id: caller.value.ctx.actorId,
        session_id: caller.value.ctx.session.sessionId,
        authentication_strength: caller.value.ctx.authenticationStrength,
        kyc_completed: false,
        execution_authority: false,
      });
    }

    if (method === 'POST' && path === '/api/v1/auth/step-up/evaluate') {
      const caller = requireCaller(auth, request, requestId);
      if (!caller.ok) {
        return caller.response;
      }
      const needed = (asString(body.needed) ?? 'HIGH_ASSURANCE') as AuthenticationAssurance;
      return fromResult(auth.requireAssurance(caller.value.ctx, needed), requestId, 200, (value) => value);
    }

    return jsonError(404, {
      error_code: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'unknown authentication route',
      retryable: false,
      request_id: requestId,
    });
  } catch (error) {
    return jsonError(500, {
      error_code: 'INTERNAL',
      category: 'INTERNAL',
      message: error instanceof Error ? error.message : 'internal error',
      retryable: false,
      request_id: requestId,
    });
  }
}

export function authenticateRequestMiddleware(
  auth: AuthenticationService,
  accessToken: string | undefined,
): { readonly ok: true; readonly context: AuthenticatedRequestContext } | { readonly ok: false; readonly failure: AuthFailure } {
  if (!accessToken) {
    return { ok: false, failure: { code: 'AUTH_REQUIRED', message: 'authentication is required' } };
  }
  const result = auth.authenticateRequest(accessToken);
  if (!result.ok) {
    return { ok: false, failure: result.error };
  }
  return { ok: true, context: result.value };
}

function requireCaller(
  auth: AuthenticationService,
  request: AuthHttpRequest,
  requestId: string,
): { readonly ok: true; readonly value: { readonly ctx: AuthenticatedRequestContext; readonly list: ReturnType<AuthenticationService['listSessions']> } } | { readonly ok: false; readonly response: AuthHttpResponse } {
  const token = bearer(request.headers);
  const authenticated = authenticateRequestMiddleware(auth, token);
  if (!authenticated.ok) {
    return { ok: false, response: errorFromFailure(authenticated.failure, requestId) };
  }
  return {
    ok: true,
    value: { ctx: authenticated.context, list: auth.listSessions(authenticated.context) },
  };
}

function tokenBody(bundle: {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: string;
  readonly refreshExpiresAt: string;
  readonly session: { readonly sessionId: string; readonly authenticationStrength: string };
  readonly authenticationStrength: string;
}): Record<string, unknown> {
  return {
    access_token: bundle.accessToken,
    refresh_token: bundle.refreshToken,
    access_expires_at: bundle.accessExpiresAt,
    refresh_expires_at: bundle.refreshExpiresAt,
    session_id: bundle.session.sessionId,
    authentication_strength: bundle.authenticationStrength,
    kyc_completed: false,
    execution_authority: false,
  };
}

function fromResult<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: AuthFailure },
  requestId: string,
  status: number,
  map: (value: T) => unknown,
): AuthHttpResponse {
  if (!result.ok) {
    return errorFromFailure(result.error, requestId);
  }
  return json(status, map(result.value));
}

function errorFromFailure(failure: AuthFailure, requestId: string): AuthHttpResponse {
  const mapped = mapFailure(failure);
  return jsonError(mapped.status, {
    error_code: mapped.code,
    category: mapped.category,
    message: failure.message,
    retryable: mapped.category === 'RATE_LIMIT',
    request_id: requestId,
    details_safe_for_client: {
      ...(failure.retryAfterMs !== undefined ? { retry_after_ms: String(failure.retryAfterMs) } : {}),
    },
  });
}

function mapFailure(failure: AuthFailure): {
  readonly status: number;
  readonly code: string;
  readonly category: AuthApiError['category'];
} {
  switch (failure.code) {
    case 'RATE_LIMITED':
      return { status: 429, code: 'RATE_LIMITED', category: 'RATE_LIMIT' };
    case 'AUTH_REQUIRED':
    case 'ACCESS_TOKEN_INVALID':
    case 'CREDENTIAL_INVALID':
    case 'REFRESH_INVALID':
    case 'REFRESH_REUSE':
    case 'REFRESH_EXPIRED':
    case 'MFA_INVALID':
    case 'CHALLENGE_INVALID':
    case 'CHALLENGE_EXPIRED':
    case 'RECOVERY_INVALID':
      return { status: 401, code: failure.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'INVALID_SIGNATURE', category: 'AUTHENTICATION' };
    case 'SESSION_REVOKED':
    case 'SESSION_EXPIRED':
    case 'DEVICE_REVOKED':
      return { status: 401, code: failure.code, category: 'AUTHENTICATION' };
    case 'STEP_UP_REQUIRED':
    case 'RECOVERY_STEP_UP_REQUIRED':
    case 'MFA_REQUIRED':
      return { status: 403, code: 'AUTH_REQUIRED', category: 'AUTHORIZATION' };
    case 'SESSION_NOT_FOUND':
    case 'DEVICE_NOT_FOUND':
    case 'NOT_FOUND':
      return { status: 404, code: 'NOT_FOUND', category: 'NOT_FOUND' };
    case 'IDENTIFIER_UNAVAILABLE':
    case 'PASSWORD_POLICY':
    case 'TERMS_REQUIRED':
    case 'IDENTIFIER_REQUIRED':
    case 'IDENTIFIER_INVALID':
    case 'CLIENT_IDENTITY_REJECTED':
      return { status: 400, code: 'MALFORMED', category: 'VALIDATION' };
    default:
      return { status: 400, code: 'MALFORMED', category: 'VALIDATION' };
  }
}

function rejectClientIdentity(body: Record<string, unknown>, requestId: string): AuthHttpResponse | null {
  if ('userId' in body || 'identityId' in body || 'actorId' in body) {
    return jsonError(400, {
      error_code: 'MALFORMED',
      category: 'VALIDATION',
      message: 'client cannot select authenticated identity',
      retryable: false,
      request_id: requestId,
    });
  }
  return null;
}

function bearer(headers: Readonly<Record<string, string | undefined>>): string | undefined {
  const raw = headers.authorization ?? headers.Authorization;
  if (!raw) {
    return undefined;
  }
  return raw.toLowerCase().startsWith('bearer ') ? raw.slice(7).trim() : raw.trim();
}

function authRequired(requestId: string): AuthHttpResponse {
  return jsonError(401, {
    error_code: 'AUTH_REQUIRED',
    category: 'AUTHENTICATION',
    message: 'authentication is required',
    retryable: false,
    request_id: requestId,
  });
}

function json(status: number, body: unknown): AuthHttpResponse {
  return { status, headers: JSON_HEADERS, body };
}

function jsonError(
  status: number,
  error: Omit<AuthApiError, 'details_safe_for_client' | 'api_version'> & {
    readonly details_safe_for_client?: Readonly<Record<string, string>>;
  },
): AuthHttpResponse {
  return {
    status,
    headers: JSON_HEADERS,
    body: Object.freeze({
      error_code: error.error_code,
      category: error.category,
      message: error.message,
      retryable: error.retryable,
      details_safe_for_client: error.details_safe_for_client ?? {},
      request_id: error.request_id,
      api_version: AUTH_API_VERSION,
    }),
  };
}

function normalizePath(path: string): string {
  const trimmed = path.split('?')[0] ?? path;
  if (trimmed.length > 1 && trimmed.endsWith('/')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
