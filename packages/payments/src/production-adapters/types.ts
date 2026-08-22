/**
 * Phase D Prompt 2 — financial-provider adapter shared types.
 *
 * External providers do not replace the SunRey Ledger. The pattern remains:
 * domain intent → Execution Authority → provider adapter → external provider
 * → verified result → Ledger / settlement / reconciliation.
 *
 * These types do not grant network membership, live connectivity, or
 * production authorization.
 */

import type { SecretReference } from '../../../security/src/secrets.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';

export const FINANCIAL_ADAPTER_FRAMEWORK_ID = 'sunrey-financial-provider-adapters' as const;
export const FINANCIAL_ADAPTER_FRAMEWORK_VERSION = 'phase-d-02/1' as const;

export const PROVIDER_LIFECYCLE_STATES = [
  'SIMULATED',
  'SANDBOX',
  'CERTIFICATION',
  'PREPRODUCTION',
  'LIMITED_LIVE',
  'PRODUCTION',
] as const;
export type ProviderLifecycleState = (typeof PROVIDER_LIFECYCLE_STATES)[number];

export const PRODUCTION_ENTRY_STATES = ['LIMITED_LIVE', 'PRODUCTION'] as const;

export const FINANCIAL_PROVIDER_DOMAINS = [
  'BANK_BAAS',
  'ACCOUNT_PROVIDER',
  'PAYMENT_RAIL',
  'INTERNATIONAL_REMITTANCE',
  'FX_LIQUIDITY',
  'CARD_ISSUING',
  'CARD_PROCESSING',
  'DIGITAL_WALLET',
] as const;
export type FinancialProviderDomain = (typeof FINANCIAL_PROVIDER_DOMAINS)[number];

export const SUBMISSION_CERTAINTY = [
  'DEFINITELY_NOT_SUBMITTED',
  'DEFINITELY_SUBMITTED',
  'UNKNOWN_SUBMISSION_STATUS',
] as const;
export type SubmissionCertainty = (typeof SUBMISSION_CERTAINTY)[number];

export const NORMALIZED_PAYMENT_STATUSES = [
  'ACCEPTED',
  'REJECTED',
  'PENDING',
  'PROCESSING',
  'SETTLED',
  'RETURNED',
  'CANCELLED',
  'UNKNOWN',
  'SUBMISSION_UNKNOWN',
  'REQUIRES_RECONCILIATION',
] as const;
export type NormalizedPaymentStatus = (typeof NORMALIZED_PAYMENT_STATUSES)[number];

export type FinancialAdapterFlags = {
  readonly productionAuthorized: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
  readonly realBankConnected: false;
  readonly realPaymentNetworkConnected: false;
  readonly realFxProviderConnected: false;
  readonly realCardProcessorConnected: false;
  readonly adapterCanPostLedger: false;
  readonly adapterCanIssueExecutionAuthority: false;
  readonly providerBalanceIsLedgerAuthority: false;
  readonly namedRailIsNetworkMembership: false;
};

export const FINANCIAL_ADAPTER_FLAGS: FinancialAdapterFlags = Object.freeze({
  productionAuthorized: false,
  productionActive: false,
  liveConnectivityEnabled: false,
  realBankConnected: false,
  realPaymentNetworkConnected: false,
  realFxProviderConnected: false,
  realCardProcessorConnected: false,
  adapterCanPostLedger: false,
  adapterCanIssueExecutionAuthority: false,
  providerBalanceIsLedgerAuthority: false,
  namedRailIsNetworkMembership: false,
});

export type AdapterCredentialBinding = {
  readonly credentialRef: SecretReference | null;
  readonly webhookVerificationRef: SecretReference | null;
  readonly descriptorId: string | null;
};

export type AdapterHealth = {
  readonly providerId: string;
  readonly domain: FinancialProviderDomain;
  readonly lifecycle: ProviderLifecycleState;
  readonly healthy: boolean;
  readonly connectivity: 'SIMULATION' | 'SANDBOX';
  readonly checkedAt: UtcInstant;
  readonly live: false;
};

export type AdapterError = {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly submissionCertainty: SubmissionCertainty;
  readonly providerCode: string | null;
};

export type AdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AdapterError };

export function adapterOk<T>(value: T): AdapterResult<T> {
  return { ok: true, value };
}

export function adapterErr(
  code: string,
  message: string,
  extras: {
    readonly retryable?: boolean;
    readonly submissionCertainty?: SubmissionCertainty;
    readonly providerCode?: string | null;
  } = {},
): AdapterResult<never> {
  return {
    ok: false,
    error: Object.freeze({
      code,
      message,
      retryable: extras.retryable === true,
      submissionCertainty: extras.submissionCertainty ?? 'DEFINITELY_NOT_SUBMITTED',
      providerCode: extras.providerCode ?? null,
    }),
  };
}

export function isProviderLifecycleState(value: string): value is ProviderLifecycleState {
  return (PROVIDER_LIFECYCLE_STATES as readonly string[]).includes(value);
}
