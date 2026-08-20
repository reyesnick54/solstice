export const CUSTODY_WALLET_CLASSES = [
  'SEGREGATED',
  'OMNIBUS',
  'HOT',
  'WARM',
  'COLD',
  'SETTLEMENT',
  'FEE',
  'TREASURY',
  'QUARANTINE',
] as const;
export type CustodyWalletClass = (typeof CUSTODY_WALLET_CLASSES)[number];

export const CUSTODY_TYPES = ['INSTITUTIONAL', 'EXCHANGE', 'TREASURY', 'ENTERPRISE'] as const;
export type CustodyType = (typeof CUSTODY_TYPES)[number];

export const VAULT_STATUSES = ['ACTIVE', 'HALTED', 'COMPROMISED', 'MIGRATING', 'RETIRED'] as const;
export type VaultStatus = (typeof VAULT_STATUSES)[number];

export const SECURITY_TIERS = ['HOT', 'WARM', 'COLD'] as const;
export type SecurityTier = (typeof SECURITY_TIERS)[number];

export const SIGNING_PROVIDER_KINDS = [
  'LOCAL_DEVELOPMENT',
  'REMOTE_SIGNER',
  'HSM',
  'KMS',
  'MPC',
  'OFFLINE_COLD',
] as const;
export type SigningProviderKind = (typeof SIGNING_PROVIDER_KINDS)[number];

export const SIGNING_IMPLEMENTATION_STATES = [
  'SIMULATION',
  'PORT_ONLY',
  'NOT_IMPLEMENTED',
] as const;
export type SigningImplementationState = (typeof SIGNING_IMPLEMENTATION_STATES)[number];

export const APPROVAL_MODES = [
  'SINGLE_OPERATOR',
  'DUAL_CONTROL',
  'M_OF_N_APPROVERS',
  'SECURITY_PLUS_OPERATIONS',
  'HIGH_VALUE_COMMITTEE',
] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export const WITHDRAWAL_POLICY_DECISIONS = [
  'ELIGIBLE',
  'ADDITIONAL_APPROVAL_REQUIRED',
  'SECURITY_REVIEW',
  'COMPLIANCE_REVIEW',
  'REJECTED',
] as const;
export type WithdrawalPolicyDecision = (typeof WITHDRAWAL_POLICY_DECISIONS)[number];

export const INSTITUTIONAL_WITHDRAWAL_STATES = [
  'REQUESTED',
  'POLICY_EVALUATED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'SIGNING',
  'SIGNED',
  'SUBMITTED',
  'SUBMISSION_UNKNOWN',
  'FINALIZED',
  'REJECTED',
  'CANCELLED',
  'RECONCILIATION_REQUIRED',
] as const;
export type InstitutionalWithdrawalState = (typeof INSTITUTIONAL_WITHDRAWAL_STATES)[number];

export const INSTITUTIONAL_DESTINATION_STATUSES = [
  'NEW',
  'PENDING_VERIFICATION',
  'APPROVED',
  'RESTRICTED',
  'REVOKED',
] as const;
export type InstitutionalDestinationStatus = (typeof INSTITUTIONAL_DESTINATION_STATUSES)[number];

export const INSTITUTIONAL_RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'MISMATCH',
  'INVESTIGATION_REQUIRED',
] as const;
export type InstitutionalReconciliationOutcome = (typeof INSTITUTIONAL_RECONCILIATION_OUTCOMES)[number];

export const INSTITUTIONAL_SECURITY_CONTROLS = [
  'WITHDRAWAL_HALT',
  'SIGNING_HALT',
  'HOT_VAULT_HALT',
  'ASSET_WITHDRAWAL_HALT',
] as const;
export type InstitutionalSecurityControl = (typeof INSTITUTIONAL_SECURITY_CONTROLS)[number];

export const HUMAN_CUSTODY_ACTORS = ['HUMAN_OPERATOR', 'HUMAN_SECURITY'] as const;
export type HumanCustodyActor = (typeof HUMAN_CUSTODY_ACTORS)[number];

export const FORBIDDEN_CUSTODY_ACTORS = ['AI', 'AGENT'] as const;
export type ForbiddenCustodyActor = (typeof FORBIDDEN_CUSTODY_ACTORS)[number];

export type CustodyActorKind = HumanCustodyActor | ForbiddenCustodyActor;

export const VAULT_SCHEMA_VERSION = 1 as const;
export const VAULT_SCHEMA_VERSION_V2 = 2 as const;
export type InstitutionalVaultSchemaVersion = typeof VAULT_SCHEMA_VERSION | typeof VAULT_SCHEMA_VERSION_V2;

export const DEVELOPMENT_TIER_LIMITS = Object.freeze({
  HOT: 1_000_000n,
  WARM: 10_000_000n,
  COLD: 1_000_000_000n,
  label: 'DEVELOPMENT_FIXTURE',
  productionPolicy: false,
});

export const CUSTODY_KEY_PURPOSE = 'WALLET_SIGNING' as const;
