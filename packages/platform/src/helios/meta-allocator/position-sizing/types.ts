/**
 * HELIOS Multi-Asset M19 — dynamic risk-based position sizing types.
 * Deterministic sizing only. No AI-controlled sizing authority.
 */

import type { UtcInstant } from '@solstice/domain';
import type { CorrelationContextInput } from '../../multi-asset/correlation/types.ts';
import type { FactorExposureContextInput } from '../../multi-asset/factor-exposure/types.ts';

export const POSITION_SIZING_CONFIG_VERSION = 'helios-position-sizing-v1' as const;

export const POSITION_SIZING_METHODS = [
  'VOLATILITY_TARGETING',
  'RISK_BUDGET',
  'MAX_LOSS_AT_INVALIDATION',
  'MAX_PORTFOLIO_ALLOCATION',
  'LIQUIDITY_ADJUSTED_CAP',
] as const;

export type PositionSizingMethod = (typeof POSITION_SIZING_METHODS)[number];

export const INVALIDATION_DISTANCE_KINDS = [
  'PRICE_DISTANCE',
  'PERCENTAGE_DISTANCE',
  'VOLATILITY_MULTIPLE',
] as const;

export type InvalidationDistanceKind = (typeof INVALIDATION_DISTANCE_KINDS)[number];

export type InvalidationStructure = {
  readonly kind: InvalidationDistanceKind;
  readonly distanceMinor?: bigint;
  readonly distanceBps?: number;
  readonly volatilityMultipleBps?: number;
};

export type VolatilityQuality = 'CURRENT' | 'STALE' | 'MISSING';

export type CapsuleSizingConstraints = {
  readonly strategyId: string;
  readonly version: string;
  readonly maxRecommendedExposureBps: number;
  readonly maximumConcurrentPositions: number;
  readonly perTradeRiskBudgetBps: number;
  readonly invalidation: InvalidationStructure;
};

export type ProviderExecutionConstraints = {
  readonly minimumOrderSizeMinor: bigint;
  readonly maximumOrderSizeMinor: bigint | null;
  readonly lotSizeUnits: bigint;
  readonly quantityScale: number;
  readonly spreadBps: number;
  readonly estimatedSlippageBps: number;
  readonly commissionMinor: bigint;
};

export type PositionSizingInput = {
  readonly requestId: string;
  readonly configVersion: typeof POSITION_SIZING_CONFIG_VERSION;
  readonly computedAt: UtcInstant;
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly currency: string;
  readonly customerAuthorizedCapitalMinor: bigint;
  readonly availableCapitalMinor: bigint;
  readonly strategyConfidenceBps: number;
  readonly capsuleConstraints: CapsuleSizingConstraints;
  readonly instrumentPriceMinor: bigint;
  readonly volatilityBps: number | null;
  readonly volatilityQuality: VolatilityQuality;
  readonly liquidityScoreBps: number;
  readonly averageDailyVolumeMinor: bigint | null;
  readonly spreadBps: number;
  readonly estimatedSlippageBps: number;
  readonly invalidation: InvalidationStructure;
  readonly currentInstrumentExposureMinor: bigint;
  readonly currentPortfolioExposureMinor: bigint;
  readonly portfolioTotalMinor: bigint;
  readonly correlationContext: CorrelationContextInput;
  readonly factorExposureContext: FactorExposureContextInput;
  readonly assetClassLimitBps: number;
  readonly strategyLimitBps: number;
  readonly positionLimitMinor: bigint;
  readonly drawdownStateBps: number;
  readonly drawdownGuardBps: number;
  readonly providerConstraints: ProviderExecutionConstraints;
  readonly enabledMethods: readonly PositionSizingMethod[];
  readonly metaAllocatorProposedNotionalMinor: bigint;
};

export type SizingMethodCap = {
  readonly method: PositionSizingMethod;
  readonly capMinor: bigint;
  readonly explanation: string;
};

export type PositionSizingAdjustments = {
  readonly volatilityAdjustmentBps: number;
  readonly liquidityAdjustmentBps: number;
  readonly correlationAdjustmentBps: number;
  readonly concentrationAdjustmentBps: number;
  readonly confidenceAdjustmentBps: number;
  readonly drawdownAdjustmentBps: number;
  readonly transactionCostAdjustmentBps: number;
};

export const BINDING_CONSTRAINTS = [
  'ZERO_CAPITAL',
  'INSUFFICIENT_LIQUIDITY',
  'HIGH_CORRELATION',
  'CONCENTRATED_PORTFOLIO',
  'MAX_LOSS_AT_INVALIDATION',
  'VOLATILITY_TARGETING',
  'RISK_BUDGET',
  'MAX_PORTFOLIO_ALLOCATION',
  'LIQUIDITY_ADJUSTED_CAP',
  'POSITION_LIMIT',
  'ASSET_CLASS_LIMIT',
  'STRATEGY_LIMIT',
  'PROVIDER_MINIMUM_ORDER',
  'STALE_VOLATILITY',
  'MISSING_VOLATILITY',
  'DRAWDOWN_GUARD',
  'META_ALLOCATOR_PROPOSAL',
  'TRANSACTION_COSTS',
] as const;

export type BindingConstraint = (typeof BINDING_CONSTRAINTS)[number];

export type PositionSizingResult = {
  readonly sizingId: string;
  readonly requestId: string;
  readonly configVersion: typeof POSITION_SIZING_CONFIG_VERSION;
  readonly instrumentId: string;
  readonly requestedNotionalMinor: bigint;
  readonly approvedNotionalMinor: bigint;
  readonly quantityUnits: bigint;
  readonly quantityScale: number;
  readonly riskBudgetUsedMinor: bigint;
  readonly estimatedLossAtInvalidationMinor: bigint;
  readonly adjustments: PositionSizingAdjustments;
  readonly methodCaps: readonly SizingMethodCap[];
  readonly bindingConstraint: BindingConstraint;
  readonly evidence: readonly string[];
  readonly deterministic: true;
  readonly aiControlled: false;
  readonly computedAt: UtcInstant;
};

export type MetaAllocatorSizingBridgeInput = {
  readonly sizingInput: PositionSizingInput;
  readonly metaAllocatorRecommendedMinor: bigint;
};

export type MetaAllocatorSizingBridgeResult = {
  readonly sizing: PositionSizingResult;
  readonly executionApprovedNotionalMinor: bigint;
  readonly grantsExecutionAuthority: false;
};
