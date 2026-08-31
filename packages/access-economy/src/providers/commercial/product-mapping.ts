/**
 * Commercial Access provider product mapping registry.
 *
 * Maps external commercial inventory to canonical Access products.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderProductMapping, CommercialProviderId } from './types.ts';

export class AccessProviderProductMappingRegistry {
  private readonly mappings = new Map<string, AccessProviderProductMapping>();

  register(mapping: AccessProviderProductMapping): void {
    this.mappings.set(mapping.mappingId, Object.freeze({ ...mapping }));
  }

  get(mappingId: string): AccessProviderProductMapping | null {
    return this.mappings.get(mappingId) ?? null;
  }

  findByProviderProduct(
    providerId: CommercialProviderId,
    providerProductId: string,
  ): AccessProviderProductMapping | null {
    for (const mapping of this.mappings.values()) {
      if (mapping.providerId === providerId && mapping.providerProductId === providerProductId) {
        return mapping;
      }
    }
    return null;
  }

  listByProvider(providerId: CommercialProviderId): readonly AccessProviderProductMapping[] {
    return Object.freeze(
      [...this.mappings.values()].filter((mapping) => mapping.providerId === providerId),
    );
  }

  listByCategory(category: AccessCapacityCategory): readonly AccessProviderProductMapping[] {
    return Object.freeze(
      [...this.mappings.values()].filter((mapping) => mapping.category === category),
    );
  }

  listActive(asOf: string): readonly AccessProviderProductMapping[] {
    return Object.freeze(
      [...this.mappings.values()].filter((mapping) => {
        if (mapping.status !== 'ACTIVE') {
          return false;
        }
        if (mapping.effectiveFrom > asOf) {
          return false;
        }
        if (mapping.effectiveTo !== null && mapping.effectiveTo < asOf) {
          return false;
        }
        return true;
      }),
    );
  }
}

export function createAccessProviderProductMappingRegistry(
  seed?: readonly AccessProviderProductMapping[],
): AccessProviderProductMappingRegistry {
  const registry = new AccessProviderProductMappingRegistry();
  for (const mapping of seed ?? []) {
    registry.register(mapping);
  }
  return registry;
}
