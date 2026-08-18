/**
 * Chunk 94 developer-platform domain types.
 *
 * Developer credentials are not user signing authority. Production
 * application registration does not activate SunRey production financial
 * capabilities. Sandbox identities stay non-production.
 */

export const APPLICATION_ENVIRONMENTS = ['LOCAL', 'TESTNET', 'SANDBOX', 'PRODUCTION'] as const;
export type ApplicationEnvironment = (typeof APPLICATION_ENVIRONMENTS)[number];

export const APPLICATION_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'PENDING_PRODUCTION_APPROVAL',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const DEVELOPER_ROLES = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'] as const;
export type DeveloperRole = (typeof DEVELOPER_ROLES)[number];

export const PROTOCOL_GOVERNANCE_ROLES = [
  'PROTOCOL_GOVERNOR',
  'VALIDATOR_OPERATOR',
  'TREASURY_SIGNER',
  'EMERGENCY_COUNCIL',
] as const;
export type ProtocolGovernanceRole = (typeof PROTOCOL_GOVERNANCE_ROLES)[number];

export const DEVELOPER_SCOPES = [
  'CHAIN_READ',
  'TRANSACTION_SUBMIT',
  'WALLET_READ_PUBLIC',
  'WEBHOOK_MANAGE',
  'MARKET_DATA_READ',
  'ORACLE_PUBLIC_READ',
  'MACHINE_PUBLIC_READ',
  'GOVERNANCE_PUBLIC_READ',
  'VALIDATOR_PUBLIC_READ',
  'MONETARY_PUBLIC_READ',
  'FAUCET_REQUEST',
  'SANDBOX_MANAGE',
] as const;
export type DeveloperPermission = (typeof DEVELOPER_SCOPES)[number];

export const CREDENTIAL_KINDS = ['SERVER_SECRET', 'PUBLIC_CLIENT'] as const;
export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

export const CREDENTIAL_STATUSES = ['ACTIVE', 'REVOKED', 'ROTATED'] as const;
export type CredentialStatus = (typeof CREDENTIAL_STATUSES)[number];

export const WEBHOOK_EVENT_TYPES = [
  'transaction.finalized',
  'deposit.detected',
  'withdrawal.state_changed',
  'exchange.order.state_changed',
  'exchange.trade.finalized',
  'governance.event',
  'validator.event',
  'moonrey.issuance.receipt',
  'machine.commerce.settlement',
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_DELIVERY_STATES = ['PENDING', 'DELIVERED', 'RETRYING', 'PERMANENTLY_FAILED'] as const;
export type WebhookDeliveryState = (typeof WEBHOOK_DELIVERY_STATES)[number];

export const IDENTITY_CLASSES = ['SANDBOX', 'TESTNET', 'PRODUCTION'] as const;
export type IdentityClass = (typeof IDENTITY_CLASSES)[number];

export type DeveloperAccount = {
  readonly accountId: string;
  readonly email: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly status: 'ACTIVE' | 'SUSPENDED';
};

export type DeveloperOrganization = {
  readonly organizationId: string;
  readonly name: string;
  readonly ownerAccountId: string;
  readonly createdAt: string;
};

export type OrganizationMembership = {
  readonly organizationId: string;
  readonly accountId: string;
  readonly role: DeveloperRole;
};

export type RedirectMetadata = {
  readonly redirectUris: readonly string[];
  readonly callbackUris: readonly string[];
};

export type DeveloperApplication = {
  readonly appId: string;
  readonly organizationId: string;
  readonly name: string;
  readonly environment: ApplicationEnvironment;
  readonly status: ApplicationStatus;
  readonly permissions: readonly DeveloperPermission[];
  readonly redirect: RedirectMetadata;
  readonly productionFinancialCapabilitiesActivated: false;
  readonly createdAt: string;
};

export type DeveloperApiCredential = {
  readonly credentialId: string;
  readonly appId: string;
  readonly kind: CredentialKind;
  readonly publicKeyId: string;
  readonly secretHash: string;
  readonly secretHint: string;
  readonly scopes: readonly DeveloperPermission[];
  readonly status: CredentialStatus;
  readonly environment: ApplicationEnvironment;
  readonly createdAt: string;
  readonly revokedAt: string | null;
};

export type RevealedCredential = {
  readonly credential: DeveloperApiCredential;
  readonly plaintextSecret: string;
  readonly revealedOnce: true;
};

export type DeveloperQuota = {
  readonly quotaId: string;
  readonly appId: string;
  readonly environment: ApplicationEnvironment;
  readonly scope: DeveloperPermission | 'ALL';
  readonly requestLimit: number;
  readonly resourceCostLimit: number;
  readonly faucetQuantityLimit: bigint;
  readonly windowMs: number;
};

export type DeveloperUsageRecord = {
  readonly usageId: string;
  readonly appId: string;
  readonly environment: ApplicationEnvironment;
  readonly scope: DeveloperPermission;
  readonly requestCount: number;
  readonly resourceCost: number;
  readonly errorCount: number;
  readonly webhookDeliveries: number;
  readonly rateLimitState: 'OK' | 'THROTTLED' | 'EXCEEDED';
  readonly recordedAt: string;
};

export type WebhookEndpoint = {
  readonly endpointId: string;
  readonly appId: string;
  readonly url: string;
  readonly events: readonly WebhookEventType[];
  readonly signingKeyHash: string;
  readonly signingKeyHint: string;
  readonly schemeVersion: 'sunrey-webhook-v1';
  readonly active: boolean;
  readonly createdAt: string;
};

export type WebhookSubscription = {
  readonly subscriptionId: string;
  readonly endpointId: string;
  readonly appId: string;
  readonly eventType: WebhookEventType;
};

export type WebhookRetryPolicy = {
  readonly maxAttempts: number;
  readonly backoffMs: readonly number[];
  readonly infinite: false;
};

export type WebhookDelivery = {
  readonly deliveryId: string;
  readonly eventId: string;
  readonly endpointId: string;
  readonly appId: string;
  readonly eventType: WebhookEventType;
  readonly timestamp: string;
  readonly attempt: number;
  readonly state: WebhookDeliveryState;
  readonly signature: string;
  readonly bodyHash: string;
};

export type SandboxAccount = {
  readonly sandboxId: string;
  readonly appId: string;
  readonly label: string;
  readonly identityClass: 'SANDBOX';
  readonly productionEligible: false;
  readonly environment: 'SANDBOX' | 'LOCAL';
  readonly walletAccountId: string;
  readonly sunreyCoinAccountId: string;
  readonly moonreyCoinAccountId: string;
  readonly machineId: string;
  readonly exchangeFixtureId: string;
  readonly oracleFixtureId: string;
  readonly createdAt: string;
};

export type DeveloperAuditEntry = {
  readonly auditId: string;
  readonly at: string;
  readonly actorAccountId: string;
  readonly organizationId: string;
  readonly action: string;
  readonly targetId: string;
  readonly details: Readonly<Record<string, string>>;
};

export type TestnetStatusSnapshot = {
  readonly network: string;
  readonly chain: string;
  readonly faucetAvailability: 'UP' | 'DOWN' | 'EMPTY';
  readonly rpcStatus: 'UP' | 'DOWN';
  readonly explorerStatus: 'UP' | 'DOWN' | 'LAGGING';
  readonly environment: 'simulation';
  readonly productionFinancialCapabilitiesActivated: false;
};

export type ApiDeprecation = {
  readonly path: string;
  readonly version: string;
  readonly compatibility: 'DEPRECATED';
  readonly successor: string | null;
  readonly sunsetAt: string | null;
};

export const DEFAULT_WEBHOOK_RETRY_POLICY: WebhookRetryPolicy = Object.freeze({
  maxAttempts: 5,
  backoffMs: Object.freeze([1_000, 4_000, 16_000, 64_000]),
  infinite: false,
});

export const WEBHOOK_SIGNING_SCHEME = 'sunrey-webhook-v1' as const;

export const SCOPE_REQUIRED_EVENTS: Readonly<Record<WebhookEventType, DeveloperPermission>> = Object.freeze({
  'transaction.finalized': 'CHAIN_READ',
  'deposit.detected': 'WALLET_READ_PUBLIC',
  'withdrawal.state_changed': 'WALLET_READ_PUBLIC',
  'exchange.order.state_changed': 'MARKET_DATA_READ',
  'exchange.trade.finalized': 'MARKET_DATA_READ',
  'governance.event': 'GOVERNANCE_PUBLIC_READ',
  'validator.event': 'VALIDATOR_PUBLIC_READ',
  'moonrey.issuance.receipt': 'MONETARY_PUBLIC_READ',
  'machine.commerce.settlement': 'MACHINE_PUBLIC_READ',
});

export function isDeveloperRole(value: string): value is DeveloperRole {
  return (DEVELOPER_ROLES as readonly string[]).includes(value);
}

export function isProtocolGovernanceRole(value: string): value is ProtocolGovernanceRole {
  return (PROTOCOL_GOVERNANCE_ROLES as readonly string[]).includes(value);
}

export function isDeveloperScope(value: string): value is DeveloperPermission {
  return (DEVELOPER_SCOPES as readonly string[]).includes(value);
}
