/**
 * Chunk 151 — production-candidate types for banking, payment-rail,
 * and FX provider integration.
 *
 * Sandbox / fixture architecture only. These types do not grant
 * network membership, regulatory authorization, or live connectivity.
 */

import type { SecretReference } from '../../../security/src/secrets.ts';
import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { Money } from '../../../money/src/money.ts';
import type { RailClass, RailDirection, SettlementClass } from '../rail-types.ts';

export const BANKING_PAYMENT_PROVIDER_CANDIDATE_ID = 'sunrey-banking-payment-provider-candidates' as const;
export const BANKING_PAYMENT_PROVIDER_CANDIDATE_VERSION = 'chunk-151/1' as const;

export const PROVIDER_CANDIDATE_STATES = [
  'DRAFT',
  'SANDBOX_READY',
  'ENGINEERING_TESTED',
  'EXTERNAL_EVIDENCE_REQUIRED',
  'PRODUCTION_CANDIDATE_DISABLED',
  'SUSPENDED',
  'REVOKED',
] as const;
export type ProviderCandidateState = (typeof PROVIDER_CANDIDATE_STATES)[number];

export const ACCOUNT_REFERENCE_CLASSES = [
  'EXTERNAL_ACCOUNT_ID',
  'ROUTING_ACCOUNT_COORDINATE',
  'ACCOUNT_LIFECYCLE',
] as const;
export type AccountReferenceClass = (typeof ACCOUNT_REFERENCE_CLASSES)[number];

export const FX_PRICE_SOURCE_CLASSES = [
  'FIXTURE_BOOK',
  'SANDBOX_PROVIDER',
  'EXTERNAL_CANDIDATE',
] as const;
export type FxPriceSourceClass = (typeof FX_PRICE_SOURCE_CLASSES)[number];

export const FX_LIQUIDITY_CLASSES = [
  'INDICATIVE',
  'FIRM_SANDBOX',
  'UNAVAILABLE',
] as const;
export type FxLiquidityClass = (typeof FX_LIQUIDITY_CLASSES)[number];

export const EXPECTED_FINALITY_CLASSES = [
  'SAME_DAY',
  'NEXT_DAY',
  'INSTANT_ENGINEERING',
  'CORRESPONDENT_MULTI_DAY',
] as const;
export type ExpectedFinalityClass = (typeof EXPECTED_FINALITY_CLASSES)[number];

export const CANDIDATE_RECONCILIATION_OUTCOMES = [
  'MATCHED',
  'PENDING',
  'PROVIDER_MISSING',
  'INTERNAL_MISSING',
  'AMOUNT_MISMATCH',
  'STATUS_MISMATCH',
  'DUPLICATE_EXTERNAL',
  'SUBMISSION_UNKNOWN',
  'REVIEW_REQUIRED',
] as const;
export type CandidateReconciliationOutcome = (typeof CANDIDATE_RECONCILIATION_OUTCOMES)[number];

export const FX_UNAVAILABLE_REASONS = [
  'PROVIDER_UNAVAILABLE',
  'STALE_QUOTE',
  'AUTH_FAILED',
  'RATE_LIMITED',
  'SCHEMA_INCOMPATIBLE',
  'FLOAT_REJECTED',
  'UNREPRESENTABLE_RATE',
  'CURRENCY_MISMATCH',
  'EXPIRED',
] as const;
export type FxUnavailableReason = (typeof FX_UNAVAILABLE_REASONS)[number];

export type EvidenceRef = {
  readonly refId: string;
  readonly class: string;
  readonly slotPresenceIsProof: false;
};

export type CredentialDescriptorRef = {
  readonly descriptorId: string;
  readonly plane: 'CHUNK_149_PROVIDER_CREDENTIAL_PLANE';
  readonly secretRef: SecretReference;
  readonly plaintextCredential: false;
};

export type ProviderAcceptanceRef = {
  readonly domain: 'BANKING_REFERENCE' | 'PAYMENT_RAIL' | 'FX_LIQUIDITY';
  readonly providerId: string;
  readonly recordId: string;
};

export type EndpointProfileRef = {
  readonly profileId: string;
  readonly sandboxOnly: true;
  readonly liveEndpoint: false;
};

export type WebhookProfileRef = {
  readonly profileId: string;
  readonly signatureRequired: true;
  readonly timestampWindowRequired: true;
  readonly nonceReplayProtection: true;
};

export type SettlementReportProfileRef = {
  readonly profileId: string;
  readonly isLedgerSourceOfTruth: false;
};

export type DataResidencyRef = {
  readonly refId: string;
  readonly legalConclusion: false;
};

export type NamedNetworkAccessClaim = {
  readonly claimedNetworkName: string;
  readonly engineeringRailClass: RailClass;
  readonly externalEvidenceRequired: true;
  readonly railClassProvesMembership: false;
};

export type BaasAccountReference = {
  readonly externalAccountId: string;
  readonly routingCoordinateRef: string;
  readonly lifecycleRef: string;
  readonly isCanonicalLedgerBalance: false;
};

export type ProviderOperationalBalance = {
  readonly providerId: string;
  readonly amount: Money;
  readonly currency: CurrencyCode;
  readonly asOf: UtcInstant;
  readonly use: 'TREASURY_RECONCILIATION' | 'LIQUIDITY_EVIDENCE' | 'SETTLEMENT_HEALTH';
  readonly isCustomerLedgerBalance: false;
};

export type ExactRational = {
  readonly numerator: bigint;
  readonly denominator: bigint;
};

export type CandidateFxPair = {
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
};

export type ProductionCandidateFlags = {
  readonly productionAuthorized: false;
  readonly productionActive: false;
  readonly realBankConnected: false;
  readonly realPaymentNetworkConnected: false;
  readonly realFxProviderConnected: false;
  readonly networkMembershipClaimed: false;
  readonly providerBalanceIsLedgerBalance: false;
  readonly adapterCanPostLedger: false;
  readonly adapterCanIssueExecutionAuthority: false;
};

export const PRODUCTION_CANDIDATE_FLAGS: ProductionCandidateFlags = Object.freeze({
  productionAuthorized: false,
  productionActive: false,
  realBankConnected: false,
  realPaymentNetworkConnected: false,
  realFxProviderConnected: false,
  networkMembershipClaimed: false,
  providerBalanceIsLedgerBalance: false,
  adapterCanPostLedger: false,
  adapterCanIssueExecutionAuthority: false,
});

export function isProviderCandidateState(value: string): value is ProviderCandidateState {
  return (PROVIDER_CANDIDATE_STATES as readonly string[]).includes(value);
}

export function evidenceRef(refId: string, evidenceClass: string): EvidenceRef {
  return Object.freeze({ refId, class: evidenceClass, slotPresenceIsProof: false });
}

export function namedNetworkAccessRequiresEvidence(
  railClass: RailClass,
  claimedNetworkName: string,
): NamedNetworkAccessClaim {
  return Object.freeze({
    claimedNetworkName,
    engineeringRailClass: railClass,
    externalEvidenceRequired: true,
    railClassProvesMembership: false,
  });
}
