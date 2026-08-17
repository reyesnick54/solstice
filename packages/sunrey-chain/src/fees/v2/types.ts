/**
 * Chunk 73 — FeePolicyV2 types.
 *
 * Historic FeePolicy / FeeSchedule (Chunk 42) remains the v1 policy.
 * FeePolicyV2 does not reinterpret historical transactions.
 */

import type { FeeAssetId, ResourceUsage } from '../types.ts';

export const FEE_POLICY_VERSIONS = [1, 2] as const;
export type FeePolicyVersion = (typeof FEE_POLICY_VERSIONS)[number];

export const FEE_POLICY_V1 = 1 as const;
export const FEE_POLICY_V2 = 2 as const;

export const BASE_PRICE_FORMULA_VERSIONS = ['BASE_PRICE_FORMULA_V1'] as const;
export type BasePriceFormulaVersion = (typeof BASE_PRICE_FORMULA_VERSIONS)[number];

export const SIGNATURE_CLASSES = ['CLASSICAL', 'HYBRID', 'PQ'] as const;
export type SignatureClass = (typeof SIGNATURE_CLASSES)[number];

/**
 * V2 resource classes. Equivalent Chunk 42 names are reused:
 * TRANSACTION_BYTE_UNITS, STATE_READ_UNITS, STATE_WRITE_UNITS,
 * CRYPTOGRAPHIC_PROOF_UNITS (PROOF_VERIFY). Signature work is split
 * by cryptographic class. New classes cover oracle, DVP, and interop.
 */
export const RESOURCE_CLASSES_V2 = [
  'TRANSACTION_BYTE_UNITS',
  'SIGNATURE_VERIFY_CLASSICAL',
  'SIGNATURE_VERIFY_HYBRID',
  'SIGNATURE_VERIFY_PQ',
  'STATE_READ_UNITS',
  'STATE_WRITE_UNITS',
  'CRYPTOGRAPHIC_PROOF_UNITS',
  'ORACLE_VERIFY',
  'EXCHANGE_DVP_LEG',
  'INTEROP_PROOF',
  'OTHER_GOVERNED_RESOURCE',
] as const;
export type ResourceClassV2 = (typeof RESOURCE_CLASSES_V2)[number];

export const FEE_DISPOSITION_SINKS_V2 = ['VALIDATOR_REWARD', 'BURN', 'PROTOCOL_TREASURY'] as const;
export type FeeDispositionSinkV2 = (typeof FEE_DISPOSITION_SINKS_V2)[number];

export const PARAMETER_STATUS = ['DEVELOPMENT_FIXTURE', 'PRODUCTION_UNCONFIGURED'] as const;
export type ParameterStatus = (typeof PARAMETER_STATUS)[number];

export const FEE_POLICY_V2_DOMAIN = 'sunrey.fees.policy.v2';
export const RESOURCE_WEIGHT_DOMAIN = 'sunrey.fees.resource-weights.v2';
export const BASE_PRICE_DOMAIN = 'sunrey.fees.base-resource-price.v2';
export const FEE_QUOTE_V2_DOMAIN = 'sunrey.fees.quote.v2';
export const FEE_DISPOSITION_V2_DOMAIN = 'sunrey.fees.disposition.v2';

export type ResourceUsageV2 = {
  readonly TRANSACTION_BYTE_UNITS: bigint;
  readonly SIGNATURE_VERIFY_CLASSICAL: bigint;
  readonly SIGNATURE_VERIFY_HYBRID: bigint;
  readonly SIGNATURE_VERIFY_PQ: bigint;
  readonly STATE_READ_UNITS: bigint;
  readonly STATE_WRITE_UNITS: bigint;
  readonly CRYPTOGRAPHIC_PROOF_UNITS: bigint;
  readonly ORACLE_VERIFY: bigint;
  readonly EXCHANGE_DVP_LEG: bigint;
  readonly INTEROP_PROOF: bigint;
  readonly OTHER_GOVERNED_RESOURCE: bigint;
};

export type ResourceWeightSchedule = {
  readonly version: number;
  readonly activationHeight: number;
  readonly status: ParameterStatus;
  readonly weights: Readonly<Record<ResourceClassV2, bigint>>;
};

export type AdaptivePriceBounds = {
  readonly minBasePrice: bigint;
  readonly maxBasePrice: bigint;
  readonly maxOneBlockAdjustment: bigint;
  readonly targetUtilizationBps: bigint;
  readonly blockResourceLimit: bigint;
  readonly adjustmentDenominator: bigint;
};

export type FeePolicyV2 = {
  readonly policyVersion: typeof FEE_POLICY_V2;
  readonly version: number;
  readonly activationHeight: number;
  readonly formulaVersion: BasePriceFormulaVersion;
  readonly weights: ResourceWeightSchedule;
  readonly bounds: AdaptivePriceBounds;
  readonly minimumFee: bigint;
  readonly priorityEnabled: boolean;
  readonly feeAsset: FeeAssetId;
  readonly moonreyFeeEnabled: false | true;
  readonly productionParametersConfigured: false;
  readonly aiCannotAuthorize: true;
  readonly status: ParameterStatus;
};

export type BaseResourcePriceState = {
  readonly formulaVersion: BasePriceFormulaVersion;
  readonly height: number;
  readonly baseResourcePrice: bigint;
  readonly previousBaseResourcePrice: bigint;
  readonly previousFinalizedUsage: bigint;
  readonly targetUsage: bigint;
  readonly utilizationBps: bigint;
  readonly adjustment: bigint;
  readonly pinnedToMinimum: boolean;
  readonly pinnedToMaximum: boolean;
};

export type FeeQuoteV2 = {
  readonly policyVersion: typeof FEE_POLICY_V2;
  readonly policyRevision: number;
  readonly resourceUsage: ResourceUsageV2;
  readonly weightedUsage: bigint;
  readonly baseResourcePrice: bigint;
  readonly baseCharge: bigint;
  readonly priorityFee: bigint;
  readonly estimatedTotal: bigint;
  readonly feeAsset: FeeAssetId;
  readonly maximumAuthorizedFee: bigint;
  readonly informational: true;
};

export type FeeDispositionPolicyV2 = {
  readonly version: number;
  readonly activationHeight: number;
  readonly validatorRewardBps: bigint;
  readonly burnBps: bigint;
  readonly treasuryBps: bigint;
};

export type FeeDispositionV2 = {
  readonly asset: FeeAssetId;
  readonly charged: bigint;
  readonly validatorReward: bigint;
  readonly burned: bigint;
  readonly treasury: bigint;
};

export type V2TransactionExtras = {
  readonly policyVersion?: FeePolicyVersion;
  readonly signatureClass?: SignatureClass;
  readonly authorizedPriorityFee?: bigint;
  readonly priorityAuthorized?: boolean;
  readonly oracleVerifyCount?: number;
  readonly interopProofCount?: number;
  readonly exchangeDvpLegs?: number;
  readonly otherGovernedUnits?: bigint;
  readonly machineMandateCeiling?: bigint;
};

export type HistoricUsageProjection = {
  readonly policyVersion: typeof FEE_POLICY_V1;
  readonly usage: ResourceUsage;
};

export function emptyUsageV2(): ResourceUsageV2 {
  return Object.freeze({
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_CLASSICAL: 0n,
    SIGNATURE_VERIFY_HYBRID: 0n,
    SIGNATURE_VERIFY_PQ: 0n,
    STATE_READ_UNITS: 0n,
    STATE_WRITE_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
    ORACLE_VERIFY: 0n,
    EXCHANGE_DVP_LEG: 0n,
    INTEROP_PROOF: 0n,
    OTHER_GOVERNED_RESOURCE: 0n,
  });
}

export function addUsageV2(left: ResourceUsageV2, right: ResourceUsageV2): ResourceUsageV2 {
  return Object.freeze({
    TRANSACTION_BYTE_UNITS: left.TRANSACTION_BYTE_UNITS + right.TRANSACTION_BYTE_UNITS,
    SIGNATURE_VERIFY_CLASSICAL: left.SIGNATURE_VERIFY_CLASSICAL + right.SIGNATURE_VERIFY_CLASSICAL,
    SIGNATURE_VERIFY_HYBRID: left.SIGNATURE_VERIFY_HYBRID + right.SIGNATURE_VERIFY_HYBRID,
    SIGNATURE_VERIFY_PQ: left.SIGNATURE_VERIFY_PQ + right.SIGNATURE_VERIFY_PQ,
    STATE_READ_UNITS: left.STATE_READ_UNITS + right.STATE_READ_UNITS,
    STATE_WRITE_UNITS: left.STATE_WRITE_UNITS + right.STATE_WRITE_UNITS,
    CRYPTOGRAPHIC_PROOF_UNITS: left.CRYPTOGRAPHIC_PROOF_UNITS + right.CRYPTOGRAPHIC_PROOF_UNITS,
    ORACLE_VERIFY: left.ORACLE_VERIFY + right.ORACLE_VERIFY,
    EXCHANGE_DVP_LEG: left.EXCHANGE_DVP_LEG + right.EXCHANGE_DVP_LEG,
    INTEROP_PROOF: left.INTEROP_PROOF + right.INTEROP_PROOF,
    OTHER_GOVERNED_RESOURCE: left.OTHER_GOVERNED_RESOURCE + right.OTHER_GOVERNED_RESOURCE,
  });
}
