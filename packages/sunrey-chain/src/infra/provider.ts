/**
 * ProductionInfrastructureProvider and registry.
 * Cloud adapters compile and validate configuration without credentials.
 * The local adapter is fully executable in CI.
 */

import { parseSecretReference, type SecretReference } from '../../../security/src/secrets.ts';
import type { HsmKmsProvider } from '../../../security/src/hsm-kms.ts';
import { digestJson } from './hash.ts';
import {
  createSimulationHsm,
  createSoftwareKms,
  createSoftwareSecureProvider,
  reportHsm,
  reportKms,
  type InfraHsmReport,
  type InfraKmsReport,
} from './crypto.ts';
import { ClassifiedSecretStore } from './secrets.ts';
import { DnsConfiguration, LocalCertificateManager, ObjectStorageAdapter } from './services.ts';
import {
  INFRA_CAPABILITIES,
  infraErr,
  infraOk,
  type FailureDomain,
  type InfraCapability,
  type InfraEnvironment,
  type InfraEvidenceReference,
  type InfraResult,
  type ProviderHealthState,
  type ProviderType,
  type ProviderVerificationState,
} from './types.ts';

export type ProductionInfrastructureProvider = {
  readonly providerId: string;
  readonly providerType: ProviderType;
  readonly environment: InfraEnvironment;
  readonly supportedCapabilities: readonly InfraCapability[];
  readonly failureDomain: FailureDomain;
  readonly credentialRef: SecretReference | null;
  readonly configurationVersion: string;
  health(): ProviderHealthState;
  verificationStatus(): ProviderVerificationState;
  validateConfiguration(): InfraResult<true>;
  secrets(): ClassifiedSecretStore | null;
  kms(): InfraKmsReport | null;
  hsm(): InfraHsmReport | null;
  certificates(): LocalCertificateManager | null;
  dns(): DnsConfiguration | null;
  storage(): ObjectStorageAdapter | null;
};

export type ProviderRecord = {
  readonly providerId: string;
  readonly providerType: ProviderType;
  readonly environment: InfraEnvironment;
  readonly supportedCapabilities: readonly InfraCapability[];
  readonly failureDomain: FailureDomain;
  readonly credentialRef: string | null;
  readonly health: ProviderHealthState;
  readonly verificationStatus: ProviderVerificationState;
  readonly configurationVersion: string;
  readonly evidenceReferences: readonly InfraEvidenceReference[];
};

export type CloudProviderConfig = {
  readonly providerId: string;
  readonly providerType: Exclude<ProviderType, 'LOCAL_INTEGRATION'>;
  readonly environment: InfraEnvironment;
  readonly region: string;
  readonly zone: string;
  readonly credentialHref?: string;
  readonly endpoint?: string;
  readonly supportedCapabilities: readonly InfraCapability[];
  readonly configurationVersion: string;
};

function requireCapabilities(capabilities: readonly InfraCapability[]): InfraResult<true> {
  const unknown = capabilities.filter((row) => !(INFRA_CAPABILITIES as readonly string[]).includes(row));
  if (unknown.length > 0) {
    return infraErr('UNKNOWN_CAPABILITY', `unknown capabilities: ${unknown.join(',')}`);
  }
  return infraOk(true);
}

export class LocalInfrastructureProvider implements ProductionInfrastructureProvider {
  readonly providerId = 'local-integration';
  readonly providerType = 'LOCAL_INTEGRATION' as const;
  readonly environment: InfraEnvironment;
  readonly supportedCapabilities: readonly InfraCapability[] = Object.freeze([
    'COMPUTE',
    'OBJECT_STORAGE',
    'SECRET_MANAGER',
    'KMS',
    'HSM',
    'DNS',
    'CERTIFICATE_MANAGER',
    'CONTAINER_REGISTRY',
    'PRIVATE_NETWORK',
    'LOG_EXPORT',
    'METRICS_EXPORT',
  ]);
  readonly failureDomain: FailureDomain;
  readonly credentialRef: SecretReference | null = null;
  readonly configurationVersion = 'local-infra-v1';
  readonly #secrets: ClassifiedSecretStore;
  readonly #kms: HsmKmsProvider;
  readonly #hsm: HsmKmsProvider;
  readonly #certs = new LocalCertificateManager();
  readonly #dns = new DnsConfiguration();
  readonly #storage = new ObjectStorageAdapter();

  constructor(environment: InfraEnvironment = 'LOCAL') {
    this.environment = environment;
    this.failureDomain = Object.freeze({
      region: 'local',
      zone: 'ci-1',
      provider: 'LOCAL_INTEGRATION',
    });
    this.#secrets = new ClassifiedSecretStore('local-infra');
    this.#kms = createSoftwareKms();
    this.#hsm = environment === 'LOCAL' || environment === 'TESTNET' ? createSimulationHsm() : createSoftwareSecureProvider();
  }

  health(): ProviderHealthState {
    return 'HEALTHY';
  }

  verificationStatus(): ProviderVerificationState {
    return 'LOCAL_EXECUTABLE';
  }

  validateConfiguration(): InfraResult<true> {
    return requireCapabilities(this.supportedCapabilities);
  }

  secrets(): ClassifiedSecretStore {
    return this.#secrets;
  }

  kms(): InfraKmsReport {
    return reportKms(this.#kms);
  }

  hsm(): InfraHsmReport {
    return reportHsm(this.#hsm, this.environment === 'LOCAL' || this.environment === 'TESTNET' ? 'SIMULATION_HSM' : 'SOFTWARE_SECURE_PROVIDER');
  }

  certificates(): LocalCertificateManager {
    return this.#certs;
  }

  dns(): DnsConfiguration {
    return this.#dns;
  }

  storage(): ObjectStorageAdapter {
    return this.#storage;
  }

  kmsProvider(): HsmKmsProvider {
    return this.#kms;
  }

  hsmProvider(): HsmKmsProvider {
    return this.#hsm;
  }
}

export class CloudInfrastructureAdapter implements ProductionInfrastructureProvider {
  readonly providerId: string;
  readonly providerType: Exclude<ProviderType, 'LOCAL_INTEGRATION'>;
  readonly environment: InfraEnvironment;
  readonly supportedCapabilities: readonly InfraCapability[];
  readonly failureDomain: FailureDomain;
  readonly credentialRef: SecretReference | null;
  readonly configurationVersion: string;
  readonly endpoint: string | null;

  constructor(config: CloudProviderConfig) {
    this.providerId = config.providerId;
    this.providerType = config.providerType;
    this.environment = config.environment;
    this.supportedCapabilities = Object.freeze([...config.supportedCapabilities]);
    this.failureDomain = Object.freeze({
      region: config.region,
      zone: config.zone,
      provider: config.providerType,
    });
    this.configurationVersion = config.configurationVersion;
    this.endpoint = config.endpoint ?? null;
    if (config.credentialHref) {
      const parsed = parseSecretReference(config.credentialHref);
      this.credentialRef = parsed.ok ? parsed.value : null;
      this.#credentialParseError = parsed.ok ? null : parsed.error.message;
    } else {
      this.credentialRef = null;
      this.#credentialParseError = null;
    }
  }

  #credentialParseError: string | null;

  health(): ProviderHealthState {
    return this.credentialRef ? 'UNCONFIGURED' : 'UNCONFIGURED';
  }

  verificationStatus(): ProviderVerificationState {
    return this.credentialRef ? 'CREDENTIALS_REQUIRED' : 'CONFIG_VALIDATED';
  }

  validateConfiguration(): InfraResult<true> {
    if (!this.failureDomain.region) {
      return infraErr('PROVIDER_CONFIG', 'cloud provider region is required');
    }
    const caps = requireCapabilities(this.supportedCapabilities);
    if (!caps.ok) {
      return caps;
    }
    if (this.#credentialParseError) {
      return infraErr('INVALID_SECRET_REFERENCE', this.#credentialParseError);
    }
    return infraOk(true);
  }

  secrets(): null {
    return null;
  }

  kms(): null {
    return null;
  }

  hsm(): null {
    return null;
  }

  certificates(): null {
    return null;
  }

  dns(): null {
    return null;
  }

  storage(): null {
    return null;
  }
}

export function awsAdapter(config: Omit<CloudProviderConfig, 'providerType'>): CloudInfrastructureAdapter {
  return new CloudInfrastructureAdapter({ ...config, providerType: 'AWS' });
}

export function azureAdapter(config: Omit<CloudProviderConfig, 'providerType'>): CloudInfrastructureAdapter {
  return new CloudInfrastructureAdapter({ ...config, providerType: 'AZURE' });
}

export function gcpAdapter(config: Omit<CloudProviderConfig, 'providerType'>): CloudInfrastructureAdapter {
  return new CloudInfrastructureAdapter({ ...config, providerType: 'GOOGLE_CLOUD' });
}

export function kubernetesAdapter(config: Omit<CloudProviderConfig, 'providerType'>): CloudInfrastructureAdapter {
  return new CloudInfrastructureAdapter({ ...config, providerType: 'KUBERNETES' });
}

export function vaultAdapter(config: Omit<CloudProviderConfig, 'providerType'>): CloudInfrastructureAdapter {
  return new CloudInfrastructureAdapter({ ...config, providerType: 'VAULT_OPENBAO' });
}

export class ProductionInfrastructureRegistry {
  readonly #providers = new Map<string, ProductionInfrastructureProvider>();

  register(provider: ProductionInfrastructureProvider): InfraResult<ProviderRecord> {
    const valid = provider.validateConfiguration();
    if (!valid.ok) {
      return valid;
    }
    this.#providers.set(provider.providerId, provider);
    return infraOk(this.recordOf(provider));
  }

  get(providerId: string): ProductionInfrastructureProvider | undefined {
    return this.#providers.get(providerId);
  }

  list(): readonly ProviderRecord[] {
    return Object.freeze([...this.#providers.values()].map((provider) => this.recordOf(provider)));
  }

  recordOf(provider: ProductionInfrastructureProvider): ProviderRecord {
    return Object.freeze({
      providerId: provider.providerId,
      providerType: provider.providerType,
      environment: provider.environment,
      supportedCapabilities: provider.supportedCapabilities,
      failureDomain: provider.failureDomain,
      credentialRef: provider.credentialRef?.href ?? null,
      health: provider.health(),
      verificationStatus: provider.verificationStatus(),
      configurationVersion: provider.configurationVersion,
      evidenceReferences: Object.freeze([
        {
          kind: 'provider-configuration',
          digest: digestJson({
            providerId: provider.providerId,
            type: provider.providerType,
            version: provider.configurationVersion,
          }),
          reference: `provider:${provider.providerId}`,
        },
      ]),
    });
  }

  configurationDigest(): string {
    return digestJson(this.list());
  }
}
