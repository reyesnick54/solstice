/**
 * ACCESS Wave 2 — AccessProviderRegistry.
 *
 * Extends the ACCESS-14 capability registry with dynamic registration,
 * category/capability/geography indexes, and health snapshots.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderId, ProviderCapabilityId } from '../types.ts';
import type { AccessProvider } from './contract.ts';
import type { AccessProviderDescriptor } from './descriptor.ts';
import { ACCESS_PROVIDER_DESCRIPTORS } from './descriptors.ts';
import { createHealthSnapshot, type AccessProviderHealthSnapshot } from './health.ts';
import type { AccessProviderRiskMonitor } from './risk.ts';
import {
  isCapacityContributor,
  isFulfillmentProvider,
  isInventoryProvider,
  isQuoteProvider,
  isRefundProvider,
} from './interfaces.ts';

export type RegisteredAccessProvider = {
  readonly provider: AccessProvider;
  readonly descriptor: AccessProviderDescriptor;
  readonly registeredAt: string;
  readonly commercialPriority: number;
  readonly trustScore: number;
};

export type FindProvidersQuery = {
  readonly category: AccessCapacityCategory;
  readonly capability: ProviderCapabilityId;
  readonly geography?: string | null;
};

export class AccessProviderRegistry {
  private readonly providers = new Map<AccessProviderId, RegisteredAccessProvider>();
  private readonly risk: AccessProviderRiskMonitor | null;
  private readonly healthCache = new Map<AccessProviderId, AccessProviderHealthSnapshot>();
  private readonly nowUtc: () => string;

  constructor(options: { readonly risk?: AccessProviderRiskMonitor; readonly nowUtc?: () => string } = {}) {
    this.risk = options.risk ?? null;
    this.nowUtc = options.nowUtc ?? (() => new Date().toISOString());
  }

  register(
    provider: AccessProvider,
    options: { readonly commercialPriority?: number; readonly trustScore?: number } = {},
  ): RegisteredAccessProvider {
    const providerId = provider.id;
    if (this.providers.has(providerId)) {
      throw new Error(`provider '${providerId}' is already registered`);
    }
    const descriptor = provider.descriptor;
    if (descriptor.providerId !== providerId) {
      throw new Error(`provider descriptor id mismatch for '${providerId}'`);
    }
    const registration: RegisteredAccessProvider = Object.freeze({
      provider,
      descriptor,
      registeredAt: this.nowUtc(),
      commercialPriority: options.commercialPriority ?? 50,
      trustScore: options.trustScore ?? 50,
    });
    this.providers.set(providerId, registration);
    return registration;
  }

  unregister(providerId: AccessProviderId): boolean {
    this.healthCache.delete(providerId);
    return this.providers.delete(providerId);
  }

  get(providerId: AccessProviderId): RegisteredAccessProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  getDescriptor(providerId: AccessProviderId): AccessProviderDescriptor | null {
    return this.providers.get(providerId)?.descriptor ?? ACCESS_PROVIDER_DESCRIPTORS[providerId] ?? null;
  }

  list(): readonly RegisteredAccessProvider[] {
    return Object.freeze([...this.providers.values()]);
  }

  listByCategory(category: AccessCapacityCategory): readonly RegisteredAccessProvider[] {
    return Object.freeze(this.list().filter((row) => row.descriptor.categories.includes(category)));
  }

  listByCapability(capability: ProviderCapabilityId): readonly RegisteredAccessProvider[] {
    return Object.freeze(this.list().filter((row) => row.descriptor.capabilities.includes(capability)));
  }

  listByGeography(geography: string): readonly RegisteredAccessProvider[] {
    return Object.freeze(
      this.list().filter(
        (row) => row.descriptor.geographies.includes(geography) || row.descriptor.geographies.includes('GLOBAL'),
      ),
    );
  }

  listProductionEnabled(): readonly RegisteredAccessProvider[] {
    return Object.freeze(this.list().filter((row) => row.descriptor.activationState === 'PRODUCTION_ENABLED'));
  }

  listFulfillmentProviders(): readonly RegisteredAccessProvider[] {
    return Object.freeze(this.list().filter((row) => isFulfillmentProvider(row.provider)));
  }

  listDiscoveryProviders(): readonly RegisteredAccessProvider[] {
    return Object.freeze(
      this.list().filter((row) => row.descriptor.providerTypes.includes('DISCOVERY')),
    );
  }

  listCapacityContributors(): readonly RegisteredAccessProvider[] {
    return Object.freeze(this.list().filter((row) => isCapacityContributor(row.provider)));
  }

  findProviders(query: FindProvidersQuery): readonly RegisteredAccessProvider[] {
    return Object.freeze(
      this.list().filter((row) => {
        if (!row.descriptor.capabilities.includes(query.capability)) {
          return false;
        }
        if (!row.descriptor.categories.includes(query.category)) {
          return false;
        }
        if (query.geography) {
          const geos = row.descriptor.geographies;
          if (!geos.includes(query.geography) && !geos.includes('GLOBAL')) {
            return false;
          }
        }
        if (this.risk?.isQuarantined(row.descriptor.providerId)) {
          return false;
        }
        return row.descriptor.activationState !== 'DISABLED';
      }),
    );
  }

  canPerform(providerId: AccessProviderId, capability: ProviderCapabilityId): boolean {
    const registration = this.get(providerId);
    if (!registration) {
      return false;
    }
    if (!registration.descriptor.capabilities.includes(capability)) {
      return false;
    }
    if (this.risk?.isQuarantined(providerId)) {
      return false;
    }
    const provider = registration.provider;
    switch (capability) {
      case 'CATALOG_SEARCH':
      case 'AVAILABILITY':
        return isInventoryProvider(provider);
      case 'QUOTE':
      case 'REALTIME_PRICING':
        return isQuoteProvider(provider);
      case 'RESERVE':
      case 'BOOK':
      case 'CANCEL':
      case 'FULFILLMENT_STATUS':
        return isFulfillmentProvider(provider);
      case 'REFUND':
        return isRefundProvider(provider);
      default:
        return registration.descriptor.capabilities.includes(capability);
    }
  }

  async getHealth(providerId: AccessProviderId): Promise<AccessProviderHealthSnapshot | null> {
    const registration = this.get(providerId);
    if (!registration) {
      return null;
    }
    const snapshot = await registration.provider.healthCheck();
    this.healthCache.set(providerId, snapshot);
    return snapshot;
  }

  getCachedHealth(providerId: AccessProviderId): AccessProviderHealthSnapshot | null {
    return this.healthCache.get(providerId) ?? null;
  }

  listDescriptorCatalog(): readonly AccessProviderDescriptor[] {
    return Object.freeze(Object.values(ACCESS_PROVIDER_DESCRIPTORS));
  }
}

export function createDefaultHealthFromDescriptor(descriptor: AccessProviderDescriptor): AccessProviderHealthSnapshot {
  const healthy = descriptor.activationState !== 'DISABLED' && descriptor.credentialStatus !== 'INVALID';
  return createHealthSnapshot({
    providerId: descriptor.providerId,
    capabilities: descriptor.capabilities,
    health: healthy ? 'HEALTHY' : 'UNHEALTHY',
    activationState: descriptor.activationState,
    credentialStatus: descriptor.credentialStatus,
    contractStatus: descriptor.commercialStatus,
    message: `${descriptor.name} health snapshot`,
    checkedAt: new Date().toISOString(),
  });
}

export function createAccessProviderRegistry(
  options: { readonly risk?: AccessProviderRiskMonitor; readonly nowUtc?: () => string } = {},
): AccessProviderRegistry {
  return new AccessProviderRegistry(options);
}
