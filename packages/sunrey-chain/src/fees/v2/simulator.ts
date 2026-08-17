/**
 * AdaptiveFeeSimulator — engineering simulation only.
 *
 * Not a production fee-parameter tuner and not a live market.
 */

import { emptyUsageV2, type ResourceUsageV2 } from './types.ts';
import { weightedUsage } from './meter.ts';
import { nextBaseResourcePrice, initialBaseResourcePriceState } from './price.ts';
import { disposeFeeV2 } from './disposition.ts';
import { developmentFeeDispositionPolicyV2 } from './disposition.ts';
import { developmentFeePolicyV2 } from './policy.ts';
import { quoteFeeV2 } from './quote.ts';
import type { BaseResourcePriceState, FeePolicyV2 } from './types.ts';

export const SIMULATOR_CLASS = 'ENGINEERING_SIMULATION' as const;

export const FEE_MARKET_SCENARIOS = [
  'VERY_LOW_UTILIZATION',
  'TARGET_UTILIZATION',
  'SUSTAINED_HIGH_UTILIZATION',
  'SUDDEN_TRANSACTION_BURST',
  'SPAM_BURST',
  'PQ_HEAVY_WORKLOAD',
  'ORACLE_HEAVY_WORKLOAD',
  'INTEROP_HEAVY_WORKLOAD',
  'EXCHANGE_HEAVY_WORKLOAD',
] as const;
export type FeeMarketScenario = (typeof FEE_MARKET_SCENARIOS)[number];

export type SimulationBlock = {
  readonly height: number;
  readonly usage: ResourceUsageV2;
  readonly weightedUsage: bigint;
  readonly utilizationBps: bigint;
  readonly basePrice: bigint;
  readonly fees: readonly bigint[];
  readonly rejected: number;
  readonly validatorAllocation: bigint;
  readonly burnAllocation: bigint;
  readonly treasuryAllocation: bigint;
  readonly saturated: boolean;
};

export type SimulationMetrics = {
  readonly classification: typeof SIMULATOR_CLASS;
  readonly resourceUtilizationBps: bigint;
  readonly basePriceTrajectory: readonly bigint[];
  readonly averageFee: bigint;
  readonly p50Fee: bigint;
  readonly p95Fee: bigint;
  readonly p99Fee: bigint;
  readonly validatorAllocation: bigint;
  readonly burnAllocation: bigint;
  readonly treasuryAllocation: bigint;
  readonly rejectedTransactionCount: number;
  readonly blockResourceSaturation: bigint;
};

export type StabilityFinding =
  | 'EXCESSIVE_OSCILLATION'
  | 'FEE_RUNAWAY'
  | 'MINIMUM_PRICE_PINNING'
  | 'MAXIMUM_PRICE_PINNING'
  | 'INSUFFICIENT_SPAM_COST'
  | 'EXTREME_PRIORITY_FEE_BEHAVIOR'
  | 'STABLE';

export type ScenarioResult = {
  readonly scenario: FeeMarketScenario;
  readonly metrics: SimulationMetrics;
  readonly findings: readonly StabilityFinding[];
  readonly blocks: readonly SimulationBlock[];
};

function percentile(sorted: readonly bigint[], bps: bigint): bigint {
  if (sorted.length === 0) {
    return 0n;
  }
  const index = Number((BigInt(sorted.length - 1) * bps) / 10_000n);
  return sorted[index] ?? 0n;
}

function usageForScenario(scenario: FeeMarketScenario, height: number, policy: FeePolicyV2): ResourceUsageV2 {
  const limit = policy.bounds.blockResourceLimit;
  const base = emptyUsageV2();
  const fill = (weightedTarget: bigint, extras: Partial<ResourceUsageV2>): ResourceUsageV2 => {
    const bytes = weightedTarget > 0n ? weightedTarget : 0n;
    return Object.freeze({
      ...base,
      TRANSACTION_BYTE_UNITS: extras.TRANSACTION_BYTE_UNITS ?? bytes,
      SIGNATURE_VERIFY_CLASSICAL: extras.SIGNATURE_VERIFY_CLASSICAL ?? 0n,
      SIGNATURE_VERIFY_HYBRID: extras.SIGNATURE_VERIFY_HYBRID ?? 0n,
      SIGNATURE_VERIFY_PQ: extras.SIGNATURE_VERIFY_PQ ?? 0n,
      STATE_READ_UNITS: extras.STATE_READ_UNITS ?? 0n,
      STATE_WRITE_UNITS: extras.STATE_WRITE_UNITS ?? 0n,
      CRYPTOGRAPHIC_PROOF_UNITS: extras.CRYPTOGRAPHIC_PROOF_UNITS ?? 0n,
      ORACLE_VERIFY: extras.ORACLE_VERIFY ?? 0n,
      EXCHANGE_DVP_LEG: extras.EXCHANGE_DVP_LEG ?? 0n,
      INTEROP_PROOF: extras.INTEROP_PROOF ?? 0n,
      OTHER_GOVERNED_RESOURCE: extras.OTHER_GOVERNED_RESOURCE ?? 0n,
    });
  };
  switch (scenario) {
    case 'VERY_LOW_UTILIZATION':
      return fill(limit / 20n, {});
    case 'TARGET_UTILIZATION':
      return fill(limit / 2n, {});
    case 'SUSTAINED_HIGH_UTILIZATION':
      return fill((limit * 9n) / 10n, {});
    case 'SUDDEN_TRANSACTION_BURST':
      return fill(height < 3 ? limit / 10n : (limit * 9n) / 10n, {});
    case 'SPAM_BURST':
      return fill(limit, { TRANSACTION_BYTE_UNITS: limit, SIGNATURE_VERIFY_CLASSICAL: 64n });
    case 'PQ_HEAVY_WORKLOAD':
      return fill(limit / 3n, { SIGNATURE_VERIFY_PQ: 80n, TRANSACTION_BYTE_UNITS: 8_000n });
    case 'ORACLE_HEAVY_WORKLOAD':
      return fill(limit / 4n, { ORACLE_VERIFY: 200n, TRANSACTION_BYTE_UNITS: 4_000n });
    case 'INTEROP_HEAVY_WORKLOAD':
      return fill(limit / 5n, { INTEROP_PROOF: 40n, TRANSACTION_BYTE_UNITS: 6_000n });
    case 'EXCHANGE_HEAVY_WORKLOAD':
      return fill(limit / 4n, { EXCHANGE_DVP_LEG: 30n, TRANSACTION_BYTE_UNITS: 5_000n });
    default: {
      const _never: never = scenario;
      return _never;
    }
  }
}

function analyzeStability(
  policy: FeePolicyV2,
  prices: readonly bigint[],
  fees: readonly bigint[],
  rejected: number,
  scenario: FeeMarketScenario,
): StabilityFinding[] {
  const findings: StabilityFinding[] = [];
  if (prices.length >= 4) {
    let flips = 0;
    for (let i = 2; i < prices.length; i += 1) {
      const prev = prices[i - 1]! - prices[i - 2]!;
      const cur = prices[i]! - prices[i - 1]!;
      if ((prev > 0n && cur < 0n) || (prev < 0n && cur > 0n)) {
        flips += 1;
      }
    }
    if (flips >= prices.length / 2) {
      findings.push('EXCESSIVE_OSCILLATION');
    }
  }
  const last = prices[prices.length - 1] ?? policy.bounds.minBasePrice;
  const first = prices[0] ?? last;
  if (last === policy.bounds.maxBasePrice && first < policy.bounds.maxBasePrice) {
    findings.push('MAXIMUM_PRICE_PINNING');
  }
  if (last === policy.bounds.minBasePrice && scenario === 'VERY_LOW_UTILIZATION') {
    findings.push('MINIMUM_PRICE_PINNING');
  }
  if (last > first * 20n) {
    findings.push('FEE_RUNAWAY');
  }
  if (scenario === 'SPAM_BURST' && rejected === 0 && (fees[0] ?? 0n) < policy.minimumFee) {
    findings.push('INSUFFICIENT_SPAM_COST');
  }
  if (fees.some((fee) => fee > policy.bounds.maxBasePrice * policy.bounds.blockResourceLimit)) {
    findings.push('EXTREME_PRIORITY_FEE_BEHAVIOR');
  }
  if (findings.length === 0) {
    findings.push('STABLE');
  }
  return findings;
}

export class AdaptiveFeeSimulator {
  readonly policy: FeePolicyV2;
  constructor(policy: FeePolicyV2 = developmentFeePolicyV2()) {
    this.policy = policy;
  }

  run(scenario: FeeMarketScenario, blocks = 12): ScenarioResult {
    const disposition = developmentFeeDispositionPolicyV2();
    let price = initialBaseResourcePriceState(this.policy.bounds, 100n, 0);
    const history: SimulationBlock[] = [];
    const allFees: bigint[] = [];
    let rejected = 0;
    let validator = 0n;
    let burn = 0n;
    let treasury = 0n;
    let lastUsage = 0n;

    for (let height = 1; height <= blocks; height += 1) {
      price = nextBaseResourcePrice(price, lastUsage, this.policy.bounds, height);
      const usage = usageForScenario(scenario, height, this.policy);
      const weighted = weightedUsage(usage, this.policy.weights);
      const saturated = weighted >= this.policy.bounds.blockResourceLimit;
      const fees: bigint[] = [];
      const txCount = scenario === 'SPAM_BURST' ? 40 : 8;
      for (let i = 0; i < txCount; i += 1) {
        const quote = quoteFeeV2({
          policy: this.policy,
          usage,
          baseResourcePrice: price.baseResourcePrice,
          feeAsset: 'SUNREY_COIN',
          maximumAuthorizedFee: scenario === 'SPAM_BURST' && i % 5 === 0 ? 10n : 10_000_000n,
          authorizedPriorityFee: scenario === 'SUDDEN_TRANSACTION_BURST' && i === 0 ? 50n : 0n,
          priorityAuthorized: scenario === 'SUDDEN_TRANSACTION_BURST' && i === 0,
        });
        if (!quote.ok) {
          rejected += 1;
          continue;
        }
        fees.push(quote.quote.estimatedTotal);
        allFees.push(quote.quote.estimatedTotal);
        const split = disposeFeeV2(disposition, 'SUNREY_COIN', quote.quote.estimatedTotal);
        validator += split.validatorReward;
        burn += split.burned;
        treasury += split.treasury;
      }
      lastUsage = weighted > this.policy.bounds.blockResourceLimit ? this.policy.bounds.blockResourceLimit : weighted;
      history.push({
        height,
        usage,
        weightedUsage: weighted,
        utilizationBps: price.utilizationBps,
        basePrice: price.baseResourcePrice,
        fees,
        rejected,
        validatorAllocation: validator,
        burnAllocation: burn,
        treasuryAllocation: treasury,
        saturated,
      });
    }

    const sorted = [...allFees].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const sum = allFees.reduce((acc, fee) => acc + fee, 0n);
    const prices = history.map((block) => block.basePrice);
    const saturation = history.filter((block) => block.saturated).length;
    const metrics: SimulationMetrics = {
      classification: SIMULATOR_CLASS,
      resourceUtilizationBps: history[history.length - 1]?.utilizationBps ?? 0n,
      basePriceTrajectory: prices,
      averageFee: allFees.length === 0 ? 0n : sum / BigInt(allFees.length),
      p50Fee: percentile(sorted, 5_000n),
      p95Fee: percentile(sorted, 9_500n),
      p99Fee: percentile(sorted, 9_900n),
      validatorAllocation: validator,
      burnAllocation: burn,
      treasuryAllocation: treasury,
      rejectedTransactionCount: rejected,
      blockResourceSaturation: BigInt(saturation),
    };
    return {
      scenario,
      metrics,
      findings: analyzeStability(this.policy, prices, allFees, rejected, scenario),
      blocks: history,
    };
  }

  runAll(blocks = 12): readonly ScenarioResult[] {
    return FEE_MARKET_SCENARIOS.map((scenario) => this.run(scenario, blocks));
  }
}

export type { BaseResourcePriceState };
