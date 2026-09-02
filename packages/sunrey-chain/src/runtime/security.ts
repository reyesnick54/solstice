/**
 * Wave 2 — runtime security hardening defaults.
 */

import type { RpcPlane } from './rpc.ts';

export const RUNTIME_SECURITY_DEFAULTS = Object.freeze({
  ratePerWindow: 32,
  windowMs: 1_000,
  maxRequestBytes: 65_536,
  maxPathLength: 512,
  maxBodyBytes: 65_536,
  bindAddressDefault: '127.0.0.1',
  publicRpcBindRequiresEdge: true,
  tlsRequiredForPublicEdge: true,
  corsWildcardForbidden: true,
  stackTracesInResponses: false,
  debugEndpointsEnabled: false,
  adminAuthenticationRequired: true,
  keyFileModeMax: 0o600,
  secretsInLogsForbidden: true,
});

export type RuntimeSecurityConfig = {
  readonly plane: RpcPlane;
  readonly bindHost: string;
  readonly ratePerWindow: number;
  readonly windowMs: number;
  readonly maxRequestBytes: number;
  readonly maxPathLength: number;
  readonly corsOrigins: readonly string[];
  readonly allowDebugEndpoints: boolean;
  readonly exposeStackTraces: boolean;
  readonly requireAdminAuth: boolean;
};

export function defaultSecurityConfig(plane: RpcPlane): RuntimeSecurityConfig {
  const isPublic = plane === 'PUBLIC_RPC';
  return Object.freeze({
    plane,
    bindHost: isPublic ? '0.0.0.0' : RUNTIME_SECURITY_DEFAULTS.bindAddressDefault,
    ratePerWindow: RUNTIME_SECURITY_DEFAULTS.ratePerWindow,
    windowMs: RUNTIME_SECURITY_DEFAULTS.windowMs,
    maxRequestBytes: RUNTIME_SECURITY_DEFAULTS.maxRequestBytes,
    maxPathLength: RUNTIME_SECURITY_DEFAULTS.maxPathLength,
    corsOrigins: isPublic ? ['https://explorer.sunrey.test'] : [],
    allowDebugEndpoints: plane === 'ADMIN_RPC' ? false : false,
    exposeStackTraces: false,
    requireAdminAuth: plane === 'ADMIN_RPC' || plane === 'VALIDATOR_RPC',
  });
}

export type SecurityValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly detail: string };

export function validateSecurityConfig(config: RuntimeSecurityConfig): SecurityValidationResult {
  if (config.exposeStackTraces) {
    return { ok: false, code: 'STACK_TRACES_EXPOSED', detail: 'stack traces must not be returned to clients' };
  }
  if (config.plane === 'PUBLIC_RPC' && config.allowDebugEndpoints) {
    return { ok: false, code: 'DEBUG_ON_PUBLIC', detail: 'debug endpoints forbidden on public RPC' };
  }
  if (config.plane === 'PUBLIC_RPC' && config.corsOrigins.includes('*')) {
    return { ok: false, code: 'CORS_WILDCARD', detail: 'wildcard CORS forbidden on public RPC' };
  }
  if (config.maxRequestBytes > RUNTIME_SECURITY_DEFAULTS.maxRequestBytes) {
    return {
      ok: false,
      code: 'REQUEST_SIZE',
      detail: `max request bytes ${config.maxRequestBytes} exceeds default`,
    };
  }
  if (config.plane === 'ADMIN_RPC' && !config.requireAdminAuth) {
    return { ok: false, code: 'ADMIN_UNAUTHENTICATED', detail: 'admin plane requires authentication' };
  }
  if (config.plane === 'VALIDATOR_RPC' && config.bindHost === '0.0.0.0') {
    return { ok: false, code: 'VALIDATOR_PUBLIC_BIND', detail: 'validator RPC must not bind publicly' };
  }
  return { ok: true };
}

const FORBIDDEN_LOG_PATTERNS = [
  /private[_-]?key/i,
  /seed[_-]?phrase/i,
  /mnemonic/i,
  /secret[_-]?ref/i,
  /password/i,
  /raw[_-]?hin/i,
  /ssn/i,
  /national[_-]?id/i,
] as const;

export function assertSafeLogPayload(payload: string): 'OK' | 'SECRET_LEAK' {
  for (const pattern of FORBIDDEN_LOG_PATTERNS) {
    if (pattern.test(payload)) {
      return 'SECRET_LEAK';
    }
  }
  return 'OK';
}

export function assertKeyFilePermissions(mode: number): 'OK' | 'PERMISSIONS_TOO_OPEN' {
  if ((mode & 0o177) !== 0) {
    return 'PERMISSIONS_TOO_OPEN';
  }
  return 'OK';
}
