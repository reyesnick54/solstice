/**
 * Chunk 42 — SunRey native fees and resource metering types.
 *
 * Protocol-native resource units are unsigned integers. No floating point.
 * Fees are native-asset minor units, not fiat ledger debits.
 */

export const RESOURCE_CLASSES = [
  'COMPUTE_UNITS',
  'STATE_READ_UNITS',
  'STATE_WRITE_UNITS',
  'TRANSACTION_BYTE_UNITS',
  'SIGNATURE_VERIFY_UNITS',
  'CRYPTOGRAPHIC_PROOF_UNITS',
] as const;
export type ResourceClass = (typeof RESOURCE_CLASSES)[number];

export const FEE_ASSETS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;
export type FeeAssetId = (typeof FEE_ASSETS)[number];

export const FEE_EXEMPTIONS = ['NONE', 'DEVELOPMENT_FAUCET', 'DEVELOPMENT_PROTOCOL'] as const;
export type FeeExemption = (typeof FEE_EXEMPTIONS)[number];

export const FEE_DISPOSITION_SINKS = [
  'NETWORK_SINK',
  'BURN',
  'VALIDATOR_REWARD_POOL',
  'TREASURY',
] as const;
export type FeeDispositionSink = (typeof FEE_DISPOSITION_SINKS)[number];

export const EXECUTION_OUTCOMES = [
  'APPLIED',
  'CONTROLLED_FAILURE',
  'OUT_OF_EXECUTION_UNITS',
  'STATELESS_REJECTED',
  'MEMPOOL_REJECTED',
] as const;
export type ExecutionOutcome = (typeof EXECUTION_OUTCOMES)[number];

export const FEE_REJECTION_CODES = [
  'UNSUPPORTED_FEE_ASSET',
  'INSUFFICIENT_MAX_FEE',
  'FEE_BELOW_MINIMUM',
  'INVALID_RESOURCE_DECLARATION',
  'OVERSIZED_EXECUTION_BUDGET',
  'FEE_PAYER_UNAUTHENTICATED',
  'INSUFFICIENT_FEE_BALANCE',
  'OUT_OF_EXECUTION_UNITS',
  'FEE_ARITHMETIC_OVERFLOW',
  'BLOCK_RESOURCE_LIMIT',
  'DISPOSITION_MISMATCH',
  'POLICY_DOWNGRADE_REJECTED',
  'PRIORITY_FIELD_TAMPER',
  'MACHINE_MANDATE_EXCEEDED',
] as const;
export type FeeRejectionCode = (typeof FEE_REJECTION_CODES)[number];

export const PROTOCOL_OPERATIONS = [
  'NATIVE_TRANSFER',
  'NATIVE_ISSUANCE_VERIFY',
  'NATIVE_LOCK',
  'NATIVE_UNLOCK',
  'GOVERNANCE_SIGNATURE_VERIFY',
  'VALIDATOR_OPERATION',
  'EVIDENCE_VERIFICATION',
  'ORDINARY_STATE_READ',
  'ORDINARY_STATE_WRITE',
  'SYSTEM_SET_OBJECT',
  'SYSTEM_NOTE',
  'DEVELOPMENT_FAUCET',
] as const;
export type ProtocolOperation = (typeof PROTOCOL_OPERATIONS)[number];

export const FAILED_TX_FEE_POLICY = Object.freeze({
  statelessValidationFailure: 'NO_STATE_MUTATION_NO_FEE',
  mempoolValidationFailure: 'NO_STATE_MUTATION_NO_FEE',
  networkSpamNeverInBlock: 'NO_STATE_MUTATION_NO_FEE',
  enteredBlockControlledFailure: 'CHARGE_METERED_USAGE_ATOMIC_APP_ROLLBACK',
  outOfExecutionUnits: 'CHARGE_CONSUMED_UNITS_ATOMIC_APP_ROLLBACK',
} as const);

export const PRIORITY_SCALE = 1_000_000n;
export const BASIS_POINTS_DENOMINATOR = 10_000n;
export const MAX_TX_EXECUTION_UNITS = 100_000n;
export const FEE_SCHEDULE_DOMAIN = 'sunrey.fees.schedule.v1';
export const FEE_ASSET_POLICY_DOMAIN = 'sunrey.fees.asset-policy.v1';
export const FEE_DISPOSITION_DOMAIN = 'sunrey.fees.disposition.v1';
export const BLOCK_LIMITS_DOMAIN = 'sunrey.fees.block-limits.v1';
export const FEE_RECEIPT_DOMAIN = 'sunrey.fees.receipt.v1';

export type ResourceUsage = {
  readonly COMPUTE_UNITS: bigint;
  readonly STATE_READ_UNITS: bigint;
  readonly STATE_WRITE_UNITS: bigint;
  readonly TRANSACTION_BYTE_UNITS: bigint;
  readonly SIGNATURE_VERIFY_UNITS: bigint;
  readonly CRYPTOGRAPHIC_PROOF_UNITS: bigint;
};

export type ExecutionBudget = {
  readonly maxExecutionUnits: bigint;
  readonly maxFee: bigint;
  readonly feeAsset: FeeAssetId;
  readonly feePayer: string;
  readonly exemption: FeeExemption;
};

export type FeeSchedule = {
  readonly version: number;
  readonly activationHeight: number;
  readonly baseTransactionFee: bigint;
  readonly perByteFee: bigint;
  readonly computeUnitFee: bigint;
  readonly stateReadFee: bigint;
  readonly stateWriteFee: bigint;
  readonly signatureVerifyFee: bigint;
  readonly cryptographicProofFee: bigint;
  readonly minimumFee: bigint;
};

export type FeeAssetPolicy = {
  readonly version: number;
  readonly activationHeight: number;
  readonly enabledAssets: readonly FeeAssetId[];
  readonly defaultAsset: FeeAssetId;
};

export type FeeDispositionPolicy = {
  readonly version: number;
  readonly activationHeight: number;
  readonly networkSinkBps: bigint;
  readonly burnBps: bigint;
  readonly validatorRewardBps: bigint;
  readonly treasuryBps: bigint;
  readonly proposerShareBps: bigint;
};

export type BlockResourceLimits = {
  readonly version: number;
  readonly activationHeight: number;
  readonly maxBytes: bigint;
  readonly maxExecutionUnits: bigint;
  readonly maxStateWrites: bigint;
  readonly maxSignatureVerifyUnits: bigint;
};

export type FeeDisposition = {
  readonly asset: FeeAssetId;
  readonly actualFee: bigint;
  readonly networkSink: bigint;
  readonly burned: bigint;
  readonly validatorRewardPool: bigint;
  readonly treasury: bigint;
};

export type ValidatorRewardShare = {
  readonly validatorId: string;
  readonly votingPower: bigint;
  readonly amount: bigint;
  readonly role: 'PROPOSER' | 'PARTICIPANT';
};

export type FeeReceipt = {
  readonly transactionId: string;
  readonly payer: string;
  readonly asset: FeeAssetId;
  readonly reservedFee: bigint;
  readonly actualFee: bigint;
  readonly releasedFee: bigint;
  readonly resourceUsage: ResourceUsage;
  readonly feeScheduleVersion: number;
  readonly dispositionPolicyVersion: number;
  readonly blockHeight: number;
  readonly blockId: string;
  readonly outcome: ExecutionOutcome;
  readonly disposition: FeeDisposition;
  readonly policyVersion?: 1 | 2;
  readonly baseResourcePrice?: bigint;
  readonly baseCharge?: bigint;
  readonly priorityFee?: bigint;
};

export type NativeAssetPosition = {
  readonly accountId: string;
  readonly asset: FeeAssetId;
  readonly available: bigint;
  readonly reserved: bigint;
  readonly locked: bigint;
};

export type FeeMetrics = {
  executionUnits: bigint;
  blockExecutionUnits: bigint;
  feeRevenueByAsset: Record<FeeAssetId, bigint>;
  feeBurned: bigint;
  feeNetworkSink: bigint;
  validatorRewardAccrual: bigint;
  transactionFeeRejections: bigint;
  outOfExecutionUnits: bigint;
  blockResourceUtilization: bigint;
  mempoolFeeFloor: bigint;
};

export type ExecutableTransaction = {
  readonly transactionId: string;
  readonly operation: ProtocolOperation;
  readonly payerAuthenticated: boolean;
  readonly encodedBytes: number;
  readonly signatureCount: number;
  readonly budget: ExecutionBudget;
  readonly transfer?: {
    readonly from: string;
    readonly to: string;
    readonly asset: FeeAssetId;
    readonly amount: bigint;
  };
  readonly applicationShouldFail?: boolean;
  readonly forceOverBudget?: boolean;
  readonly policyVersion?: 1 | 2;
  readonly signatureClass?: 'CLASSICAL' | 'HYBRID' | 'PQ';
  readonly authorizedPriorityFee?: bigint;
  readonly priorityAuthorized?: boolean;
  readonly oracleVerifyCount?: number;
  readonly interopProofCount?: number;
  readonly exchangeDvpLegs?: number;
  readonly otherGovernedUnits?: bigint;
  readonly machineMandateCeiling?: bigint;
};

export type FeeRejection = {
  readonly code: FeeRejectionCode;
  readonly stage: 'stateless' | 'mempool' | 'execution' | 'block';
  readonly detail: string;
};

export function emptyUsage(): ResourceUsage {
  return Object.freeze({
    COMPUTE_UNITS: 0n,
    STATE_READ_UNITS: 0n,
    STATE_WRITE_UNITS: 0n,
    TRANSACTION_BYTE_UNITS: 0n,
    SIGNATURE_VERIFY_UNITS: 0n,
    CRYPTOGRAPHIC_PROOF_UNITS: 0n,
  });
}

export function totalUnits(usage: ResourceUsage): bigint {
  return (
    usage.COMPUTE_UNITS +
    usage.STATE_READ_UNITS +
    usage.STATE_WRITE_UNITS +
    usage.TRANSACTION_BYTE_UNITS +
    usage.SIGNATURE_VERIFY_UNITS +
    usage.CRYPTOGRAPHIC_PROOF_UNITS
  );
}

export function addUsage(left: ResourceUsage, right: ResourceUsage): ResourceUsage {
  return Object.freeze({
    COMPUTE_UNITS: left.COMPUTE_UNITS + right.COMPUTE_UNITS,
    STATE_READ_UNITS: left.STATE_READ_UNITS + right.STATE_READ_UNITS,
    STATE_WRITE_UNITS: left.STATE_WRITE_UNITS + right.STATE_WRITE_UNITS,
    TRANSACTION_BYTE_UNITS: left.TRANSACTION_BYTE_UNITS + right.TRANSACTION_BYTE_UNITS,
    SIGNATURE_VERIFY_UNITS: left.SIGNATURE_VERIFY_UNITS + right.SIGNATURE_VERIFY_UNITS,
    CRYPTOGRAPHIC_PROOF_UNITS: left.CRYPTOGRAPHIC_PROOF_UNITS + right.CRYPTOGRAPHIC_PROOF_UNITS,
  });
}

export function assertUnsigned(value: bigint, label: string): void {
  if (value < 0n) {
    throw new TypeError(`${label} must be an unsigned integer`);
  }
}
