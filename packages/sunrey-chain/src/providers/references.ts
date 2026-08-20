/**
 * Cross-domain references into canonical registries.
 *
 * Do not create a second provider registry for domains that already
 * have ProductionInfrastructureRegistry, OracleOnboardingRegistry,
 * RegulatedServiceProviderRegistry, or the security HSM/KMS port.
 *
 * Regulated-service and institutional-custody objects stay in their
 * owning packages. This catalog stores pointers, not copies.
 */

import { ProductionInfrastructureRegistry, type ProductionInfrastructureProvider } from '../infra/provider.ts';
import { OracleOnboardingRegistry, type OracleProviderOnboardingRecord } from '../oracle/production/index.ts';
import type { HsmKmsProvider } from '../../../security/src/hsm-kms.ts';
import type { CanonicalRegistryKind, CrossDomainProviderReference, ProviderDomain } from './types.ts';

export type CanonicalRegistryPointer = {
  readonly kind: CanonicalRegistryKind;
  readonly ownerPackage: string;
  readonly canonicalPath: string;
  readonly isCopy: false;
};

export const CANONICAL_REGISTRY_POINTERS: readonly CanonicalRegistryPointer[] = Object.freeze([
  {
    kind: 'PRODUCTION_INFRASTRUCTURE',
    ownerPackage: 'packages/sunrey-chain',
    canonicalPath: 'packages/sunrey-chain/src/infra/provider.ts',
    isCopy: false,
  },
  {
    kind: 'ORACLE_PROVIDER',
    ownerPackage: 'packages/sunrey-chain',
    canonicalPath: 'packages/sunrey-chain/src/oracle/production/onboarding.ts',
    isCopy: false,
  },
  {
    kind: 'REGULATED_SERVICE',
    ownerPackage: 'packages/kernel',
    canonicalPath: 'packages/kernel/src/regulated/index.ts',
    isCopy: false,
  },
  {
    kind: 'SECURITY_HSM',
    ownerPackage: 'packages/security',
    canonicalPath: 'packages/security/src/hsm-kms.ts',
    isCopy: false,
  },
]);

export type CanonicalProviderBinding = {
  readonly reference: CrossDomainProviderReference;
  readonly infrastructure?: ProductionInfrastructureProvider;
  readonly oracle?: OracleProviderOnboardingRecord;
  readonly hsm?: HsmKmsProvider;
};

export class ProviderAcceptanceCatalog {
  readonly infrastructure: ProductionInfrastructureRegistry;
  readonly oracles: OracleOnboardingRegistry;
  readonly #hsm = new Map<string, HsmKmsProvider>();
  readonly #bindings = new Map<string, CanonicalProviderBinding>();

  constructor(input?: {
    readonly infrastructure?: ProductionInfrastructureRegistry;
    readonly oracles?: OracleOnboardingRegistry;
  }) {
    this.infrastructure = input?.infrastructure ?? new ProductionInfrastructureRegistry();
    this.oracles = input?.oracles ?? new OracleOnboardingRegistry();
  }

  bindInfrastructure(domain: ProviderDomain, provider: ProductionInfrastructureProvider): CrossDomainProviderReference {
    const registered = this.infrastructure.register(provider);
    if (!registered.ok) {
      throw new TypeError(registered.error.message);
    }
    return this.#store({
      reference: Object.freeze({
        domain,
        providerId: provider.providerId,
        registry: 'PRODUCTION_INFRASTRUCTURE',
        canonicalRecordId: provider.providerId,
        isCopy: false,
      }),
      infrastructure: provider,
    });
  }

  bindOracle(record: OracleProviderOnboardingRecord): CrossDomainProviderReference {
    const put = this.oracles.put(record);
    if (!put.ok) {
      throw new TypeError(put.error.detail);
    }
    return this.#store({
      reference: Object.freeze({
        domain: 'ORACLE_DATA_SOURCE',
        providerId: record.providerId,
        registry: 'ORACLE_PROVIDER',
        canonicalRecordId: record.providerId,
        isCopy: false,
      }),
      oracle: record,
    });
  }

  bindExternalReference(reference: CrossDomainProviderReference): CrossDomainProviderReference {
    if (reference.isCopy) {
      throw new TypeError('provider acceptance stores cross-domain references, not copies');
    }
    return this.#store({ reference: Object.freeze({ ...reference, isCopy: false }) });
  }

  bindHsm(provider: HsmKmsProvider): CrossDomainProviderReference {
    this.#hsm.set(provider.providerId, provider);
    return this.#store({
      reference: Object.freeze({
        domain: 'HSM',
        providerId: provider.providerId,
        registry: 'SECURITY_HSM',
        canonicalRecordId: provider.providerId,
        isCopy: false,
      }),
      hsm: provider,
    });
  }

  get(providerId: string): CanonicalProviderBinding | undefined {
    return this.#bindings.get(providerId);
  }

  list(): readonly CrossDomainProviderReference[] {
    return Object.freeze([...this.#bindings.values()].map((row) => row.reference));
  }

  hsm(providerId: string): HsmKmsProvider | undefined {
    return this.#hsm.get(providerId);
  }

  pointerFor(kind: CanonicalRegistryKind): CanonicalRegistryPointer {
    const found = CANONICAL_REGISTRY_POINTERS.find((row) => row.kind === kind);
    if (!found) {
      throw new TypeError(`unknown registry kind ${kind}`);
    }
    return found;
  }

  registryKindFor(domain: ProviderDomain): CanonicalRegistryKind | null {
    if (domain === 'ORACLE_DATA_SOURCE') {
      return 'ORACLE_PROVIDER';
    }
    if (
      domain === 'IDENTITY_KYC' ||
      domain === 'SANCTIONS_PEP' ||
      domain === 'AML_TRANSACTION_MONITORING' ||
      domain === 'TRAVEL_RULE' ||
      domain === 'MARKET_SURVEILLANCE' ||
      domain === 'CASE_MANAGEMENT' ||
      domain === 'CUSTODY_PROVIDER' ||
      domain === 'BANKING_REFERENCE' ||
      domain === 'PAYMENT_RAIL' ||
      domain === 'FX_LIQUIDITY'
    ) {
      return 'REGULATED_SERVICE';
    }
    if (domain === 'HSM' || domain === 'KMS') {
      return 'SECURITY_HSM';
    }
    if (
      domain === 'CLOUD_INFRASTRUCTURE' ||
      domain === 'SECRET_MANAGER' ||
      domain === 'DATABASE' ||
      domain === 'OBJECT_STORAGE' ||
      domain === 'DNS' ||
      domain === 'CERTIFICATE_MANAGER'
    ) {
      return 'PRODUCTION_INFRASTRUCTURE';
    }
    return null;
  }

  #store(binding: CanonicalProviderBinding): CrossDomainProviderReference {
    this.#bindings.set(binding.reference.providerId, binding);
    return binding.reference;
  }
}
