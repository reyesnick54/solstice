import type { RegulatedServiceMode } from './modes.ts';
import {
  providerMayActivateLive,
  type ActivationEligibility,
  type ProviderHealthState,
  type RegulatedProviderServiceClass,
  type RegulatedServiceProvider,
} from './providers.ts';

export class RegulatedServiceProviderRegistry {
  readonly #providers = new Map<string, RegulatedServiceProvider>();

  register(provider: RegulatedServiceProvider): RegulatedServiceProvider {
    if (providerMayActivateLive(provider)) {
      throw new TypeError(`provider ${provider.providerId} cannot activate live financial execution`);
    }
    if (provider.qualifiedOrApprovedClaim) {
      throw new TypeError(`provider ${provider.providerId} must not claim qualification without evidence`);
    }
    const frozen = Object.freeze({ ...provider });
    this.#providers.set(provider.providerId, frozen);
    return frozen;
  }

  get(providerId: string): RegulatedServiceProvider | undefined {
    return this.#providers.get(providerId);
  }

  list(filter?: {
    readonly serviceClass?: RegulatedProviderServiceClass;
    readonly environment?: RegulatedServiceMode;
  }): readonly RegulatedServiceProvider[] {
    return Object.freeze(
      [...this.#providers.values()].filter((provider) => {
        if (filter?.serviceClass && provider.serviceClass !== filter.serviceClass) {
          return false;
        }
        if (filter?.environment && provider.environment !== filter.environment) {
          return false;
        }
        return true;
      }),
    );
  }

  requiredFor(serviceClass: RegulatedProviderServiceClass): readonly RegulatedServiceProvider[] {
    return this.list({ serviceClass });
  }

  updateHealth(providerId: string, health: ProviderHealthState): RegulatedServiceProvider {
    const current = this.require(providerId);
    const next = Object.freeze({ ...current, health });
    this.#providers.set(providerId, next);
    return next;
  }

  eligibility(providerId: string): ActivationEligibility {
    return this.require(providerId).activationEligibility;
  }

  private require(providerId: string): RegulatedServiceProvider {
    const provider = this.#providers.get(providerId);
    if (!provider) {
      throw new TypeError(`unknown regulated provider '${providerId}'`);
    }
    return provider;
  }
}
