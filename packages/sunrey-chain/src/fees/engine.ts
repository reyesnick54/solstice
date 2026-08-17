import { commitCanonical } from '../hash.ts';
import { NativeAssetAccounts } from './accounts.ts';
import { declarationIsOversized, ResourceMeter, usageForOperation } from './meter.ts';
import {
  assetIsEnabled,
  developmentBlockLimits,
  developmentFeeAssetPolicy,
  developmentFeeDispositionPolicy,
  disposeFee,
  dispositionReconciles,
  hashBlockResourceLimits,
  hashFeeAssetPolicy,
  hashFeeDispositionPolicy,
} from './policy.ts';
import { calculateFee, developmentFeeSchedule, hashFeeSchedule } from './schedule.ts';
import {
  BASIS_POINTS_DENOMINATOR,
  FEE_RECEIPT_DOMAIN,
  emptyUsage,
  totalUnits,
  type BlockResourceLimits,
  type ExecutableTransaction,
  type ExecutionOutcome,
  type FeeAssetId,
  type FeeAssetPolicy,
  type FeeDisposition,
  type FeeDispositionPolicy,
  type FeeMetrics,
  type FeeReceipt,
  type FeeRejection,
  type FeeSchedule,
  type ResourceUsage,
  type ValidatorRewardShare,
} from './types.ts';
import {
  developmentFeeDispositionPolicyV2,
  developmentFeePolicyV2,
  disposeFeeV2,
  dispositionV2Reconciles,
  hashFeePolicyV2,
  quoteFeeV2,
  quoteInputForTransaction,
  initialBaseResourcePriceState,
  machineFeeFitsMandate,
  nextBaseResourcePrice,
  rejectPolicyDowngrade,
  toHistoricDispositionShape,
  type BaseResourcePriceState,
  type FeeDispositionPolicyV2,
  type FeePolicyV2,
} from './v2/index.ts';

export const NETWORK_SINK_ACCOUNT = 'sunrey.fees.network_sink';
export const BURN_ACCOUNT = 'sunrey.fees.burn';
export const TREASURY_ACCOUNT = 'sunrey.fees.treasury';
export const REWARD_POOL_ACCOUNT = 'sunrey.fees.validator_reward_pool';
export const FAUCET_ACCOUNT = 'sunrey.fees.development_faucet';

export type ValidatorDescriptor = {
  readonly validatorId: string;
  readonly votingPower: bigint;
};

export type ExecuteInput = {
  readonly tx: ExecutableTransaction;
  readonly blockHeight: number;
  readonly blockId: string;
  readonly proposerId: string;
  readonly validators: readonly ValidatorDescriptor[];
};

export type ExecuteResult =
  | { readonly ok: true; readonly receipt: FeeReceipt; readonly applicationApplied: boolean }
  | { readonly ok: false; readonly rejection: FeeRejection };

function emptyMetrics(): FeeMetrics {
  return {
    executionUnits: 0n,
    blockExecutionUnits: 0n,
    feeRevenueByAsset: { SUNREY_COIN: 0n, MOONREY_COIN: 0n },
    feeBurned: 0n,
    feeNetworkSink: 0n,
    validatorRewardAccrual: 0n,
    transactionFeeRejections: 0n,
    outOfExecutionUnits: 0n,
    blockResourceUtilization: 0n,
    mempoolFeeFloor: 0n,
  };
}

export class FeeEngine {
  schedule: FeeSchedule;
  assetPolicy: FeeAssetPolicy;
  dispositionPolicy: FeeDispositionPolicy;
  limits: BlockResourceLimits;
  policyVersion: 1 | 2 = 1;
  feePolicyV2: FeePolicyV2 = developmentFeePolicyV2();
  dispositionPolicyV2: FeeDispositionPolicyV2 = developmentFeeDispositionPolicyV2();
  priceState: BaseResourcePriceState = initialBaseResourcePriceState(
    developmentFeePolicyV2().bounds,
    developmentFeePolicyV2().bounds.minBasePrice,
    0,
  );
  readonly priceHistory: BaseResourcePriceState[] = [];
  readonly accounts = new NativeAssetAccounts();
  readonly receipts = new Map<string, FeeReceipt>();
  readonly rewardAccrual = new Map<string, Record<FeeAssetId, bigint>>();
  readonly metrics: FeeMetrics = emptyMetrics();
  readonly scheduledChanges: Array<{
    readonly activationHeight: number;
    readonly schedule?: FeeSchedule;
    readonly assetPolicy?: FeeAssetPolicy;
    readonly dispositionPolicy?: FeeDispositionPolicy;
    readonly limits?: BlockResourceLimits;
  }> = [];

  constructor() {
    this.schedule = developmentFeeSchedule();
    this.assetPolicy = developmentFeeAssetPolicy();
    this.dispositionPolicy = developmentFeeDispositionPolicy();
    this.limits = developmentBlockLimits();
    this.metrics.mempoolFeeFloor = this.schedule.minimumFee;
  }

  protocolCommitments(): {
    readonly feeScheduleHash: string;
    readonly feeAssetPolicyHash: string;
    readonly feeDispositionHash: string;
    readonly blockLimitsHash: string;
    readonly feePolicyV2Hash: string;
    readonly policyVersion: 1 | 2;
  } {
    return {
      feeScheduleHash: hashFeeSchedule(this.schedule),
      feeAssetPolicyHash: hashFeeAssetPolicy(this.assetPolicy),
      feeDispositionHash: hashFeeDispositionPolicy(this.dispositionPolicy),
      blockLimitsHash: hashBlockResourceLimits(this.limits),
      feePolicyV2Hash: hashFeePolicyV2(this.feePolicyV2),
      policyVersion: this.policyVersion,
    };
  }

  activateFeePolicyV2(policy: FeePolicyV2 = developmentFeePolicyV2(), height = policy.activationHeight): FeeRejection | null {
    if (rejectPolicyDowngrade(this.policyVersion, policy.policyVersion)) {
      return {
        code: 'POLICY_DOWNGRADE_REJECTED',
        stage: 'stateless',
        detail: 'FeePolicyV2 cannot be replaced by a lower policy version',
      };
    }
    this.feePolicyV2 = policy;
    this.policyVersion = 2;
    this.priceState = initialBaseResourcePriceState(policy.bounds, this.priceState.baseResourcePrice, height);
    this.metrics.mempoolFeeFloor = policy.minimumFee;
    return null;
  }

  finalizeBlock(weightedUsageUnits: bigint, height: number): BaseResourcePriceState {
    this.priceState = nextBaseResourcePrice(this.priceState, weightedUsageUnits, this.feePolicyV2.bounds, height);
    this.priceHistory.push(this.priceState);
    this.metrics.blockResourceUtilization =
      this.feePolicyV2.bounds.blockResourceLimit === 0n
        ? 0n
        : (weightedUsageUnits * 10_000n) / this.feePolicyV2.bounds.blockResourceLimit;
    return this.priceState;
  }

  faucet(accountId: string, amount: bigint, asset: FeeAssetId = 'SUNREY_COIN'): void {
    if (asset !== 'SUNREY_COIN') {
      throw new TypeError('development faucet credits SUNREY_COIN only');
    }
    this.accounts.credit(FAUCET_ACCOUNT, asset, amount);
    if (!this.accounts.transfer(FAUCET_ACCOUNT, accountId, asset, amount)) {
      throw new Error('faucet transfer failed');
    }
  }

  scheduleGovernedChange(change: FeeEngine['scheduledChanges'][number]): void {
    this.scheduledChanges.push(change);
    this.scheduledChanges.sort((left, right) => left.activationHeight - right.activationHeight);
  }

  activateAt(height: number): void {
    const due = this.scheduledChanges.filter((change) => change.activationHeight === height);
    for (const change of due) {
      if (change.schedule) {
        this.schedule = change.schedule;
      }
      if (change.assetPolicy) {
        this.assetPolicy = change.assetPolicy;
      }
      if (change.dispositionPolicy) {
        this.dispositionPolicy = change.dispositionPolicy;
      }
      if (change.limits) {
        this.limits = change.limits;
      }
    }
    this.metrics.mempoolFeeFloor = this.schedule.minimumFee;
  }

  validateAdmission(tx: ExecutableTransaction): FeeRejection | null {
    const budget = tx.budget;
    if (budget.exemption === 'DEVELOPMENT_FAUCET' || budget.exemption === 'DEVELOPMENT_PROTOCOL') {
      return null;
    }
    if (!tx.payerAuthenticated) {
      this.metrics.transactionFeeRejections += 1n;
      return {
        code: 'FEE_PAYER_UNAUTHENTICATED',
        stage: 'stateless',
        detail: 'fee payer must be authenticated',
      };
    }
    if (budget.maxExecutionUnits < 0n || budget.maxFee < 0n) {
      this.metrics.transactionFeeRejections += 1n;
      return {
        code: 'INVALID_RESOURCE_DECLARATION',
        stage: 'stateless',
        detail: 'resource declaration must be unsigned',
      };
    }
    if (declarationIsOversized(budget.maxExecutionUnits)) {
      this.metrics.transactionFeeRejections += 1n;
      return {
        code: 'OVERSIZED_EXECUTION_BUDGET',
        stage: 'mempool',
        detail: 'declared execution budget exceeds the per-transaction cap',
      };
    }
    if (!assetIsEnabled(this.assetPolicy, budget.feeAsset)) {
      this.metrics.transactionFeeRejections += 1n;
      return {
        code: 'UNSUPPORTED_FEE_ASSET',
        stage: 'mempool',
        detail: `${budget.feeAsset} is not an enabled fee asset`,
      };
    }
    if (this.policyVersion === 2 && (tx.policyVersion ?? 2) < 2) {
      this.metrics.transactionFeeRejections += 1n;
      return {
        code: 'POLICY_DOWNGRADE_REJECTED',
        stage: 'mempool',
        detail: 'historic FeePolicy v1 cannot execute after FeePolicyV2 activation',
      };
    }
    const declaredUsage = usageForOperation(tx.operation, tx.encodedBytes, tx.signatureCount);
    if (this.policyVersion === 2) {
      const quote = quoteFeeV2(
        quoteInputForTransaction(this.feePolicyV2, tx, this.priceState.baseResourcePrice, tx.budget.maxFee),
      );
      if (!quote.ok) {
        this.metrics.transactionFeeRejections += 1n;
        return { code: quote.code, stage: 'mempool', detail: quote.detail };
      }
      if (tx.machineMandateCeiling !== undefined && tx.transfer) {
        if (!machineFeeFitsMandate(tx.machineMandateCeiling, tx.transfer.amount, quote.quote)) {
          this.metrics.transactionFeeRejections += 1n;
          return {
            code: 'MACHINE_MANDATE_EXCEEDED',
            stage: 'mempool',
            detail: 'priority fee cannot bypass the machine spending mandate',
          };
        }
      }
    } else {
      if (budget.maxFee < this.schedule.minimumFee) {
        this.metrics.transactionFeeRejections += 1n;
        return { code: 'FEE_BELOW_MINIMUM', stage: 'mempool', detail: 'max_fee is below the active minimum' };
      }
      if (totalUnits(declaredUsage) <= budget.maxExecutionUnits) {
        const estimated = calculateFee(this.schedule, declaredUsage);
        if (budget.maxFee < estimated) {
          this.metrics.transactionFeeRejections += 1n;
          return {
            code: 'INSUFFICIENT_MAX_FEE',
            stage: 'mempool',
            detail: 'max_fee cannot cover the estimated resource cost',
          };
        }
      }
    }
    const alreadyReserved = this.accounts.position(budget.feePayer, budget.feeAsset).reserved >= budget.maxFee;
    if (!alreadyReserved && this.accounts.position(budget.feePayer, budget.feeAsset).available < budget.maxFee) {
      this.metrics.transactionFeeRejections += 1n;
      return {
        code: 'INSUFFICIENT_FEE_BALANCE',
        stage: 'mempool',
        detail: 'fee payer cannot satisfy max_fee',
      };
    }
    return null;
  }

  reserve(tx: ExecutableTransaction): FeeRejection | null {
    if (tx.budget.exemption !== 'NONE') {
      return null;
    }
    if (!this.accounts.reserve(tx.budget.feePayer, tx.budget.feeAsset, tx.budget.maxFee)) {
      this.metrics.transactionFeeRejections += 1n;
      return {
        code: 'INSUFFICIENT_FEE_BALANCE',
        stage: 'mempool',
        detail: 'unable to reserve max_fee',
      };
    }
    return null;
  }

  releaseReservation(tx: ExecutableTransaction): void {
    if (tx.budget.exemption !== 'NONE') {
      return;
    }
    this.accounts.releaseReserved(tx.budget.feePayer, tx.budget.feeAsset, tx.budget.maxFee);
  }

  execute(input: ExecuteInput): ExecuteResult {
    const { tx } = input;
    const admission = this.validateAdmission(tx);
    if (admission) {
      return { ok: false, rejection: admission };
    }
    if (tx.budget.exemption === 'NONE') {
      const reserved = this.accounts.position(tx.budget.feePayer, tx.budget.feeAsset).reserved;
      if (reserved < tx.budget.maxFee) {
        const reservation = this.reserve(tx);
        if (reservation) {
          return { ok: false, rejection: reservation };
        }
      }
    }

    const meter = new ResourceMeter(tx.budget.maxExecutionUnits);
    const baseUsage = usageForOperation(tx.operation, tx.encodedBytes, tx.signatureCount);
    let outcome: ExecutionOutcome = 'APPLIED';
    let applicationApplied = false;

    if (tx.forceOverBudget || !meter.charge(baseUsage)) {
      outcome = 'OUT_OF_EXECUTION_UNITS';
      this.metrics.outOfExecutionUnits += 1n;
    } else if (tx.applicationShouldFail) {
      outcome = 'CONTROLLED_FAILURE';
    } else if (tx.operation === 'NATIVE_TRANSFER' && tx.transfer) {
      const scratch = this.accounts.clone();
      const moved = scratch.transfer(tx.transfer.from, tx.transfer.to, tx.transfer.asset, tx.transfer.amount);
      if (!moved) {
        outcome = 'CONTROLLED_FAILURE';
      } else {
        this.replaceAccounts(scratch);
        applicationApplied = true;
      }
    } else if (tx.operation === 'NATIVE_LOCK' && tx.transfer) {
      const scratch = this.accounts.clone();
      if (!scratch.lock(tx.transfer.from, tx.transfer.asset, tx.transfer.amount)) {
        outcome = 'CONTROLLED_FAILURE';
      } else {
        this.replaceAccounts(scratch);
        applicationApplied = true;
      }
    } else if (tx.operation === 'NATIVE_UNLOCK' && tx.transfer) {
      const scratch = this.accounts.clone();
      if (!scratch.unlock(tx.transfer.from, tx.transfer.asset, tx.transfer.amount)) {
        outcome = 'CONTROLLED_FAILURE';
      } else {
        this.replaceAccounts(scratch);
        applicationApplied = true;
      }
    } else if (tx.operation === 'DEVELOPMENT_FAUCET' && tx.transfer) {
      this.faucet(tx.transfer.to, tx.transfer.amount, tx.transfer.asset);
      applicationApplied = true;
    } else {
      applicationApplied = true;
    }

    const usage = outcome === 'OUT_OF_EXECUTION_UNITS' ? baseUsage : meter.snapshot();
    let computed = calculateFee(this.schedule, usage);
    let actualFee = tx.budget.exemption === 'NONE' ? minBig(computed, tx.budget.maxFee) : 0n;
    let baseCharge = computed;
    let priorityFee = 0n;
    let baseResourcePrice: bigint | undefined;
    if (this.policyVersion === 2 && tx.budget.exemption === 'NONE') {
      const quote = quoteFeeV2(
        quoteInputForTransaction(this.feePolicyV2, tx, this.priceState.baseResourcePrice, tx.budget.maxFee),
      );
      if (!quote.ok) {
        if (tx.budget.exemption === 'NONE') {
          this.releaseReservation(tx);
        }
        this.metrics.transactionFeeRejections += 1n;
        return { ok: false, rejection: { code: quote.code, stage: 'execution', detail: quote.detail } };
      }
      computed = quote.quote.estimatedTotal;
      if (computed > tx.budget.maxFee) {
        this.releaseReservation(tx);
        this.metrics.transactionFeeRejections += 1n;
        return {
          ok: false,
          rejection: {
            code: 'INSUFFICIENT_MAX_FEE',
            stage: 'execution',
            detail: 'required fee exceeds the signed max_fee; insufficient-fee path applies',
          },
        };
      }
      actualFee = computed;
      baseCharge = quote.quote.baseCharge;
      priorityFee = quote.quote.priorityFee;
      baseResourcePrice = quote.quote.baseResourcePrice;
    }
    const reservedFee = tx.budget.exemption === 'NONE' ? tx.budget.maxFee : 0n;
    const releasedFee = reservedFee - actualFee;

    if (tx.budget.exemption === 'NONE') {
      if (!this.accounts.chargeReserved(tx.budget.feePayer, tx.budget.feeAsset, actualFee, reservedFee)) {
        return {
          ok: false,
          rejection: {
            code: 'INSUFFICIENT_FEE_BALANCE',
            stage: 'execution',
            detail: 'reserved fee missing at charge time',
          },
        };
      }
    }

    const v2Disposition =
      this.policyVersion === 2
        ? disposeFeeV2(this.dispositionPolicyV2, tx.budget.feeAsset, actualFee)
        : null;
    const disposition = v2Disposition
      ? toHistoricDispositionShape(v2Disposition)
      : disposeFee(this.dispositionPolicy, tx.budget.feeAsset, actualFee);
    if ((v2Disposition && !dispositionV2Reconciles(v2Disposition)) || !dispositionReconciles(disposition)) {
      return {
        ok: false,
        rejection: { code: 'DISPOSITION_MISMATCH', stage: 'execution', detail: 'fee disposition does not reconcile' },
      };
    }
    this.applyDisposition(disposition);
    const shares = this.accrueRewards(input.proposerId, input.validators, disposition);

    const receipt: FeeReceipt = Object.freeze({
      transactionId: tx.transactionId,
      payer: tx.budget.feePayer,
      asset: tx.budget.feeAsset,
      reservedFee,
      actualFee,
      releasedFee,
      resourceUsage: usage,
      feeScheduleVersion: this.schedule.version,
      dispositionPolicyVersion: this.dispositionPolicy.version,
      blockHeight: input.blockHeight,
      blockId: input.blockId,
      outcome,
      disposition,
      policyVersion: this.policyVersion,
      ...(baseResourcePrice !== undefined ? { baseResourcePrice } : {}),
      baseCharge,
      priorityFee,
    });
    this.receipts.set(tx.transactionId, receipt);
    this.metrics.executionUnits += totalUnits(usage);
    this.metrics.blockExecutionUnits += totalUnits(usage);
    this.metrics.feeRevenueByAsset[tx.budget.feeAsset] += actualFee;
    this.metrics.feeBurned += disposition.burned;
    this.metrics.feeNetworkSink += disposition.networkSink;
    this.metrics.validatorRewardAccrual += shares.reduce((sum, share) => sum + share.amount, 0n);

    if (outcome === 'OUT_OF_EXECUTION_UNITS') {
      return {
        ok: false,
        rejection: {
          code: 'OUT_OF_EXECUTION_UNITS',
          stage: 'execution',
          detail: 'execution exceeded the declared budget; application state was not mutated',
        },
      };
    }
    return { ok: true, receipt, applicationApplied };
  }

  claimRewards(validatorId: string, asset: FeeAssetId): bigint {
    const accrued = this.rewardAccrual.get(validatorId)?.[asset] ?? 0n;
    if (accrued === 0n) {
      return 0n;
    }
    const record = this.rewardAccrual.get(validatorId)!;
    record[asset] = 0n;
    this.accounts.credit(validatorId, asset, accrued);
    return accrued;
  }

  rewardsOf(validatorId: string): Record<FeeAssetId, bigint> {
    return this.rewardAccrual.get(validatorId) ?? { SUNREY_COIN: 0n, MOONREY_COIN: 0n };
  }

  receiptOf(transactionId: string): FeeReceipt | undefined {
    return this.receipts.get(transactionId);
  }

  receiptHash(receipt: FeeReceipt): string {
    return commitCanonical({
      domain: FEE_RECEIPT_DOMAIN,
      transactionId: receipt.transactionId,
      payer: receipt.payer,
      asset: receipt.asset,
      reservedFee: receipt.reservedFee.toString(),
      actualFee: receipt.actualFee.toString(),
      releasedFee: receipt.releasedFee.toString(),
      resourceUsage: Object.fromEntries(
        Object.entries(receipt.resourceUsage).map(([key, value]) => [key, value.toString()]),
      ),
      feeScheduleVersion: receipt.feeScheduleVersion,
      dispositionPolicyVersion: receipt.dispositionPolicyVersion,
      blockHeight: receipt.blockHeight,
      blockId: receipt.blockId,
      outcome: receipt.outcome,
    });
  }

  private replaceAccounts(next: NativeAssetAccounts): void {
    this.accounts.copyFrom(next);
  }

  private applyDisposition(disposition: FeeDisposition): void {
    if (disposition.actualFee === 0n) {
      return;
    }
    this.accounts.credit(NETWORK_SINK_ACCOUNT, disposition.asset, disposition.networkSink);
    this.accounts.credit(BURN_ACCOUNT, disposition.asset, disposition.burned);
    this.accounts.credit(TREASURY_ACCOUNT, disposition.asset, disposition.treasury);
    this.accounts.credit(REWARD_POOL_ACCOUNT, disposition.asset, disposition.validatorRewardPool);
  }

  private accrueRewards(
    proposerId: string,
    validators: readonly ValidatorDescriptor[],
    disposition: { readonly asset: FeeAssetId; readonly validatorRewardPool: bigint },
  ): ValidatorRewardShare[] {
    const pool = disposition.validatorRewardPool;
    if (pool === 0n || validators.length === 0) {
      return [];
    }
    const proposerShare = (pool * this.dispositionPolicy.proposerShareBps) / BASIS_POINTS_DENOMINATOR;
    const remainder = pool - proposerShare;
    const totalPower = validators.reduce((sum, validator) => sum + validator.votingPower, 0n);
    const shares: ValidatorRewardShare[] = [];
    let allocated = 0n;
    const ordered = [...validators].sort((left, right) => left.validatorId.localeCompare(right.validatorId));
    for (const validator of ordered) {
      const amount =
        totalPower === 0n ? 0n : (remainder * validator.votingPower) / totalPower;
      allocated += amount;
      shares.push({
        validatorId: validator.validatorId,
        votingPower: validator.votingPower,
        amount: amount + (validator.validatorId === proposerId ? proposerShare : 0n),
        role: validator.validatorId === proposerId ? 'PROPOSER' : 'PARTICIPANT',
      });
    }
    const leftover = remainder - allocated;
    const proposer = shares.find((share) => share.validatorId === proposerId) ?? shares[0];
    if (proposer) {
      shares[shares.indexOf(proposer)] = {
        ...proposer,
        amount: proposer.amount + leftover,
        role: 'PROPOSER',
      };
    }
    for (const share of shares) {
      const current = this.rewardAccrual.get(share.validatorId) ?? { SUNREY_COIN: 0n, MOONREY_COIN: 0n };
      current[disposition.asset] = (current[disposition.asset] ?? 0n) + share.amount;
      this.rewardAccrual.set(share.validatorId, current);
    }
    const rewardSum = shares.reduce((sum, share) => sum + share.amount, 0n);
    if (rewardSum !== pool) {
      throw new Error('validator reward allocation must reconcile');
    }
    return shares;
  }
}

function minBig(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

export function estimateFee(
  schedule: FeeSchedule,
  usage: ResourceUsage,
): { readonly estimatedFee: bigint; readonly usage: ResourceUsage } {
  return { estimatedFee: calculateFee(schedule, usage), usage };
}

export { emptyUsage };
