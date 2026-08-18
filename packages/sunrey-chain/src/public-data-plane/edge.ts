import type { DeveloperApiKey, EdgeProtectionPort } from './types.ts';

export const PRODUCTION_SECURITY_HEADERS = Object.freeze({
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-sunrey-api-version': 'v1',
});

export const DEFAULT_EDGE_PROTECTION: EdgeProtectionPort = Object.freeze({
  vendorNeutral: true,
  provider: 'NONE',
  tlsRequired: true,
  maxRequestBytes: 16_384,
  trustedProxyHops: 2,
  originPolicy: 'SAME_SITE_OR_ALLOWLIST',
});

export function configureEdgeProtection(provider: 'NONE' | 'CONFIGURED_GENERIC'): EdgeProtectionPort {
  return Object.freeze({
    ...DEFAULT_EDGE_PROTECTION,
    provider,
    vendorNeutral: true,
    tlsRequired: true,
  });
}

export function developerApiKey(apiKeyId: string, quotaMultiplier = 10): DeveloperApiKey {
  return Object.freeze({
    apiKeyId,
    quotaMultiplier,
    grantsFinancialAuthority: false,
    canAuthorizeCustody: false,
    canAuthorizeExchange: false,
  });
}

export function apiKeyCannotAuthorizeFinancialAction(key: DeveloperApiKey): true {
  if (key.grantsFinancialAuthority || key.canAuthorizeCustody || key.canAuthorizeExchange) {
    throw new Error('developer API keys must not grant financial authority');
  }
  return true;
}

export function localDevnetGatewayMode(): {
  readonly environment: 'LOCAL_DEVNET';
  readonly environmentLabel: 'LOCAL_DEVNET';
  readonly bind: '127.0.0.1';
  readonly tlsRequired: false;
  readonly anonymousAccess: true;
} {
  return Object.freeze({
    environment: 'LOCAL_DEVNET',
    environmentLabel: 'LOCAL_DEVNET',
    bind: '127.0.0.1',
    tlsRequired: false,
    anonymousAccess: true,
  });
}

export function testnetGatewayLabel(): {
  readonly environment: 'TESTNET';
  readonly environmentLabel: 'SUNREY_TESTNET';
  readonly apiVersion: 'v1';
  readonly sameApiShape: true;
} {
  return Object.freeze({
    environment: 'TESTNET',
    environmentLabel: 'SUNREY_TESTNET',
    apiVersion: 'v1',
    sameApiShape: true,
  });
}
