/**
 * API security control catalog. Enforcement stays on the canonical
 * services/api and packages/identity owners.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';

export const API_SECURITY_CONTROLS = Object.freeze({
  authentication: 'Bearer access token via packages/identity; userId is never taken from the body',
  authorization: 'session principal + capability; Kernel for regulated mutation',
  cors: 'explicit origin allow-list; wildcard forbidden on production/staging authenticated APIs',
  csrf: 'bearer token is not cookie-session CSRF-vulnerable; cookie auth would require SameSite + CSRF token',
  requestLimits: 'body size and field validation at the gateway',
  rateLimits: 'per-endpoint class; memory or postgres backend',
  injection: 'parameterized SQL; no string-concatenated queries in persistence writers',
  serialization: 'typed envelopes; unknown fields dropped',
  massAssignment: 'allow-listed body fields only',
  idor: 'resource owner must equal authenticated subject',
  ssrf: 'webhook destinations inspected; private ranges refused',
  openRedirects: 'redirect targets allow-listed',
  fileHandling: 'no unrestricted user file execution; PDV stores encrypted blobs',
});

export type ApiRequestContext = {
  readonly authenticatedSubjectId: string | null;
  readonly requestedSubjectId: string | null;
  readonly bodyKeys: readonly string[];
  readonly allowedBodyKeys: readonly string[];
  readonly redirectTarget: string | null;
  readonly allowedRedirects: readonly string[];
};

export function assertNoIdor(ctx: ApiRequestContext): SecurityResult<true> {
  if (ctx.authenticatedSubjectId === null) {
    return securityErr('AUTHENTICATION_FAILED', 'unauthenticated caller cannot select another subject');
  }
  if (ctx.requestedSubjectId !== null && ctx.requestedSubjectId !== ctx.authenticatedSubjectId) {
    return securityErr('ADMIN_BOUNDARY', 'IDOR: caller cannot select another subject');
  }
  return securityOk(true);
}

export function assertNoMassAssignment(ctx: ApiRequestContext): SecurityResult<true> {
  const extra = ctx.bodyKeys.filter((key) => !ctx.allowedBodyKeys.includes(key));
  const privileged = extra.filter((key) =>
    /userId|identityId|actorId|role|admin|balance|authority|kyc/i.test(key),
  );
  if (privileged.length > 0) {
    return securityErr('ADMIN_BOUNDARY', `mass assignment of privileged fields refused: ${privileged.join(',')}`);
  }
  return securityOk(true);
}

export function assertNoOpenRedirect(ctx: ApiRequestContext): SecurityResult<true> {
  if (ctx.redirectTarget === null) {
    return securityOk(true);
  }
  if (!ctx.allowedRedirects.includes(ctx.redirectTarget)) {
    return securityErr('POLICY_REJECTED', `open redirect refused: ${ctx.redirectTarget}`);
  }
  return securityOk(true);
}
