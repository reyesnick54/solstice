/**
 * Chunk 96 — SunRey wallet security, recovery, device trust, and
 * transaction authorization types.
 *
 * This module extends Chunk 46 sovereign wallets. It is not a second
 * wallet ledger, identity system, custody plane, key provider, or
 * authorization root. Wallet balances remain canonical SunRey
 * Blockchain state. Fiat balances remain the canonical Ledger.
 *
 * Application authentication is distinct from blockchain transaction
 * signing. A passkey or session login is never native signing authority.
 */

import type { NativeAssetId } from '../../protocol/assets.ts';
import type { TransactionFamily } from '../../protocol/transaction-family.ts';
import type { NetworkClass, WalletType } from '../types.ts';

export const WALLET_SECURITY_SCHEMA_VERSION = 1 as const;
export const WALLET_SECURITY_OWNER = 'packages/sunrey-chain' as const;

export const WALLET_CUSTODY_CLASSES = [
  'SELF_CUSTODY',
  'ASSISTED_SELF_CUSTODY',
  'INSTITUTIONAL_CUSTODY',
  'MACHINE_CONTROLLED',
  'DELEGATED_AGENT',
] as const;
export type WalletCustodyClass = (typeof WALLET_CUSTODY_CLASSES)[number];

export const WALLET_AUTH_METHODS = [
  'PASSKEY',
  'DEVICE',
  'APPROVED_MFA',
  'RECOVERY',
] as const;
export type WalletAuthMethod = (typeof WALLET_AUTH_METHODS)[number];

export const DEVICE_PLATFORM_CLASSES = [
  'MOBILE',
  'DESKTOP',
  'HARDWARE_AUTHENTICATOR',
  'SERVER',
  'UNKNOWN',
] as const;
export type DevicePlatformClass = (typeof DEVICE_PLATFORM_CLASSES)[number];

export const DEVICE_REGISTRATION_STATES = ['PENDING', 'REGISTERED', 'REVOKED'] as const;
export type DeviceRegistrationState = (typeof DEVICE_REGISTRATION_STATES)[number];

export const WALLET_DEVICE_TRUST_STATES = [
  'NEW',
  'VERIFIED',
  'TRUSTED',
  'RESTRICTED',
  'REVOKED',
] as const;
export type WalletDeviceTrustState = (typeof WALLET_DEVICE_TRUST_STATES)[number];

export const WALLET_SESSION_SCOPES = [
  'READ_ONLY',
  'TRANSACTION_PREVIEW',
  'TRANSACTION_APPROVAL',
  'TRADING',
  'PROFILE_MANAGEMENT',
  'RECOVERY_ADMIN',
] as const;
export type WalletSessionScope = (typeof WALLET_SESSION_SCOPES)[number];

export const WALLET_SESSION_RISK_STATES = ['CLEAR', 'ELEVATED', 'CHALLENGED', 'BLOCKED'] as const;
export type WalletSessionRiskState = (typeof WALLET_SESSION_RISK_STATES)[number];

export const DESTINATION_TRUST_STATES = [
  'UNRECOGNIZED',
  'PENDING_VERIFICATION',
  'TRUSTED',
  'RESTRICTED',
  'REVOKED',
] as const;
export type DestinationTrustState = (typeof DESTINATION_TRUST_STATES)[number];

export const HIGH_RISK_CATEGORIES = [
  'NEW_DESTINATION',
  'LARGE_QUANTITY',
  'CUSTODY_WITHDRAWAL',
  'KEY_ROTATION',
  'RECOVERY_ACTION',
  'NEW_DELEGATED_AGENT',
  'NEW_MACHINE_MANDATE',
] as const;
export type HighRiskCategory = (typeof HIGH_RISK_CATEGORIES)[number];

export const TRANSACTION_REQUIREMENT_KINDS = [
  'NORMAL_USER_SIGNATURE',
  'ADDITIONAL_APPLICATION_AUTHENTICATION',
  'SECOND_DEVICE',
  'SECOND_HUMAN_APPROVER',
  'CUSTODY_APPROVAL',
  'DELAYED_REVIEW',
  'TRUSTED_DESTINATION_CONFIRMATION',
] as const;
export type TransactionRequirementKind = (typeof TRANSACTION_REQUIREMENT_KINDS)[number];

export const RECOVERY_REASON_CLASSES = [
  'LOST_DEVICE',
  'COMPROMISED_KEY',
  'OWNER_INITIATED_ROTATION',
  'CUSTODY_OPERATOR',
  'GUARDIAN_THRESHOLD',
] as const;
export type RecoveryReasonClass = (typeof RECOVERY_REASON_CLASSES)[number];

export const RECOVERY_COMPONENT_KINDS = [
  'RECOVERY_PASSKEY',
  'SECONDARY_VERIFIED_DEVICE',
  'HUMAN_RECOVERY_CONTACT',
  'CUSTODY_OPERATOR_PROCESS',
  'TIME_DELAYED_RECOVERY',
  'MULTI_PARTY_RECOVERY',
] as const;
export type RecoveryComponentKind = (typeof RECOVERY_COMPONENT_KINDS)[number];

export const KEY_ROTATION_ACTIVATION_STATES = [
  'PLANNED',
  'AUTHORIZED',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUPERSEDED',
  'CANCELLED',
] as const;
export type KeyRotationActivationState = (typeof KEY_ROTATION_ACTIVATION_STATES)[number];

export const WALLET_SECURITY_EVENT_KINDS = [
  'NEW_DEVICE',
  'SESSION_CREATED',
  'SESSION_REVOKED',
  'DELEGATED_KEY_CREATED',
  'DELEGATED_KEY_REVOKED',
  'RECOVERY_INITIATED',
  'RECOVERY_COMPLETED',
  'KEY_ROTATED',
  'TRUSTED_DESTINATION_CHANGED',
  'HIGH_RISK_TRANSACTION_CHALLENGED',
] as const;
export type WalletSecurityEventKind = (typeof WALLET_SECURITY_EVENT_KINDS)[number];

export const WALLET_SECURITY_REJECTION_CODES = [
  'WRONG_NETWORK_ADDRESS',
  'WRONG_CHAIN_TRANSACTION',
  'REVOKED_DEVICE',
  'REVOKED_SESSION',
  'TAMPERED_SIGNING_INTENT',
  'DELEGATED_AMOUNT_LIMIT',
  'DELEGATED_WRONG_ASSET',
  'DELEGATED_WRONG_DESTINATION',
  'DELEGATED_MASTER_AUTHORITY_FORBIDDEN',
  'GUARDIAN_CANNOT_SPEND',
  'RECOVERY_REPLAY',
  'RECOVERY_DELAY_ACTIVE',
  'RECOVERY_CANNOT_REWRITE_HISTORY',
  'TESTNET_KEY_PRODUCTION',
  'SESSION_IS_NOT_SIGNING_AUTHORITY',
  'CLASS_CONVERSION_FORBIDDEN',
  'PRIVATE_KEY_EXPOSURE',
  'SELF_CUSTODY_KEY_UNAVAILABLE',
  'CUSTODY_CONTROL_REQUIRED',
  'POLICY_NOT_SATISFIED',
  'DESTINATION_RESTRICTED',
  'ADDRESS_CLASS_MISMATCH',
] as const;
export type WalletSecurityRejectionCode = (typeof WALLET_SECURITY_REJECTION_CODES)[number];

export type WalletSecurityRejection = {
  readonly ok: false;
  readonly code: WalletSecurityRejectionCode;
  readonly detail: string;
};

export type WalletAuthenticationPolicy = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly allowedMethods: readonly WalletAuthMethod[];
  readonly requireMfaForHighRisk: boolean;
  readonly passkeyAuthenticatesSessionOnly: true;
  readonly loginIsNotNativeSigning: true;
};

export type WalletAuthorizationPolicy = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly custodyClass: WalletCustodyClass;
  readonly defaultRequirements: readonly TransactionRequirementKind[];
  readonly highRiskRequirements: readonly TransactionRequirementKind[];
  readonly allowDelegatedMaster: false;
};

export type WalletSessionPolicy = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly allowedScopes: readonly WalletSessionScope[];
  readonly ttlMs: bigint;
  readonly environment: string;
  readonly revokeDoesNotRewriteChain: true;
};

export type WalletSpendControl = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly perTransactionQuantity: bigint | null;
  readonly rollingPeriodMs: bigint | null;
  readonly rollingPeriodQuantity: bigint | null;
  readonly assetId: NativeAssetId | null;
  readonly destinationId: string | null;
  readonly marketId: string | null;
  readonly delegatedKeyId: string | null;
  readonly agentMandateId: string | null;
  readonly spentInPeriod: bigint;
  readonly periodStartedAt: string | null;
};

export type WalletTransactionPolicy = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly custodyClass: WalletCustodyClass;
  readonly spendControls: readonly WalletSpendControl[];
  readonly largeQuantityThreshold: bigint | null;
  readonly requireTrustedDestinationConfirmation: boolean;
};

export type WalletDestinationRecord = {
  readonly destinationId: string;
  readonly addressText: string;
  readonly networkId: string;
  readonly networkClass: NetworkClass;
  readonly addressClass: string;
  readonly trustState: DestinationTrustState;
  readonly label: string;
  readonly updatedAt: string;
};

export type WalletDestinationPolicy = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly walletId: string;
  readonly version: number;
  readonly destinations: readonly WalletDestinationRecord[];
};

export type WalletRecoveryComponent = {
  readonly componentId: string;
  readonly kind: RecoveryComponentKind;
  readonly actorRef: string;
  readonly publicDescriptor: string;
  readonly grantsEverydaySpend: false;
  readonly grantsWalletPrivateView: false;
};

export type WalletRecoveryPolicy = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly policyId: string;
  readonly version: number;
  readonly walletId: string;
  readonly threshold: number;
  readonly delayMs: bigint;
  readonly rehearsalDelayMs: bigint;
  readonly ownerMayCancel: boolean;
  readonly components: readonly WalletRecoveryComponent[];
};

export type WalletDeviceBinding = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly bindingId: string;
  readonly deviceId: string;
  readonly walletId: string;
  readonly devicePublicDescriptor: string;
  readonly devicePlatformClass: DevicePlatformClass;
  readonly registrationState: DeviceRegistrationState;
  readonly trustState: WalletDeviceTrustState;
  readonly firstRegistrationEvidence: string;
  readonly lastAuthenticationAt: string | null;
  readonly lastAuthenticationMethod: WalletAuthMethod | null;
  readonly revocationState: 'ACTIVE' | 'REVOKED';
  readonly revokedAt: string | null;
};

export type WalletTrustedDevice = {
  readonly deviceId: string;
  readonly walletId: string;
  readonly trustState: Extract<WalletDeviceTrustState, 'VERIFIED' | 'TRUSTED'>;
  readonly publicDescriptor: string;
};

export type WalletSession = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly sessionId: string;
  readonly walletId: string;
  readonly identityRef: string;
  readonly deviceId: string;
  readonly authenticationMethod: WalletAuthMethod;
  readonly environment: string;
  readonly scope: WalletSessionScope;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly riskState: WalletSessionRiskState;
  readonly revocationState: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  readonly grantsNativeSigning: false;
};

export type WalletRecoveryEvidence = {
  readonly evidenceId: string;
  readonly kind: string;
  readonly publicRef: string;
  readonly createdAt: string;
};

export type WalletRecoveryApproval = {
  readonly approvalId: string;
  readonly componentId: string;
  readonly actorRef: string;
  readonly approvedAt: string;
  readonly scopedToRecovery: true;
  readonly grantsSpend: false;
};

export type WalletRecoveryRequest = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly requestId: string;
  readonly walletId: string;
  readonly policyId: string;
  readonly policyVersion: number;
  readonly requestedNewAuthorityPublicKey: string;
  readonly reasonClass: RecoveryReasonClass;
  readonly evidence: readonly WalletRecoveryEvidence[];
  readonly challenge: string;
  readonly approvals: readonly WalletRecoveryApproval[];
  readonly expiresAt: string;
  readonly requestHash: string;
  readonly status: 'PENDING' | 'CHALLENGED' | 'CANCELLED' | 'ACTIVATED' | 'EXPIRED';
  readonly activationAt: string;
  readonly consumed: boolean;
};

export type WalletKeyRotationPlan = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly planId: string;
  readonly walletId: string;
  readonly oldKeyId: string;
  readonly newPublicKeyHex: string;
  readonly policyId: string;
  readonly authorizationRef: string;
  readonly activationState: KeyRotationActivationState;
  readonly auditEvidence: string;
  readonly createdAt: string;
};

export type WalletDelegatedKeyBinding = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly keyId: string;
  readonly walletId: string;
  readonly purpose: string;
  readonly assets: readonly NativeAssetId[];
  readonly quantityLimit: bigint | null;
  readonly destinations: readonly string[];
  readonly actionClasses: readonly TransactionFamily[];
  readonly expiresAt: string | null;
  readonly environment: string;
  readonly revocationPolicy: 'OWNER_MAY_REVOKE' | 'CUSTODY_MAY_REVOKE';
  readonly revoked: boolean;
  readonly inheritsMasterAuthority: false;
};

export type WalletSecurityEvent = {
  readonly eventId: string;
  readonly walletId: string;
  readonly kind: WalletSecurityEventKind;
  readonly occurredAt: string;
  readonly publicSummary: string;
  readonly notificationHook: WalletSecurityNotificationHook;
};

export type WalletSecurityNotificationHook = {
  readonly channel: 'CHUNK_97_NOTIFICATION';
  readonly privacySafe: true;
  readonly payload: {
    readonly walletId: string;
    readonly kind: WalletSecurityEventKind;
    readonly occurredAt: string;
    readonly summary: string;
  };
};

export type WalletRiskChallenge = {
  readonly challengeId: string;
  readonly walletId: string;
  readonly category: HighRiskCategory;
  readonly reason: string;
  readonly required: readonly TransactionRequirementKind[];
  readonly createdAt: string;
  readonly resolved: boolean;
};

export type WalletSecurityProfile = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly walletId: string;
  readonly ownerActorId: string;
  readonly identityRef: string;
  readonly walletType: WalletType;
  readonly custodyClass: WalletCustodyClass;
  readonly networkId: string;
  readonly environment: string;
  readonly authenticationPolicy: WalletAuthenticationPolicy;
  readonly authorizationPolicy: WalletAuthorizationPolicy;
  readonly sessionPolicy: WalletSessionPolicy;
  readonly transactionPolicy: WalletTransactionPolicy;
  readonly destinationPolicyVersion: number;
  readonly recoveryPolicyVersion: number | null;
  readonly classLocked: true;
};

export type WalletSecurityAuditReport = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly walletId: string;
  readonly generatedAt: string;
  readonly activeDevices: readonly WalletDeviceBinding[];
  readonly activeSessions: readonly WalletSession[];
  readonly activeSigningAuthorities: readonly string[];
  readonly delegations: readonly WalletDelegatedKeyBinding[];
  readonly recoveryPolicy: WalletRecoveryPolicy | null;
  readonly destinationPolicy: WalletDestinationPolicy;
  readonly pendingSecurityActions: readonly string[];
};

export type SigningIntent = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly intentId: string;
  readonly walletId: string;
  readonly assetId: NativeAssetId | null;
  readonly quantity: string | null;
  readonly destination: string | null;
  readonly networkFee: string;
  readonly marketOrContractAction: string | null;
  readonly expectedChainOperation: string;
  readonly policyRequirements: readonly TransactionRequirementKind[];
  readonly networkId: string;
  readonly chainId: string;
  readonly transactionHash: string;
  readonly canonicalBytesHash: string;
  readonly humanReadable: string;
};

export type TransactionPreview = {
  readonly schemaVersion: typeof WALLET_SECURITY_SCHEMA_VERSION;
  readonly assetId: NativeAssetId | null;
  readonly quantity: string | null;
  readonly destination: string | null;
  readonly networkFee: string;
  readonly marketOrContractAction: string | null;
  readonly expectedChainOperation: string;
  readonly policyRequirements: readonly TransactionRequirementKind[];
  readonly signingIntent: SigningIntent;
};

export type ValidatedAddress = {
  readonly text: string;
  readonly networkId: string;
  readonly networkClass: NetworkClass;
  readonly addressClass: string;
  readonly checksumOk: true;
};

export type PasskeyPublicCredential = {
  readonly credentialId: string;
  readonly identityRef: string;
  readonly publicKeyMaterial: string;
  readonly signCount: number;
  readonly createdAt: string;
};

export type PasskeyChallenge = {
  readonly challengeId: string;
  readonly purpose: 'REGISTRATION' | 'AUTHENTICATION';
  readonly challenge: string;
  readonly rpId: string;
  readonly origin: string;
  readonly expiresAt: string;
  readonly consumed: boolean;
};

export type SecureLocalStoragePort = {
  readonly storeLocal: (slot: string, materialRef: string) => void;
  readonly loadLocal: (slot: string) => string | null;
  readonly wipeLocal: (slot: string) => void;
  readonly exposeToBackend: false;
};

export type CustodyApprovalPort = {
  readonly requireApproval: (input: {
    readonly walletId: string;
    readonly destination: string;
    readonly quantity: bigint;
    readonly assetId: NativeAssetId;
  }) => { readonly ok: true; readonly approvalRef: string } | WalletSecurityRejection;
};

export type SelfCustodyServerView = {
  readonly walletId: string;
  readonly publicDescriptors: readonly string[];
  readonly signedTransactionsOnly: true;
  readonly privateKey: never;
};

export type LostDeviceWorkflowResult = {
  readonly walletId: string;
  readonly deviceRevoked: true;
  readonly sessionsRevoked: number;
  readonly delegatedKeysReviewed: readonly string[];
  readonly agentMandatesReviewed: readonly string[];
  readonly recoveryInitiated: boolean;
};

export function isWalletSecurityRejection(value: unknown): value is WalletSecurityRejection {
  return Boolean(value && typeof value === 'object' && (value as WalletSecurityRejection).ok === false);
}
