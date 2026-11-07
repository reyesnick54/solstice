/**
 * HELIOS EXEC08 — external broker/custody account representation (simulation).
 * Describes provider-reported structure only; not legal suitability of any model.
 */

export const HELIOS_EXEC08_ASSET_SEGREGATION = 'HELIOS_EXEC08_ASSET_SEGREGATION' as const;

export const EXTERNAL_ACCOUNT_REPRESENTATION_MODELS = [
  'FULLY_DISCLOSED',
  'OMNIBUS',
  'SEGREGATED',
  'INSTITUTIONAL',
  'UNKNOWN',
] as const;
export type ExternalAccountRepresentationModel = (typeof EXTERNAL_ACCOUNT_REPRESENTATION_MODELS)[number];

export const ASSET_AVAILABILITY_STATES = [
  'AVAILABLE',
  'HELD',
  'UNSETTLED',
  'SETTLED',
  'PENDING_TRANSFER',
] as const;
export type AssetAvailabilityStateKind = (typeof ASSET_AVAILABILITY_STATES)[number];

export const EXTERNAL_ACCOUNT_STATUSES = [
  'PENDING',
  'ACTIVE',
  'RESTRICTED',
  'SUSPENDED',
  'CLOSED',
  'UNKNOWN',
] as const;
export type ExternalAccountStatus = (typeof EXTERNAL_ACCOUNT_STATUSES)[number];

export const EXTERNAL_ACCOUNT_PERMISSIONS = [
  'READ_BALANCES',
  'READ_POSITIONS',
  'READ_TRANSACTIONS',
  'SUBMIT_ORDERS',
  'REQUEST_TRANSFERS',
  'REQUEST_WITHDRAWALS',
] as const;
export type ExternalAccountPermission = (typeof EXTERNAL_ACCOUNT_PERMISSIONS)[number];

export const BENEFICIAL_OWNER_BINDING_STATUSES = ['ACTIVE', 'PENDING', 'REVOKED', 'UNKNOWN'] as const;
export type BeneficialOwnerBindingStatus = (typeof BENEFICIAL_OWNER_BINDING_STATUSES)[number];

export const EXEC08_RECORD_TRUTH = Object.freeze({
  providerBalanceIsSunReyLedgerTruth: false,
  sunReyLedgerIsProviderCustodyTruth: false,
  independentRecordsMustReconcile: true,
  silentBalanceSynchronization: false,
  simulation: true as const,
});
