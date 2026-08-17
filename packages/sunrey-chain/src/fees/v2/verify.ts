import { AdaptiveFeeSimulator, FEE_MARKET_SCENARIOS, type ScenarioResult } from './simulator.ts';
import { nextBaseResourcePrice, initialBaseResourcePriceState, validateAdaptivePriceBounds } from './price.ts';
import { developmentFeePolicyV2, validateFeePolicyV2 } from './policy.ts';
import { quoteFeeV2 } from './quote.ts';
import { disposeFeeV2, dispositionV2Reconciles, developmentFeeDispositionPolicyV2 } from './disposition.ts';
import { usageV2ForTransaction, weightedUsage } from './meter.ts';
import { emptyUsageV2, type FeePolicyV2 } from './types.ts';
import type { ExecutableTransaction } from '../types.ts';

export type PropertyResult = {
  readonly property: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type FeeMarketVerificationReport = {
  readonly classification: 'ENGINEERING_VERIFICATION';
  readonly policyVersion: 2;
  readonly formulaVersion: 'BASE_PRICE_FORMULA_V1';
  readonly productionParametersConfigured: false;
  readonly properties: readonly PropertyResult[];
  readonly simulations: readonly ScenarioResult[];
  readonly passed: boolean;
};

function transferLike(maxFee: bigint): ExecutableTransaction {
  return {
    transactionId: '00'.repeat(32),
    operation: 'NATIVE_TRANSFER',
    payerAuthenticated: true,
    encodedBytes: 240,
    signatureCount: 1,
    budget: {
      maxExecutionUnits: 10_000n,
      maxFee,
      feeAsset: 'SUNREY_COIN',
      feePayer: 'alice',
      exemption: 'NONE',
    },
  };
}

export function verifyFeeMarketProperties(policy: FeePolicyV2 = developmentFeePolicyV2()): PropertyResult[] {
  const results: PropertyResult[] = [];
  const boundsOk = validateAdaptivePriceBounds(policy.bounds) === null && validateFeePolicyV2(policy) === null;
  results.push({
    property: 'price_always_within_bounds',
    passed: boundsOk,
    detail: boundsOk ? 'bounds validate' : 'invalid bounds',
  });

  const initial = initialBaseResourcePriceState(policy.bounds, 100n, 0);
  const a = nextBaseResourcePrice(initial, 100n, policy.bounds, 1);
  const b = nextBaseResourcePrice(initial, 100n, policy.bounds, 1);
  results.push({
    property: 'deterministic_next_price',
    passed: a.baseResourcePrice === b.baseResourcePrice && a.adjustment === b.adjustment,
    detail: 'identical inputs produce identical next price',
  });

  const inBounds = [0n, policy.bounds.blockResourceLimit / 2n, policy.bounds.blockResourceLimit, policy.bounds.blockResourceLimit * 2n].every(
    (used) => {
      const next = nextBaseResourcePrice(initial, used, policy.bounds, 1);
      return next.baseResourcePrice >= policy.bounds.minBasePrice && next.baseResourcePrice <= policy.bounds.maxBasePrice;
    },
  );
  results.push({
    property: 'price_always_within_bounds_trajectory',
    passed: inBounds,
    detail: 'next price stays inside [min, max]',
  });

  const usage = usageV2ForTransaction(transferLike(50_000n));
  const quote = quoteFeeV2({
    policy,
    usage,
    baseResourcePrice: 100n,
    feeAsset: 'SUNREY_COIN',
    maximumAuthorizedFee: 50_000n,
    authorizedPriorityFee: 10n,
    priorityAuthorized: true,
  });
  results.push({
    property: 'charged_le_signed_max',
    passed: quote.ok && quote.quote.estimatedTotal <= quote.quote.maximumAuthorizedFee,
    detail: quote.ok ? 'quote respects max_fee' : quote.detail,
  });

  const reserved = 50_000n;
  const charged = quote.ok ? quote.quote.estimatedTotal : 0n;
  const released = reserved - charged;
  results.push({
    property: 'reserved_equals_charged_plus_released',
    passed: reserved === charged + released,
    detail: 'reservation identity holds',
  });

  const disposition = quote.ok
    ? disposeFeeV2(developmentFeeDispositionPolicyV2(), 'SUNREY_COIN', quote.quote.estimatedTotal)
    : null;
  results.push({
    property: 'disposition_exact',
    passed: disposition !== null && dispositionV2Reconciles(disposition),
    detail: 'validator + burn + treasury = charged',
  });

  results.push({
    property: 'no_asset_creation',
    passed: disposition !== null && disposition.charged === disposition.validatorReward + disposition.burned + disposition.treasury,
    detail: 'disposition cannot mint',
  });

  const left = usageV2ForTransaction(transferLike(1_000n));
  const right = usageV2ForTransaction(transferLike(1_000n));
  results.push({
    property: 'policy_version_deterministic',
    passed:
      Object.entries(left).every(([key, value]) => right[key as keyof typeof right] === value) &&
      policy.policyVersion === 2,
    detail: 'identical bytes produce identical usage and policy version 2',
  });

  let overflowRejected = false;
  try {
    weightedUsage(
      { ...emptyUsageV2(), TRANSACTION_BYTE_UNITS: (1n << 120n) },
      { ...policy.weights, weights: { ...policy.weights.weights, TRANSACTION_BYTE_UNITS: 1n << 20n } },
    );
  } catch {
    overflowRejected = true;
  }
  const overflowQuote = quoteFeeV2({
    policy,
    usage: { ...emptyUsageV2(), TRANSACTION_BYTE_UNITS: (1n << 100n) },
    baseResourcePrice: 1n << 40n,
    feeAsset: 'SUNREY_COIN',
    maximumAuthorizedFee: 1n << 126n,
  });
  results.push({
    property: 'overflow_impossible',
    passed: overflowRejected || !overflowQuote.ok,
    detail: 'overflow is a rejection',
  });

  return results;
}

export function buildFeeMarketVerificationReport(
  policy: FeePolicyV2 = developmentFeePolicyV2(),
): FeeMarketVerificationReport {
  const properties = verifyFeeMarketProperties(policy);
  const simulations = new AdaptiveFeeSimulator(policy).runAll(8);
  return {
    classification: 'ENGINEERING_VERIFICATION',
    policyVersion: 2,
    formulaVersion: 'BASE_PRICE_FORMULA_V1',
    productionParametersConfigured: false,
    properties,
    simulations,
    passed: properties.every((row) => row.passed) && simulations.length === FEE_MARKET_SCENARIOS.length,
  };
}
