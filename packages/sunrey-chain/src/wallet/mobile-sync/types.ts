/**
 * Chunk 97 — SunRey mobile wallet synchronization types.
 *
 * Wallet projections are rebuildable and never authoritative over
 * canonical chain state (Chunk 93 RPC/finality). Backend sync servers
 * must not obtain self-custody master private keys. Fiat ledger data
 * stays separate from native chain balances.
 */

export const MOBILE_SYNC_SCHEMA_VERSION = 1 as const;
export const MOBILE_SYNC_API_VERSION = 'v1' as const;
export const MOBILE_SYNC_TOOL_VERSION = 'sunrey-mobile-sync-0' as const;
export const MINIMUM_MOBILE_CLIENT_VERSION = '1.0.0' as const;
export const SUPPORTED_MOBILE_CLIENT_VERSIONS = ['1.0.0', '1.1.0'] as const;
export const PAYMENT_REQUEST_VERSION = 1 as const;
export const DEEP_LINK_SCHEME = 'sunrey' as const;
export const UNIVERSAL_LINK_HOSTS = ['wallet.sunrey.test', 'wallet.sunrey.invalid'] as const;

export const PENDING_TRANSACTION_STATES = [
  'LOCAL_DRAFT',
  'SIGNED_NOT_SUBMITTED',
  'SUBMITTED',
  'MEMPOOL_ACCEPTED',
  'FINALIZED',
  'REJECTED',
  'EXPIRED',
  'SUBMISSION_UNKNOWN',
] as const;
export type PendingTransactionState = (typeof PENDING_TRANSACTION_STATES)[number];

export const WALLET_EVENT_KINDS = [
  'NATIVE_BALANCE',
  'TRANSACTION_HISTORY',
  'PENDING_TRANSACTION',
  'FINALITY',
  'FEE',
  'DELEGATED_KEY',
  'WALLET_SECURITY',
  'EXCHANGE_ACTIVITY',
  'AGENT_MANDATE',
  'FIAT_LEDGER',
] as const;
export type WalletEventKind = (typeof WALLET_EVENT_KINDS)[number];

export const PUSH_EVENT_CATEGORIES = [
  'TRANSACTION_FINALIZED',
  'INCOMING_TRANSFER',
  'WITHDRAWAL_STATE',
  'SECURITY_EVENT',
  'NEW_DEVICE',
  'RECOVERY_REQUEST',
  'DELEGATION_CHANGE',
  'EXCHANGE_ORDER_UPDATE',
  'TRADE_SETTLEMENT',
  'AGENT_MANDATE_ACTION',
] as const;
export type PushEventCategory = (typeof PUSH_EVENT_CATEGORIES)[number];

export const DEVICE_TRUST_STATES = ['PENDING', 'TRUSTED', 'REVOKED', 'COMPROMISED'] as const;
export type DeviceTrustState = (typeof DEVICE_TRUST_STATES)[number];

export const DEVICE_RISK_SIGNALS = [
  'NONE',
  'ROOTED_OR_JAILBROKEN',
  'COMPROMISE_SUSPECTED',
  'UNKNOWN',
] as const;
export type DeviceRiskSignal = (typeof DEVICE_RISK_SIGNALS)[number];

export const PUSH_PROVIDER_CLASSES = ['APNS_COMPATIBLE', 'FCM_COMPATIBLE', 'FUTURE'] as const;
export type PushProviderClass = (typeof PUSH_PROVIDER_CLASSES)[number];

export const SECURE_STORAGE_KINDS = [
  'WALLET_KEY_HANDLE',
  'DELEGATED_SESSION_KEY',
  'AUTHENTICATION_CREDENTIAL',
  'DEVICE_REGISTRATION_CREDENTIAL',
] as const;
export type SecureStorageKind = (typeof SECURE_STORAGE_KINDS)[number];

export const DEEP_LINK_ACTION_CLASSES = [
  'PAYMENT_REQUEST',
  'VIEW_TRANSACTION',
  'OPEN_WALLET',
  'SECURITY_NOTICE',
] as const;
export type DeepLinkActionClass = (typeof DEEP_LINK_ACTION_CLASSES)[number];

export const MOBILE_SYNC_REJECTION_CODES = [
  'DEVICE_NOT_REGISTERED',
  'DEVICE_REVOKED',
  'DEVICE_UNTRUSTED',
  'PUSH_TOKEN_NOT_AUTHORIZATION',
  'CLIENT_VERSION_UNSUPPORTED',
  'CLIENT_UPGRADE_REQUIRED',
  'EVENT_GAP_DETECTED',
  'STALE_DRAFT',
  'WRONG_NETWORK',
  'WRONG_CHAIN',
  'DEEP_LINK_CANNOT_AUTO_SIGN',
  'SELF_CUSTODY_KEY_UNAVAILABLE',
  'MEMPOOL_IS_NOT_FINALITY',
  'DEVICE_CACHE_NOT_AUTHORITATIVE',
  'FIAT_NATIVE_MERGE_FORBIDDEN',
  'DRAFT_IS_NOT_AUTHORIZATION',
  'PAYMENT_REQUEST_PREVIEW_ONLY',
  'SENSITIVE_PUSH_PAYLOAD',
  'SYNC_SERVER_HAS_NO_MASTER_KEY',
] as const;
export type MobileSyncRejectionCode = (typeof MOBILE_SYNC_REJECTION_CODES)[number];

export type MobileSyncRejection = {
  readonly ok: false;
  readonly code: MobileSyncRejectionCode;
  readonly message: string;
};

export type WalletSyncCursor = {
  readonly schemaVersion: typeof MOBILE_SYNC_SCHEMA_VERSION;
  readonly apiVersion: typeof MOBILE_SYNC_API_VERSION;
  readonly networkId: string;
  readonly chainId: string;
  readonly walletId: string;
  readonly finalizedHeight: number;
  readonly projectionSequence: number;
  readonly cursorId: string;
};

export type NativeBalanceProjection = {
  readonly accountId: string;
  readonly assetId: string;
  readonly availableMinorUnits: string;
  readonly reservedMinorUnits: string;
  readonly lockedMinorUnits: string;
  readonly source: 'CANONICAL_CHAIN';
  readonly authoritative: true;
};

export type FiatBalanceProjection = {
  readonly accountId: string;
  readonly currency: string;
  readonly availableMinorUnits: string;
  readonly source: 'CANONICAL_LEDGER_API';
  readonly mergedWithNative: false;
};

export type WalletStateProjection = {
  readonly schemaVersion: typeof MOBILE_SYNC_SCHEMA_VERSION;
  readonly walletId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly finalizedHeight: number;
  readonly projectionSequence: number;
  readonly nativeBalances: readonly NativeBalanceProjection[];
  readonly fiatBalances: readonly FiatBalanceProjection[];
  readonly pendingTransactionIds: readonly string[];
  readonly delegatedKeyIds: readonly string[];
  readonly securityEventIds: readonly string[];
  readonly exchangeActivityIds: readonly string[];
  readonly agentMandateIds: readonly string[];
  readonly rebuildable: true;
  readonly authoritative: false;
  readonly deviceCacheAuthoritative: false;
};

export type WalletSyncSnapshot = {
  readonly schemaVersion: typeof MOBILE_SYNC_SCHEMA_VERSION;
  readonly snapshotId: string;
  readonly cursor: WalletSyncCursor;
  readonly projection: WalletStateProjection;
  readonly eventsThroughSequence: number;
  readonly createdAtUtc: string;
  readonly source: 'CANONICAL_CHAIN_APIS';
};

export type WalletEventEnvelope = {
  readonly schemaVersion: typeof MOBILE_SYNC_SCHEMA_VERSION;
  readonly apiVersion: typeof MOBILE_SYNC_API_VERSION;
  readonly eventId: string;
  readonly sequence: number;
  readonly kind: WalletEventKind;
  readonly walletId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly finalizedHeight: number | null;
  readonly occurredAtUtc: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type WalletEventStream = {
  readonly walletId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
  readonly events: readonly WalletEventEnvelope[];
  readonly gapDetected: boolean;
  readonly missingSequences: readonly number[];
};

export type WalletPendingTransaction = {
  readonly transactionId: string;
  readonly clientTxId: string;
  readonly walletId: string;
  readonly accountId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly state: PendingTransactionState;
  readonly bodyHash: string;
  readonly nonce: string;
  readonly feeAuthorizedMinorUnits: string;
  readonly mempoolAcceptanceIsFinality: false;
  readonly uiFinalized: boolean;
};

export type OfflineTransactionDraft = {
  readonly draftId: string;
  readonly walletId: string;
  readonly accountId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly nonce: string;
  readonly feeAuthorizedMinorUnits: string;
  readonly canonicalTransactionBytesHex: string;
  readonly policySnapshotHash: string;
  readonly networkInfoCapturedAtUtc: string;
  readonly expiresAtUtc: string;
  readonly authorization: false;
  readonly signed: boolean;
};

export type OfflineSignedPayload = {
  readonly draftId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly nonce: string;
  readonly feeAuthorization: string;
  readonly canonicalTransactionBytesHex: string;
  readonly signatureHex: string;
  readonly signedOffline: true;
};

export type MobileDeviceRegistration = {
  readonly registrationId: string;
  readonly deviceId: string;
  readonly walletId: string;
  readonly platform: 'IOS' | 'ANDROID' | 'REFERENCE_HARNESS';
  readonly trustState: DeviceTrustState;
  readonly riskSignal: DeviceRiskSignal;
  readonly registeredAtUtc: string;
  readonly source: 'CHUNK_96_WALLET_SECURITY' | 'SIMULATION_ADAPTER';
};

export type MobileNotificationSubscription = {
  readonly subscriptionId: string;
  readonly deviceId: string;
  readonly walletId: string;
  readonly providerClass: PushProviderClass;
  readonly pushToken: string;
  readonly categories: readonly PushEventCategory[];
  readonly securityCriticalAlwaysOn: boolean;
  readonly pushTokenIsAuthorization: false;
};

export type MobilePushEvent = {
  readonly pushId: string;
  readonly category: PushEventCategory;
  readonly title: string;
  readonly body: string;
  readonly retrievalHint: string;
  readonly sensitiveDetailIncluded: false;
  readonly seedPhrase: false;
  readonly privateKey: false;
  readonly kycPayload: false;
  readonly rawPersonalData: false;
  readonly sensitiveAccountDetails: false;
};

export type MobileSyncHealth = {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly walletId: string;
  readonly online: boolean;
  readonly lastSuccessfulSyncUtc: string | null;
  readonly lastCursor: WalletSyncCursor | null;
  readonly rpcHealth: 'HEALTHY' | 'DEGRADED' | 'FAILOVER' | 'DOWN';
  readonly eventGap: boolean;
  readonly upgradeRequired: boolean;
};

export type WalletSyncSession = {
  readonly sessionId: string;
  readonly walletId: string;
  readonly deviceId: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly clientVersion: string;
  readonly apiVersion: typeof MOBILE_SYNC_API_VERSION;
  readonly authenticated: boolean;
  readonly createdAtUtc: string;
};

export type WalletSyncReport = {
  readonly schemaVersion: typeof MOBILE_SYNC_SCHEMA_VERSION;
  readonly toolVersion: typeof MOBILE_SYNC_TOOL_VERSION;
  readonly sessions: number;
  readonly devices: number;
  readonly snapshots: number;
  readonly events: number;
  readonly pending: number;
  readonly drafts: number;
  readonly pushDeliveries: number;
  readonly selfCustodyKeyOnSyncServer: false;
  readonly mempoolPresentedAsFinality: false;
  readonly deviceCacheAuthoritative: false;
  readonly fiatMergedWithNative: false;
};

export type PublicNetworkStatusView = {
  readonly networkId: string;
  readonly chainId: string;
  readonly release: string;
  readonly finalizedHeight: number;
  readonly rpcStatus: 'HEALTHY' | 'DEGRADED' | 'FAILOVER' | 'DOWN';
  readonly environment: 'simulation';
};

export type ClientCompatibilityDecision = {
  readonly allowed: boolean;
  readonly compatibility: 'BACKWARD_COMPATIBLE' | 'UPGRADE_REQUIRED' | 'UNSUPPORTED';
  readonly minimumVersion: typeof MINIMUM_MOBILE_CLIENT_VERSION;
  readonly currentApiVersion: typeof MOBILE_SYNC_API_VERSION;
  readonly reason: string;
};

export type StaleDraftCheck = {
  readonly draftId: string;
  readonly stale: boolean;
  readonly reasons: readonly string[];
};

export function isMobileSyncRejection(value: unknown): value is MobileSyncRejection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    (value as { ok: unknown }).ok === false &&
    'code' in value
  );
}

export function reject(code: MobileSyncRejectionCode, message: string): MobileSyncRejection {
  return Object.freeze({ ok: false, code, message });
}
