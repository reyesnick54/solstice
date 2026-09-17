/**
 * HELIOS H22 — provider account / funding / wallet orchestration taxonomy.
 *
 * Coordination and reservation only. Does not issue Execution Authority,
 * post journals, or become legal account owner.
 */

/** Explicit provider capability posture for orchestration discovery. */
export const PROVIDER_ORCHESTRATION_CAPABILITY_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED',
  'SANDBOX_AVAILABLE',
  'CERTIFICATION_AVAILABLE',
  'APPLICATION_SUPPORTED',
  'FUNDING_SUPPORTED',
  'CUSTODY_SUPPORTED',
  'TRADING_SUPPORTED',
  'WITHDRAWAL_SUPPORTED',
  'DEGRADED',
  'UNAVAILABLE',
  'LIVE_AUTHORIZATION_PENDING',
  'LIVE_AUTHORIZED',
] as const;
export type ProviderOrchestrationCapabilityState =
  (typeof PROVIDER_ORCHESTRATION_CAPABILITY_STATES)[number];

/** External investment/account application lifecycle from provider evidence. */
export const EXTERNAL_ACCOUNT_APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'PENDING',
  'ACTION_REQUIRED',
  'APPROVED',
  'RESTRICTED',
  'REJECTED',
  'CLOSED',
  'UNKNOWN',
] as const;
export type ExternalAccountApplicationStatus =
  (typeof EXTERNAL_ACCOUNT_APPLICATION_STATUSES)[number];

/** Customer action types surfaced when provider requires human attestation. */
export const CUSTOMER_ACTION_REQUIREMENT_KINDS = [
  'CUSTOMER_SIGNATURE',
  'TAX_FORM',
  'IDENTITY_DOCUMENT',
  'SUITABILITY_RESPONSE',
  'AGREEMENT_ACCEPTANCE',
  'ADDITIONAL_VERIFICATION',
] as const;
export type CustomerActionRequirementKind =
  (typeof CUSTOMER_ACTION_REQUIREMENT_KINDS)[number];

/** Verified funding relationship verification posture. */
export const FUNDING_VERIFICATION_STATES = [
  'UNVERIFIED',
  'PENDING',
  'VERIFIED',
  'FAILED',
  'REVOKED',
  'UNKNOWN',
] as const;
export type FundingVerificationState = (typeof FUNDING_VERIFICATION_STATES)[number];

/** Funding operation lifecycle — provider and settlement remain authoritative. */
export const FUNDING_OPERATION_STATUSES = [
  'REQUESTED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PENDING',
  'SETTLING',
  'SETTLED',
  'FAILED',
  'REVERSED',
  'ACTION_REQUIRED',
  'UNKNOWN',
] as const;
export type FundingOperationStatus = (typeof FUNDING_OPERATION_STATUSES)[number];

/** Custody wallet provisioning lifecycle. */
export const CUSTODY_WALLET_PROVISION_STATUSES = [
  'REQUESTED',
  'PENDING',
  'PROVISIONED',
  'RESTRICTED',
  'FAILED',
  'CLOSED',
  'UNKNOWN',
] as const;
export type CustodyWalletProvisionStatus =
  (typeof CUSTODY_WALLET_PROVISION_STATUSES)[number];

/** Orchestration readiness reported to HELIOS without faking qualification. */
export const PROVIDER_ORCHESTRATION_READINESS = [
  'PROVIDER_ORCHESTRATION_READY',
  'EXTERNAL_PROVIDER_QUALIFICATION_PENDING',
] as const;
export type ProviderOrchestrationReadiness =
  (typeof PROVIDER_ORCHESTRATION_READINESS)[number];

export const PROVIDER_ORCHESTRATION_ENVIRONMENTS = ['simulation', 'sandbox'] as const;
export type ProviderOrchestrationEnvironment =
  (typeof PROVIDER_ORCHESTRATION_ENVIRONMENTS)[number];

/** Account types supported for external investment provisioning. */
export const EXTERNAL_ACCOUNT_TYPES = [
  'BROKERAGE_CASH',
  'BROKERAGE_MARGIN',
  'INVESTMENT_ISA',
  'RETIREMENT',
] as const;
export type ExternalAccountType = (typeof EXTERNAL_ACCOUNT_TYPES)[number];
