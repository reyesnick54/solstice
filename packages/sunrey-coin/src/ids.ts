import { randomUUID } from 'node:crypto';

import { type Brand, brandAs } from '../../domain/src/brand.ts';

export type SunReyCoinAssetId = Brand<string, 'SunReyCoinAssetId'>;
export type SupplyPolicyId = Brand<string, 'SupplyPolicyId'>;
export type ContributionVectorId = Brand<string, 'ContributionVectorId'>;
export type EligibilityId = Brand<string, 'EligibilityId'>;
export type IssuanceProposalId = Brand<string, 'IssuanceProposalId'>;
export type IssuanceRecordId = Brand<string, 'IssuanceRecordId'>;
export type TransferRecordId = Brand<string, 'TransferRecordId'>;
export type BurnRecordId = Brand<string, 'BurnRecordId'>;
export type CoinHoldId = Brand<string, 'CoinHoldId'>;
export type ReconciliationSnapshotId = Brand<string, 'ReconciliationSnapshotId'>;
export type FormulaVersionId = Brand<string, 'FormulaVersionId'>;

export const SUNREY_COIN_ASSET_ID = 'asset:sunrey-coin' as SunReyCoinAssetId;
export const SUNREY_COIN_FORMULA_V1 = 'sunrey-coin-formula-v1' as FormulaVersionId;
export const SUNREY_ISSUANCE_BOOK = 'SUNREY.ISSUANCE';
export const SUNREY_TREASURY_BOOK = 'SUNREY.TREASURY';
export const SUNREY_BURN_BOOK = 'SUNREY.BURN';

export function custodyBookId(ownerId: string): string {
  return `SUNREY.CUSTODY.${ownerId}`;
}

function asId<T extends string>(value: string, label: string): Brand<string, T> {
  if (value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return brandAs<string, T>(value);
}

export function newContributionVectorId(): ContributionVectorId {
  return asId('vec_' + randomUUID(), 'ContributionVectorId');
}
export function newEligibilityId(): EligibilityId {
  return asId('elig_' + randomUUID(), 'EligibilityId');
}
export function newIssuanceProposalId(): IssuanceProposalId {
  return asId('prop_' + randomUUID(), 'IssuanceProposalId');
}
export function newIssuanceRecordId(): IssuanceRecordId {
  return asId('iss_' + randomUUID(), 'IssuanceRecordId');
}
export function newTransferRecordId(): TransferRecordId {
  return asId('xfer_' + randomUUID(), 'TransferRecordId');
}
export function newBurnRecordId(): BurnRecordId {
  return asId('burn_' + randomUUID(), 'BurnRecordId');
}
export function newCoinHoldId(): CoinHoldId {
  return asId('hold_' + randomUUID(), 'CoinHoldId');
}
export function newReconciliationSnapshotId(): ReconciliationSnapshotId {
  return asId('rec_' + randomUUID(), 'ReconciliationSnapshotId');
}
