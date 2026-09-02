/**
 * Application state for client cache, degradation, and reconnect handling.
 * Client cache may display state; backend remains authoritative.
 */

import type { BffPrincipal } from './ports.ts';
import type { FeatureCapabilityMap } from './ports.ts';
import type { SandboxModeMetadata } from './sandbox-mode.ts';

export const APPLICATION_CONNECTIVITY = ['ONLINE', 'DEGRADED', 'OFFLINE', 'CHAIN_SYNCING'] as const;
export type ApplicationConnectivity = (typeof APPLICATION_CONNECTIVITY)[number];

export const CACHE_POLICIES = ['NO_STORE', 'PRIVATE_SHORT_TTL', 'STALE_WHILE_REVALIDATE'] as const;
export type CachePolicyHint = (typeof CACHE_POLICIES)[number];

export type ApplicationStateResource = {
  readonly schema: 'sunrey.consumer.application-state.v1';
  readonly generatedAt: string;
  readonly connectivity: ApplicationConnectivity;
  readonly cachePolicy: CachePolicyHint;
  readonly authoritativeSource: 'BACKEND';
  readonly frontendMathAuthoritative: false;
  readonly staleAfterSeconds: number;
  readonly refreshRecommended: boolean;
  readonly degradedServices: readonly string[];
  readonly chainSyncing: boolean;
  readonly sandbox: SandboxModeMetadata;
  readonly capabilities: FeatureCapabilityMap;
};

export type ApplicationStateInput = {
  readonly now: () => string;
  readonly principal: BffPrincipal;
  readonly capabilities: FeatureCapabilityMap;
  readonly sandbox: SandboxModeMetadata;
  readonly providerDown?: Readonly<Record<string, boolean>>;
  readonly chainSyncing?: boolean;
};

export function buildApplicationState(input: ApplicationStateInput): ApplicationStateResource {
  const degraded: string[] = [];
  if (input.providerDown?.payments) degraded.push('payments');
  if (input.providerDown?.fx) degraded.push('fx');
  if (input.providerDown?.cards) degraded.push('cards');
  if (input.providerDown?.custody) degraded.push('wallets');
  const connectivity: ApplicationConnectivity =
    degraded.length > 0
      ? 'DEGRADED'
      : input.chainSyncing
        ? 'CHAIN_SYNCING'
        : 'ONLINE';
  return Object.freeze({
    schema: 'sunrey.consumer.application-state.v1',
    generatedAt: input.now(),
    connectivity,
    cachePolicy: 'NO_STORE',
    authoritativeSource: 'BACKEND',
    frontendMathAuthoritative: false,
    staleAfterSeconds: 0,
    refreshRecommended: degraded.length > 0 || input.chainSyncing === true,
    degradedServices: Object.freeze(degraded),
    chainSyncing: input.chainSyncing === true,
    sandbox: input.sandbox,
    capabilities: input.capabilities,
  });
}
