import type { ProviderCategory } from '../../../provider-sdk/src/types.ts';

export type FabricProviderTrustTier = 'untrusted' | 'catalog_registered' | 'certified' | 'trusted';

export type FabricProviderRegistration = {
  readonly providerId: string;
  readonly displayName: string;
  readonly category: ProviderCategory;
  readonly economicDomain: string;
  readonly sourceClass: string;
  readonly trustTier: FabricProviderTrustTier;
  readonly connectorId: string;
  readonly normalizationSchema: string;
  readonly licensingRequired: boolean;
  readonly active: boolean;
  readonly simulationOnly: true;
};

export type FabricProviderRegistry = {
  register(provider: FabricProviderRegistration): void;
  get(providerId: string): FabricProviderRegistration | undefined;
  list(): readonly FabricProviderRegistration[];
  listByDomain(domain: string): readonly FabricProviderRegistration[];
  isActive(providerId: string): boolean;
};

export class InMemoryFabricProviderRegistry implements FabricProviderRegistry {
  private readonly providers = new Map<string, FabricProviderRegistration>();

  register(provider: FabricProviderRegistration): void {
    if (this.providers.has(provider.providerId)) {
      throw new Error(`provider already registered: ${provider.providerId}`);
    }
    this.providers.set(provider.providerId, Object.freeze({ ...provider }));
  }

  get(providerId: string): FabricProviderRegistration | undefined {
    return this.providers.get(providerId);
  }

  list(): readonly FabricProviderRegistration[] {
    return Object.freeze([...this.providers.values()]);
  }

  listByDomain(domain: string): readonly FabricProviderRegistration[] {
    return Object.freeze(this.list().filter((p) => p.economicDomain === domain));
  }

  isActive(providerId: string): boolean {
    const p = this.providers.get(providerId);
    return p?.active === true;
  }
}
