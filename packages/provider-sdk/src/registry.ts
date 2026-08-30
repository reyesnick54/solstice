/**
 * Canonical provider registry for external-data providers.
 */

import {
  buildCatalogIndex,
  catalogEntryToDescriptor,
  getCatalogEntry,
  loadCatalogFromYaml,
  type CatalogIndex,
} from './catalog/loader.ts';
import type { CatalogProviderEntry } from './catalog/types.ts';
import { ProviderActivationPolicy, descriptorAllowsRuntime, sanitizeDescriptorForExposure } from './activation-policy.ts';
import type { SunReyProvider } from './contract.ts';
import { providerSdkError, throwProviderSdk } from './errors.ts';
import type {
  ProviderActivationMode,
  ProviderCapability,
  ProviderCategory,
  ProviderConfiguration,
  ProviderDescriptor,
  ProviderHealthStatus,
  ProviderId,
  ProviderRegistration,
  ProviderRuntimeContext,
} from './types.ts';

export type ProviderRegistryOptions = {
  readonly catalogIndex?: CatalogIndex;
  readonly catalogPath?: string;
  readonly activationPolicy?: ProviderActivationPolicy;
  readonly nowUtc?: () => string;
};

type RegisteredProvider = {
  readonly registration: ProviderRegistration;
  readonly catalogEntry: CatalogProviderEntry;
  readonly configuration: ProviderConfiguration | null;
};

export class ProviderRegistry {
  readonly #catalog: CatalogIndex;
  readonly #activation: ProviderActivationPolicy;
  readonly #nowUtc: () => string;
  readonly #providers = new Map<ProviderId, RegisteredProvider>();

  constructor(options: ProviderRegistryOptions = {}) {
    this.#catalog = options.catalogIndex ?? loadCatalogFromYaml(options.catalogPath);
    this.#activation = options.activationPolicy ?? new ProviderActivationPolicy();
    this.#nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  register(
    provider: SunReyProvider,
    options: {
      readonly activationMode?: ProviderActivationMode;
      readonly configuration?: ProviderConfiguration | null;
      readonly credentialAvailable?: boolean;
      readonly featureFlagEnabled?: boolean;
    } = {},
  ): ProviderRegistration {
    const providerId = provider.id;
    if (this.#providers.has(providerId)) {
      throwProviderSdk(providerSdkError('PROVIDER_ALREADY_REGISTERED', `provider '${providerId}' is already registered`, providerId));
    }

    const catalogEntry = getCatalogEntry(this.#catalog, providerId);
    if (!catalogEntry) {
      throwProviderSdk(providerSdkError('PROVIDER_NOT_IN_CATALOG', `provider '${providerId}' is not in the free API catalog`, providerId));
    }

    if (provider.descriptor.id !== providerId) {
      throwProviderSdk(providerSdkError('PROVIDER_METADATA_INVALID', 'provider descriptor id mismatch', providerId));
    }

    const requestedMode = options.activationMode ?? 'preview_only';
    const evaluation = this.#activation.evaluate({
      catalogEntry,
      configuration: options.configuration ?? null,
      requestedMode,
      ...(options.credentialAvailable !== undefined
        ? { credentialAvailable: options.credentialAvailable }
        : {}),
      ...(options.featureFlagEnabled !== undefined
        ? { featureFlagEnabled: options.featureFlagEnabled }
        : {}),
    });

    if (evaluation.effectiveMode === 'blocked') {
      throwProviderSdk(providerSdkError('PROVIDER_BLOCKED', `provider '${providerId}' is blocked`, providerId));
    }

    if (!evaluation.allowed && requestedMode !== 'disabled') {
      throwProviderSdk(
        providerSdkError(
          'PROVIDER_ACTIVATION_DENIED',
          `provider '${providerId}' cannot activate as ${requestedMode}: ${evaluation.reasons.join(', ')}`,
          providerId,
        ),
      );
    }

    const descriptor = sanitizeDescriptorForExposure(
      catalogEntryToDescriptor(catalogEntry, evaluation.effectiveMode),
    );

    const registration = Object.freeze({
      provider,
      descriptor,
      registeredAt: this.#nowUtc(),
      activationMode: evaluation.effectiveMode,
    } satisfies ProviderRegistration);

    this.#providers.set(providerId, Object.freeze({
      registration,
      catalogEntry,
      configuration: options.configuration ?? null,
    }));

    return registration;
  }

  unregister(providerId: ProviderId): boolean {
    return this.#providers.delete(providerId);
  }

  get(providerId: ProviderId): ProviderRegistration | undefined {
    return this.#providers.get(providerId)?.registration;
  }

  has(providerId: ProviderId): boolean {
    return this.#providers.has(providerId);
  }

  list(): readonly ProviderRegistration[] {
    return Object.freeze([...this.#providers.values()].map((entry) => entry.registration));
  }

  listByCategory(category: ProviderCategory): readonly ProviderRegistration[] {
    return Object.freeze(
      [...this.#providers.values()]
        .filter(
          (entry) =>
            entry.catalogEntry.primary_category === category ||
            (entry.catalogEntry.secondary_categories ?? []).includes(category),
        )
        .map((entry) => entry.registration),
    );
  }

  listByCapability(capability: ProviderCapability): readonly ProviderRegistration[] {
    return Object.freeze(
      [...this.#providers.values()]
        .filter((entry) => entry.catalogEntry.capabilities.includes(capability))
        .map((entry) => entry.registration),
    );
  }

  listEnabled(): readonly ProviderRegistration[] {
    return Object.freeze(
      this.list().filter((registration) => descriptorAllowsRuntime(registration.descriptor)),
    );
  }

  listProductionCandidates(): readonly ProviderRegistration[] {
    return Object.freeze(
      this.list().filter((registration) => registration.descriptor.launchTier === 'production_candidate'),
    );
  }

  getDescriptor(providerId: ProviderId): ProviderDescriptor | undefined {
    const registration = this.get(providerId);
    return registration ? sanitizeDescriptorForExposure(registration.descriptor) : undefined;
  }

  async getHealth(providerId: ProviderId): Promise<ProviderHealthStatus | undefined> {
    const entry = this.#providers.get(providerId);
    if (!entry) {
      return undefined;
    }
    return entry.registration.provider.healthCheck();
  }

  async initialize(providerId: ProviderId, context: ProviderRuntimeContext): Promise<void> {
    const entry = this.requireRegistered(providerId);
    if (!descriptorAllowsRuntime(entry.registration.descriptor)) {
      throwProviderSdk(providerSdkError('PROVIDER_ACTIVATION_DENIED', `provider '${providerId}' is not enabled`, providerId));
    }
    await entry.registration.provider.initialize(context);
  }

  async shutdown(providerId: ProviderId): Promise<void> {
    const entry = this.#providers.get(providerId);
    if (!entry) {
      throwProviderSdk(providerSdkError('PROVIDER_NOT_FOUND', `provider '${providerId}' is not registered`, providerId));
    }
    await entry.registration.provider.shutdown();
    this.unregister(providerId);
  }

  async shutdownAll(): Promise<void> {
    for (const providerId of [...this.#providers.keys()]) {
      await this.shutdown(providerId);
    }
  }

  catalogHas(providerId: ProviderId): boolean {
    return getCatalogEntry(this.#catalog, providerId) !== undefined;
  }

  getCatalogEntry(providerId: ProviderId): CatalogProviderEntry | undefined {
    return getCatalogEntry(this.#catalog, providerId);
  }

  private requireRegistered(providerId: ProviderId): RegisteredProvider {
    const entry = this.#providers.get(providerId);
    if (!entry) {
      throwProviderSdk(providerSdkError('PROVIDER_NOT_FOUND', `provider '${providerId}' is not registered`, providerId));
    }
    return entry;
  }
}

export function createProviderRegistry(options: ProviderRegistryOptions = {}): ProviderRegistry {
  return new ProviderRegistry(options);
}
