/**
 * Provider resolution for domain services.
 */

import type { ProviderCapability, ProviderCategory, SunReyConsumerDomain } from './types.ts';
import type { ProviderRegistry } from './registry.ts';
import type { ProviderRegistration } from './types.ts';

export type ProviderResolutionQuery = {
  readonly capability?: ProviderCapability;
  readonly category?: ProviderCategory;
  readonly domain?: SunReyConsumerDomain;
  readonly productionCandidatesOnly?: boolean;
  readonly enabledOnly?: boolean;
};

export class ProviderFactory {
  readonly #registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.#registry = registry;
  }

  resolve(query: ProviderResolutionQuery): readonly ProviderRegistration[] {
    let candidates = this.#registry.list();

    if (query.enabledOnly !== false) {
      candidates = this.#registry.listEnabled();
    }

    if (query.productionCandidatesOnly) {
      candidates = this.#registry.listProductionCandidates();
    }

    if (query.category) {
      candidates = candidates.filter((registration) => registration.descriptor.primaryCategory === query.category);
    }

    if (query.capability) {
      candidates = this.#registry.listByCapability(query.capability);
      if (query.enabledOnly !== false) {
        candidates = candidates.filter((registration) =>
          this.#registry.listEnabled().some((enabled) => enabled.descriptor.id === registration.descriptor.id),
        );
      }
    }

    if (query.domain) {
      candidates = candidates.filter((registration) => registration.descriptor.domains.includes(query.domain!));
    }

    return Object.freeze(this.sortByPriority(candidates));
  }

  resolveOne(query: ProviderResolutionQuery): ProviderRegistration | undefined {
    const [first] = this.resolve(query);
    return first;
  }

  listByCapability(capability: ProviderCapability): readonly ProviderRegistration[] {
    return this.resolve({ capability, enabledOnly: true });
  }

  private sortByPriority(registrations: readonly ProviderRegistration[]): ProviderRegistration[] {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...registrations].sort(
      (left, right) => order[left.descriptor.priority] - order[right.descriptor.priority],
    );
  }
}

export function createProviderFactory(registry: ProviderRegistry): ProviderFactory {
  return new ProviderFactory(registry);
}
