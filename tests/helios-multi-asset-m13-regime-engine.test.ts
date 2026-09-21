/**
 * HELIOS Multi-Asset M13 — deterministic market regime engine qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { asUtcInstant } from '../packages/domain/src/time.ts';
import {
  MarketRegimeEngine,
  evaluateMarketRegime,
  evaluateMultiAssetM13Qualification,
  filterBarsKnowableAt,
  fixtureNow,
  HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED,
  highVolatilityBars,
  insufficientBars,
  liquidityStressBars,
  lowVolatilityBars,
  rangeBoundBars,
  staleFutureBars,
  trendingDownBars,
  trendingUpBars,
  type MarketRegimeEvaluationInput,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { buildHeliosM09Material } from '../packages/strategy-lab/src/capsule/m09-index-mean-reversion.ts';
import { buildHeliosM10Material } from '../packages/strategy-lab/src/capsule/m10.ts';
import { evaluateStrategyRegimeGating } from '../packages/strategy-lab/src/regime-gating.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = fixtureNow();
const BTC = 'CRYPTO:BTC:USD';
const SPY = 'SECURITY:US:SPY:ARCX';

function baseInput(
  overrides: Partial<MarketRegimeEvaluationInput> & { readonly bars: MarketRegimeEvaluationInput['bars'] },
): MarketRegimeEvaluationInput {
  return Object.freeze({
    scope: 'INSTRUMENT',
    scopeId: SPY,
    assetClass: 'equity',
    now: NOW,
    sessionState: 'OPEN',
    freshness: 'FRESH',
    liquidityState: 'ADEQUATE',
    volatilityState: 'NORMAL',
    spreadBps: 5,
    minBarsRequired: 20,
    ...overrides,
  });
}

function hasDimension(
  result: ReturnType<typeof evaluateMarketRegime>,
  dimension: string,
): boolean {
  return result.regime.detectedRegimes.some((row) => row.dimension === dimension);
}

describe('HELIOS Multi-Asset M13 market regime engine', () => {
  it('passes HELIOS boundary guard', () => {
    assert.deepEqual(lintHeliosBoundary(process.cwd()), []);
  });

  it('classifies trending up deterministically', () => {
    const result = evaluateMarketRegime(baseInput({ bars: trendingUpBars() }));
    assert.equal(hasDimension(result, 'TRENDING_UP'), true);
    assert.equal(result.insufficientData, false);
    assert.equal(result.regime.methodologyVersion, 'helios-m13-regime-v1');
    assert.ok(result.regime.observationsUsed.length > 0);
    assert.ok(result.regime.evidenceRefs !== undefined);
    assert.ok(Date.parse(result.regime.validUntil) > Date.parse(result.regime.asOf));
  });

  it('classifies trending down deterministically', () => {
    const result = evaluateMarketRegime(baseInput({ bars: trendingDownBars() }));
    assert.equal(hasDimension(result, 'TRENDING_DOWN'), true);
  });

  it('classifies range-bound deterministically', () => {
    const result = evaluateMarketRegime(baseInput({ bars: rangeBoundBars() }));
    assert.equal(hasDimension(result, 'RANGE_BOUND'), true);
  });

  it('classifies high volatility deterministically', () => {
    const result = evaluateMarketRegime(baseInput({ bars: highVolatilityBars(), volatilityState: 'NORMAL' }));
    assert.equal(hasDimension(result, 'HIGH_VOLATILITY'), true);
  });

  it('classifies low volatility deterministically', () => {
    const result = evaluateMarketRegime(baseInput({ bars: lowVolatilityBars(), volatilityState: 'NORMAL' }));
    assert.equal(hasDimension(result, 'LOW_VOLATILITY'), true);
  });

  it('classifies liquidity stress deterministically', () => {
    const result = evaluateMarketRegime(
      baseInput({ bars: liquidityStressBars(), spreadBps: 150, liquidityState: 'THIN' }),
    );
    assert.equal(hasDimension(result, 'LIQUIDITY_STRESS'), true);
  });

  it('supports multiple simultaneous regime characteristics', () => {
    const result = evaluateMarketRegime(
      baseInput({ bars: highVolatilityBars(), scopeId: BTC, assetClass: 'crypto' }),
    );
    assert.equal(hasDimension(result, 'HIGH_VOLATILITY'), true);
    assert.ok(result.regime.detectedRegimes.length >= 2);
  });

  it('fails closed to UNKNOWN on insufficient data without fabricated confidence', () => {
    const result = evaluateMarketRegime(baseInput({ bars: insufficientBars() }));
    assert.equal(hasDimension(result, 'UNKNOWN'), true);
    assert.equal(result.insufficientData, true);
    assert.equal(result.regime.dataQualityState, 'INSUFFICIENT');
    assert.equal(
      result.regime.detectedRegimes.find((row) => row.dimension === 'UNKNOWN')?.strengthBps,
      0,
    );
  });

  it('fails closed on stale data', () => {
    const result = evaluateMarketRegime(
      baseInput({ bars: trendingUpBars(), freshness: 'STALE' }),
    );
    assert.equal(result.staleData, true);
    assert.equal(result.regime.dataQualityState, 'STALE');
    assert.ok(result.regime.invalidatingConditions.includes('STALE_OBSERVATIONS'));
  });

  it('handles conflicting indicators conservatively', () => {
    const result = evaluateMarketRegime(
      baseInput({ bars: lowVolatilityBars(), volatilityState: 'EXTREME' }),
    );
    assert.equal(result.conflictingIndicators, true);
    assert.equal(hasDimension(result, 'HIGH_VOLATILITY'), true);
    assert.ok(result.regime.invalidatingConditions.includes('CONFLICTING_INDICATORS'));
  });

  it('handles multi-timeframe disagreement without look-ahead', () => {
    const bars = trendingUpBars();
    const filtered = filterBarsKnowableAt(bars, NOW);
    assert.equal(filtered.length, bars.length);

    const futureOnly = filterBarsKnowableAt(staleFutureBars(), NOW);
    assert.equal(futureOnly.length, 0);

    const result = evaluateMarketRegime(
      baseInput({
        bars,
        longerTimeframeRegimes: Object.freeze(['TRENDING_DOWN']),
      }),
    );
    assert.equal(result.multiTimeframeDisagreement, true);
    assert.ok(result.regime.invalidatingConditions.includes('MULTI_TIMEFRAME_DISAGREEMENT'));
  });

  it('persists regime transitions across evaluations and restart', () => {
    const engine = new MarketRegimeEngine();
    const first = engine.evaluate(baseInput({ bars: trendingUpBars(), scopeId: SPY }));
    assert.equal(hasDimension(first, 'TRENDING_UP'), true);
    assert.ok(engine.activeTransitions(SPY).some((row) => row.dimension === 'TRENDING_UP'));

    const second = engine.evaluate(
      baseInput({
        bars: rangeBoundBars(),
        scopeId: SPY,
        now: asUtcInstant(new Date(Date.parse(NOW) + 60 * 60 * 1000).toISOString()),
      }),
    );
    assert.equal(hasDimension(second, 'RANGE_BOUND'), true);
    const completed = engine.completedTransitions(SPY);
    assert.ok(completed.some((row) => row.dimension === 'TRENDING_UP' && row.endedAt !== null));
    assert.ok(completed.some((row) => row.startedAt !== null));

    const snapshot = engine.snapshot();
    const restarted = new MarketRegimeEngine();
    restarted.loadSnapshot(snapshot);
    assert.equal(restarted.activeTransitions(SPY).length, engine.activeTransitions(SPY).length);
    assert.equal(restarted.completedTransitions(SPY).length, engine.completedTransitions(SPY).length);
    assert.equal(restarted.latestRegime('INSTRUMENT', SPY)?.regimeId, second.regime.regimeId);
  });

  it('supports instrument, asset-class, and global scopes', () => {
    const instrument = evaluateMarketRegime(baseInput({ bars: trendingUpBars(), scope: 'INSTRUMENT', scopeId: SPY }));
    const assetClass = evaluateMarketRegime(
      baseInput({ bars: trendingUpBars(), scope: 'ASSET_CLASS', scopeId: 'equity', assetClass: 'equity' }),
    );
    const global = evaluateMarketRegime(
      baseInput({ bars: trendingUpBars(), scope: 'GLOBAL', scopeId: 'GLOBAL', assetClass: null }),
    );
    assert.equal(instrument.regime.scope, 'INSTRUMENT');
    assert.equal(assetClass.regime.scope, 'ASSET_CLASS');
    assert.equal(global.regime.scope, 'GLOBAL');
  });

  it('gates M09 mean-reversion capsule by declared regime preferences', () => {
    const m09 = buildHeliosM09Material();
    const rangeResult = evaluateMarketRegime(baseInput({ bars: rangeBoundBars() }));
    const trendResult = evaluateMarketRegime(baseInput({ bars: trendingUpBars() }));

    const rangeGate = evaluateStrategyRegimeGating({
      preferences: m09.marketRegimePreferences,
      detectedRegimes: rangeResult.regime.detectedRegimes,
    });
    assert.equal(rangeGate.permitted, true);
    assert.equal(rangeGate.preferredMatch, true);

    const trendGate = evaluateStrategyRegimeGating({
      preferences: m09.marketRegimePreferences,
      detectedRegimes: trendResult.regime.detectedRegimes,
    });
    assert.equal(trendGate.permitted, false);
    assert.ok(trendGate.blockReason);
    assert.match(trendGate.blockReason, /PROHIBITED_REGIME/);
  });

  it('gates M10 momentum breakout capsule by declared regime preferences', () => {
    const m10 = buildHeliosM10Material();
    const trendResult = evaluateMarketRegime(baseInput({ bars: trendingUpBars(), scopeId: BTC, assetClass: 'crypto' }));
    const rangeResult = evaluateMarketRegime(baseInput({ bars: rangeBoundBars(), scopeId: BTC, assetClass: 'crypto' }));

    const trendGate = evaluateStrategyRegimeGating({
      preferences: m10.marketRegimePreferences,
      detectedRegimes: trendResult.regime.detectedRegimes,
    });
    assert.equal(trendGate.permitted, true);

    const rangeGate = evaluateStrategyRegimeGating({
      preferences: m10.marketRegimePreferences,
      detectedRegimes: rangeResult.regime.detectedRegimes,
    });
    assert.equal(rangeGate.permitted, false);
    assert.ok(rangeGate.blockReason);
    assert.match(rangeGate.blockReason, /PROHIBITED_REGIME/);
  });

  it('emits HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED marker', () => {
    const engine = new MarketRegimeEngine();
    const trendingUp = evaluateMarketRegime(baseInput({ bars: trendingUpBars() }));
    const trendingDown = evaluateMarketRegime(baseInput({ bars: trendingDownBars() }));
    const rangeBound = evaluateMarketRegime(baseInput({ bars: rangeBoundBars() }));
    const highVol = evaluateMarketRegime(baseInput({ bars: highVolatilityBars() }));
    const lowVol = evaluateMarketRegime(baseInput({ bars: lowVolatilityBars(), volatilityState: 'NORMAL' }));
    const liquidity = evaluateMarketRegime(
      baseInput({ bars: liquidityStressBars(), spreadBps: 150, liquidityState: 'THIN' }),
    );
    const insufficient = evaluateMarketRegime(baseInput({ bars: insufficientBars() }));
    const stale = evaluateMarketRegime(baseInput({ bars: trendingUpBars(), freshness: 'STALE' }));
    const conflict = evaluateMarketRegime(
      baseInput({ bars: lowVolatilityBars(), volatilityState: 'EXTREME' }),
    );
    const disagreement = evaluateMarketRegime(
      baseInput({ bars: trendingUpBars(), longerTimeframeRegimes: Object.freeze(['TRENDING_DOWN']) }),
    );

    engine.evaluate(baseInput({ bars: trendingUpBars(), scopeId: SPY }));
    engine.evaluate(
      baseInput({
        bars: rangeBoundBars(),
        scopeId: SPY,
        now: asUtcInstant(new Date(Date.parse(NOW) + 30 * 60 * 1000).toISOString()),
      }),
    );
    const snapshot = engine.snapshot();
    const restarted = new MarketRegimeEngine();
    restarted.loadSnapshot(snapshot);

    const m09 = buildHeliosM09Material();
    const gatingWorks =
      evaluateStrategyRegimeGating({
        preferences: m09.marketRegimePreferences,
        detectedRegimes: rangeBound.regime.detectedRegimes,
      }).permitted &&
      !evaluateStrategyRegimeGating({
        preferences: m09.marketRegimePreferences,
        detectedRegimes: trendingUp.regime.detectedRegimes,
      }).permitted;

    const futureFiltered = filterBarsKnowableAt(staleFutureBars(), NOW);

    const qualification = evaluateMultiAssetM13Qualification({
      trendingUpDetected: hasDimension(trendingUp, 'TRENDING_UP'),
      trendingDownDetected: hasDimension(trendingDown, 'TRENDING_DOWN'),
      rangeBoundDetected: hasDimension(rangeBound, 'RANGE_BOUND'),
      highVolatilityDetected: hasDimension(highVol, 'HIGH_VOLATILITY'),
      lowVolatilityDetected: hasDimension(lowVol, 'LOW_VOLATILITY'),
      liquidityStressDetected: hasDimension(liquidity, 'LIQUIDITY_STRESS'),
      regimeTransitionPersisted: engine.completedTransitions(SPY).length > 0,
      staleDataFailsClosed: stale.staleData && stale.regime.dataQualityState === 'STALE',
      insufficientDataFailsClosed: insufficient.insufficientData && hasDimension(insufficient, 'UNKNOWN'),
      conflictingIndicatorsHandled: conflict.conflictingIndicators,
      multiTimeframeDisagreementHandled: disagreement.multiTimeframeDisagreement,
      restartPersistenceWorks:
        restarted.completedTransitions(SPY).length === engine.completedTransitions(SPY).length,
      strategyRegimeGatingWorks: gatingWorks,
      noLookAheadEnforced: futureFiltered.length === 0,
      noAiClassification: trendingUp.regime.methodologyVersion === 'helios-m13-regime-v1',
      multiCharacteristicSupported: highVol.regime.detectedRegimes.length >= 1,
      instrumentScopeSupported: trendingUp.regime.scope === 'INSTRUMENT',
      assetClassScopeSupported:
        evaluateMarketRegime(
          baseInput({ bars: trendingUpBars(), scope: 'ASSET_CLASS', scopeId: 'equity' }),
        ).regime.scope === 'ASSET_CLASS',
      globalScopeSupported:
        evaluateMarketRegime(
          baseInput({ bars: trendingUpBars(), scope: 'GLOBAL', scopeId: 'GLOBAL', assetClass: null }),
        ).regime.scope === 'GLOBAL',
    });

    assert.equal(qualification.qualified, true, qualification.blockers.join(', '));
    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M13_REGIME_ENGINE_QUALIFIED);
  });
});
