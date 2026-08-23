/**
 * Application network surfaces and default-deny paths.
 * Composes Chunk 66 infrastructure zones; does not replace them.
 */

import { securityErr, securityOk, type SecurityResult } from '../errors.ts';

export const NETWORK_SURFACES = [
  'PUBLIC_API',
  'PUBLIC_RPC',
  'INTERNAL_API',
  'ADMIN_OPERATIONS',
  'DATABASE',
  'MESSAGE_QUEUE',
  'VALIDATOR',
  'CUSTODY_KEY_SERVICES',
  'MONITORING',
] as const;

export type NetworkSurface = (typeof NETWORK_SURFACES)[number];

export type NetworkPath = {
  readonly from: NetworkSurface;
  readonly to: NetworkSurface;
  readonly purpose: string;
};

export const ALLOWED_NETWORK_PATHS: readonly NetworkPath[] = Object.freeze([
  { from: 'PUBLIC_API', to: 'INTERNAL_API', purpose: 'authenticated public API to domain services' },
  { from: 'INTERNAL_API', to: 'DATABASE', purpose: 'application role to bounded-domain database' },
  { from: 'INTERNAL_API', to: 'MESSAGE_QUEUE', purpose: 'outbox / inbox dispatch' },
  { from: 'INTERNAL_API', to: 'CUSTODY_KEY_SERVICES', purpose: 'Exchange / custody API only' },
  { from: 'PUBLIC_RPC', to: 'VALIDATOR', purpose: 'public RPC reads finalized / mempool via sentry path' },
  { from: 'ADMIN_OPERATIONS', to: 'INTERNAL_API', purpose: 'named admin after step-up' },
  { from: 'MONITORING', to: 'PUBLIC_API', purpose: 'health scrape' },
  { from: 'MONITORING', to: 'PUBLIC_RPC', purpose: 'RPC health scrape' },
  { from: 'MONITORING', to: 'INTERNAL_API', purpose: 'internal health scrape' },
]);

export const FORBIDDEN_NETWORK_PATHS: readonly NetworkPath[] = Object.freeze([
  { from: 'PUBLIC_API', to: 'DATABASE', purpose: 'public API must not reach PostgreSQL' },
  { from: 'PUBLIC_API', to: 'CUSTODY_KEY_SERVICES', purpose: 'public API must not reach HSM / custody keys' },
  { from: 'PUBLIC_API', to: 'VALIDATOR', purpose: 'public API must not administer validators' },
  { from: 'PUBLIC_API', to: 'ADMIN_OPERATIONS', purpose: 'public API must not reach admin' },
  { from: 'PUBLIC_RPC', to: 'CUSTODY_KEY_SERVICES', purpose: 'RPC must not reach HSM' },
  { from: 'PUBLIC_RPC', to: 'DATABASE', purpose: 'RPC must not reach application databases' },
  { from: 'PUBLIC_RPC', to: 'ADMIN_OPERATIONS', purpose: 'RPC must not reach admin' },
  { from: 'MONITORING', to: 'CUSTODY_KEY_SERVICES', purpose: 'monitoring must not retrieve key material' },
  { from: 'MESSAGE_QUEUE', to: 'CUSTODY_KEY_SERVICES', purpose: 'queue workers must not reach HSM directly' },
]);

export type NetworkDecision = {
  readonly allowed: boolean;
  readonly from: NetworkSurface;
  readonly to: NetworkSurface;
  readonly reason: string;
};

export function evaluateNetworkPath(from: NetworkSurface, to: NetworkSurface): NetworkDecision {
  const forbidden = FORBIDDEN_NETWORK_PATHS.find((row) => row.from === from && row.to === to);
  if (forbidden) {
    return Object.freeze({ allowed: false, from, to, reason: `forbidden: ${forbidden.purpose}` });
  }
  const allowed = ALLOWED_NETWORK_PATHS.find((row) => row.from === from && row.to === to);
  if (allowed) {
    return Object.freeze({ allowed: true, from, to, reason: allowed.purpose });
  }
  return Object.freeze({ allowed: false, from, to, reason: `denied by default: ${from} → ${to}` });
}

export function authorizeNetworkPath(from: NetworkSurface, to: NetworkSurface): SecurityResult<NetworkDecision> {
  const decision = evaluateNetworkPath(from, to);
  if (!decision.allowed) {
    return securityErr('NETWORK_PATH_DENIED', decision.reason);
  }
  return securityOk(decision);
}
