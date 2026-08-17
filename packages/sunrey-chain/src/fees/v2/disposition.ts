import { commitCanonical } from '../../hash.ts';
import type { FeeAssetId } from '../types.ts';
import { BASIS_POINTS_DENOMINATOR, checkedAdd, checkedMul } from './arithmetic.ts';
import { FEE_DISPOSITION_V2_DOMAIN, type FeeDispositionPolicyV2, type FeeDispositionV2 } from './types.ts';

export function developmentFeeDispositionPolicyV2(activationHeight = 0): FeeDispositionPolicyV2 {
  return Object.freeze({
    version: 2,
    activationHeight,
    validatorRewardBps: 5_000n,
    burnBps: 2_500n,
    treasuryBps: 2_500n,
  });
}

export function validateDispositionPolicyV2(policy: FeeDispositionPolicyV2): string | null {
  const total = policy.validatorRewardBps + policy.burnBps + policy.treasuryBps;
  if (total !== BASIS_POINTS_DENOMINATOR) {
    return 'v2 disposition basis points must sum to 10000';
  }
  if (policy.validatorRewardBps < 0n || policy.burnBps < 0n || policy.treasuryBps < 0n) {
    return 'v2 disposition shares must be unsigned';
  }
  return null;
}

/**
 * Split charged fee across VALIDATOR_REWARD + BURN + PROTOCOL_TREASURY.
 * Remainder after integer division goes to treasury so the identity is exact.
 * Disposition redistributes existing quantity. It cannot mint.
 */
export function disposeFeeV2(
  policy: FeeDispositionPolicyV2,
  asset: FeeAssetId,
  charged: bigint,
): FeeDispositionV2 {
  if (charged < 0n) {
    throw new TypeError('charged fee must be unsigned');
  }
  const invalid = validateDispositionPolicyV2(policy);
  if (invalid) {
    throw new TypeError(invalid);
  }
  const validatorReward = checkedMul(charged, policy.validatorRewardBps, 'validatorReward') / BASIS_POINTS_DENOMINATOR;
  const burned = checkedMul(charged, policy.burnBps, 'burn') / BASIS_POINTS_DENOMINATOR;
  const allocated = checkedAdd(validatorReward, burned, 'disposition');
  const treasury = charged - allocated;
  return Object.freeze({
    asset,
    charged,
    validatorReward,
    burned,
    treasury,
  });
}

export function dispositionV2Reconciles(disposition: FeeDispositionV2): boolean {
  return (
    disposition.validatorReward + disposition.burned + disposition.treasury === disposition.charged &&
    disposition.validatorReward >= 0n &&
    disposition.burned >= 0n &&
    disposition.treasury >= 0n
  );
}

export function hashFeeDispositionPolicyV2(policy: FeeDispositionPolicyV2): string {
  return commitCanonical({
    domain: FEE_DISPOSITION_V2_DOMAIN,
    version: policy.version,
    activationHeight: policy.activationHeight,
    validatorRewardBps: policy.validatorRewardBps.toString(),
    burnBps: policy.burnBps.toString(),
    treasuryBps: policy.treasuryBps.toString(),
  });
}

export function toHistoricDispositionShape(disposition: FeeDispositionV2): {
  readonly asset: FeeAssetId;
  readonly actualFee: bigint;
  readonly networkSink: bigint;
  readonly burned: bigint;
  readonly validatorRewardPool: bigint;
  readonly treasury: bigint;
} {
  return Object.freeze({
    asset: disposition.asset,
    actualFee: disposition.charged,
    networkSink: 0n,
    burned: disposition.burned,
    validatorRewardPool: disposition.validatorReward,
    treasury: disposition.treasury,
  });
}
