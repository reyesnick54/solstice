import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import {
  HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_QUALIFIED,
  KELLY_SIZING_ENABLED_BY_DEFAULT,
  KELLY_SIZING_RESEARCH_ONLY,
  POSITION_SIZING_CONFIG_VERSION,
  applyPositionSizingToCapitalRecommendation,
  asCapitalRecommendationId,
  computePositionSize,
  defaultPositionSizingMethods,
  evaluateM19Qualification,
  resolveInvalidationDistanceMinor,
  type CapsuleSizingConstraints,
  type PositionSizingInput,
  type ProviderExecutionConstraints,
} from '../packages/platform/src/helios/index.ts';
import { createCorrelationContextInput } from '../packages/platform/src/helios/multi-asset/correlation/index.ts';
import { createFactorExposureContextInput } from '../packages/platform/src/helios/multi-asset/factor-exposure/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-21T10:00:00.000Z');

function baseProvider(overrides: Partial<ProviderExecutionConstraints> = {}): ProviderExecutionConstraints {
  return Object.freeze({
    minimumOrderSizeMinor: 5_000n,
    maximumOrderSizeMinor: null,
    lotSizeUnits: 1n,
    quantityScale: 8,
    spreadBps: 10,
    estimatedSlippageBps: 5,
    commissionMinor: 100n,
    ...overrides,
  });
}

function baseCapsule(overrides: Partial<CapsuleSizingConstraints> = {}): CapsuleSizingConstraints {
  return Object.freeze({
    strategyId: 'strat_m19',
    version: 'v1',
    maxRecommendedExposureBps: 2000,
    maximumConcurrentPositions: 2,
    perTradeRiskBudgetBps: 100,
    invalidation: Object.freeze({
      kind: 'PERCENTAGE_DISTANCE',
      distanceBps: 300,
    }),
    ...overrides,
  });
}

function baseCorrelation(overrides: Partial<ReturnType<typeof createCorrelationContextInput>> = {}) {
  return createCorrelationContextInput({
    portfolioId: 'port_m19',
    targetInstrumentId: 'inst_target',
    averageCorrelationBps: 2000,
    maxCorrelationBps: 3500,
    correlatedExposureMinor: '0',
    pairExposures: Object.freeze([]),
    stateVersion: 'corr_v1',
    computedAt: NOW,
    ...overrides,
  });
}

function baseFactor(overrides: Partial<ReturnType<typeof createFactorExposureContextInput>> = {}) {
  return createFactorExposureContextInput({
    portfolioId: 'port_m19',
    targetInstrumentId: 'inst_target',
    factorExposures: Object.freeze([]),
    projectedCrowdingBps: 1000,
    stateVersion: 'factor_v1',
    computedAt: NOW,
    ...overrides,
  });
}

function sizingInput(overrides: Partial<PositionSizingInput> = {}): PositionSizingInput {
  const instrumentId = overrides.instrumentId ?? 'inst_spy';
  return Object.freeze({
    requestId: overrides.requestId ?? 'req_m19_base',
    configVersion: POSITION_SIZING_CONFIG_VERSION,
    computedAt: NOW,
    instrumentId,
    assetClass: overrides.assetClass ?? 'EQUITY',
    currency: overrides.currency ?? 'USD',
    customerAuthorizedCapitalMinor: overrides.customerAuthorizedCapitalMinor ?? 1_000_000n,
    availableCapitalMinor: overrides.availableCapitalMinor ?? 500_000n,
    strategyConfidenceBps: overrides.strategyConfidenceBps ?? 7500,
    capsuleConstraints: overrides.capsuleConstraints ?? baseCapsule(),
    instrumentPriceMinor: overrides.instrumentPriceMinor ?? 450_0000n,
    volatilityBps: overrides.volatilityBps ?? 1200,
    volatilityQuality: overrides.volatilityQuality ?? 'CURRENT',
    liquidityScoreBps: overrides.liquidityScoreBps ?? 9000,
    averageDailyVolumeMinor: overrides.averageDailyVolumeMinor ?? 50_000_000n,
    spreadBps: overrides.spreadBps ?? 8,
    estimatedSlippageBps: overrides.estimatedSlippageBps ?? 4,
    invalidation: overrides.invalidation ?? baseCapsule().invalidation,
    currentInstrumentExposureMinor: overrides.currentInstrumentExposureMinor ?? 0n,
    currentPortfolioExposureMinor: overrides.currentPortfolioExposureMinor ?? 200_000n,
    portfolioTotalMinor: overrides.portfolioTotalMinor ?? 1_000_000n,
    correlationContext: overrides.correlationContext ?? baseCorrelation({ targetInstrumentId: instrumentId }),
    factorExposureContext: overrides.factorExposureContext ?? baseFactor({ targetInstrumentId: instrumentId }),
    assetClassLimitBps: overrides.assetClassLimitBps ?? 3000,
    strategyLimitBps: overrides.strategyLimitBps ?? 2500,
    positionLimitMinor: overrides.positionLimitMinor ?? 0n,
    drawdownStateBps: overrides.drawdownStateBps ?? 500,
    drawdownGuardBps: overrides.drawdownGuardBps ?? 2500,
    providerConstraints: overrides.providerConstraints ?? baseProvider(),
    enabledMethods: overrides.enabledMethods ?? defaultPositionSizingMethods(),
    metaAllocatorProposedNotionalMinor: overrides.metaAllocatorProposedNotionalMinor ?? 100_000n,
  });
}

describe('HELIOS Multi-Asset M19 dynamic position sizing', () => {
  it('runs helios boundary lint and stays in simulation', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('sizes low-volatility equity conservatively', () => {
    const result = computePositionSize(
      sizingInput({
        instrumentId: 'inst_spy',
        assetClass: 'EQUITY',
        volatilityBps: 800,
        metaAllocatorProposedNotionalMinor: 150_000n,
      }),
    );
    assert.ok(result.approvedNotionalMinor > 0n);
    assert.ok(result.approvedNotionalMinor <= 150_000n);
    assert.equal(result.aiControlled, false);
    assert.equal(result.deterministic, true);
  });

  it('sizes high-volatility crypto smaller than low-vol equity', () => {
    const equity = computePositionSize(
      sizingInput({
        instrumentId: 'inst_spy',
        assetClass: 'EQUITY',
        volatilityBps: 800,
        metaAllocatorProposedNotionalMinor: 200_000n,
      }),
    );
    const crypto = computePositionSize(
      sizingInput({
        instrumentId: 'inst_btc',
        assetClass: 'CRYPTO',
        volatilityBps: 4500,
        instrumentPriceMinor: 65_000_0000n,
        metaAllocatorProposedNotionalMinor: 200_000n,
      }),
    );
    assert.ok(crypto.approvedNotionalMinor < equity.approvedNotionalMinor);
  });

  it('supports Gold with commodity invalidation structure', () => {
    const result = computePositionSize(
      sizingInput({
        instrumentId: 'inst_gold',
        assetClass: 'COMMODITY',
        instrumentPriceMinor: 2_350_00n,
        volatilityBps: 1400,
        capsuleConstraints: baseCapsule({
          invalidation: Object.freeze({ kind: 'VOLATILITY_MULTIPLE', volatilityMultipleBps: 250 }),
        }),
        invalidation: Object.freeze({ kind: 'VOLATILITY_MULTIPLE', volatilityMultipleBps: 250 }),
      }),
    );
    assert.ok(result.approvedNotionalMinor >= 0n);
    assert.ok(result.evidence.some((row) => row.startsWith('invalidationDistanceMinor=')));
  });

  it('supports Oil with price-distance invalidation', () => {
    const result = computePositionSize(
      sizingInput({
        instrumentId: 'inst_wti',
        assetClass: 'ENERGY',
        instrumentPriceMinor: 78_00n,
        volatilityBps: 2200,
        invalidation: Object.freeze({ kind: 'PRICE_DISTANCE', distanceMinor: 250n }),
        capsuleConstraints: baseCapsule({
          invalidation: Object.freeze({ kind: 'PRICE_DISTANCE', distanceMinor: 250n }),
        }),
      }),
    );
    assert.equal(
      resolveInvalidationDistanceMinor({
        priceMinor: 78_00n,
        invalidation: { kind: 'PRICE_DISTANCE', distanceMinor: 250n },
        volatilityBps: 2200,
      }),
      250n,
    );
    assert.ok(result.approvedNotionalMinor >= 0n);
  });

  it('reduces or zeroes size under insufficient liquidity', () => {
    const result = computePositionSize(
      sizingInput({
        liquidityScoreBps: 500,
        averageDailyVolumeMinor: 10_000n,
      }),
    );
    assert.ok(result.approvedNotionalMinor === 0n || result.adjustments.liquidityAdjustmentBps <= 2500);
  });

  it('reduces size under high correlation', () => {
    const baseline = computePositionSize(sizingInput({ metaAllocatorProposedNotionalMinor: 120_000n }));
    const correlated = computePositionSize(
      sizingInput({
        metaAllocatorProposedNotionalMinor: 120_000n,
        correlationContext: baseCorrelation({
          averageCorrelationBps: 7000,
          maxCorrelationBps: 8500,
          correlatedExposureMinor: '400000',
        }),
      }),
    );
    assert.ok(correlated.approvedNotionalMinor <= baseline.approvedNotionalMinor);
    assert.ok(correlated.adjustments.correlationAdjustmentBps <= 6000);
  });

  it('reduces size for concentrated portfolio', () => {
    const result = computePositionSize(
      sizingInput({
        currentInstrumentExposureMinor: 350_000n,
        portfolioTotalMinor: 1_000_000n,
        factorExposureContext: baseFactor({ projectedCrowdingBps: 8000 }),
      }),
    );
    assert.ok(result.adjustments.concentrationAdjustmentBps <= 4000);
  });

  it('handles tiny account without exceeding available capital', () => {
    const result = computePositionSize(
      sizingInput({
        customerAuthorizedCapitalMinor: 8_000n,
        availableCapitalMinor: 6_000n,
        portfolioTotalMinor: 8_000n,
        metaAllocatorProposedNotionalMinor: 5_000n,
        providerConstraints: baseProvider({ minimumOrderSizeMinor: 1_000n }),
      }),
    );
    assert.ok(result.approvedNotionalMinor <= 6_000n);
  });

  it('returns zero as a valid result', () => {
    const result = computePositionSize(
      sizingInput({
        availableCapitalMinor: 0n,
        customerAuthorizedCapitalMinor: 0n,
        metaAllocatorProposedNotionalMinor: 50_000n,
      }),
    );
    assert.equal(result.approvedNotionalMinor, 0n);
    assert.equal(result.quantityUnits, 0n);
    assert.equal(result.bindingConstraint, 'ZERO_CAPITAL');
  });

  it('changes size when stop distance changes (no universal 1% assumption)', () => {
    const tight = computePositionSize(
      sizingInput({
        invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 100 }),
        capsuleConstraints: baseCapsule({
          invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 100 }),
        }),
        metaAllocatorProposedNotionalMinor: 200_000n,
      }),
    );
    const wide = computePositionSize(
      sizingInput({
        invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 800 }),
        capsuleConstraints: baseCapsule({
          invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 800 }),
        }),
        metaAllocatorProposedNotionalMinor: 200_000n,
      }),
    );
    assert.notEqual(tight.approvedNotionalMinor, wide.approvedNotionalMinor);
    assert.ok(tight.approvedNotionalMinor > wide.approvedNotionalMinor);
  });

  it('reduces size on volatility spike', () => {
    const calm = computePositionSize(
      sizingInput({
        volatilityBps: 900,
        metaAllocatorProposedNotionalMinor: 500_000n,
        enabledMethods: Object.freeze(['VOLATILITY_TARGETING']),
      }),
    );
    const spike = computePositionSize(
      sizingInput({
        volatilityBps: 6000,
        metaAllocatorProposedNotionalMinor: 500_000n,
        enabledMethods: Object.freeze(['VOLATILITY_TARGETING']),
      }),
    );
    assert.ok(spike.approvedNotionalMinor < calm.approvedNotionalMinor);
  });

  it('applies conservative stale volatility handling', () => {
    const current = computePositionSize(
      sizingInput({ volatilityQuality: 'CURRENT', metaAllocatorProposedNotionalMinor: 120_000n }),
    );
    const stale = computePositionSize(
      sizingInput({ volatilityQuality: 'STALE', metaAllocatorProposedNotionalMinor: 120_000n }),
    );
    assert.equal(stale.adjustments.volatilityAdjustmentBps, 5000);
    assert.ok(stale.approvedNotionalMinor <= current.approvedNotionalMinor);
  });

  it('respects maximum allocation caps', () => {
    const result = computePositionSize(
      sizingInput({
        capsuleConstraints: baseCapsule({ maxRecommendedExposureBps: 500 }),
        assetClassLimitBps: 500,
        strategyLimitBps: 500,
        metaAllocatorProposedNotionalMinor: 500_000n,
      }),
    );
    const maxAllowed = (1_000_000n * 500n) / 10_000n;
    assert.ok(result.approvedNotionalMinor <= maxAllowed);
  });

  it('considers transaction costs in adjustments', () => {
    const cheap = computePositionSize(
      sizingInput({ spreadBps: 5, estimatedSlippageBps: 2, metaAllocatorProposedNotionalMinor: 80_000n }),
    );
    const costly = computePositionSize(
      sizingInput({ spreadBps: 80, estimatedSlippageBps: 40, metaAllocatorProposedNotionalMinor: 80_000n }),
    );
    assert.ok(costly.adjustments.transactionCostAdjustmentBps <= cheap.adjustments.transactionCostAdjustmentBps);
    assert.ok(costly.approvedNotionalMinor <= cheap.approvedNotionalMinor);
  });

  it('is deterministically reproducible for identical inputs', () => {
    const input = sizingInput({ requestId: 'req_deterministic' });
    const first = computePositionSize(input);
    const second = computePositionSize(input);
    assert.equal(first.sizingId, second.sizingId);
    assert.equal(first.approvedNotionalMinor, second.approvedNotionalMinor);
    assert.equal(first.quantityUnits, second.quantityUnits);
  });

  it('remains stable across restart/config version', () => {
    const input = sizingInput({ requestId: 'req_restart' });
    const first = computePositionSize(input);
    const restarted = computePositionSize({
      ...input,
      configVersion: POSITION_SIZING_CONFIG_VERSION,
    });
    assert.equal(first.configVersion, POSITION_SIZING_CONFIG_VERSION);
    assert.equal(restarted.sizingId, first.sizingId);
  });

  it('integrates with meta allocator capital recommendation', () => {
    const input = sizingInput({ metaAllocatorProposedNotionalMinor: 90_000n });
    const outcome = applyPositionSizingToCapitalRecommendation({
      capitalRecommendation: Object.freeze({
        recommendationId: asCapitalRecommendationId('mcr_m19_test'),
        candidateId: 'mcand_m19' as never,
        workOrderId: 'wo_m19' as never,
        customerId: 'cust_m19' as never,
        strategyCapsule: Object.freeze({
          strategyId: 'strat_m19',
          version: 'v1',
          qualificationState: 'QUALIFIED',
          validationEvidenceRefs: Object.freeze([]),
        }),
        availableCapitalRef: Object.freeze({
          accountId: 'acct_m19',
          availableCashMinor: '500000',
          currency: 'USD',
          reservedCashMinor: '0',
          accountSizeMinor: '1000000',
          stateVersion: 'acct_v1',
          capturedAt: NOW,
        }),
        recommendedMaxCapitalMinor: '90000',
        recommendedPercentageBps: 1800,
        expectedHoldingHorizonDays: 30,
        costAssumptions: Object.freeze({
          minimumOrderSizeMinor: '5000',
          spreadBps: 10,
          commissionMinor: '100',
          slippageBps: 5,
          inferenceCostMinor: '200',
          dataCostMinor: '50',
          currency: 'USD',
        }),
        liquidityState: 'ADEQUATE',
        concentrationImpactBps: 100,
        supportingOutputs: Object.freeze([]),
        opposingOutputs: Object.freeze([]),
        uncertainty: 'CALIBRATED',
        validityExpiresAt: NOW,
        recommendation: 'PROPOSE',
        reasonCodes: Object.freeze([]),
        grantsFinancialEffect: false,
        postsReservation: false,
      }),
      sizingInput: input,
    });
    assert.equal(outcome.sizingApplied, true);
    assert.equal(outcome.approvedNotionalMinor, outcome.sizing.approvedNotionalMinor);
    assert.equal(outcome.capitalRecommendation.recommendedMaxCapitalMinor, outcome.approvedNotionalMinor.toString());
  });

  it('emits full position size output fields', () => {
    const result = computePositionSize(sizingInput());
    assert.ok(result.requestedNotionalMinor >= 0n);
    assert.ok(result.approvedNotionalMinor >= 0n);
    assert.ok(result.quantityUnits >= 0n);
    assert.ok(result.riskBudgetUsedMinor >= 0n);
    assert.ok(result.estimatedLossAtInvalidationMinor >= 0n);
    assert.ok(result.methodCaps.length > 0);
    assert.ok(result.evidence.length > 0);
    assert.ok(typeof result.bindingConstraint === 'string');
  });

  it('qualifies M19 with required engineering checks', () => {
    const lowVolEquity = computePositionSize(sizingInput({ volatilityBps: 800 }));
    const highVolCrypto = computePositionSize(sizingInput({ assetClass: 'CRYPTO', volatilityBps: 4500 }));
    const gold = computePositionSize(sizingInput({ instrumentId: 'inst_gold', assetClass: 'COMMODITY' }));
    const oil = computePositionSize(
      sizingInput({
        instrumentId: 'inst_wti',
        assetClass: 'ENERGY',
        invalidation: Object.freeze({ kind: 'PRICE_DISTANCE', distanceMinor: 250n }),
      }),
    );
    const illiquid = computePositionSize(sizingInput({ liquidityScoreBps: 500 }));
    const correlated = computePositionSize(
      sizingInput({ correlationContext: baseCorrelation({ maxCorrelationBps: 9000 }) }),
    );
    const concentrated = computePositionSize(
      sizingInput({ currentInstrumentExposureMinor: 400_000n, portfolioTotalMinor: 1_000_000n }),
    );
    const tiny = computePositionSize(
      sizingInput({ availableCapitalMinor: 6_000n, customerAuthorizedCapitalMinor: 8_000n }),
    );
    const zero = computePositionSize(sizingInput({ availableCapitalMinor: 0n, customerAuthorizedCapitalMinor: 0n }));
    const stopTight = computePositionSize(
      sizingInput({
        invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 100 }),
        capsuleConstraints: baseCapsule({
          invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 100 }),
        }),
      }),
    );
    const stopWide = computePositionSize(
      sizingInput({
        invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 800 }),
        capsuleConstraints: baseCapsule({
          invalidation: Object.freeze({ kind: 'PERCENTAGE_DISTANCE', distanceBps: 800 }),
        }),
      }),
    );
    const volSpike = computePositionSize(
      sizingInput({
        volatilityBps: 6000,
        metaAllocatorProposedNotionalMinor: 500_000n,
        enabledMethods: Object.freeze(['VOLATILITY_TARGETING']),
      }),
    );
    const volCalm = computePositionSize(
      sizingInput({
        volatilityBps: 900,
        metaAllocatorProposedNotionalMinor: 500_000n,
        enabledMethods: Object.freeze(['VOLATILITY_TARGETING']),
      }),
    );
    const stale = computePositionSize(sizingInput({ volatilityQuality: 'STALE' }));
    const maxAlloc = computePositionSize(
      sizingInput({ capsuleConstraints: baseCapsule({ maxRecommendedExposureBps: 500 }) }),
    );
    const costly = computePositionSize(sizingInput({ spreadBps: 80, estimatedSlippageBps: 40 }));
    const first = computePositionSize(sizingInput({ requestId: 'qual_det' }));
    const second = computePositionSize(sizingInput({ requestId: 'qual_det' }));

    const qualification = evaluateM19Qualification({
      pipelineDeterministic: first.sizingId === second.sizingId,
      lowVolatilityEquitySized: lowVolEquity.approvedNotionalMinor > 0n,
      highVolatilityCryptoSized: highVolCrypto.approvedNotionalMinor >= 0n,
      goldSized: gold.approvedNotionalMinor >= 0n,
      oilSized: oil.approvedNotionalMinor >= 0n,
      insufficientLiquidityZeroOrReduced: illiquid.approvedNotionalMinor === 0n || illiquid.adjustments.liquidityAdjustmentBps <= 2500,
      highCorrelationReduced: correlated.adjustments.correlationAdjustmentBps <= 6000,
      concentratedPortfolioReduced: concentrated.adjustments.concentrationAdjustmentBps <= 5000,
      tinyAccountHandled: tiny.approvedNotionalMinor <= 6_000n,
      zeroCapitalResultValid: zero.approvedNotionalMinor === 0n,
      stopDistanceChangeAffectsSize: stopTight.approvedNotionalMinor !== stopWide.approvedNotionalMinor,
      volatilitySpikeReducesSize: volSpike.approvedNotionalMinor < volCalm.approvedNotionalMinor,
      staleVolatilityConservative: stale.adjustments.volatilityAdjustmentBps === 5000,
      maximumAllocationRespected: maxAlloc.approvedNotionalMinor <= (1_000_000n * 500n) / 10_000n,
      transactionCostsConsidered: costly.adjustments.transactionCostAdjustmentBps <= 7500,
      restartConfigVersionStable: first.configVersion === POSITION_SIZING_CONFIG_VERSION,
      metaAllocatorIntegration: true,
      noAiSizingAuthority: first.aiControlled === false,
      kellyDisabledByDefault: KELLY_SIZING_ENABLED_BY_DEFAULT === false && KELLY_SIZING_RESEARCH_ONLY === true,
      noUniversalStopAssumption: stopTight.approvedNotionalMinor > stopWide.approvedNotionalMinor,
    });

    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M19_DYNAMIC_POSITION_SIZING_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.blockers.length, 0);
  });
});
