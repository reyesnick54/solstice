import { commitCanonical } from '../hash.ts';
import {
  BASIS_POINTS_DENOMINATOR,
  BLOCK_LIMITS_DOMAIN,
  FEE_ASSET_POLICY_DOMAIN,
  FEE_DISPOSITION_DOMAIN,
  type BlockResourceLimits,
  type FeeAssetId,
  type FeeAssetPolicy,
  type FeeDisposition,
  type FeeDispositionPolicy,
} from './types.ts';

export function developmentFeeAssetPolicy(activationHeight = 0): FeeAssetPolicy {
  return Object.freeze({
    version: 1,
    activationHeight,
    enabledAssets: Object.freeze(['SUNREY_COIN'] as const),
    defaultAsset: 'SUNREY_COIN',
  });
}

export function developmentFeeDispositionPolicy(activationHeight = 0): FeeDispositionPolicy {
  return Object.freeze({
    version: 1,
    activationHeight,
    networkSinkBps: 5_000n,
    burnBps: 2_500n,
    validatorRewardBps: 2_500n,
    treasuryBps: 0n,
    proposerShareBps: 4_000n,
  });
}

export function developmentBlockLimits(activationHeight = 0): BlockResourceLimits {
  return Object.freeze({
    version: 1,
    activationHeight,
    maxBytes: 512_000n,
    maxExecutionUnits: 2_000_000n,
    maxStateWrites: 8_192n,
    maxSignatureVerifyUnits: 4_096n,
  });
}

export function hashFeeAssetPolicy(policy: FeeAssetPolicy): string {
  return commitCanonical({
    domain: FEE_ASSET_POLICY_DOMAIN,
    version: policy.version,
    activationHeight: policy.activationHeight,
    enabledAssets: policy.enabledAssets,
    defaultAsset: policy.defaultAsset,
  });
}

export function hashFeeDispositionPolicy(policy: FeeDispositionPolicy): string {
  return commitCanonical({
    domain: FEE_DISPOSITION_DOMAIN,
    version: policy.version,
    activationHeight: policy.activationHeight,
    networkSinkBps: policy.networkSinkBps.toString(),
    burnBps: policy.burnBps.toString(),
    validatorRewardBps: policy.validatorRewardBps.toString(),
    treasuryBps: policy.treasuryBps.toString(),
    proposerShareBps: policy.proposerShareBps.toString(),
  });
}

export function hashBlockResourceLimits(limits: BlockResourceLimits): string {
  return commitCanonical({
    domain: BLOCK_LIMITS_DOMAIN,
    version: limits.version,
    activationHeight: limits.activationHeight,
    maxBytes: limits.maxBytes.toString(),
    maxExecutionUnits: limits.maxExecutionUnits.toString(),
    maxStateWrites: limits.maxStateWrites.toString(),
    maxSignatureVerifyUnits: limits.maxSignatureVerifyUnits.toString(),
  });
}

export function assetIsEnabled(policy: FeeAssetPolicy, asset: FeeAssetId): boolean {
  return policy.enabledAssets.includes(asset);
}

export function validateDispositionPolicy(policy: FeeDispositionPolicy): string | null {
  const total =
    policy.networkSinkBps + policy.burnBps + policy.validatorRewardBps + policy.treasuryBps;
  if (total !== BASIS_POINTS_DENOMINATOR) {
    return 'disposition basis points must sum to 10000';
  }
  if (policy.proposerShareBps > BASIS_POINTS_DENOMINATOR) {
    return 'proposer share exceeds 10000 bps';
  }
  return null;
}

/**
 * Split actual_fee across sinks. Remainder after integer division goes to NETWORK_SINK.
 */
export function disposeFee(
  policy: FeeDispositionPolicy,
  asset: FeeAssetId,
  actualFee: bigint,
): FeeDisposition {
  const burn = (actualFee * policy.burnBps) / BASIS_POINTS_DENOMINATOR;
  const rewards = (actualFee * policy.validatorRewardBps) / BASIS_POINTS_DENOMINATOR;
  const treasury = (actualFee * policy.treasuryBps) / BASIS_POINTS_DENOMINATOR;
  const networkSink = actualFee - burn - rewards - treasury;
  return Object.freeze({
    asset,
    actualFee,
    networkSink,
    burned: burn,
    validatorRewardPool: rewards,
    treasury,
  });
}

export function dispositionReconciles(disposition: FeeDisposition): boolean {
  return (
    disposition.networkSink +
      disposition.burned +
      disposition.validatorRewardPool +
      disposition.treasury ===
    disposition.actualFee
  );
}
