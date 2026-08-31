/**
 * ACCESS Wave 2 — AccessProviderDescriptor.
 *
 * Describes a registered Access provider. Never stores secrets.
 */

import type { AccessCapacityCategory } from '../../taxonomy.ts';
import type { AccessProviderId, ProviderCapabilityId } from '../types.ts';

export const ACCESS_PROVIDER_TYPES = [
  'DISCOVERY',
  'AGGREGATOR',
  'DIRECT_PROVIDER',
  'MARKETPLACE',
  'FULFILLMENT',
  'SETTLEMENT',
  'CAPACITY_CONTRIBUTOR',
  'HYBRID',
] as const;
export type AccessProviderType = (typeof ACCESS_PROVIDER_TYPES)[number];

export const ACCESS_PROVIDER_ENVIRONMENTS = ['SIMULATION', 'SANDBOX', 'PRODUCTION'] as const;
export type AccessProviderEnvironment = (typeof ACCESS_PROVIDER_ENVIRONMENTS)[number];

export const ACCESS_PROVIDER_ACTIVATION_STATES = [
  'DISABLED',
  'PREVIEW',
  'SANDBOX_ENABLED',
  'PRODUCTION_ENABLED',
] as const;
export type AccessProviderActivationState = (typeof ACCESS_PROVIDER_ACTIVATION_STATES)[number];

export const ACCESS_PROVIDER_CONTRACT_STATUSES = [
  'NONE',
  'DISCOVERY_TERMS',
  'SANDBOX',
  'COMMERCIAL_NEGOTIATION',
  'SIGNED',
  'SUSPENDED',
  'TERMINATED',
] as const;
export type AccessProviderContractStatus = (typeof ACCESS_PROVIDER_CONTRACT_STATUSES)[number];

export const ACCESS_PROVIDER_CREDENTIAL_STATUSES = [
  'NOT_REQUIRED',
  'MISSING',
  'CONFIGURED',
  'INVALID',
  'UNKNOWN',
] as const;
export type AccessProviderCredentialStatus = (typeof ACCESS_PROVIDER_CREDENTIAL_STATUSES)[number];

export const ACCESS_SETTLEMENT_MODELS = [
  'DIRECT_BOOKING_PAYMENT',
  'VIRTUAL_CARD',
  'INVOICE',
  'ACH',
  'PAYOUT',
  'PROVIDER_CREDIT',
  'FUTURE_NATIVE_MR',
  'OTHER',
] as const;
export type AccessSettlementModel = (typeof ACCESS_SETTLEMENT_MODELS)[number];

export const ACCESS_FULFILLMENT_MODELS = [
  'DIRECT',
  'AGGREGATOR_CONFIRM',
  'MARKETPLACE_HANDOFF',
  'CAPACITY_ONLY',
  'DISCOVERY_ONLY',
] as const;
export type AccessFulfillmentModel = (typeof ACCESS_FULFILLMENT_MODELS)[number];

export type AccessProviderDescriptor = {
  readonly providerId: AccessProviderId;
  readonly name: string;
  readonly providerTypes: readonly AccessProviderType[];
  readonly categories: readonly AccessCapacityCategory[];
  readonly capabilities: readonly ProviderCapabilityId[];
  readonly geographies: readonly string[];
  readonly environment: AccessProviderEnvironment;
  readonly activationState: AccessProviderActivationState;
  readonly commercialStatus: AccessProviderContractStatus;
  readonly credentialStatus: AccessProviderCredentialStatus;
  readonly fulfillmentModel: AccessFulfillmentModel;
  readonly settlementModel: AccessSettlementModel;
  readonly supportsIdempotency: boolean;
  readonly supportsWebhooks: boolean;
  readonly supportsReconciliation: boolean;
  readonly contractRef: string | null;
  readonly metadata: Readonly<Record<string, string>>;
};

export function isProductionSettlementModel(model: AccessSettlementModel): boolean {
  return model !== 'FUTURE_NATIVE_MR';
}

export function isFutureNativeMrEnabled(descriptor: AccessProviderDescriptor): boolean {
  return descriptor.settlementModel === 'FUTURE_NATIVE_MR' && descriptor.activationState === 'PRODUCTION_ENABLED';
}
