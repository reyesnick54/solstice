import { randomUUID } from 'node:crypto';

export const RIGHTS_MARKETPLACE_ID_PREFIXES = Object.freeze({
  right: 'irr_',
  product: 'idp_',
  license: 'irl_',
  usage: 'iru_',
  allocation: 'ica_',
  settlement: 'irs_',
  policy: 'icp_',
  pricing: 'ipr_',
  credential: 'ilc_',
  request: 'ilreq_',
});

export type InformationRightId = string & { readonly __brand: 'InformationRightId' };
export type DataProductId = string & { readonly __brand: 'DataProductId' };
export type InformationLicenseId = string & { readonly __brand: 'InformationLicenseId' };
export type UsageEventId = string & { readonly __brand: 'UsageEventId' };
export type CompensationAllocationId = string & { readonly __brand: 'CompensationAllocationId' };
export type LicenseSettlementId = string & { readonly __brand: 'LicenseSettlementId' };
export type CompensationPolicyId = string & { readonly __brand: 'CompensationPolicyId' };
export type PricingPolicyId = string & { readonly __brand: 'PricingPolicyId' };
export type LicenseeCredentialId = string & { readonly __brand: 'LicenseeCredentialId' };
export type LicenseRequestId = string & { readonly __brand: 'LicenseRequestId' };

function mint(prefix: string): string {
  return `${prefix}${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export const newInformationRightId = (): InformationRightId => mint(RIGHTS_MARKETPLACE_ID_PREFIXES.right) as InformationRightId;
export const newDataProductId = (): DataProductId => mint(RIGHTS_MARKETPLACE_ID_PREFIXES.product) as DataProductId;
export const newInformationLicenseId = (): InformationLicenseId =>
  mint(RIGHTS_MARKETPLACE_ID_PREFIXES.license) as InformationLicenseId;
export const newUsageEventId = (): UsageEventId => mint(RIGHTS_MARKETPLACE_ID_PREFIXES.usage) as UsageEventId;
export const newCompensationAllocationId = (): CompensationAllocationId =>
  mint(RIGHTS_MARKETPLACE_ID_PREFIXES.allocation) as CompensationAllocationId;
export const newLicenseSettlementId = (): LicenseSettlementId =>
  mint(RIGHTS_MARKETPLACE_ID_PREFIXES.settlement) as LicenseSettlementId;
export const newCompensationPolicyId = (): CompensationPolicyId =>
  mint(RIGHTS_MARKETPLACE_ID_PREFIXES.policy) as CompensationPolicyId;
export const newPricingPolicyId = (): PricingPolicyId => mint(RIGHTS_MARKETPLACE_ID_PREFIXES.pricing) as PricingPolicyId;
export const newLicenseeCredentialId = (): LicenseeCredentialId =>
  mint(RIGHTS_MARKETPLACE_ID_PREFIXES.credential) as LicenseeCredentialId;
export const newLicenseRequestId = (): LicenseRequestId => mint(RIGHTS_MARKETPLACE_ID_PREFIXES.request) as LicenseRequestId;
