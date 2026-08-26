import { timingSafeEqual } from 'node:crypto';

import { asSessionId } from '../../../../packages/identity/src/ids.ts';
import type { IdentityService } from '../../../../packages/identity/src/service.ts';
import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { SessionDirectory } from './session.ts';
import {
  SANDBOX_PERSONA_IDS,
  sandboxToken,
  type SandboxPersonaId,
} from './sandbox-personas.ts';

export const DEFAULT_PREVIEW_LOGIN_EMAIL = 'preview@sunrey.xyz' as const;

export type PreviewAuthConfig = {
  readonly email?: string;
  readonly password?: string;
};

export type PreviewSessionResource = {
  readonly schema: 'sunrey.preview.auth-session.v1';
  readonly environment: 'simulation';
  readonly production: false;
  readonly tokenType: 'Bearer';
  readonly token: string;
  readonly expiresAt: string;
  readonly personaId: SandboxPersonaId;
  readonly email: string;
};

function isPersonaId(value: string): value is SandboxPersonaId {
  return (SANDBOX_PERSONA_IDS as readonly string[]).includes(value);
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  if (leftBytes.length !== rightBytes.length) {
    return false;
  }
  return timingSafeEqual(leftBytes, rightBytes);
}

export function issuePreviewSession(input: {
  readonly body: unknown;
  readonly sessions: SessionDirectory;
  readonly identity: IdentityService | undefined;
  readonly config: PreviewAuthConfig;
  readonly requestId: string;
}): PreviewSessionResource | BffErrorEnvelope {
  const configuredPassword = input.config.password;
  if (!configuredPassword || configuredPassword.length < 12) {
    return bffError({
      errorCode: 'FEATURE_UNAVAILABLE',
      category: 'TEMPORARY_UNAVAILABLE',
      message: 'preview authentication is not configured',
      retryable: false,
      requestId: input.requestId,
    });
  }
  if (!input.identity) {
    return bffError({
      errorCode: 'FEATURE_UNAVAILABLE',
      category: 'TEMPORARY_UNAVAILABLE',
      message: 'identity service is not attached to this runtime',
      retryable: false,
      requestId: input.requestId,
    });
  }

  const body = input.body && typeof input.body === 'object' && !Array.isArray(input.body)
    ? (input.body as Record<string, unknown>)
    : {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const personaRaw = typeof body.personaId === 'string' ? body.personaId.trim() : 'basic_verified';
  const configuredEmail = (input.config.email ?? DEFAULT_PREVIEW_LOGIN_EMAIL).trim().toLowerCase();

  if (
    !email ||
    !password ||
    !isPersonaId(personaRaw) ||
    !safeEqual(email, configuredEmail) ||
    !safeEqual(password, configuredPassword)
  ) {
    return bffError({
      errorCode: 'AUTH_REQUIRED',
      category: 'AUTHENTICATION',
      message: 'email or password is incorrect',
      retryable: false,
      requestId: input.requestId,
    });
  }

  const principal = input.sessions.get(sandboxToken(personaRaw));
  if (!principal) {
    return bffError({
      errorCode: 'FEATURE_UNAVAILABLE',
      category: 'TEMPORARY_UNAVAILABLE',
      message: 'sandbox persona is unavailable',
      retryable: false,
      requestId: input.requestId,
    });
  }

  const sourceSession = input.identity.getSession(asSessionId(principal.sessionId));
  if (!sourceSession) {
    return bffError({
      errorCode: 'SESSION_INVALID',
      category: 'AUTHENTICATION',
      message: 'sandbox identity session is unavailable',
      retryable: false,
      requestId: input.requestId,
    });
  }
  const identity = input.identity.getIdentity(sourceSession.subjectId);
  if (!identity || identity.status !== 'ACTIVE') {
    return bffError({
      errorCode: 'FORBIDDEN',
      category: 'AUTHORIZATION',
      message: 'identity is not eligible to authenticate',
      retryable: false,
      requestId: input.requestId,
    });
  }

  const session = input.identity.createSession({
    subjectId: sourceSession.subjectId,
    actorId: sourceSession.actorId,
    assurance: sourceSession.authenticationStrength,
    factors: sourceSession.factors,
    deviceId: sourceSession.deviceId,
  });

  return Object.freeze({
    schema: 'sunrey.preview.auth-session.v1',
    environment: 'simulation',
    production: false,
    tokenType: 'Bearer',
    token: session.sessionId,
    expiresAt: session.expiresAt,
    personaId: personaRaw,
    email: configuredEmail,
  });
}
