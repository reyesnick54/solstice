/**
 * Default simulation providers for sandbox BFF/capabilities.
 * These are SIMULATED registrations. They cannot activate production.
 */

import { createCredentialRef } from './store.ts';
import type { UniversalProviderRuntime } from './runtime.ts';
import type { ProviderCapabilityId, ProviderCategory, ProviderEnvironment } from './types.ts';

const NOW = '2026-08-21T00:00:00.000Z';

type SandboxSeed = {
  readonly providerId: string;
  readonly providerType: ProviderCategory;
  readonly displayName: string;
  readonly capabilities: readonly ProviderCapabilityId[];
  readonly environment: ProviderEnvironment;
  readonly currencies: readonly string[];
  readonly products: readonly string[];
};

const SEEDS: readonly SandboxSeed[] = Object.freeze([
  {
    providerId: 'sim-payments',
    providerType: 'PAYMENTS',
    displayName: 'SunRey simulated payments',
    capabilities: Object.freeze(['PAYMENT.ACH', 'PAYMENT.WIRE', 'PAYMENT.RTP'] as const),
    environment: 'LOCAL',
    currencies: Object.freeze(['USD', 'SAR']),
    products: Object.freeze(['send']),
  },
  {
    providerId: 'sim-fx',
    providerType: 'FX',
    displayName: 'SunRey simulated FX',
    capabilities: Object.freeze(['FX.QUOTE', 'FX.EXECUTE', 'FX.CANCEL', 'FX.STATUS'] as const),
    environment: 'LOCAL',
    currencies: Object.freeze(['USD', 'SAR']),
    products: Object.freeze(['fx']),
  },
  {
    providerId: 'sim-cards',
    providerType: 'CARDS',
    displayName: 'SunRey simulated cards',
    capabilities: Object.freeze(['CARD.VIRTUAL_ISSUING', 'CARD.AUTHORIZATION'] as const),
    environment: 'LOCAL',
    currencies: Object.freeze(['USD']),
    products: Object.freeze(['cards']),
  },
]);

export function seedSimulationProviders(runtime: UniversalProviderRuntime, nowUtc = NOW): void {
  for (const seed of SEEDS) {
    if (runtime.get(seed.providerId)) {
      continue;
    }
    const credential = createCredentialRef({
      providerId: seed.providerId,
      secretHref: `secret://simulation/${seed.providerId}/webhook`,
      keyVersion: '1',
      environment: seed.environment,
    });
    const registered = runtime.register({
      providerId: seed.providerId,
      providerType: seed.providerType,
      displayName: seed.displayName,
      adapterId: `${seed.providerId}-adapter`,
      capabilities: seed.capabilities,
      environment: seed.environment,
      lifecycleState: 'DISABLED',
      enabledJurisdictions: Object.freeze(['US', 'SA']),
      supportedCurrencies: seed.currencies,
      supportedProducts: seed.products,
      credentialReference: credential.ok ? credential.value : null,
      webhookConfiguration: Object.freeze({
        verificationAdapterId: `${seed.providerId}-webhook`,
        replayWindowMs: 300_000,
        environment: seed.environment,
        persistRawEvidence: true,
      }),
      routingPriority: 10,
      nowUtc,
    });
    if (!registered.ok) {
      continue;
    }
    runtime.transitionLifecycle({
      providerId: seed.providerId,
      to: 'SIMULATED',
      actorKind: 'SYSTEM',
      actorId: 'sandbox-seed',
      nowUtc,
    });
    runtime.observeHealth({
      providerId: seed.providerId,
      success: true,
      latencyMs: 1,
      nowUtc,
    });
  }
}
