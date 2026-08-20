/**
 * Chunk 149 — production-candidate provider credential types.
 *
 * Values are references and handles only. Raw credentials never enter
 * domain configuration. A credential is not Execution Authority, a
 * mint, a ledger journal, or provider approval.
 */

import type { SecretReference } from '../../secrets.ts';
import type { HsmKeyHandle } from '../../hsm-kms.ts';

export const CREDENTIAL_PLANE_SCHEMA_VERSION = 1 as const;
export const CREDENTIAL_PLANE_ID = 'sunrey-production-provider-credential-plane' as const;

export const CREDENTIAL_KINDS = [
  'API_KEY_REFERENCE',
  'OAUTH_CLIENT_SECRET_REFERENCE',
  'OAUTH_PRIVATE_KEY_REFERENCE',
  'MTLS_CERTIFICATE_REFERENCE',
  'MTLS_PRIVATE_KEY_REFERENCE',
  'WEBHOOK_SIGNING_SECRET_REFERENCE',
  'REQUEST_SIGNING_KEY_HANDLE',
  'KMS_KEY_HANDLE_REFERENCE',
  'HSM_KEY_HANDLE_REFERENCE',
  'MPC_CUSTODY_CREDENTIAL_REFERENCE',
  'PROVIDER_SESSION_TOKEN_REFERENCE',
] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

export const CREDENTIAL_STATUSES = [
  'ACTIVE',
  'ROTATING',
  'RETIRED',
  'REVOKED',
  'EXPIRED',
] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const CREDENTIAL_PROVIDER_DOMAINS = [
  'CLOUD_INFRASTRUCTURE',
  'SECRET_MANAGER',
  'KMS',
  'HSM',
  'DATABASE',
  'OBJECT_STORAGE',
  'DNS',
  'CERTIFICATE_MANAGER',
  'ORACLE_DATA_SOURCE',
  'IDENTITY_KYC',
  'SANCTIONS_PEP',
  'AML_TRANSACTION_MONITORING',
  'TRAVEL_RULE',
  'MARKET_SURVEILLANCE',
  'CASE_MANAGEMENT',
  'CUSTODY_PROVIDER',
  'BANKING_REFERENCE',
  'PAYMENT_RAIL',
  'FX_LIQUIDITY',
  'OTHER_GOVERNED_EXTERNAL_PROVIDER',
] as const;
export type CredentialProviderDomain = (typeof CREDENTIAL_PROVIDER_DOMAINS)[number];

export const CREDENTIAL_WORKLOADS = [
  'oracle_collector',
  'explorer',
  'rpc',
  'case_management',
  'kyc_worker',
  'screening_worker',
  'travel_rule_worker',
  'surveillance_worker',
  'custody_worker',
  'banking_worker',
  'infra_worker',
  'kms_worker',
  'hsm_worker',
  'validator_signer',
  'consensus_execution',
  'governance_kms',
] as const;
export type CredentialWorkload = (typeof CREDENTIAL_WORKLOADS)[number];

export const CREDENTIAL_OPERATIONS = [
  'READ_HEALTH',
  'READ_REFERENCE_DATA',
  'SUBMIT_PAYMENT',
  'QUERY_PAYMENT',
  'CANCEL_PAYMENT',
  'READ_SETTLEMENT_REPORT',
  'VERIFY_IDENTITY',
  'SCREEN_SANCTIONS',
  'SCREEN_PEP',
  'MONITOR_TRANSACTION',
  'SUBMIT_TRAVEL_RULE_MESSAGE',
  'READ_CUSTODY_POSITION',
  'SUBMIT_CUSTODY_WITHDRAWAL',
  'SIGN_PROVIDER_REQUEST',
  'VERIFY_WEBHOOK',
] as const;
export type CredentialOperation = (typeof CREDENTIAL_OPERATIONS)[number];

export const CREDENTIAL_NETWORK_ZONES = [
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
export type CredentialNetworkZone = (typeof CREDENTIAL_NETWORK_ZONES)[number];

export const CREDENTIAL_FAILURE_CODES = [
  'CREDENTIAL_EXPIRED',
  'CREDENTIAL_NOT_YET_VALID',
  'CREDENTIAL_REVOKED',
  'CREDENTIAL_RETIRED',
  'CREDENTIAL_SCOPE_MISMATCH',
  'CREDENTIAL_WORKLOAD_MISMATCH',
  'CREDENTIAL_DOMAIN_MISMATCH',
  'CREDENTIAL_ENDPOINT_MISMATCH',
  'CREDENTIAL_PLAINTEXT_REJECTED',
  'SECRET_UNRESOLVED',
  'INVALID_SECRET_REFERENCE',
  'PRODUCTION_PROVIDER_MODE_UNAVAILABLE',
] as const;
export type CredentialFailureCode = (typeof CREDENTIAL_FAILURE_CODES)[number];

export const HANDLE_KINDS = ['SECRET_REFERENCE', 'HSM_KEY_HANDLE', 'KMS_KEY_HANDLE'] as const;
export type CredentialHandleKind = (typeof HANDLE_KINDS)[number];

export type CredentialMaterialRef =
  | { readonly handleKind: 'SECRET_REFERENCE'; readonly credentialRef: SecretReference }
  | { readonly handleKind: 'HSM_KEY_HANDLE'; readonly hsmHandle: HsmKeyHandle }
  | { readonly handleKind: 'KMS_KEY_HANDLE'; readonly kmsHandle: HsmKeyHandle };

export type ProviderCredentialDescriptor = {
  readonly credentialId: string;
  readonly providerId: string;
  readonly providerDomain: CredentialProviderDomain;
  readonly credentialKind: CredentialKind;
  readonly credentialRef: SecretReference | null;
  readonly keyHandle: HsmKeyHandle | null;
  readonly handleKind: CredentialHandleKind;
  readonly workloadIdentity: CredentialWorkload;
  readonly allowedProviderDomains: readonly CredentialProviderDomain[];
  readonly allowedOperations: readonly CredentialOperation[];
  readonly networkZone: CredentialNetworkZone;
  readonly endpointProfileRef: string;
  readonly version: number;
  readonly rotationGeneration: number;
  readonly issuedAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly status: CredentialStatus;
  readonly leastPrivilege: true;
  readonly rawCredentialPresent: false;
  readonly privateKeyPresent: false;
  readonly grantsExecutionAuthority: false;
  readonly grantsLedgerPosting: false;
  readonly grantsMintAuthority: false;
  readonly grantsGovernanceAuthority: false;
  readonly grantsCustodyHumanApproval: false;
  readonly equalsProviderApproval: false;
};

export type SecretVersionMetadata = {
  readonly referenceHash: string;
  readonly provider: string;
  readonly credentialId: string;
  readonly version: number;
  readonly createdAt: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly rotationGeneration: number;
  readonly status: CredentialStatus;
  readonly pathHidden: true;
  readonly valuePresent: false;
};

export type CredentialRotationState = {
  readonly credentialId: string;
  readonly currentVersion: number;
  readonly previousVersion: number | null;
  readonly rotationStartedAt: string | null;
  readonly overlapUntil: string | null;
  readonly status: CredentialStatus;
};

export type ProtectedSecretHandle = {
  readonly handleId: string;
  readonly credentialId: string;
  readonly version: number;
  readonly kind: CredentialKind;
  readonly workloadIdentity: CredentialWorkload;
  readonly operation: CredentialOperation;
  readonly expiresAt: string;
  readonly rawCredentialPresent: false;
  readonly toString: () => string;
  readonly toJSON: () => string;
};

export type ProviderCredentialError = {
  readonly name: 'ProviderCredentialError';
  readonly code: CredentialFailureCode;
  readonly reason: string;
  readonly correlationId: string;
  readonly providerId: string | null;
  readonly credentialId: string | null;
};

export type CredentialPlaneResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ProviderCredentialError };

export type CredentialUseAudit = {
  readonly auditId: string;
  readonly providerId: string;
  readonly domain: CredentialProviderDomain;
  readonly credentialId: string;
  readonly credentialVersion: number;
  readonly workloadIdentity: CredentialWorkload;
  readonly operation: CredentialOperation;
  readonly timestamp: string;
  readonly success: boolean;
  readonly reasonCode: CredentialFailureCode | 'OK';
  readonly correlationId: string;
};

export const CREDENTIAL_IS_NOT_EXECUTION_AUTHORITY = true as const;
export const CREDENTIAL_CANNOT_MINT = true as const;
export const CREDENTIAL_CANNOT_POST_LEDGER = true as const;
export const CREDENTIAL_EQUALS_PROVIDER_APPROVAL = false as const;
export const CROSS_WORKLOAD_REUSE_ALLOWED = false as const;
export const CROSS_DOMAIN_REUSE_ALLOWED = false as const;
export const WILDCARD_OPERATIONS_DEFAULT = false as const;
