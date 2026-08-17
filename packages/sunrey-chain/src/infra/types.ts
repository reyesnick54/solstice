/**
 * Chunk 66 — SunRey production-infrastructure control-plane types.
 *
 * Provider-neutral abstractions for a future production deployment.
 * PRODUCTION_CANDIDATE does not imply active mainnet. No LIVE_* flags
 * are enabled. Consensus logic is not coupled to a cloud vendor.
 */

export const INFRA_SCHEMA_VERSION = 1 as const;
export const INFRA_TOOL_VERSION = 'sunrey-infra/1' as const;

export const INFRA_ENVIRONMENTS = [
  'LOCAL',
  'TESTNET',
  'MAINNET_REHEARSAL',
  'PRODUCTION_CANDIDATE',
] as const;
export type InfraEnvironment = (typeof INFRA_ENVIRONMENTS)[number];

export const PROVIDER_TYPES = [
  'LOCAL_INTEGRATION',
  'AWS',
  'AZURE',
  'GOOGLE_CLOUD',
  'KUBERNETES',
  'VAULT_OPENBAO',
] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

export const INFRA_CAPABILITIES = [
  'COMPUTE',
  'KUBERNETES',
  'OBJECT_STORAGE',
  'SECRET_MANAGER',
  'KMS',
  'HSM',
  'LOAD_BALANCER',
  'DNS',
  'CERTIFICATE_MANAGER',
  'CONTAINER_REGISTRY',
  'PRIVATE_NETWORK',
  'LOG_EXPORT',
  'METRICS_EXPORT',
  'DATABASE_SERVICE',
] as const;
export type InfraCapability = (typeof INFRA_CAPABILITIES)[number];

export const SECRET_CLASSES = [
  'DATABASE_CREDENTIAL',
  'TLS_PRIVATE_KEY',
  'RPC_SERVICE_CREDENTIAL',
  'ORACLE_PROVIDER_CREDENTIAL',
  'RELEASE_SERVICE_CREDENTIAL',
  'BACKUP_ENCRYPTION_KEY',
  'HSM_AUTH_REFERENCE',
  'KMS_AUTH_REFERENCE',
  'CONTAINER_REGISTRY_CREDENTIAL',
  'EXTERNAL_PROVIDER_CREDENTIAL',
] as const;
export type SecretClass = (typeof SECRET_CLASSES)[number];

export const CONSENSUS_KEY_CLASSES = [
  'VALIDATOR_CONSENSUS_SIGNING',
  'BLOCK_PROPOSAL_SIGNING',
  'GOVERNANCE_SIGNING',
  'GENESIS_SIGNING',
] as const;
export type ConsensusKeyClass = (typeof CONSENSUS_KEY_CLASSES)[number];

export const WORKLOAD_SERVICES = [
  'validator',
  'sentry',
  'rpc',
  'explorer',
  'exchange',
  'custody',
  'oracle_collector',
  'relayer',
  'monitoring',
  'backup',
  'release_service',
] as const;
export type WorkloadService = (typeof WORKLOAD_SERVICES)[number];

export const NETWORK_ZONES = [
  'PUBLIC_EDGE',
  'PUBLIC_RPC',
  'SENTRY',
  'VALIDATOR_PRIVATE',
  'SIGNER_PRIVATE',
  'CUSTODY_PRIVATE',
  'DATA_PRIVATE',
  'OPERATIONS_PRIVATE',
  'OBSERVABILITY',
  'BACKUP',
] as const;
export type NetworkZone = (typeof NETWORK_ZONES)[number];

export const EGRESS_CLASSES = [
  'ORACLE_COLLECTOR_SOURCE',
  'COMPLIANCE_PROVIDER',
  'RELEASE_INFRASTRUCTURE',
  'OBJECT_STORAGE_BACKUP',
  'LOG_EXPORT',
  'METRICS_EXPORT',
  'CONTAINER_REGISTRY_PULL',
  'DNS_RESOLUTION',
] as const;
export type EgressClass = (typeof EGRESS_CLASSES)[number];

export const HSM_READINESS_STATES = [
  'SIMULATION_HSM',
  'SOFTWARE_SECURE_PROVIDER',
  'EXTERNAL_HSM_CONFIGURED_UNVERIFIED',
  'EXTERNAL_HSM_VERIFIED',
] as const;
export type HsmReadinessState = (typeof HSM_READINESS_STATES)[number];

export const PROVIDER_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'UNCONFIGURED',
] as const;
export type ProviderHealthState = (typeof PROVIDER_HEALTH_STATES)[number];

export const PROVIDER_VERIFICATION_STATES = [
  'LOCAL_EXECUTABLE',
  'CONFIG_VALIDATED',
  'CREDENTIALS_REQUIRED',
  'EXTERNAL_EVIDENCE_REQUIRED',
] as const;
export type ProviderVerificationState = (typeof PROVIDER_VERIFICATION_STATES)[number];

export const INFRA_AUDIT_EVENT_TYPES = [
  'SECRET_RETRIEVAL',
  'CREDENTIAL_ROTATION',
  'KMS_OPERATION',
  'HSM_HEALTH_CHANGE',
  'PROVIDER_CONFIGURATION_CHANGE',
  'INFRASTRUCTURE_DEPLOYMENT',
  'NETWORK_POLICY_CHANGE',
] as const;
export type InfraAuditEventType = (typeof INFRA_AUDIT_EVENT_TYPES)[number];

export const ACCESS_OPERATIONS = [
  'READ',
  'WRITE',
  'SIGN',
  'ROTATE',
  'CONFIGURE',
  'RETRIEVE_SECRET',
  'MUTATE_CHAIN',
  'ACCESS_HSM',
  'ACCESS_CONSENSUS_SIGNER',
] as const;
export type AccessOperation = (typeof ACCESS_OPERATIONS)[number];

export const TLS_MODES = ['SERVICE_TLS', 'MTLS'] as const;
export type TlsMode = (typeof TLS_MODES)[number];

export const OBJECT_CLASSES = [
  'VERIFIED_SNAPSHOT',
  'BACKUP',
  'RELEASE_BUNDLE',
  'AUDIT_BUNDLE',
  'DR_ARTIFACT',
] as const;
export type ObjectClass = (typeof OBJECT_CLASSES)[number];

export const ENCRYPTION_POLICIES = [
  'PROVIDER_MANAGED',
  'CUSTOMER_MANAGED_KMS',
  'BACKUP_ENCRYPTION_KEY',
] as const;
export type EncryptionPolicy = (typeof ENCRYPTION_POLICIES)[number];

export type FailureDomain = {
  readonly region: string;
  readonly zone: string;
  readonly provider: ProviderType;
};

export type InfraEvidenceReference = {
  readonly kind: string;
  readonly digest: string;
  readonly reference: string;
};

export type InfraResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

export function infraOk<T>(value: T): InfraResult<T> {
  return Object.freeze({ ok: true, value });
}

export function infraErr<T = never>(code: string, message: string): InfraResult<T> {
  return Object.freeze({ ok: false, error: Object.freeze({ code, message }) });
}

export function unwrapInfra<T>(result: InfraResult<T>): T {
  if (!result.ok) {
    throw new TypeError(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}
