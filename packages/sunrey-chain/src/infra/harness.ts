/**
 * Local production-candidate harness. Fully executable in CI with
 * test-only credentials. Emulates secret manager, KMS, HSM, object
 * storage, service identity, and network policies.
 */

import { PRODUCTION_CANDIDATE_CHAIN_ID, PRODUCTION_CANDIDATE_NETWORK_ID } from '../mainnet/identity.ts';
import { InfrastructureAccessPolicy } from './access.ts';
import { hashConfigurationBundle, validateProductionCandidateConfig } from './config.ts';
import { refuseInferredPqc } from './crypto.ts';
import { defaultWorkloadIdentities } from './identity.ts';
import { authorizeNetworkPath } from './network.ts';
import { InfraAuditLog, rotateServiceCredential } from './operations.ts';
import { LocalInfrastructureProvider, ProductionInfrastructureRegistry, awsAdapter, azureAdapter, gcpAdapter, kubernetesAdapter, vaultAdapter } from './provider.ts';
import { buildInfrastructureReadinessReport, type InfrastructureReadinessReport } from './readiness.ts';
import { parseContainerReference } from './services.ts';
import type { InfraEnvironment, SecretClass, WorkloadService } from './types.ts';

export type LocalHarness = {
  readonly environment: InfraEnvironment;
  readonly provider: LocalInfrastructureProvider;
  readonly registry: ProductionInfrastructureRegistry;
  readonly identities: ReturnType<typeof defaultWorkloadIdentities>;
  readonly access: InfrastructureAccessPolicy;
  readonly audit: InfraAuditLog;
  readonly report: InfrastructureReadinessReport;
};

const HARNESS_SECRETS: readonly {
  readonly secretId: string;
  readonly secretClass: SecretClass;
  readonly path: string;
  readonly value: string;
  readonly allowedIdentities: readonly WorkloadService[];
  readonly fixture: boolean;
}[] = Object.freeze([
  {
    secretId: 'rpc-service',
    secretClass: 'RPC_SERVICE_CREDENTIAL',
    path: 'service/rpc',
    value: 'test-only-rpc-credential',
    allowedIdentities: ['rpc'],
    fixture: true,
  },
  {
    secretId: 'validator-signer',
    secretClass: 'HSM_AUTH_REFERENCE',
    path: 'service/validator-hsm-auth',
    value: 'test-only-validator-hsm-auth',
    allowedIdentities: ['validator'],
    fixture: true,
  },
  {
    secretId: 'custody-signing',
    secretClass: 'HSM_AUTH_REFERENCE',
    path: 'service/custody-hsm-auth',
    value: 'test-only-custody-signing',
    allowedIdentities: ['custody'],
    fixture: true,
  },
  {
    secretId: 'oracle-source',
    secretClass: 'ORACLE_PROVIDER_CREDENTIAL',
    path: 'service/oracle',
    value: 'test-only-oracle-source',
    allowedIdentities: ['oracle_collector'],
    fixture: true,
  },
  {
    secretId: 'governance-key-auth',
    secretClass: 'RELEASE_SERVICE_CREDENTIAL',
    path: 'service/governance-auth',
    value: 'test-only-governance-auth',
    allowedIdentities: ['release_service'],
    fixture: true,
  },
  {
    secretId: 'database',
    secretClass: 'DATABASE_CREDENTIAL',
    path: 'service/database',
    value: 'test-only-database',
    allowedIdentities: ['backup', 'release_service'],
    fixture: true,
  },
  {
    secretId: 'tls-key',
    secretClass: 'TLS_PRIVATE_KEY',
    path: 'tls/rpc',
    value: 'test-only-tls-key',
    allowedIdentities: ['rpc', 'explorer'],
    fixture: true,
  },
  {
    secretId: 'registry',
    secretClass: 'CONTAINER_REGISTRY_CREDENTIAL',
    path: 'service/registry',
    value: 'test-only-registry',
    allowedIdentities: ['release_service'],
    fixture: true,
  },
]);

export function createLocalHarness(environment: InfraEnvironment = 'LOCAL'): LocalHarness {
  const provider = new LocalInfrastructureProvider(environment);
  const registry = new ProductionInfrastructureRegistry();
  registry.register(provider);
  registry.register(
    awsAdapter({
      providerId: 'aws-candidate',
      environment: 'PRODUCTION_CANDIDATE',
      region: 'us-east-1',
      zone: 'use1-az1',
      credentialHref: 'secret://local-infra/cloud/aws',
      supportedCapabilities: ['COMPUTE', 'KMS', 'OBJECT_STORAGE', 'SECRET_MANAGER'],
      configurationVersion: 'aws-adapter-v1',
    }),
  );
  registry.register(
    azureAdapter({
      providerId: 'azure-candidate',
      environment: 'PRODUCTION_CANDIDATE',
      region: 'eastus',
      zone: 'eastus-1',
      supportedCapabilities: ['COMPUTE', 'KMS', 'OBJECT_STORAGE'],
      configurationVersion: 'azure-adapter-v1',
    }),
  );
  registry.register(
    gcpAdapter({
      providerId: 'gcp-candidate',
      environment: 'PRODUCTION_CANDIDATE',
      region: 'us-central1',
      zone: 'us-central1-a',
      supportedCapabilities: ['COMPUTE', 'KMS', 'OBJECT_STORAGE'],
      configurationVersion: 'gcp-adapter-v1',
    }),
  );
  registry.register(
    kubernetesAdapter({
      providerId: 'k8s-candidate',
      environment: 'PRODUCTION_CANDIDATE',
      region: 'any',
      zone: 'cluster-1',
      supportedCapabilities: ['KUBERNETES', 'PRIVATE_NETWORK'],
      configurationVersion: 'k8s-adapter-v1',
    }),
  );
  registry.register(
    vaultAdapter({
      providerId: 'vault-candidate',
      environment: 'PRODUCTION_CANDIDATE',
      region: 'any',
      zone: 'vault-1',
      credentialHref: 'secret://local-infra/cloud/vault',
      supportedCapabilities: ['SECRET_MANAGER', 'KMS'],
      configurationVersion: 'vault-adapter-v1',
    }),
  );

  const identities = defaultWorkloadIdentities(environment);
  const access = new InfrastructureAccessPolicy(environment);
  const audit = new InfraAuditLog();
  const secrets = provider.secrets();
  for (const row of HARNESS_SECRETS) {
    secrets.put({
      ...row,
      environment,
      rotationGeneration: 1,
    });
  }
  provider.certificates().issue({
    certificateId: 'rpc-tls',
    secretHref: 'secret://local-infra/tls/rpc',
    mode: 'SERVICE_TLS',
    notAfterUtc: '2027-01-01T00:00:00.000Z',
    chainFingerprint: 'aa'.repeat(32),
  });
  provider.dns().upsert({
    hostname: 'rpc.local.sunrey.test',
    role: 'RPC',
    environment,
    target: '127.0.0.1',
    productionDomainRequired: false,
  });
  provider.storage().put({
    objectId: 'backup-1',
    objectClass: 'BACKUP',
    environment,
    payload: Buffer.from('test-only-backup'),
    encryptionPolicy: 'BACKUP_ENCRYPTION_KEY',
    retentionUntilUtc: '2027-01-01T00:00:00.000Z',
  });
  provider.storage().put({
    objectId: 'audit-1',
    objectClass: 'AUDIT_BUNDLE',
    environment,
    payload: Buffer.from('test-only-audit-bundle'),
    encryptionPolicy: 'PROVIDER_MANAGED',
    retentionUntilUtc: null,
  });
  const image = parseContainerReference({
    name: 'sunrey-node',
    digest: `sha256:${'ab'.repeat(32)}`,
    tag: 'ignored',
  });
  const report = buildInfrastructureReadinessReport({
    environment,
    identities,
    secrets,
    registry,
    kms: provider.kms(),
    hsm: provider.hsm(),
    certificates: provider.certificates(),
    storage: provider.storage(),
    containerDigestsOk: image.ok,
  });
  return Object.freeze({
    environment,
    provider,
    registry,
    identities,
    access,
    audit,
    report,
  });
}

export function runLocalProductionCandidateHarness(): LocalHarness {
  const harness = createLocalHarness('LOCAL');
  const rpc = harness.identities.byService('rpc', 'LOCAL')!;
  harness.access.authorize({ identity: rpc, resource: 'PUBLIC_NODE_STATE', operation: 'READ' });
  authorizeNetworkPath('PUBLIC_EDGE', 'PUBLIC_RPC');
  rotateServiceCredential(harness.provider.secrets(), 'rpc-service', 'LOCAL', 'test-only-rpc-rotated', harness.audit);
  harness.audit.record({
    eventType: 'SECRET_RETRIEVAL',
    environment: 'LOCAL',
    actor: 'rpc',
    resource: 'rpc-service',
    outcome: 'OK',
    detail: 'reference only',
  });
  const kms = harness.provider.kms();
  refuseInferredPqc(kms.capabilities, 'CLASSICAL_SUPPORTED');
  hashConfigurationBundle({
    bundleId: 'cfg_local_harness',
    environment: 'LOCAL',
    protocolVersion: '1',
    networkId: PRODUCTION_CANDIDATE_NETWORK_ID,
    chainId: PRODUCTION_CANDIDATE_CHAIN_ID,
    releaseArtifactDigest: 'aa'.repeat(32),
    providerConfigurationHash: harness.registry.configurationDigest(),
  });
  validateProductionCandidateConfig({
    environment: 'PRODUCTION_CANDIDATE',
    networkId: PRODUCTION_CANDIDATE_NETWORK_ID,
    chainId: PRODUCTION_CANDIDATE_CHAIN_ID,
    releaseArtifactDigest: 'aa'.repeat(32),
    floatingRelease: false,
    secretEnvironment: 'PRODUCTION_CANDIDATE',
    fixtureSecret: false,
    publicSignerExposure: false,
    publicValidatorAdminExposure: false,
    hsmReadiness: 'SOFTWARE_SECURE_PROVIDER',
    hsmMarkedVerified: false,
    container: {
      name: 'sunrey-node',
      digest: `sha256:${'ab'.repeat(32)}`,
      tag: null,
      immutable: true,
    },
  });
  return harness;
}
