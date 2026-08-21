import { randomUUID } from 'node:crypto';

import type { DeploymentTier, PlatformApiConfig } from './config.ts';

export const API_VERSION = 'v1' as const;
export type ApiVersion = typeof API_VERSION;

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,128}$/;

export type SecurityMetadata = {
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly origin: string | null;
  readonly forwardedFor: string | null;
};

export type AuthorizationContext = {
  readonly authenticated: boolean;
  readonly scheme: 'none' | 'session' | 'placeholder';
  readonly scopes: readonly string[];
};

export type AuthenticatedPrincipal = {
  readonly userId: string;
  readonly sessionId: string;
  readonly deviceId?: string;
  readonly jurisdiction?: string;
  readonly clientId?: string;
};

export type RequestContext = {
  readonly requestId: string;
  readonly correlationId: string;
  readonly timestamp: string;
  readonly environment: 'simulation';
  readonly deploymentTier: DeploymentTier;
  readonly apiVersion: ApiVersion;
  readonly route: string;
  readonly method: string;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly deviceId: string | null;
  readonly jurisdiction: string | null;
  readonly clientId: string | null;
  readonly security: SecurityMetadata;
  readonly authorization: AuthorizationContext;
};

export type Authenticator = {
  authenticate(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
  }): Promise<AuthenticatedPrincipal | null>;
};

/**
 * Default authenticator. Does not trust client-supplied identity headers.
 * Session validation is a later Phase B prompt.
 */
export const nullAuthenticator: Authenticator = {
  async authenticate(): Promise<AuthenticatedPrincipal | null> {
    return null;
  },
};

export function newRequestId(candidate: string | undefined): string {
  if (candidate && REQUEST_ID_RE.test(candidate) && !candidate.includes(' ')) {
    return candidate;
  }
  return randomUUID();
}

export function deriveRequestContext(input: {
  readonly config: PlatformApiConfig;
  readonly method: string;
  readonly route: string;
  readonly requestIdHeader: string | undefined;
  readonly correlationIdHeader: string | undefined;
  readonly ip: string | null;
  readonly userAgent: string | undefined;
  readonly origin: string | undefined;
  readonly forwardedFor: string | undefined;
  readonly principal: AuthenticatedPrincipal | null;
  readonly nowIso: string;
}): RequestContext {
  const requestId = newRequestId(input.requestIdHeader);
  const correlationId = newRequestId(input.correlationIdHeader ?? requestId);
  const authenticated = input.principal !== null;
  return Object.freeze({
    requestId,
    correlationId,
    timestamp: input.nowIso,
    environment: 'simulation',
    deploymentTier: input.config.deploymentTier,
    apiVersion: API_VERSION,
    route: input.route,
    method: input.method,
    userId: input.principal?.userId ?? null,
    sessionId: input.principal?.sessionId ?? null,
    deviceId: input.principal?.deviceId ?? null,
    jurisdiction: input.principal?.jurisdiction ?? null,
    clientId: input.principal?.clientId ?? null,
    security: Object.freeze({
      ip: input.ip,
      userAgent: input.userAgent ?? null,
      origin: input.origin ?? null,
      forwardedFor: input.forwardedFor ?? null,
    }),
    authorization: Object.freeze({
      authenticated,
      scheme: authenticated ? 'session' : 'none',
      scopes: [],
    }),
  });
}
