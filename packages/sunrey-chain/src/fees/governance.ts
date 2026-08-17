import type { UpgradePlan } from '../governance/types.ts';
import type { FeeEngine } from './engine.ts';
import type { BlockResourceLimits, FeeAssetPolicy, FeeDispositionPolicy, FeeSchedule } from './types.ts';
import { developmentFeePolicyV2, rejectPolicyDowngrade } from './v2/index.ts';

function asBig(value: unknown, fallback: bigint): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value)) {
    return BigInt(value);
  }
  return fallback;
}

function asInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return fallback;
}

/**
 * Height-activated fee parameter changes. A newer binary does not change
 * fees. Only an authorized UpgradePlan that activates at this height does.
 */
export function applyFeeGovernance(engine: FeeEngine, plan: UpgradePlan, height: number): boolean {
  if (plan.status !== 'ACTIVATED' && plan.status !== 'READY') {
    return false;
  }
  if (plan.activationHeight !== height) {
    return false;
  }
  if (plan.upgradeKind !== 'PARAMETER_CHANGE' && plan.upgradeKind !== 'FEE_PARAMETER_CHANGE') {
    return false;
  }
  const payload = plan.payload;
  const change: {
    activationHeight: number;
    schedule?: FeeSchedule;
    assetPolicy?: FeeAssetPolicy;
    dispositionPolicy?: FeeDispositionPolicy;
    limits?: BlockResourceLimits;
  } = { activationHeight: height };

  if (payload.fee_schedule && typeof payload.fee_schedule === 'object') {
    const raw = payload.fee_schedule as Record<string, unknown>;
    change.schedule = {
      ...engine.schedule,
      version: asInt(raw.version, engine.schedule.version + 1),
      activationHeight: height,
      baseTransactionFee: asBig(raw.base_transaction_fee, engine.schedule.baseTransactionFee),
      perByteFee: asBig(raw.per_byte_fee, engine.schedule.perByteFee),
      computeUnitFee: asBig(raw.compute_unit_fee, engine.schedule.computeUnitFee),
      stateReadFee: asBig(raw.state_read_fee, engine.schedule.stateReadFee),
      stateWriteFee: asBig(raw.state_write_fee, engine.schedule.stateWriteFee),
      signatureVerifyFee: asBig(raw.signature_verify_fee, engine.schedule.signatureVerifyFee),
      cryptographicProofFee: asBig(raw.cryptographic_proof_fee, engine.schedule.cryptographicProofFee),
      minimumFee: asBig(raw.minimum_fee, engine.schedule.minimumFee),
    };
  }
  if (payload.fee_asset_policy && typeof payload.fee_asset_policy === 'object') {
    const raw = payload.fee_asset_policy as Record<string, unknown>;
    const enabled = Array.isArray(raw.enabled_assets)
      ? raw.enabled_assets.filter((item): item is 'SUNREY_COIN' | 'MOONREY_COIN' => item === 'SUNREY_COIN' || item === 'MOONREY_COIN')
      : engine.assetPolicy.enabledAssets;
    change.assetPolicy = {
      version: asInt(raw.version, engine.assetPolicy.version + 1),
      activationHeight: height,
      enabledAssets: enabled,
      defaultAsset: raw.default_asset === 'MOONREY_COIN' ? 'MOONREY_COIN' : 'SUNREY_COIN',
    };
  }
  if (payload.fee_disposition_policy && typeof payload.fee_disposition_policy === 'object') {
    const raw = payload.fee_disposition_policy as Record<string, unknown>;
    change.dispositionPolicy = {
      ...engine.dispositionPolicy,
      version: asInt(raw.version, engine.dispositionPolicy.version + 1),
      activationHeight: height,
      networkSinkBps: asBig(raw.network_sink_bps, engine.dispositionPolicy.networkSinkBps),
      burnBps: asBig(raw.burn_bps, engine.dispositionPolicy.burnBps),
      validatorRewardBps: asBig(raw.validator_reward_bps, engine.dispositionPolicy.validatorRewardBps),
      treasuryBps: asBig(raw.treasury_bps, engine.dispositionPolicy.treasuryBps),
      proposerShareBps: asBig(raw.proposer_share_bps, engine.dispositionPolicy.proposerShareBps),
    };
  }
  if (payload.block_resource_limits && typeof payload.block_resource_limits === 'object') {
    const raw = payload.block_resource_limits as Record<string, unknown>;
    change.limits = {
      ...engine.limits,
      version: asInt(raw.version, engine.limits.version + 1),
      activationHeight: height,
      maxBytes: asBig(raw.max_bytes, engine.limits.maxBytes),
      maxExecutionUnits: asBig(raw.max_execution_units, engine.limits.maxExecutionUnits),
      maxStateWrites: asBig(raw.max_state_writes, engine.limits.maxStateWrites),
      maxSignatureVerifyUnits: asBig(raw.max_signature_verify_units, engine.limits.maxSignatureVerifyUnits),
    };
  }
  if (payload.fee_policy_v2 && typeof payload.fee_policy_v2 === 'object') {
    const raw = payload.fee_policy_v2 as Record<string, unknown>;
    const nextVersion = asInt(raw.policy_version, 2) as 1 | 2;
    if (rejectPolicyDowngrade(engine.policyVersion, nextVersion) || nextVersion < 2) {
      return false;
    }
    const current = engine.feePolicyV2;
    const activated = engine.activateFeePolicyV2(
      {
        ...developmentFeePolicyV2(height),
        version: asInt(raw.version, current.version + 1),
        activationHeight: height,
        minimumFee: asBig(raw.minimum_fee, current.minimumFee),
        priorityEnabled: raw.priority_enabled === false ? false : current.priorityEnabled,
        moonreyFeeEnabled: raw.moonrey_fee_enabled === true,
        bounds: {
          ...current.bounds,
          minBasePrice: asBig(raw.min_base_price, current.bounds.minBasePrice),
          maxBasePrice: asBig(raw.max_base_price, current.bounds.maxBasePrice),
          maxOneBlockAdjustment: asBig(raw.max_one_block_adjustment, current.bounds.maxOneBlockAdjustment),
          targetUtilizationBps: asBig(raw.target_utilization_bps, current.bounds.targetUtilizationBps),
          blockResourceLimit: asBig(raw.block_resource_limit, current.bounds.blockResourceLimit),
          adjustmentDenominator: asBig(raw.adjustment_denominator, current.bounds.adjustmentDenominator),
        },
      },
      height,
    );
    if (activated) {
      return false;
    }
  }
  engine.scheduleGovernedChange(change);
  engine.activateAt(height);
  return true;
}
