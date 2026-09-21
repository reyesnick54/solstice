import type {
  CapsuleSizingConstraints,
  InvalidationStructure,
  PositionSizingInput,
  PositionSizingMethod,
  SizingMethodCap,
} from './types.ts';

function clampMinor(value: bigint): bigint {
  return value < 0n ? 0n : value;
}

export function resolveInvalidationDistanceMinor(input: {
  readonly priceMinor: bigint;
  readonly invalidation: InvalidationStructure;
  readonly volatilityBps: number | null;
}): bigint {
  const { priceMinor, invalidation, volatilityBps } = input;
  if (priceMinor <= 0n) {
    return 0n;
  }
  switch (invalidation.kind) {
    case 'PRICE_DISTANCE':
      return clampMinor(invalidation.distanceMinor ?? 0n);
    case 'PERCENTAGE_DISTANCE': {
      const bps = invalidation.distanceBps ?? 0;
      return clampMinor((priceMinor * BigInt(bps)) / 10_000n);
    }
    case 'VOLATILITY_MULTIPLE': {
      if (volatilityBps == null || volatilityBps <= 0) {
        return 0n;
      }
      const multipleBps = invalidation.volatilityMultipleBps ?? 100;
      const distanceBps = Math.floor((volatilityBps * multipleBps) / 10_000);
      return clampMinor((priceMinor * BigInt(distanceBps)) / 10_000n);
    }
    default:
      return 0n;
  }
}

export function computeVolatilityTargetingCap(input: PositionSizingInput, targetVolBps: number): SizingMethodCap {
  const portfolio = input.portfolioTotalMinor > 0n ? input.portfolioTotalMinor : input.availableCapitalMinor;
  if (input.volatilityBps == null || input.volatilityBps <= 0 || portfolio <= 0n) {
    return Object.freeze({
      method: 'VOLATILITY_TARGETING',
      capMinor: 0n,
      explanation: 'volatility unavailable or zero portfolio — volatility targeting cap is zero',
    });
  }
  const capMinor = clampMinor((portfolio * BigInt(targetVolBps)) / BigInt(input.volatilityBps));
  return Object.freeze({
    method: 'VOLATILITY_TARGETING',
    capMinor,
    explanation: `volatility targeting: portfolio ${portfolio} * target ${targetVolBps}bps / instrument vol ${input.volatilityBps}bps`,
  });
}

export function computeRiskBudgetCap(input: PositionSizingInput): SizingMethodCap {
  const budgetBase = input.customerAuthorizedCapitalMinor > 0n
    ? input.customerAuthorizedCapitalMinor
    : input.availableCapitalMinor;
  const riskBudgetMinor = clampMinor(
    (budgetBase * BigInt(input.capsuleConstraints.perTradeRiskBudgetBps)) / 10_000n,
  );
  const distanceMinor = resolveInvalidationDistanceMinor({
    priceMinor: input.instrumentPriceMinor,
    invalidation: input.invalidation,
    volatilityBps: input.volatilityBps,
  });
  if (distanceMinor <= 0n || input.instrumentPriceMinor <= 0n) {
    return Object.freeze({
      method: 'RISK_BUDGET',
      capMinor: 0n,
      explanation: 'invalidation distance unresolved — risk budget cap is zero',
    });
  }
  const capMinor = clampMinor((riskBudgetMinor * input.instrumentPriceMinor) / distanceMinor);
  return Object.freeze({
    method: 'RISK_BUDGET',
    capMinor,
    explanation: `risk budget ${riskBudgetMinor} with invalidation distance ${distanceMinor} at price ${input.instrumentPriceMinor}`,
  });
}

export function computeMaxLossAtInvalidationCap(input: PositionSizingInput): SizingMethodCap {
  const distanceMinor = resolveInvalidationDistanceMinor({
    priceMinor: input.instrumentPriceMinor,
    invalidation: input.invalidation,
    volatilityBps: input.volatilityBps,
  });
  const maxLossMinor = clampMinor(
    (input.availableCapitalMinor * BigInt(input.capsuleConstraints.perTradeRiskBudgetBps)) / 10_000n,
  );
  if (distanceMinor <= 0n || input.instrumentPriceMinor <= 0n) {
    return Object.freeze({
      method: 'MAX_LOSS_AT_INVALIDATION',
      capMinor: 0n,
      explanation: 'invalidation distance unresolved — max-loss cap is zero',
    });
  }
  const capMinor = clampMinor((maxLossMinor * input.instrumentPriceMinor) / distanceMinor);
  return Object.freeze({
    method: 'MAX_LOSS_AT_INVALIDATION',
    capMinor,
    explanation: `max loss at invalidation ${maxLossMinor} over distance ${distanceMinor}`,
  });
}

export function computeMaxPortfolioAllocationCap(
  input: PositionSizingInput,
  constraints: CapsuleSizingConstraints,
): SizingMethodCap {
  const portfolio = input.portfolioTotalMinor > 0n ? input.portfolioTotalMinor : input.availableCapitalMinor;
  const allocationBps = Math.min(
    constraints.maxRecommendedExposureBps,
    input.assetClassLimitBps,
    input.strategyLimitBps,
  );
  const capMinor = clampMinor((portfolio * BigInt(allocationBps)) / 10_000n);
  return Object.freeze({
    method: 'MAX_PORTFOLIO_ALLOCATION',
    capMinor,
    explanation: `max portfolio allocation ${allocationBps}bps of ${portfolio}`,
  });
}

export function computeLiquidityAdjustedCap(input: PositionSizingInput): SizingMethodCap {
  const liquidityScore = Math.max(0, Math.min(10_000, input.liquidityScoreBps));
  let capMinor = input.availableCapitalMinor;
  if (input.averageDailyVolumeMinor != null && input.averageDailyVolumeMinor > 0n) {
    const advCap = clampMinor((input.averageDailyVolumeMinor * BigInt(liquidityScore)) / 10_000n);
    capMinor = capMinor < advCap ? capMinor : advCap;
  } else {
    capMinor = clampMinor((capMinor * BigInt(liquidityScore)) / 10_000n);
  }
  return Object.freeze({
    method: 'LIQUIDITY_ADJUSTED_CAP',
    capMinor,
    explanation: `liquidity-adjusted cap from score ${liquidityScore}bps`,
  });
}

export function computeMethodCaps(input: PositionSizingInput, targetVolBps: number): readonly SizingMethodCap[] {
  const enabled = new Set<PositionSizingMethod>(input.enabledMethods);
  const caps: SizingMethodCap[] = [];
  if (enabled.has('VOLATILITY_TARGETING')) {
    caps.push(computeVolatilityTargetingCap(input, targetVolBps));
  }
  if (enabled.has('RISK_BUDGET')) {
    caps.push(computeRiskBudgetCap(input));
  }
  if (enabled.has('MAX_LOSS_AT_INVALIDATION')) {
    caps.push(computeMaxLossAtInvalidationCap(input));
  }
  if (enabled.has('MAX_PORTFOLIO_ALLOCATION')) {
    caps.push(computeMaxPortfolioAllocationCap(input, input.capsuleConstraints));
  }
  if (enabled.has('LIQUIDITY_ADJUSTED_CAP')) {
    caps.push(computeLiquidityAdjustedCap(input));
  }
  return Object.freeze(caps);
}

export function estimateLossAtInvalidationMinor(input: {
  readonly notionalMinor: bigint;
  readonly priceMinor: bigint;
  readonly invalidation: InvalidationStructure;
  readonly volatilityBps: number | null;
}): bigint {
  if (input.notionalMinor <= 0n || input.priceMinor <= 0n) {
    return 0n;
  }
  const distanceMinor = resolveInvalidationDistanceMinor({
    priceMinor: input.priceMinor,
    invalidation: input.invalidation,
    volatilityBps: input.volatilityBps,
  });
  if (distanceMinor <= 0n) {
    return 0n;
  }
  return clampMinor((input.notionalMinor * distanceMinor) / input.priceMinor);
}
