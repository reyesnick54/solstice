import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';
import {
  computeMethodCaps,
  estimateLossAtInvalidationMinor,
  resolveInvalidationDistanceMinor,
} from './methods.ts';
import {
  POSITION_SIZING_CONFIG_VERSION,
  type BindingConstraint,
  type MetaAllocatorSizingBridgeInput,
  type MetaAllocatorSizingBridgeResult,
  type PositionSizingAdjustments,
  type PositionSizingInput,
  type PositionSizingMethod,
  type PositionSizingResult,
  type SizingMethodCap,
} from './types.ts';

export const DEFAULT_TARGET_VOLATILITY_BPS = 1500;
export const KELLY_SIZING_RESEARCH_ONLY = true as const;
export const KELLY_SIZING_ENABLED_BY_DEFAULT = false as const;

const DEFAULT_ENABLED_METHODS: readonly PositionSizingMethod[] = Object.freeze([
  'VOLATILITY_TARGETING',
  'RISK_BUDGET',
  'MAX_LOSS_AT_INVALIDATION',
  'MAX_PORTFOLIO_ALLOCATION',
  'LIQUIDITY_ADJUSTED_CAP',
]);

function clampBps(value: number): number {
  return Math.max(0, Math.min(10_000, Math.floor(value)));
}

function clampMinor(value: bigint): bigint {
  return value < 0n ? 0n : value;
}

function minCap(caps: readonly SizingMethodCap[]): { readonly cap: SizingMethodCap | null; readonly minor: bigint } {
  if (caps.length === 0) {
    return { cap: null, minor: 0n };
  }
  let winner = caps[0]!;
  for (const cap of caps.slice(1)) {
    if (cap.capMinor < winner.capMinor) {
      winner = cap;
    }
  }
  return { cap: winner, minor: winner.capMinor };
}

function quantityFromNotional(notionalMinor: bigint, priceMinor: bigint, quantityScale: number): bigint {
  if (notionalMinor <= 0n || priceMinor <= 0n) {
    return 0n;
  }
  const scale = BigInt(10 ** quantityScale);
  return clampMinor((notionalMinor * scale) / priceMinor);
}

function roundToLot(quantityUnits: bigint, lotSizeUnits: bigint): bigint {
  if (lotSizeUnits <= 0n) {
    return quantityUnits;
  }
  return clampMinor((quantityUnits / lotSizeUnits) * lotSizeUnits);
}

function sizingIdFor(material: string): string {
  return `psz_${createHash('sha256').update(material).digest('hex').slice(0, 24)}`;
}

function computeAdjustments(input: PositionSizingInput, baseMinor: bigint): PositionSizingAdjustments {
  let volatilityAdjustmentBps = 10_000;
  if (input.volatilityQuality === 'MISSING') {
    volatilityAdjustmentBps = 0;
  } else if (input.volatilityQuality === 'STALE') {
    volatilityAdjustmentBps = 5000;
  }

  let liquidityAdjustmentBps = clampBps(input.liquidityScoreBps);
  if (input.liquidityScoreBps < 2000) {
    liquidityAdjustmentBps = Math.min(liquidityAdjustmentBps, 2500);
  }

  let correlationAdjustmentBps = 10_000;
  if (input.correlationContext.maxCorrelationBps >= 8000) {
    correlationAdjustmentBps = 3000;
  } else if (input.correlationContext.maxCorrelationBps >= 6000) {
    correlationAdjustmentBps = 6000;
  } else if (input.correlationContext.averageCorrelationBps >= 5000) {
    correlationAdjustmentBps = 7500;
  }

  let concentrationAdjustmentBps = 10_000;
  const portfolio = input.portfolioTotalMinor > 0n ? input.portfolioTotalMinor : input.availableCapitalMinor;
  if (portfolio > 0n) {
    const instrumentShareBps = Number((input.currentInstrumentExposureMinor * 10_000n) / portfolio);
    if (instrumentShareBps >= 3000) {
      concentrationAdjustmentBps = 2000;
    } else if (instrumentShareBps >= 1500) {
      concentrationAdjustmentBps = 5000;
    }
  }
  if (input.factorExposureContext.projectedCrowdingBps >= 7000) {
    concentrationAdjustmentBps = Math.min(concentrationAdjustmentBps, 4000);
  }

  const confidenceAdjustmentBps = clampBps(input.strategyConfidenceBps);

  let drawdownAdjustmentBps = 10_000;
  if (input.drawdownGuardBps > 0 && input.drawdownStateBps >= input.drawdownGuardBps) {
    drawdownAdjustmentBps = 0;
  } else if (input.drawdownGuardBps > 0 && input.drawdownStateBps >= Math.floor(input.drawdownGuardBps * 0.75)) {
    drawdownAdjustmentBps = 4000;
  } else if (input.drawdownStateBps >= 1500) {
    drawdownAdjustmentBps = 7000;
  }

  const totalCostBps = input.spreadBps + input.estimatedSlippageBps;
  let transactionCostAdjustmentBps = 10_000;
  if (baseMinor > 0n && totalCostBps >= 100) {
    transactionCostAdjustmentBps = 5000;
  } else if (baseMinor > 0n && totalCostBps >= 50) {
    transactionCostAdjustmentBps = 7500;
  }

  return Object.freeze({
    volatilityAdjustmentBps,
    liquidityAdjustmentBps,
    correlationAdjustmentBps,
    concentrationAdjustmentBps,
    confidenceAdjustmentBps,
    drawdownAdjustmentBps,
    transactionCostAdjustmentBps,
  });
}

function applyAdjustments(baseMinor: bigint, adjustments: PositionSizingAdjustments): bigint {
  if (baseMinor <= 0n) {
    return 0n;
  }
  const factors = [
    adjustments.volatilityAdjustmentBps,
    adjustments.liquidityAdjustmentBps,
    adjustments.correlationAdjustmentBps,
    adjustments.concentrationAdjustmentBps,
    adjustments.confidenceAdjustmentBps,
    adjustments.drawdownAdjustmentBps,
    adjustments.transactionCostAdjustmentBps,
  ];
  let adjusted = baseMinor;
  for (const factorBps of factors) {
    adjusted = clampMinor((adjusted * BigInt(factorBps)) / 10_000n);
  }
  return adjusted;
}

function resolveBindingConstraint(params: {
  readonly approvedMinor: bigint;
  readonly requestedMinor: bigint;
  readonly methodWinner: SizingMethodCap | null;
  readonly sizingInput: PositionSizingInput;
  readonly adjustments: PositionSizingAdjustments;
}): BindingConstraint {
  const { approvedMinor, requestedMinor, methodWinner, sizingInput, adjustments } = params;
  if (sizingInput.availableCapitalMinor <= 0n || sizingInput.customerAuthorizedCapitalMinor <= 0n) {
    return 'ZERO_CAPITAL';
  }
  if (adjustments.volatilityAdjustmentBps === 0) {
    return sizingInput.volatilityQuality === 'MISSING' ? 'MISSING_VOLATILITY' : 'STALE_VOLATILITY';
  }
  if (adjustments.drawdownAdjustmentBps === 0) {
    return 'DRAWDOWN_GUARD';
  }
  if (adjustments.liquidityAdjustmentBps <= 2500 && sizingInput.liquidityScoreBps < 2000) {
    return 'INSUFFICIENT_LIQUIDITY';
  }
  if (adjustments.correlationAdjustmentBps <= 3000) {
    return 'HIGH_CORRELATION';
  }
  if (adjustments.concentrationAdjustmentBps <= 2000) {
    return 'CONCENTRATED_PORTFOLIO';
  }
  if (approvedMinor <= 0n) {
    if (methodWinner != null) {
      return methodWinner.method;
    }
    return 'ZERO_CAPITAL';
  }
  if (approvedMinor < sizingInput.providerConstraints.minimumOrderSizeMinor) {
    return 'PROVIDER_MINIMUM_ORDER';
  }
  if (sizingInput.positionLimitMinor > 0n && approvedMinor > sizingInput.positionLimitMinor) {
    return 'POSITION_LIMIT';
  }
  if (approvedMinor < requestedMinor) {
    return methodWinner?.method ?? 'META_ALLOCATOR_PROPOSAL';
  }
  if (adjustments.transactionCostAdjustmentBps <= 5000) {
    return 'TRANSACTION_COSTS';
  }
  return methodWinner?.method ?? 'META_ALLOCATOR_PROPOSAL';
}

export function computePositionSize(
  input: PositionSizingInput,
  options?: { readonly targetVolatilityBps?: number },
): PositionSizingResult {
  const targetVolBps = options?.targetVolatilityBps ?? DEFAULT_TARGET_VOLATILITY_BPS;
  const enabledMethods = input.enabledMethods.length > 0 ? input.enabledMethods : DEFAULT_ENABLED_METHODS;
  const normalizedInput: PositionSizingInput = Object.freeze({
    ...input,
    enabledMethods,
    configVersion: POSITION_SIZING_CONFIG_VERSION,
  });

  const evidence: string[] = [
    'deterministic risk-based position sizing',
    `configVersion=${POSITION_SIZING_CONFIG_VERSION}`,
    `kellyResearchOnly=${String(KELLY_SIZING_RESEARCH_ONLY)}`,
    `kellyEnabledByDefault=${String(KELLY_SIZING_ENABLED_BY_DEFAULT)}`,
    `invalidationKind=${normalizedInput.invalidation.kind}`,
  ];

  const methodCaps = computeMethodCaps(normalizedInput, targetVolBps);
  const { cap: methodWinner, minor: methodCapMinor } = minCap(methodCaps);

  let baseMinor = methodCapMinor;
  if (normalizedInput.metaAllocatorProposedNotionalMinor > 0n) {
    baseMinor = baseMinor < normalizedInput.metaAllocatorProposedNotionalMinor
      ? baseMinor
      : normalizedInput.metaAllocatorProposedNotionalMinor;
    evidence.push(`metaAllocatorProposed=${normalizedInput.metaAllocatorProposedNotionalMinor.toString()}`);
  }

  if (normalizedInput.positionLimitMinor > 0n && baseMinor > normalizedInput.positionLimitMinor) {
    baseMinor = normalizedInput.positionLimitMinor;
    evidence.push(`positionLimitApplied=${normalizedInput.positionLimitMinor.toString()}`);
  }

  const adjustments = computeAdjustments(normalizedInput, baseMinor);
  let approvedMinor = applyAdjustments(baseMinor, adjustments);

  if (normalizedInput.providerConstraints.maximumOrderSizeMinor != null) {
    const maxOrder = normalizedInput.providerConstraints.maximumOrderSizeMinor;
    if (approvedMinor > maxOrder) {
      approvedMinor = maxOrder;
      evidence.push(`providerMaximumOrderApplied=${maxOrder.toString()}`);
    }
  }

  if (
    approvedMinor > 0n &&
    approvedMinor < normalizedInput.providerConstraints.minimumOrderSizeMinor
  ) {
    approvedMinor = 0n;
    evidence.push(
      `belowProviderMinimumOrder=${normalizedInput.providerConstraints.minimumOrderSizeMinor.toString()}`,
    );
  }

  const quantityScale = normalizedInput.providerConstraints.quantityScale;
  let quantityUnits = quantityFromNotional(
    approvedMinor,
    normalizedInput.instrumentPriceMinor,
    quantityScale,
  );
  quantityUnits = roundToLot(quantityUnits, normalizedInput.providerConstraints.lotSizeUnits);

  if (quantityUnits <= 0n) {
    approvedMinor = 0n;
  } else if (normalizedInput.instrumentPriceMinor > 0n) {
    const scale = BigInt(10 ** quantityScale);
    approvedMinor = clampMinor((quantityUnits * normalizedInput.instrumentPriceMinor) / scale);
  }

  const distanceMinor = resolveInvalidationDistanceMinor({
    priceMinor: normalizedInput.instrumentPriceMinor,
    invalidation: normalizedInput.invalidation,
    volatilityBps: normalizedInput.volatilityBps,
  });
  evidence.push(`invalidationDistanceMinor=${distanceMinor.toString()}`);

  const riskBudgetUsedMinor = clampMinor(
    (normalizedInput.availableCapitalMinor * BigInt(normalizedInput.capsuleConstraints.perTradeRiskBudgetBps)) /
      10_000n,
  );
  const estimatedLossAtInvalidationMinor = estimateLossAtInvalidationMinor({
    notionalMinor: approvedMinor,
    priceMinor: normalizedInput.instrumentPriceMinor,
    invalidation: normalizedInput.invalidation,
    volatilityBps: normalizedInput.volatilityBps,
  });

  const bindingConstraint = resolveBindingConstraint({
    approvedMinor,
    requestedMinor: normalizedInput.metaAllocatorProposedNotionalMinor,
    methodWinner,
    sizingInput: normalizedInput,
    adjustments,
  });

  for (const cap of methodCaps) {
    evidence.push(`${cap.method}:${cap.capMinor.toString()}`);
  }
  evidence.push(`bindingConstraint=${bindingConstraint}`);

  const material = JSON.stringify(
    {
      requestId: normalizedInput.requestId,
      configVersion: POSITION_SIZING_CONFIG_VERSION,
      instrumentId: normalizedInput.instrumentId,
      approvedMinor: approvedMinor.toString(),
      methodCaps: methodCaps.map((row) => [row.method, row.capMinor.toString()]),
      adjustments,
      bindingConstraint,
    },
    (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
  );

  return Object.freeze({
    sizingId: sizingIdFor(material),
    requestId: normalizedInput.requestId,
    configVersion: POSITION_SIZING_CONFIG_VERSION,
    instrumentId: normalizedInput.instrumentId,
    requestedNotionalMinor: normalizedInput.metaAllocatorProposedNotionalMinor,
    approvedNotionalMinor: approvedMinor,
    quantityUnits,
    quantityScale,
    riskBudgetUsedMinor,
    estimatedLossAtInvalidationMinor,
    adjustments,
    methodCaps,
    bindingConstraint,
    evidence: Object.freeze(evidence),
    deterministic: true,
    aiControlled: false,
    computedAt: normalizedInput.computedAt,
  });
}

export function bridgeMetaAllocatorToPositionSizing(
  bridge: MetaAllocatorSizingBridgeInput,
): MetaAllocatorSizingBridgeResult {
  const sizingInput: PositionSizingInput = Object.freeze({
    ...bridge.sizingInput,
    metaAllocatorProposedNotionalMinor: bridge.metaAllocatorRecommendedMinor,
  });
  const sizing = computePositionSize(sizingInput);
  return Object.freeze({
    sizing,
    executionApprovedNotionalMinor: sizing.approvedNotionalMinor,
    grantsExecutionAuthority: false,
  });
}

export function defaultPositionSizingMethods(): readonly PositionSizingMethod[] {
  return DEFAULT_ENABLED_METHODS;
}

export type { UtcInstant };
