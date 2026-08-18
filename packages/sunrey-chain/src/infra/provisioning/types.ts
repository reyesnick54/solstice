/**
 * Chunk 86 — SunRey production-environment provisioning types.
 *
 * Plan-first control plane. PRODUCTION exists as code but requires a
 * distinct human-authorized deployment package. CI uses non-production
 * classes. This module does not execute genesis or activate customer
 * capabilities.
 */

import type { SecretReference } from '../../../../security/src/secrets.ts';
import type { NetworkZone } from '../types.ts';

export const PROVISIONING_SCHEMA_VERSION = 1 as const;
export const PROVISIONING_TOOL_VERSION = 'sunrey-infra/provisioning/1' as const;

export const PRODUCTION_ENVIRONMENT_CLASSES = [
  'LOCAL',
  'TESTNET',
  'MAINNET_REHEARSAL',
  'PRODUCTION_CANDIDATE',
  'PRODUCTION',
] as const;
export type ProductionEnvironmentClass = (typeof PRODUCTION_ENVIRONMENT_CLASSES)[number];

export const PROVISIONING_SERVICE_ROLES = [
  'validator',
  'sentry',
  'rpc',
  'explorer',
  'oracle',
  'exchange',
  'custody',
  'database',
  'monitoring',
  'backup',
  'release',
] as const;
export type ProvisioningServiceRole = (typeof PROVISIONING_SERVICE_ROLES)[number];

export const PROVISIONING_OPERATION_KINDS = [
  'NETWORK',
  'SECURITY_PRIMITIVES',
  'STORAGE',
  'DATABASE',
  'SENTRIES',
  'SIGNERS',
  'VALIDATORS',
  'RPC',
  'EXPLORER',
  'MONITORING',
  'BACKUPS',
  'OFFCHAIN_SERVICES',
] as const;
export type ProvisioningOperationKind = (typeof PROVISIONING_OPERATION_KINDS)[number];

export const DRIFT_CLASSIFICATIONS = [
  'MATCH',
  'AUTHORIZED_VARIANCE',
  'UNAUTHORIZED_DRIFT',
  'OBSERVATION_UNAVAILABLE',
] as const;
export type DriftClassification = (typeof DRIFT_CLASSIFICATIONS)[number];

export const OBJECT_STORAGE_PURPOSES = [
  'CHAIN_BACKUPS',
  'DATABASE_BACKUPS',
  'RELEASE_ARTIFACTS',
  'AUDIT_BUNDLES',
  'CEREMONY_EVIDENCE',
  'DR_EVIDENCE',
] as const;
export type ObjectStoragePurpose = (typeof OBJECT_STORAGE_PURPOSES)[number];

export const DATABASE_ROLES = ['PRIMARY', 'SYNC_REPLICA', 'ASYNC_REPLICA', 'READ_REPLICA'] as const;
export type DatabaseRole = (typeof DATABASE_ROLES)[number];

export const BACKUP_CLASSES = ['CHAIN_STATE', 'APPLICATION_DATABASE', 'OBJECT_CATALOG', 'CONFIGURATION'] as const;
export type BackupClass = (typeof BACKUP_CLASSES)[number];

export type ProductionEnvironmentTarget = {
  readonly class: ProductionEnvironmentClass;
  readonly networkId: string;
  readonly chainId: string;
  readonly addressHrp: string;
  readonly productionAuthorized: false;
  readonly mainnetEnabled: false;
};

export type ProvisioningDependency = {
  readonly operationId: string;
  readonly requires: readonly string[];
};

export type ProvisioningEvidence = {
  readonly evidenceId: string;
  readonly kind: string;
  readonly digest: string;
  readonly reference: string;
  readonly secretValuePresent: false;
};

export type ProvisioningOperation = {
  readonly operationId: string;
  readonly kind: ProvisioningOperationKind;
  readonly target: string;
  readonly zone: NetworkZone;
  readonly artifactDigest: string | null;
  readonly providerId: string;
  readonly dependsOn: readonly string[];
  readonly mutatesInfrastructure: boolean;
};

export type ProvisioningResult = {
  readonly operationId: string;
  readonly ok: boolean;
  readonly code: string;
  readonly detail: string;
  readonly mutated: false;
};

export type ValidatorDeploymentBinding = {
  readonly validatorId: string;
  readonly failureDomain: {
    readonly region: string;
    readonly availabilityDomain: string;
    readonly provider: string;
  };
  readonly networkZone: 'VALIDATOR_PRIVATE';
  readonly artifactDigest: string;
  readonly storageProfile: string;
  readonly sentryConnections: readonly string[];
  readonly remoteSignerReference: string;
  readonly monitoringTarget: string;
  readonly backupClass: BackupClass;
  readonly workloadIdentity: string;
  readonly privateSigningMaterialEmbedded: false;
};

export type ServiceDeploymentBinding = {
  readonly role: ProvisioningServiceRole;
  readonly zone: NetworkZone;
  readonly artifactDigest: string;
  readonly workloadIdentity: string;
  readonly secretReferences: readonly string[];
  readonly floatingImage: false;
  readonly capabilityActivation: false;
};

export type DatabaseDeploymentPlan = {
  readonly role: DatabaseRole;
  readonly replicaCount: number;
  readonly backupEnabled: true;
  readonly pitrCapable: boolean;
  readonly privateNetwork: true;
  readonly tlsRequired: true;
  readonly credentialRef: SecretReference;
  readonly monitoring: true;
  readonly authority: 'APPLICATION_ONLY';
};

export type ChainStoragePlan = {
  readonly engine: 'redb';
  readonly volumeRef: string;
  readonly snapshotLocation: string;
  readonly archivePruningPolicy: string;
  readonly capacityAlert: string;
  readonly backupPath: string;
};

export type ObjectStoragePlan = {
  readonly adapter: 'ObjectStorageAdapter';
  readonly purposes: readonly ObjectStoragePurpose[];
};

export type ObservabilityPlan = {
  readonly metrics: true;
  readonly logs: true;
  readonly traces: boolean;
  readonly alertRoutes: readonly string[];
  readonly auditEvents: true;
  readonly credentialsLogged: false;
};

export type DisasterRecoveryBinding = {
  readonly service: ProvisioningServiceRole;
  readonly backupClass: BackupClass;
  readonly recoveryMethod: string;
  readonly failureDomain: string;
  readonly recoveryEvidenceLocation: string;
};

export type ProductionDeploymentDescriptor = {
  readonly schemaVersion: 1;
  readonly environmentClass: ProductionEnvironmentClass;
  readonly networkId: string;
  readonly chainId: string;
  readonly services: readonly ServiceDeploymentBinding[];
  readonly validators: readonly ValidatorDeploymentBinding[];
  readonly observedAtUtc: string | null;
};

export type ProductionEnvironmentPlan = {
  readonly schemaVersion: 1;
  readonly toolVersion: typeof PROVISIONING_TOOL_VERSION;
  readonly planId: string;
  readonly environment: ProductionEnvironmentTarget;
  readonly candidateV2Id: string;
  readonly candidateV2RootHash: string;
  readonly mainnetRcId: string;
  readonly mainnetRcHash: string;
  readonly providerMatrixDigest: string;
  readonly protocolVersion: string;
  readonly topologyHash: string;
  readonly services: readonly ServiceDeploymentBinding[];
  readonly validators: readonly ValidatorDeploymentBinding[];
  readonly operations: readonly ProvisioningOperation[];
  readonly dependencies: readonly ProvisioningDependency[];
  readonly artifactDigests: Readonly<Record<string, string>>;
  readonly storage: ChainStoragePlan;
  readonly objectStorage: ObjectStoragePlan;
  readonly database: DatabaseDeploymentPlan;
  readonly securityPolicy: string;
  readonly hsmState: string;
  readonly workloadIdentities: readonly string[];
  readonly networkPolicyHash: string;
  readonly observability: ObservabilityPlan;
  readonly disasterRecovery: readonly DisasterRecoveryBinding[];
  readonly evidence: readonly ProvisioningEvidence[];
  readonly secretReferences: readonly string[];
  readonly genesisExecuted: false;
  readonly customerCapabilitiesActivated: false;
  readonly productionAuthorized: false;
  readonly mainnetEnabled: false;
  readonly planHash: string;
};

export type ProductionEnvironmentVerificationReport = {
  readonly schemaVersion: 1;
  readonly planHash: string;
  readonly candidateV2Verified: boolean;
  readonly mainnetRcVerified: boolean;
  readonly providerGating: boolean;
  readonly artifactImmutability: boolean;
  readonly networkPolicy: boolean;
  readonly secretsAbsent: boolean;
  readonly privateKeysAbsent: boolean;
  readonly genesisExecuted: false;
  readonly productionAuthorized: false;
  readonly mainnetEnabled: false;
  readonly checks: readonly { readonly id: string; readonly ok: boolean; readonly detail: string }[];
  readonly ok: boolean;
};

export type ProductionEnvironmentDriftReport = {
  readonly schemaVersion: 1;
  readonly planHash: string;
  readonly classification: DriftClassification;
  readonly differences: readonly string[];
  readonly observed: boolean;
};

export type DeploymentAuthorizationPackage = {
  readonly authorized: boolean;
  readonly actorKind: 'HUMAN' | 'AI' | 'AUTOMATION';
  readonly humanRoles: readonly string[];
  readonly evidenceDigest: string | null;
  readonly aiGeneratedPlanningAlone: boolean;
};
