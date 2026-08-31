import { createHash } from 'node:crypto';

import { type Brand, brandAs } from '../../../domain/src/brand.ts';

export type AccessProductId = Brand<string, 'AccessProductId'>;
export type AccessCapacityId = Brand<string, 'AccessCapacityId'>;
export type AccessDomainEntitlementId = Brand<string, 'AccessDomainEntitlementId'>;
export type AccessAllocationId = Brand<string, 'AccessAllocationId'>;
export type AccessDomainQuoteId = Brand<string, 'AccessDomainQuoteId'>;
export type AccessDomainReservationId = Brand<string, 'AccessDomainReservationId'>;
export type AccessDomainRedemptionId = Brand<string, 'AccessDomainRedemptionId'>;
export type AccessDomainSettlementId = Brand<string, 'AccessDomainSettlementId'>;
export type AccessDomainTransactionId = Brand<string, 'AccessDomainTransactionId'>;
export type AccessUserId = Brand<string, 'AccessUserId'>;
export type AccessEvidenceRef = Brand<string, 'AccessEvidenceRef'>;
export type AccessAllocationSnapshotId = Brand<string, 'AccessAllocationSnapshotId'>;
export type AccessFundingPoolId = Brand<string, 'AccessFundingPoolId'>;

export const ACCESS_DOMAIN_ID_PREFIXES = Object.freeze({
  accessProduct: 'acew1p_',
  accessCapacity: 'acew1c_',
  accessEntitlement: 'acew1e_',
  accessAllocation: 'acew1a_',
  accessQuote: 'acew1q_',
  accessReservation: 'acew1r_',
  accessRedemption: 'acew1x_',
  accessSettlement: 'acew1s_',
  accessTransaction: 'acew1t_',
  accessUser: 'acew1u_',
  accessEvidence: 'acew1ev_',
  allocationSnapshot: 'acew1as_',
  fundingPool: 'acew1fp_',
});

const HEX_BODY = /^[a-f0-9]{16,64}$/;

function digest(material: string): string {
  return createHash('sha256').update(material).digest('hex');
}

function asPrefixedHex<T extends string>(value: string, prefix: string, label: string): Brand<string, T> {
  if (!value.startsWith(prefix)) {
    throw new TypeError(`${label} must start with ${prefix}`);
  }
  const body = value.slice(prefix.length);
  if (!HEX_BODY.test(body)) {
    throw new TypeError(`${label} must be ${prefix} followed by 16-64 lowercase hex characters`);
  }
  return brandAs<string, T>(value);
}

export function asAccessProductId(value: string): AccessProductId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessProduct, 'AccessProductId');
}
export function asAccessCapacityId(value: string): AccessCapacityId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessCapacity, 'AccessCapacityId');
}
export function asAccessDomainEntitlementId(value: string): AccessDomainEntitlementId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessEntitlement, 'AccessDomainEntitlementId');
}
export function asAccessAllocationId(value: string): AccessAllocationId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessAllocation, 'AccessAllocationId');
}
export function asAccessDomainQuoteId(value: string): AccessDomainQuoteId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessQuote, 'AccessDomainQuoteId');
}
export function asAccessDomainReservationId(value: string): AccessDomainReservationId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessReservation, 'AccessDomainReservationId');
}
export function asAccessDomainRedemptionId(value: string): AccessDomainRedemptionId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessRedemption, 'AccessDomainRedemptionId');
}
export function asAccessDomainSettlementId(value: string): AccessDomainSettlementId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessSettlement, 'AccessDomainSettlementId');
}
export function asAccessDomainTransactionId(value: string): AccessDomainTransactionId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessTransaction, 'AccessDomainTransactionId');
}
export function asAccessUserId(value: string): AccessUserId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessUser, 'AccessUserId');
}
export function asAccessEvidenceRef(value: string): AccessEvidenceRef {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.accessEvidence, 'AccessEvidenceRef');
}
export function asAccessAllocationSnapshotId(value: string): AccessAllocationSnapshotId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.allocationSnapshot, 'AccessAllocationSnapshotId');
}
export function asAccessFundingPoolId(value: string): AccessFundingPoolId {
  return asPrefixedHex(value, ACCESS_DOMAIN_ID_PREFIXES.fundingPool, 'AccessFundingPoolId');
}

export function accessProductIdFor(material: string): AccessProductId {
  return asAccessProductId(`${ACCESS_DOMAIN_ID_PREFIXES.accessProduct}${digest(material).slice(0, 32)}`);
}
export function accessCapacityIdFor(material: string): AccessCapacityId {
  return asAccessCapacityId(`${ACCESS_DOMAIN_ID_PREFIXES.accessCapacity}${digest(material).slice(0, 32)}`);
}
export function accessDomainEntitlementIdFor(material: string): AccessDomainEntitlementId {
  return asAccessDomainEntitlementId(`${ACCESS_DOMAIN_ID_PREFIXES.accessEntitlement}${digest(material).slice(0, 32)}`);
}
export function accessAllocationIdFor(material: string): AccessAllocationId {
  return asAccessAllocationId(`${ACCESS_DOMAIN_ID_PREFIXES.accessAllocation}${digest(material).slice(0, 32)}`);
}
export function accessDomainQuoteIdFor(material: string): AccessDomainQuoteId {
  return asAccessDomainQuoteId(`${ACCESS_DOMAIN_ID_PREFIXES.accessQuote}${digest(material).slice(0, 32)}`);
}
export function accessDomainReservationIdFor(material: string): AccessDomainReservationId {
  return asAccessDomainReservationId(`${ACCESS_DOMAIN_ID_PREFIXES.accessReservation}${digest(material).slice(0, 32)}`);
}
export function accessDomainRedemptionIdFor(material: string): AccessDomainRedemptionId {
  return asAccessDomainRedemptionId(`${ACCESS_DOMAIN_ID_PREFIXES.accessRedemption}${digest(material).slice(0, 32)}`);
}
export function accessDomainSettlementIdFor(material: string): AccessDomainSettlementId {
  return asAccessDomainSettlementId(`${ACCESS_DOMAIN_ID_PREFIXES.accessSettlement}${digest(material).slice(0, 32)}`);
}
export function accessDomainTransactionIdFor(material: string): AccessDomainTransactionId {
  return asAccessDomainTransactionId(`${ACCESS_DOMAIN_ID_PREFIXES.accessTransaction}${digest(material).slice(0, 32)}`);
}
export function accessUserIdFor(material: string): AccessUserId {
  return asAccessUserId(`${ACCESS_DOMAIN_ID_PREFIXES.accessUser}${digest(material).slice(0, 32)}`);
}
export function accessEvidenceRefFor(material: string): AccessEvidenceRef {
  return asAccessEvidenceRef(`${ACCESS_DOMAIN_ID_PREFIXES.accessEvidence}${digest(material).slice(0, 32)}`);
}
export function accessAllocationSnapshotIdFor(material: string): AccessAllocationSnapshotId {
  return asAccessAllocationSnapshotId(`${ACCESS_DOMAIN_ID_PREFIXES.allocationSnapshot}${digest(material).slice(0, 32)}`);
}
export function accessFundingPoolIdFor(material: string): AccessFundingPoolId {
  return asAccessFundingPoolId(`${ACCESS_DOMAIN_ID_PREFIXES.fundingPool}${digest(material).slice(0, 32)}`);
}
