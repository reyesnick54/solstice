import { commitCanonical } from '../../hash.ts';
import { developmentBlockLimits } from '../policy.ts';
import { FEE_POLICY_V2_DOMAIN, type AdaptivePriceBounds, type FeePolicyV2 } from './types.ts';
import { validateAdaptivePriceBounds } from './price.ts';
import { developmentResourceWeightSchedule, validateResourceWeightSchedule } from './weights.ts';

/**
 * Development / rehearsal FeePolicyV2.
 *
 * Production parameters remain unconfigured. AI cannot authorize changes.
 * Chunk 58 development block limits are reused; they are not raised to
 * chase benchmark throughput.
 */
export function developmentAdaptivePriceBounds(): AdaptivePriceBounds {
  const limits = developmentBlockLimits();
  return Object.freeze({
    minBasePrice: 1n,
    maxBasePrice: 10_000n,
    maxOneBlockAdjustment: 250n,
    targetUtilizationBps: 5_000n,
    blockResourceLimit: limits.maxExecutionUnits,
    adjustmentDenominator: 8n,
  });
}

export function developmentFeePolicyV2(activationHeight = 0): FeePolicyV2 {
  return Object.freeze({
    policyVersion: 2,
    version: 2,
    activationHeight,
    formulaVersion: 'BASE_PRICE_FORMULA_V1',
    weights: developmentResourceWeightSchedule(activationHeight),
    bounds: developmentAdaptivePriceBounds(),
    minimumFee: 100n,
    priorityEnabled: true,
    feeAsset: 'SUNREY_COIN',
    moonreyFeeEnabled: false,
    productionParametersConfigured: false,
    aiCannotAuthorize: true,
    status: 'DEVELOPMENT_FIXTURE',
  });
}

export function productionUnconfiguredFeePolicyV2(): FeePolicyV2 {
  return Object.freeze({
    ...developmentFeePolicyV2(),
    status: 'PRODUCTION_UNCONFIGURED',
    productionParametersConfigured: false,
  });
}

export function validateFeePolicyV2(policy: FeePolicyV2): string | null {
  if (policy.policyVersion !== 2) {
    return 'FeePolicyV2.policyVersion must be 2';
  }
  if (policy.formulaVersion !== 'BASE_PRICE_FORMULA_V1') {
    return 'unknown base-price formula version';
  }
  if (policy.aiCannotAuthorize !== true) {
    return 'AI cannot authorize fee-policy changes';
  }
  if (policy.productionParametersConfigured !== false) {
    return 'production fee parameters remain unconfigured';
  }
  if (policy.minimumFee < 0n) {
    return 'minimum fee must be unsigned';
  }
  if (policy.feeAsset !== 'SUNREY_COIN' && policy.moonreyFeeEnabled !== true) {
    return 'MoonRey remains unavailable as a fee asset';
  }
  return validateAdaptivePriceBounds(policy.bounds) ?? validateResourceWeightSchedule(policy.weights);
}

export function hashFeePolicyV2(policy: FeePolicyV2): string {
  return commitCanonical({
    domain: FEE_POLICY_V2_DOMAIN,
    policyVersion: policy.policyVersion,
    version: policy.version,
    activationHeight: policy.activationHeight,
    formulaVersion: policy.formulaVersion,
    minimumFee: policy.minimumFee.toString(),
    priorityEnabled: policy.priorityEnabled,
    feeAsset: policy.feeAsset,
    moonreyFeeEnabled: policy.moonreyFeeEnabled,
    productionParametersConfigured: policy.productionParametersConfigured,
    bounds: {
      minBasePrice: policy.bounds.minBasePrice.toString(),
      maxBasePrice: policy.bounds.maxBasePrice.toString(),
      maxOneBlockAdjustment: policy.bounds.maxOneBlockAdjustment.toString(),
      targetUtilizationBps: policy.bounds.targetUtilizationBps.toString(),
      blockResourceLimit: policy.bounds.blockResourceLimit.toString(),
      adjustmentDenominator: policy.bounds.adjustmentDenominator.toString(),
    },
  });
}

export function rejectPolicyDowngrade(current: 1 | 2, next: 1 | 2): boolean {
  return next < current;
}
