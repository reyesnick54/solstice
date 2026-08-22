/**
 * Phase D Prompt 1 — universal production provider runtime types.
 *
 * Extends Chunk 91 (`packages/sunrey-chain/src/provider-runtime`).
 * Not a second provider package, ledger, Kernel, or Execution Authority.
 * PRODUCTION remains disabled. LIVE_* stay false.
 */

import type { SecretReference } from '../../../../security/src/secrets.ts';

export const UNIVERSAL_PROVIDER_RUNTIME_SCHEMA_VERSION = 1 as const;
export const UNIVERSAL_PROVIDER_RUNTIME_ID = 'sunrey-universal-provider-runtime' as const;
export const PRODUCTION_READY = false as const;
export const PRODUCTION_ACTIVE = false as const;
export const LIVE_CONNECTIVITY_ENABLED = false as const;
export const production_authorized = false as const;

export const PROVIDER_LIFECYCLE_STATES = [
  'DISABLED',
  'SIMULATED',
  'SANDBOX',
  'CERTIFICATION',
  'PREPRODUCTION',
  'LIMITED_LIVE',
  'PRODUCTION',
  'SUSPENDED',
] as const;
export type ProviderLifecycleState = (typeof PROVIDER_LIFECYCLE_STATES)[number];

export const PROVIDER_ENVIRONMENTS = [
  'LOCAL',
  'TEST',
  'SANDBOX',
  'STAGING',
  'PREPRODUCTION',
  'PRODUCTION',
] as const;
export type ProviderEnvironment = (typeof PROVIDER_ENVIRONMENTS)[number];

export const PROVIDER_CATEGORIES = [
  'BANKING',
  'PAYMENTS',
  'FX',
  'CARDS',
  'IDENTITY',
  'KYC',
  'KYB',
  'AML',
  'SANCTIONS',
  'FRAUD',
  'TRAVEL_RULE',
  'CUSTODY',
  'BLOCKCHAIN_ANALYTICS',
  'MARKET_DATA',
  'ORACLE',
] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export const PROVIDER_CAPABILITIES = [
  'BANK.ACCOUNTS',
  'BANK.STATEMENTS',
  'BANK.TRANSFERS',
  'BANK.BALANCES',
  'PAYMENT.ACH',
  'PAYMENT.WIRE',
  'PAYMENT.RTP',
  'PAYMENT.SEPA',
  'PAYMENT.SWIFT',
  'PAYMENT.SAR',
  'FX.QUOTE',
  'FX.EXECUTE',
  'FX.CANCEL',
  'FX.STATUS',
  'CARD.VIRTUAL_ISSUING',
  'CARD.PHYSICAL_ISSUING',
  'CARD.AUTHORIZATION',
  'CARD.WALLET_PROVISIONING',
  'IDENTITY.SESSION',
  'KYC.DOCUMENT_VERIFICATION',
  'KYC.IDENTITY_VERIFICATION',
  'KYB.BUSINESS_VERIFICATION',
  'AML.TRANSACTION_MONITORING',
  'SANCTIONS.SCREENING',
  'FRAUD.SCORE',
  'TRAVEL_RULE.SUBMIT',
  'CUSTODY.WALLET',
  'CUSTODY.DEPOSIT',
  'CUSTODY.WITHDRAWAL',
  'CUSTODY.SIGNING',
  'BLOCKCHAIN_ANALYTICS.SCREEN',
  'MARKET_DATA.QUOTE',
  'ORACLE.FACT_INGEST',
] as const;
export type ProviderCapabilityId = (typeof PROVIDER_CAPABILITIES)[number];

export const PROVIDER_HEALTH_STATES = [
  'HEALTHY',
  'DEGRADED',
  'UNAVAILABLE',
  'RATE_LIMITED',
  'MAINTENANCE',
  'UNKNOWN',
] as const;
export type ProviderHealthState = (typeof PROVIDER_HEALTH_STATES)[number];

export const CIRCUIT_STATES = ['CLOSED', 'OPEN', 'HALF_OPEN'] as const;
export type CircuitState = (typeof CIRCUIT_STATES)[number];

export const RETRY_CLASSES = ['READ', 'IDEMPOTENT_MUTATION', 'NON_IDEMPOTENT_MUTATION'] as const;
export type RetryClass = (typeof RETRY_CLASSES)[number];

export const FAILOVER_SAFETY = [
  'SAFE_TO_FAILOVER',
  'NOT_SAFE_TO_FAILOVER',
  'REQUIRES_RECONCILIATION',
] as const;
export type FailoverSafety = (typeof FAILOVER_SAFETY)[number];

export const PROVIDER_ERROR_CODES = [
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_REJECTED',
  'PROVIDER_AUTH_FAILED',
  'PROVIDER_VALIDATION_FAILED',
  'PROVIDER_PENDING',
  'PROVIDER_UNKNOWN_STATUS',
  'PROVIDER_CONFIGURATION_ERROR',
  'PROVIDER_LIFECYCLE_FORBIDDEN',
  'PROVIDER_ENVIRONMENT_MISMATCH',
  'PROVIDER_CREDENTIAL_REDACTED',
  'PROVIDER_KILL_SWITCH',
  'PROVIDER_NOT_REGISTERED',
  'PROVIDER_CAPABILITY_UNSUPPORTED',
  'PROVIDER_CERTIFICATION_INSUFFICIENT',
  'PROVIDER_ROUTE_UNAVAILABLE',
] as const;
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export const CERTIFICATION_DISTINCTIONS = [
  'UNTESTED',
  'INTERNAL_ADAPTER_TESTED',
  'EXTERNAL_PROVIDER_CERTIFIED',
] as const;
export type CertificationDistinction = (typeof CERTIFICATION_DISTINCTIONS)[number];

export const LIFECYCLE_ACTOR_KINDS = [
  'HUMAN_OPERATOR',
  'SYSTEM',
  'API',
  'AGENT',
  'FRONTEND',
  'ENVIRONMENT_VARIABLE',
] as const;
export type LifecycleActorKind = (typeof LIFECYCLE_ACTOR_KINDS)[number];

export const KILL_SWITCH_SCOPES = [
  'PROVIDER',
  'CAPABILITY',
  'JURISDICTION',
  'PRODUCT',
  'OUTBOUND_MUTATIONS',
] as const;
export type KillSwitchScope = (typeof KILL_SWITCH_SCOPES)[number];

export const MIN_TIMEOUT_MS = 50;
export const MAX_TIMEOUT_MS = 30_000;
export const DEFAULT_TIMEOUT_MS = 3_000;
export const DEFAULT_CIRCUIT_FAILURES = 3;
export const DEFAULT_CIRCUIT_COOLDOWN_MS = 5_000;

export type UniversalError = {
  readonly code: ProviderErrorCode | string;
  readonly message: string;
  readonly providerId?: string;
  readonly providerReference?: string;
  readonly safeToDisplay: false;
};

export type UniversalResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: UniversalError };

export function universalOk<T>(value: T): UniversalResult<T> {
  return Object.freeze({ ok: true, value });
}

export function universalErr(
  code: ProviderErrorCode | string,
  message: string,
  extras: { readonly providerId?: string; readonly providerReference?: string } = {},
): UniversalResult<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code,
      message,
      ...(extras.providerId ? { providerId: extras.providerId } : {}),
      ...(extras.providerReference ? { providerReference: extras.providerReference } : {}),
      safeToDisplay: false as const,
    }),
  });
}

export function isProviderLifecycleState(value: string): value is ProviderLifecycleState {
  return (PROVIDER_LIFECYCLE_STATES as readonly string[]).includes(value);
}

export function isProviderEnvironment(value: string): value is ProviderEnvironment {
  return (PROVIDER_ENVIRONMENTS as readonly string[]).includes(value);
}

export function isProviderCategory(value: string): value is ProviderCategory {
  return (PROVIDER_CATEGORIES as readonly string[]).includes(value);
}

export function isProviderCapabilityId(value: string): value is ProviderCapabilityId {
  return (PROVIDER_CAPABILITIES as readonly string[]).includes(value);
}

export type ProviderCredentialRef = {
  readonly providerId: string;
  readonly secretReference: SecretReference;
  readonly keyVersion: string;
  readonly environment: ProviderEnvironment;
  readonly rawCredentialPresent: false;
};

export type ProviderWebhookConfiguration = {
  readonly verificationAdapterId: string;
  readonly replayWindowMs: number;
  readonly environment: ProviderEnvironment;
  readonly persistRawEvidence: boolean;
};

export type ProviderHealthPolicy = {
  readonly timeoutMs: number;
  readonly openAfterFailures: number;
  readonly cooldownMs: number;
  readonly rateLimitPerMinute: number | null;
};

export type ProviderRegistration = {
  readonly providerId: string;
  readonly providerType: ProviderCategory;
  readonly displayName: string;
  readonly adapterId: string;
  readonly capabilities: readonly ProviderCapabilityId[];
  readonly environment: ProviderEnvironment;
  readonly lifecycleState: ProviderLifecycleState;
  readonly enabledJurisdictions: readonly string[];
  readonly supportedCurrencies: readonly string[];
  readonly supportedProducts: readonly string[];
  readonly credentialReference: ProviderCredentialRef | null;
  readonly webhookConfiguration: ProviderWebhookConfiguration | null;
  readonly healthPolicy: ProviderHealthPolicy;
  readonly routingPriority: number;
  readonly certificationState: CertificationDistinction;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly rawCredentialPresent: false;
};

export type RegisterProviderInput = {
  readonly providerId: string;
  readonly providerType: ProviderCategory;
  readonly displayName: string;
  readonly adapterId: string;
  readonly capabilities: readonly ProviderCapabilityId[];
  readonly environment: ProviderEnvironment;
  readonly lifecycleState?: ProviderLifecycleState;
  readonly enabledJurisdictions?: readonly string[];
  readonly supportedCurrencies?: readonly string[];
  readonly supportedProducts?: readonly string[];
  readonly credentialReference?: ProviderCredentialRef | null;
  readonly webhookConfiguration?: ProviderWebhookConfiguration | null;
  readonly healthPolicy?: Partial<ProviderHealthPolicy>;
  readonly routingPriority?: number;
  readonly nowUtc: string;
};

export type LifecycleTransitionRequest = {
  readonly providerId: string;
  readonly to: ProviderLifecycleState;
  readonly actorKind: LifecycleActorKind;
  readonly actorId: string;
  readonly nowUtc: string;
  readonly configurationComplete?: boolean;
  readonly testSuiteReady?: boolean;
  readonly certificationEvidenceRefs?: readonly string[];
  readonly humanAuthorizationId?: string;
  readonly productionAuthorizationId?: string;
  readonly externalGateRefs?: readonly string[];
};

export type ProviderHealthRecord = {
  readonly providerId: string;
  readonly state: ProviderHealthState;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly latencyMs: number | null;
  readonly errorRate: number;
  readonly consecutiveFailures: number;
  readonly rateLimited: boolean;
  readonly circuitState: CircuitState;
  readonly updatedAt: string;
};

export type KillSwitchRecord = {
  readonly switchId: string;
  readonly providerId: string;
  readonly scope: KillSwitchScope;
  readonly target: string;
  readonly active: boolean;
  readonly allowReadOnlyReconciliation: boolean;
  readonly actorId: string;
  readonly reason: string;
  readonly createdAt: string;
  readonly frontendExposed: false;
};

export type ProviderCertificationRecord = {
  readonly certificationId: string;
  readonly providerId: string;
  readonly adapterVersion: string;
  readonly environment: ProviderEnvironment;
  readonly testSuiteVersion: string;
  readonly testDateUtc: string;
  readonly result: 'PASS' | 'FAIL';
  readonly distinction: CertificationDistinction;
  readonly evidenceRefs: readonly string[];
  readonly approvedBy: string | null;
  readonly approvedAtUtc: string | null;
  readonly expiresAtUtc: string | null;
  readonly unitTestsAreNotExternalCertification: true;
};

export type LimitedLiveRule = {
  readonly ruleId: string;
  readonly providerId: string;
  readonly allowlistedCustomers: readonly string[];
  readonly jurisdictions: readonly string[];
  readonly currencies: readonly string[];
  readonly maxTransactionMinor: bigint | null;
  readonly dailyAggregateCapMinor: bigint | null;
  readonly products: readonly string[];
  readonly activated: false;
};

export type RoutingInquiry = {
  readonly capability: ProviderCapabilityId;
  readonly jurisdiction?: string;
  readonly currency?: string;
  readonly product?: string;
  readonly customerId?: string;
  readonly amountMinor?: bigint;
  readonly environment: ProviderEnvironment;
  readonly nowUtc: string;
};

export type RoutingDecision = {
  readonly selectedProviderId: string;
  readonly candidates: readonly string[];
  readonly reason: string;
  readonly deterministic: true;
  readonly auditable: true;
  readonly aiChoseFreely: false;
};

export type FailoverInquiry = {
  readonly operation: 'MARKET_DATA_READ' | 'FX_QUOTE_BEFORE_ACCEPT' | 'BANK_PAYMENT_SUBMIT' | 'STATUS_UNKNOWN';
  readonly submissionState: 'NOT_SUBMITTED' | 'SUBMITTED' | 'UNKNOWN';
};

export type FailoverDecision = {
  readonly safety: FailoverSafety;
  readonly reason: string;
};

export type ProviderEvidenceRecord = {
  readonly evidenceId: string;
  readonly providerId: string;
  readonly operation: string;
  readonly requestRef: string;
  readonly responseRef: string;
  readonly timestamps: { readonly startedAt: string; readonly endedAt: string };
  readonly environment: ProviderEnvironment;
  readonly routingDecision: string | null;
  readonly result: string;
  readonly correlationId: string;
  readonly providerTransactionId: string | null;
  readonly secretPresent: false;
  readonly panPresent: false;
  readonly privateKeyPresent: false;
  readonly prohibitedKycPresent: false;
};

export type NormalizedWebhookEvent = {
  readonly providerId: string;
  readonly eventType: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly payloadDigest: string;
  readonly environment: ProviderEnvironment;
  readonly duplicate: boolean;
  readonly domainAuthorityBypassed: false;
};

export type OperationsProviderView = {
  readonly providerId: string;
  readonly providerType: ProviderCategory;
  readonly lifecycle: ProviderLifecycleState;
  readonly health: ProviderHealthState;
  readonly capabilities: readonly ProviderCapabilityId[];
  readonly lastRequestAt: string | null;
  readonly errorRate: number;
  readonly circuitState: CircuitState;
  readonly certification: CertificationDistinction;
  readonly environment: ProviderEnvironment;
  readonly customerBffExposed: false;
};

export type BffFeatureKey = 'payments' | 'fx' | 'cards';

export type FeatureAvailability = {
  readonly feature: BffFeatureKey;
  readonly enabled: boolean;
  readonly sandbox: boolean;
  readonly providerConfigured: boolean;
  readonly lifecycleSufficient: boolean;
  readonly healthy: boolean;
  readonly reason: string;
};

export type UniversalProviderSnapshot = {
  readonly schemaVersion: typeof UNIVERSAL_PROVIDER_RUNTIME_SCHEMA_VERSION;
  readonly secretsForbidden: true;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly productionAuthorized: false;
  readonly registrations: readonly ProviderRegistration[];
  readonly health: readonly ProviderHealthRecord[];
  readonly certifications: readonly ProviderCertificationRecord[];
  readonly killSwitches: readonly KillSwitchRecord[];
  readonly limitedLiveRules: readonly LimitedLiveRule[];
  readonly evidence: readonly ProviderEvidenceRecord[];
  readonly routingDecisions: readonly RoutingDecision[];
};

export const EMPTY_UNIVERSAL_SNAPSHOT: UniversalProviderSnapshot = Object.freeze({
  schemaVersion: UNIVERSAL_PROVIDER_RUNTIME_SCHEMA_VERSION,
  secretsForbidden: true,
  productionActive: false,
  liveConnectivityEnabled: false,
  productionAuthorized: false,
  registrations: Object.freeze([]),
  health: Object.freeze([]),
  certifications: Object.freeze([]),
  killSwitches: Object.freeze([]),
  limitedLiveRules: Object.freeze([]),
  evidence: Object.freeze([]),
  routingDecisions: Object.freeze([]),
});
