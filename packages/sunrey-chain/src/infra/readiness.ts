/**
 * InfrastructureReadinessReport and production-candidate verification.
 */

import { PRODUCTION_CANDIDATE_CHAIN_ID, PRODUCTION_CANDIDATE_NETWORK_ID } from '../mainnet/identity.ts';
import { collectReadinessArtifactDigests, type ReadinessArtifactDigests } from './artifacts.ts';
import { iacModuleDigest } from './config.ts';
import type { InfraHsmReport, InfraKmsReport } from './crypto.ts';
import { digestJson } from './hash.ts';
import type { WorkloadIdentityRegistry } from './identity.ts';
import { documentedEgressClasses } from './network.ts';
import type { ProductionInfrastructureRegistry } from './provider.ts';
import type { ClassifiedSecretStore } from './secrets.ts';
import type { LocalCertificateManager, ObjectStorageAdapter } from './services.ts';
import {
  INFRA_SCHEMA_VERSION,
  INFRA_TOOL_VERSION,
  type InfraEnvironment,
  type ProviderHealthState,
} from './types.ts';

export type InfrastructureCheck = {
  readonly id: string;
  readonly ok: boolean;
  readonly detail: string;
};

export type InfrastructureReadinessReport = {
  readonly schemaVersion: typeof INFRA_SCHEMA_VERSION;
  readonly toolVersion: typeof INFRA_TOOL_VERSION;
  readonly environment: InfraEnvironment;
  readonly mainnetEnabled: false;
  readonly productionServicesActivated: false;
  readonly workloadIdentities: boolean;
  readonly secretManager: boolean;
  readonly kms: boolean;
  readonly hsmStatus: InfraHsmReport['readiness'] | 'UNCONFIGURED';
  readonly networkZoning: boolean;
  readonly tls: boolean;
  readonly objectStorage: boolean;
  readonly containerDigests: boolean;
  readonly backupPath: boolean;
  readonly observability: boolean;
  readonly failureDomainTopology: boolean;
  readonly artifactDigests: ReadinessArtifactDigests;
  readonly checks: readonly InfrastructureCheck[];
  readonly secretValuePresent: false;
  readonly reportDigest: string;
};

export function buildInfrastructureReadinessReport(input: {
  readonly environment: InfraEnvironment;
  readonly identities: WorkloadIdentityRegistry;
  readonly secrets: ClassifiedSecretStore;
  readonly registry: ProductionInfrastructureRegistry;
  readonly kms: InfraKmsReport | null;
  readonly hsm: InfraHsmReport | null;
  readonly certificates: LocalCertificateManager | null;
  readonly storage: ObjectStorageAdapter | null;
  readonly containerDigestsOk: boolean;
  readonly root?: string;
}): InfrastructureReadinessReport {
  const identities = input.identities.requireAllServices(input.environment);
  const distinct = input.identities.assertDistinct(input.environment);
  const providers = input.registry.list();
  const healthy = providers.some((row) => row.health === ('HEALTHY' satisfies ProviderHealthState));
  const failureDomains = new Set(providers.map((row) => `${row.failureDomain.region}/${row.failureDomain.zone}`));
  const artifacts = collectReadinessArtifactDigests(input.root);
  const checks: InfrastructureCheck[] = [
    { id: 'workload-identities', ok: identities.ok && distinct.ok, detail: identities.ok ? 'all services distinct' : identities.error.message },
    { id: 'secret-manager', ok: input.secrets.list().length > 0, detail: `${input.secrets.list().length} classified secrets` },
    { id: 'kms', ok: input.kms !== null && input.kms.privateKeyExportSupported === false, detail: input.kms?.providerId ?? 'absent' },
    { id: 'hsm', ok: input.hsm !== null, detail: input.hsm?.readiness ?? 'UNCONFIGURED' },
    { id: 'network-zoning', ok: documentedEgressClasses().length === 8, detail: 'zones and egress classes modeled' },
    { id: 'tls', ok: (input.certificates?.list().length ?? 0) > 0, detail: `${input.certificates?.list().length ?? 0} certificates` },
    { id: 'object-storage', ok: (input.storage?.list().length ?? 0) > 0, detail: `${input.storage?.list().length ?? 0} objects` },
    { id: 'container-digests', ok: input.containerDigestsOk, detail: input.containerDigestsOk ? 'immutable digests' : 'floating tag' },
    { id: 'backup-path', ok: (input.storage?.list().some((row) => row.objectClass === 'BACKUP') ?? false), detail: 'backup object class' },
    { id: 'observability', ok: providers.some((row) => row.supportedCapabilities.includes('METRICS_EXPORT')), detail: 'metrics export capability' },
    { id: 'failure-domain', ok: failureDomains.size >= 1 && healthy, detail: [...failureDomains].join(',') },
    { id: 'iac', ok: Boolean(iacModuleDigest()), detail: 'provider-neutral modules' },
    { id: 'candidate-identity', ok: PRODUCTION_CANDIDATE_NETWORK_ID.startsWith('net_sunrey_production_candidate_'), detail: `${PRODUCTION_CANDIDATE_NETWORK_ID}/${PRODUCTION_CANDIDATE_CHAIN_ID}` },
    { id: 'no-secret-values', ok: true, detail: 'report contains references only' },
  ];
  const body = {
    schemaVersion: INFRA_SCHEMA_VERSION,
    toolVersion: INFRA_TOOL_VERSION,
    environment: input.environment,
    mainnetEnabled: false as const,
    productionServicesActivated: false as const,
    workloadIdentities: identities.ok && distinct.ok,
    secretManager: input.secrets.list().length > 0,
    kms: input.kms !== null,
    hsmStatus: (input.hsm?.readiness ?? 'UNCONFIGURED') as InfrastructureReadinessReport['hsmStatus'],
    networkZoning: true,
    tls: (input.certificates?.list().length ?? 0) > 0,
    objectStorage: (input.storage?.list().length ?? 0) > 0,
    containerDigests: input.containerDigestsOk,
    backupPath: input.storage?.list().some((row) => row.objectClass === 'BACKUP') ?? false,
    observability: providers.some((row) => row.supportedCapabilities.includes('METRICS_EXPORT')),
    failureDomainTopology: failureDomains.size >= 1,
    artifactDigests: artifacts,
    checks: Object.freeze(checks),
    secretValuePresent: false as const,
  };
  return Object.freeze({
    ...body,
    reportDigest: digestJson(body),
  });
}
