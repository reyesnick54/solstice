/**
 * Chunk 46 — SunRey sovereign wallet and blockchain-account types.
 *
 * A BlockchainAccount is not a bank deposit, brokerage, card, or
 * packages/domain Account. Native asset balances remain canonical
 * blockchain state. Wallet metadata must never become a second ledger.
 *
 * Public tickers remain NOT_ASSIGNED.
 */

import type { NativeAssetId } from '../protocol/assets.ts';
import type { TransactionFamily } from '../protocol/transaction-family.ts';

export const WALLET_SCHEMA_VERSION = 1 as const;
export const ADDRESS_FORMAT_VERSION = 1 as const;
export const ADDRESS_MAX_BINARY_BYTES = 42 as const;
export const ADDRESS_MAX_TEXT_LENGTH = 90 as const;

export const NETWORK_CLASSES = ['DEVELOPMENT', 'RESERVED_TEST', 'RESERVED_PRODUCTION'] as const;
export type NetworkClass = (typeof NETWORK_CLASSES)[number];

export const NETWORK_CLASS_IDS: { readonly [K in NetworkClass]: number } = {
  DEVELOPMENT: 1,
  RESERVED_TEST: 2,
  RESERVED_PRODUCTION: 3,
};

export const DEVELOPMENT_NETWORK_IDS = [
  'net_sunrey_simulation',
  'net_sunrey_local_dev',
] as const;

export const RESERVED_TEST_NETWORK_ID = 'net_sunrey_reserved_test' as const;
export const RESERVED_PRODUCTION_NETWORK_ID = 'net_sunrey_reserved_production' as const;

export const ADDRESS_CLASSES = [
  'SINGLE_KEY_ACCOUNT',
  'POLICY_ACCOUNT',
  'MULTI_AUTH_ACCOUNT',
  'MACHINE_ACCOUNT',
  'INSTITUTIONAL_ACCOUNT',
  'WATCH_ONLY_ACCOUNT',
] as const;
export type AddressClass = (typeof ADDRESS_CLASSES)[number];

export const ADDRESS_CLASS_IDS: { readonly [K in AddressClass]: number } = {
  SINGLE_KEY_ACCOUNT: 1,
  POLICY_ACCOUNT: 2,
  MULTI_AUTH_ACCOUNT: 3,
  MACHINE_ACCOUNT: 4,
  INSTITUTIONAL_ACCOUNT: 5,
  WATCH_ONLY_ACCOUNT: 6,
};

export const ADDRESS_ALGORITHMS = [
  'ED25519_V1',
  'HYBRID_SIM_V1',
  'PQ_SIM_V1',
] as const;
export type AddressAlgorithm = (typeof ADDRESS_ALGORITHMS)[number];

export const ADDRESS_ALGORITHM_IDS: { readonly [K in AddressAlgorithm]: number } = {
  ED25519_V1: 1,
  HYBRID_SIM_V1: 2,
  PQ_SIM_V1: 3,
};

export const WALLET_TYPES = [
  'HUMAN',
  'ENTERPRISE',
  'MACHINE',
  'INSTITUTIONAL',
  'WATCH_ONLY',
] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const WALLET_STATUSES = ['ACTIVE', 'LOCKED', 'REVOKED'] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const ACCOUNT_STATUSES = [
  'ACTIVE',
  'RECOVERY_PENDING',
  'SECURITY_RESTRICTED',
  'KEY_ROTATION_PENDING',
  'REVOKED',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const AUTHORIZATION_POLICIES = [
  'SINGLE_SIGNATURE',
  'M_OF_N',
  'ROLE_BASED',
  'OWNER_PLUS_RECOVERY',
  'INSTITUTIONAL_POLICY',
  'MACHINE_MANDATE',
] as const;
export type AuthorizationPolicyKind = (typeof AUTHORIZATION_POLICIES)[number];

export const SIGNER_PROVIDER_CLASSES = [
  'LOCAL_ENCRYPTED_DEVELOPMENT',
  'HARDWARE_SIGNER',
  'REMOTE_SIGNER',
  'HSM_SIGNER',
  'INSTITUTIONAL_SIGNER',
  'PQ_SIGNER',
] as const;
export type SignerProviderClass = (typeof SIGNER_PROVIDER_CLASSES)[number];

export const KEY_LIFECYCLE_STATES = [
  'PENDING',
  'ACTIVE',
  'ROTATION_REGISTERED',
  'HISTORICAL',
  'REVOKED',
] as const;
export type KeyLifecycleState = (typeof KEY_LIFECYCLE_STATES)[number];

export const RECOVERY_KINDS = [
  'OWNER_RECOVERY_KEY',
  'M_OF_N_RECOVERY_GUARDIANS',
  'INSTITUTIONAL_RECOVERY',
  'HARDWARE_BACKUP',
] as const;
export type RecoveryKind = (typeof RECOVERY_KINDS)[number];

export const TX_PROJECTION_STATES = [
  'PENDING_LOCAL',
  'SUBMITTED',
  'FINALIZED',
  'REJECTED',
  'EXPIRED',
] as const;
export type TxProjectionState = (typeof TX_PROJECTION_STATES)[number];

export const WALLET_REJECTION_CODES = [
  'WRONG_NETWORK_ADDRESS',
  'CHECKSUM_FAILURE',
  'WRONG_CHAIN_TRANSACTION',
  'DUPLICATE_SIGNER',
  'UNAUTHORIZED_SIGNER',
  'INSUFFICIENT_M_OF_N',
  'WATCH_ONLY_CANNOT_SIGN',
  'OLD_ROTATED_KEY',
  'RECOVERY_DELAY_ACTIVE',
  'DELEGATED_AMOUNT_LIMIT',
  'DELEGATED_TX_TYPE_LIMIT',
  'MACHINE_MANDATE_BYPASS',
  'CRYPTO_SUITE_DOWNGRADE',
  'ACCOUNT_NOT_ACTIVE',
  'SECURITY_HOLD',
  'KEYSTORE_LOCKED',
  'NONCE_CONFLICT',
  'INSUFFICIENT_BALANCE',
  'PRIVATE_KEY_EXPOSURE',
] as const;
export type WalletRejectionCode = (typeof WALLET_REJECTION_CODES)[number];

export type PublicKeyDescriptor = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly keyId: string;
  readonly suiteId: string;
  readonly algorithm: AddressAlgorithm;
  readonly publicKeyHex: string;
  readonly purpose: 'WALLET_SIGNING' | 'MACHINE_SIGNING' | 'TRANSACTION_SIGNING';
};

export type AccountDescriptor = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly accountId: string;
  readonly addressClass: AddressClass;
  readonly authorizedKeyIds: readonly string[];
  readonly policyKind: AuthorizationPolicyKind;
  readonly threshold: number;
};

export type BlockchainAddress = {
  readonly schemaVersion: typeof ADDRESS_FORMAT_VERSION;
  readonly text: string;
  readonly binaryHex: string;
  readonly networkId: string;
  readonly networkClass: NetworkClass;
  readonly addressClass: AddressClass;
  readonly algorithm: AddressAlgorithm;
  readonly payloadHex: string;
};

export type AuthorizationPolicy = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly kind: AuthorizationPolicyKind;
  readonly threshold: number;
  readonly authorizedKeyIds: readonly string[];
  readonly roleBindings: Readonly<Record<string, readonly string[]>>;
  readonly recoveryKeyIds: readonly string[];
};

export type RecoveryCredentialDescriptor = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly credentialId: string;
  readonly kind: RecoveryKind;
  readonly actorId: string;
  readonly keyId: string;
  readonly publicKeyHex: string;
  readonly grantsEverydaySpend: false;
};

export type RecoveryPolicy = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly policyId: string;
  readonly kind: RecoveryKind;
  readonly threshold: number;
  readonly delayHeights: number;
  readonly ownerMayCancel: boolean;
  readonly credentials: readonly RecoveryCredentialDescriptor[];
};

export type AccountKeyRecord = {
  readonly keyId: string;
  readonly suiteId: string;
  readonly algorithm: AddressAlgorithm;
  readonly publicKeyHex: string;
  readonly purpose: PublicKeyDescriptor['purpose'];
  readonly status: KeyLifecycleState;
  readonly version: number;
  readonly createdHeight: number;
  readonly activatedHeight: number | null;
  readonly revokedHeight: number | null;
  readonly rotatedFrom: string | null;
};

export type DelegatedKeyLimit = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly keyId: string;
  readonly allowedTransactionTypes: readonly TransactionFamily[];
  readonly allowedAsset: NativeAssetId | null;
  readonly maximumAmount: bigint | null;
  readonly maximumTotalAmount: bigint | null;
  readonly spentTotal: bigint;
  readonly expirationHeight: number | null;
  readonly allowedCounterparty: string | null;
  readonly purpose: string;
  readonly feeCeiling: bigint | null;
};

export type BlockchainAccount = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly accountId: string;
  readonly address: BlockchainAddress;
  readonly ownerActorId: string;
  readonly controllerActorIds: readonly string[];
  readonly accountType: AddressClass;
  readonly authorizationPolicy: AuthorizationPolicy;
  readonly nonce: bigint;
  readonly approvedCryptoSuites: readonly string[];
  readonly recoveryPolicyReference: string | null;
  readonly createdHeight: number;
  readonly status: AccountStatus;
  readonly keys: readonly AccountKeyRecord[];
  readonly delegatedLimits: readonly DelegatedKeyLimit[];
  readonly pendingRecovery: PendingRecovery | null;
  readonly pendingRotation: PendingRotation | null;
  readonly securityHoldPolicy: AuthorizationPolicy | null;
};

export type PendingRecovery = {
  readonly requestedHeight: number;
  readonly activationHeight: number;
  readonly nextPrimaryKeyId: string;
  readonly authorizingCredentialIds: readonly string[];
};

export type PendingRotation = {
  readonly requestedHeight: number;
  readonly activationHeight: number;
  readonly nextKeyId: string;
  readonly previousKeyId: string;
};

export type WalletDescriptor = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly walletId: string;
  readonly ownerActorId: string;
  readonly walletType: WalletType;
  readonly networkId: string;
  readonly accountDescriptors: readonly AccountDescriptor[];
  readonly creationVersion: typeof WALLET_SCHEMA_VERSION;
  readonly cryptoPolicy: string;
  readonly recoveryPolicy: string | null;
  readonly status: WalletStatus;
};

export type WalletRejection = {
  readonly ok: false;
  readonly code: WalletRejectionCode;
  readonly detail: string;
};

export type AccountAuthorization = {
  readonly accountId: string;
  readonly transactionBodyHash: string;
  readonly requiredPolicy: AuthorizationPolicy;
  readonly signerKeyIds: readonly string[];
  readonly signatures: readonly WalletSignature[];
};

export type WalletSignature = {
  readonly keyId: string;
  readonly suiteId: string;
  readonly publicKeyHex: string;
  readonly signatureHex: string;
};

export type FeeQuote = {
  readonly estimatedFee: bigint;
  readonly maximumAuthorizedFee: bigint;
  readonly actualFinalizedFee: bigint | null;
  readonly feeAsset: NativeAssetId;
  readonly scheduleHash: string;
};

export type BuiltTransaction = {
  readonly clientTxId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly family: TransactionFamily;
  readonly accountId: string;
  readonly counterpartyAccountId: string | null;
  readonly assetId: NativeAssetId | null;
  readonly amount: bigint | null;
  readonly fee: FeeQuote;
  readonly nonce: bigint;
  readonly bodyHash: string;
  readonly unsignedEnvelope: unknown;
  readonly signBytesHex: string;
};

export type WalletTransactionRecord = {
  readonly txId: string;
  readonly clientTxId: string;
  readonly accountId: string;
  readonly family: TransactionFamily;
  readonly state: TxProjectionState;
  readonly assetId: NativeAssetId | null;
  readonly amount: bigint | null;
  readonly estimatedFee: bigint;
  readonly maximumAuthorizedFee: bigint;
  readonly actualFinalizedFee: bigint | null;
  readonly height: number | null;
  readonly bodyHash: string;
  readonly historicSignatureHex: string | null;
};

export type AddressBookEntry = {
  readonly addressText: string;
  readonly label: string;
  readonly note: string;
};

export type HardwareSignRequest = {
  readonly schemaVersion: typeof WALLET_SCHEMA_VERSION;
  readonly signBytesHex: string;
  readonly transactionSummary: {
    readonly family: TransactionFamily;
    readonly fromAddress: string;
    readonly toAddress: string | null;
    readonly assetId: NativeAssetId | null;
    readonly amount: string | null;
    readonly maxFee: string;
    readonly feeAsset: NativeAssetId;
    readonly networkId: string;
    readonly chainId: string;
  };
  readonly suiteId: string;
};

export type HardwareSignResponse = {
  readonly signatureHex: string;
  readonly publicKeyHex: string;
  readonly suiteId: string;
};

export function isWalletRejection(value: unknown): value is WalletRejection {
  return Boolean(value && typeof value === 'object' && (value as WalletRejection).ok === false);
}
