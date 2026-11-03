/**
 * AAF08 provider registry — composes wave2 catalog + AAF07 certification overlay.
 */

import { FINNHUB_PROVIDER_ID } from '../aaf07/profiles.ts';
import { requireAaf07Certification } from '../aaf07/certification.ts';

export const AAF08_REGISTERED_PROVIDER_IDS = Object.freeze([FINNHUB_PROVIDER_ID, 'fixture_aaf08'] as const);

export type Aaf08ProviderRegistryEntry = {
  readonly providerId: string;
  readonly adapterBinding: 'finnhub_capital_market' | 'contract_fixture';
  readonly credentialEnvVar: string | null;
  readonly aaf07Certified: boolean;
  readonly grantsExecutionAuthority: false;
};

const REGISTRY: Readonly<Record<string, Aaf08ProviderRegistryEntry>> = Object.freeze({
  [FINNHUB_PROVIDER_ID]: Object.freeze({
    providerId: FINNHUB_PROVIDER_ID,
    adapterBinding: 'finnhub_capital_market',
    credentialEnvVar: 'FINNHUB_API_KEY',
    aaf07Certified: requireAaf07Certification(FINNHUB_PROVIDER_ID).ok,
    grantsExecutionAuthority: false,
  }),
  fixture_aaf08: Object.freeze({
    providerId: 'fixture_aaf08',
    adapterBinding: 'contract_fixture',
    credentialEnvVar: null,
    aaf07Certified: true,
    grantsExecutionAuthority: false,
  }),
});

export function resolveAaf08Provider(providerId: string): Aaf08ProviderRegistryEntry | undefined {
  return REGISTRY[providerId];
}

export function listAaf08Providers(): readonly Aaf08ProviderRegistryEntry[] {
  return Object.freeze(Object.values(REGISTRY));
}
