/**
 * Structural provider adapter ports.
 *
 * Provider-specific payload mapping belongs inside the adapter implementation.
 * HELIOS orchestration code must not import sunrey-chain or provider SDKs directly.
 */

import type { UtcInstant } from '../../../../domain/src/time.ts';
import type {
  CustodyWalletProvisionStatus,
  ExternalAccountApplicationStatus,
  FundingOperationStatus,
  ProviderOrchestrationCapabilityState,
  ProviderOrchestrationEnvironment,
} from './taxonomy.ts';
import type { CustomerActionRequirement, ProviderEvidence } from './types.ts';

export type ProviderRuntimeRegistration = {
  readonly providerId: string;
  readonly lifecycleState: string;
  readonly environment: string;
  readonly healthState: string;
  readonly capabilities: readonly string[];
  readonly credentialConfigured: boolean;
};

/** Discovery port aligned with universal provider runtime. */
export type ProviderRuntimeDiscoveryPort = {
  get(providerId: string): ProviderRuntimeRegistration | null;
  list(): readonly ProviderRuntimeRegistration[];
};

export type AdapterAccountSubmitInput = {
  readonly customerId: string;
  readonly legalIdentityRef: string;
  readonly kycState: string;
  readonly jurisdiction: string;
  readonly productRequested: string;
  readonly accountType: string;
  readonly requiredAgreements: readonly string[];
  readonly idempotencyKey: string;
  readonly workOrderRef: string | null;
  readonly growRef: string | null;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly now: UtcInstant;
};

export type AdapterAccountQueryInput = {
  readonly providerId: string;
  readonly providerObjectId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type AdapterAccountOutcome = {
  readonly status: ExternalAccountApplicationStatus;
  readonly providerObjectId: string | null;
  readonly providerAccountRef: string | null;
  readonly providerTimestamp: UtcInstant | null;
  readonly rawStatus: string;
  readonly actionRequirements: readonly CustomerActionRequirement[];
  readonly capabilityState: ProviderOrchestrationCapabilityState | null;
};

export type AdapterFundingSubmitInput = {
  readonly customerId: string;
  readonly providerId: string;
  readonly sourceAccountRef: string;
  readonly destinationAccountRef: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly idempotencyKey: string;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly now: UtcInstant;
};

export type AdapterFundingQueryInput = {
  readonly providerId: string;
  readonly providerObjectId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type AdapterFundingOutcome = {
  readonly status: FundingOperationStatus;
  readonly providerObjectId: string | null;
  readonly providerTimestamp: UtcInstant | null;
  readonly rawStatus: string;
  readonly actionRequirements: readonly CustomerActionRequirement[];
};

export type AdapterWalletSubmitInput = {
  readonly customerId: string;
  readonly custodyProviderId: string;
  readonly assetId: string;
  readonly networkId: string;
  readonly signingPolicyRef: string;
  readonly idempotencyKey: string;
  readonly environment: ProviderOrchestrationEnvironment;
  readonly now: UtcInstant;
};

export type AdapterWalletQueryInput = {
  readonly custodyProviderId: string;
  readonly providerObjectId: string;
  readonly idempotencyKey: string;
  readonly now: UtcInstant;
};

export type AdapterWalletOutcome = {
  readonly status: CustodyWalletProvisionStatus;
  readonly providerObjectId: string | null;
  readonly addressOrReference: string | null;
  readonly providerTimestamp: UtcInstant | null;
  readonly rawStatus: string;
  readonly signingCredentialExposed: false;
};

/** Investment/account application adapter — provider-neutral contract. */
export type InvestmentAccountAdapterPort = {
  readonly providerId: string;
  submitApplication(input: AdapterAccountSubmitInput): AdapterAccountOutcome;
  queryApplication(input: AdapterAccountQueryInput): AdapterAccountOutcome;
};

/** Funding adapter — verified source/destination only. */
export type FundingAdapterPort = {
  readonly providerId: string;
  submitFunding(input: AdapterFundingSubmitInput): AdapterFundingOutcome;
  queryFunding(input: AdapterFundingQueryInput): AdapterFundingOutcome;
  verifyFundingOwnership(input: {
    readonly customerId: string;
    readonly sourceAccountRef: string;
    readonly providerEvidence: ProviderEvidence | null;
    readonly now: UtcInstant;
  }): { readonly verified: boolean; readonly reason: string };
};

/** Custody wallet adapter — no unrestricted credentials. */
export type CustodyWalletAdapterPort = {
  readonly custodyProviderId: string;
  submitWalletProvision(input: AdapterWalletSubmitInput): AdapterWalletOutcome;
  queryWalletProvision(input: AdapterWalletQueryInput): AdapterWalletOutcome;
};
