/**
 * Wave 8 — server-side route authorization.
 * Does not trust frontend role claims. Uses session-resolved capabilities only.
 */

import { bffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';
import { domainForPath } from './domains.ts';

export type RouteAuthRequirement = {
  readonly capabilities: readonly string[];
  readonly requireVerified: boolean;
  readonly denyRestricted: boolean;
  readonly regulated: boolean;
};

const DEFAULT_READ: RouteAuthRequirement = Object.freeze({
  capabilities: Object.freeze(['VIEW_ACCOUNT']),
  requireVerified: false,
  denyRestricted: false,
  regulated: false,
});

const ROUTE_AUTH: Readonly<Record<string, RouteAuthRequirement>> = Object.freeze({
  'GET /api/v1/me': Object.freeze({ capabilities: [], requireVerified: false, denyRestricted: false, regulated: false }),
  'GET /api/v1/me/home': DEFAULT_READ,
  'GET /api/v1/accounts': DEFAULT_READ,
  'GET /api/v1/payments': Object.freeze({ capabilities: ['PAYMENT_REQUEST', 'VIEW_ACCOUNT'], requireVerified: true, denyRestricted: true, regulated: true }),
  'POST /api/v1/payments': Object.freeze({ capabilities: ['PAYMENT_REQUEST'], requireVerified: true, denyRestricted: true, regulated: true }),
  'GET /api/v1/wallets': Object.freeze({ capabilities: ['VIEW_ACCOUNT'], requireVerified: true, denyRestricted: true, regulated: true }),
  'POST /api/v1/wallets/withdrawals': Object.freeze({ capabilities: ['POST_WITHDRAWAL_REQUEST'], requireVerified: true, denyRestricted: true, regulated: true }),
  'GET /api/v1/grow': Object.freeze({ capabilities: ['VIEW_GROWTH_PLAN'], requireVerified: false, denyRestricted: true, regulated: false }),
  'GET /api/v1/exchange': Object.freeze({ capabilities: ['EXCHANGE_VIEW'], requireVerified: true, denyRestricted: true, regulated: true }),
  'POST /api/v1/exchange/orders': Object.freeze({ capabilities: ['EXCHANGE_OPERATE_REQUEST'], requireVerified: true, denyRestricted: true, regulated: true }),
  'GET /api/v1/data/vault': Object.freeze({ capabilities: ['VAULT_VIEW_OWN'], requireVerified: true, denyRestricted: true, regulated: true }),
  'GET /api/v1/sunrey/peve': Object.freeze({ capabilities: ['VIEW_ECONOMIC_GRAPH'], requireVerified: true, denyRestricted: true, regulated: true }),
  'GET /api/v1/actions': DEFAULT_READ,
  'GET /api/v1/agent/actions': Object.freeze({ capabilities: [], requireVerified: false, denyRestricted: true, regulated: false }),
});

function routeKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function requirementFor(method: string, path: string): RouteAuthRequirement {
  const exact = ROUTE_AUTH[routeKey(method, path)];
  if (exact) return exact;

  const domain = domainForPath(path);
  if (domain?.domain === 'sunrey' || domain?.domain === 'moonrey') {
    return Object.freeze({ capabilities: ['VIEW_ECONOMIC_GRAPH'], requireVerified: false, denyRestricted: true, regulated: false });
  }
  if (domain?.domain === 'vault' || domain?.domain === 'consent') {
    return Object.freeze({ capabilities: ['VAULT_VIEW_OWN'], requireVerified: true, denyRestricted: true, regulated: true });
  }
  if (domain?.domain === 'hin') {
    return method === 'GET' || method === 'HEAD'
      ? DEFAULT_READ
      : Object.freeze({ capabilities: [], requireVerified: true, denyRestricted: true, regulated: false });
  }
  if (domain?.domain === 'exchange' || domain?.domain === 'wallet') {
    return Object.freeze({ capabilities: ['EXCHANGE_VIEW'], requireVerified: true, denyRestricted: true, regulated: true });
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return Object.freeze({ capabilities: [], requireVerified: true, denyRestricted: true, regulated: true });
  }
  return DEFAULT_READ;
}

function hasCapability(principal: BffPrincipal, required: string): boolean {
  if (required.length === 0) return true;
  return principal.capabilities.includes(required);
}

export function authorizeConsumerRoute(
  principal: BffPrincipal,
  method: string,
  path: string,
  requestId: string,
): BffErrorEnvelope | null {
  const req = requirementFor(method, path);

  if (req.denyRestricted && principal.restricted) {
    return bffError({
      errorCode: 'POLICY_DENIED',
      category: 'POLICY',
      message: 'account restriction forbids this action',
      retryable: false,
      requestId,
      detailsSafeForClient: { code: 'POLICY_DENIED' },
    });
  }

  if (req.requireVerified && principal.verification !== 'VERIFIED') {
    return bffError({
      errorCode: 'IDENTITY_ASSURANCE_INSUFFICIENT',
      category: 'POLICY',
      message: 'identity verification must complete before this action',
      retryable: false,
      requestId,
      detailsSafeForClient: { code: 'IDENTITY_ASSURANCE_INSUFFICIENT' },
    });
  }

  for (const cap of req.capabilities) {
    if (!hasCapability(principal, cap)) {
      return bffError({
        errorCode: 'FORBIDDEN',
        category: 'AUTHORIZATION',
        message: 'insufficient capability for this route',
        retryable: false,
        requestId,
        detailsSafeForClient: { requiredCapability: cap },
      });
    }
  }

  if (req.regulated && path.includes('/moonrey/gpuv')) {
    return null;
  }

  return null;
}

export function authRequirementFor(method: string, path: string): RouteAuthRequirement {
  return requirementFor(method, path);
}
