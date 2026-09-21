/**
 * Deterministic market regime classifier (M13).
 *
 * Uses quantitative inputs only — no AI/LLM classification.
 * Fails closed to UNKNOWN when evidence is insufficient.
 */

import { asUtcInstant } from '@solstice/domain';
import type {
  DetectedRegime,
  MarketRegime,
  MarketRegimeEvaluationInput,
  MarketRegimeEvaluationResult,
  MarketRegimeObservation,
  RegimeBarInput,
} from './types.ts';
import {
  MARKET_REGIME_METHODOLOGY_VERSION,
  type MarketRegimeDimension,
} from './taxonomy.ts';

const DEFAULT_MIN_BARS = 20;
const DEFAULT_VALID_FOR_MS = 15 * 60 * 1000;
const TREND_RETURN_THRESHOLD_BPS = 50;
const RANGE_RETURN_THRESHOLD_BPS = 25;
const HIGH_VOL_PERCENTILE_BPS = 7500;
const LOW_VOL_PERCENTILE_BPS = 2500;
const SPREAD_STRESS_BPS = 100;
const CORRELATION_STRESS_BPS = 8000;
const RISK_RETURN_THRESHOLD_BPS = 20;

export function filterBarsKnowableAt(
  bars: readonly RegimeBarInput[],
  asOf: MarketRegimeEvaluationInput['now'],
): readonly RegimeBarInput[] {
  const cutoff = Date.parse(asOf);
  return Object.freeze(
    bars
      .filter((bar) => Date.parse(bar.knowableAt) <= cutoff)
      .sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt)),
  );
}

export function evaluateMarketRegime(input: MarketRegimeEvaluationInput): MarketRegimeEvaluationResult {
  const minBars = input.minBarsRequired ?? DEFAULT_MIN_BARS;
  const validForMs = input.validForMs ?? DEFAULT_VALID_FOR_MS;
  const knowableBars = filterBarsKnowableAt(input.bars, input.now);
  const observations: MarketRegimeObservation[] = [];
  const invalidatingConditions: string[] = [];
  let insufficientData = false;
  let staleData = false;
  let conflictingIndicators = false;
  let multiTimeframeDisagreement = false;

  if (input.freshness === 'STALE') {
    staleData = true;
    invalidatingConditions.push('STALE_OBSERVATIONS');
  }
  if (knowableBars.length < minBars) {
    insufficientData = true;
    observations.push(
      freezeObservation('bar_count', 'available_bars', String(knowableBars.length)),
      freezeObservation('bar_count', 'required_bars', String(minBars)),
    );
    const regime = buildRegimeArtifact({
      input,
      detected: Object.freeze([freezeDetected('UNKNOWN', 0)]),
      observations,
      invalidatingConditions,
      dataQualityState: 'INSUFFICIENT',
      validForMs,
    });
    return freezeResult({
      regime,
      insufficientData,
      staleData,
      conflictingIndicators,
      multiTimeframeDisagreement,
    });
  }

  const returns = computeReturns(knowableBars);
  observations.push(
    freezeObservation('returns', 'sample_count', String(returns.length)),
    freezeObservation('returns', 'cumulative_short_bps', String(sumLast(returns, 10))),
  );

  const shortReturnBps = sumLast(returns, 10);
  const trendStrengthBps = computeTrendStrengthBps(returns, 10);
  observations.push(
    freezeObservation('trend', 'short_return_bps', String(shortReturnBps)),
    freezeObservation('trend', 'trend_strength_bps', String(trendStrengthBps)),
  );

  const currentVolBps = stdDevBps(returns.slice(-10));
  const rollingVols = rollingVolatilitySeries(returns, 10);
  const volPercentileBps = percentileRankBps(currentVolBps, rollingVols);
  observations.push(
    freezeObservation('volatility', 'realized_vol_bps', String(currentVolBps)),
    freezeObservation('volatility', 'historical_percentile_bps', String(volPercentileBps)),
  );

  const detected: DetectedRegime[] = [];

  if (shortReturnBps >= TREND_RETURN_THRESHOLD_BPS && trendStrengthBps >= 6000) {
    detected.push(freezeDetected('TRENDING_UP', clampStrength(trendStrengthBps)));
  } else if (shortReturnBps <= -TREND_RETURN_THRESHOLD_BPS && trendStrengthBps <= 4000) {
    detected.push(freezeDetected('TRENDING_DOWN', clampStrength(10000 - trendStrengthBps)));
  } else if (
    Math.abs(shortReturnBps) <= RANGE_RETURN_THRESHOLD_BPS &&
    trendStrengthBps >= 3500 &&
    trendStrengthBps <= 6500
  ) {
    detected.push(freezeDetected('RANGE_BOUND', clampStrength(10000 - Math.abs(trendStrengthBps - 5000) * 2)));
  }

  const volFromBars = classifyVolatility(currentVolBps, volPercentileBps);
  const volFromM04 = classifyVolatilityFromM04(input.volatilityState);
  if (volFromBars && volFromM04 && volFromBars.dimension !== volFromM04.dimension) {
    conflictingIndicators = true;
    observations.push(
      freezeObservation('conflict', 'volatility_bars', volFromBars.dimension),
      freezeObservation('conflict', 'volatility_m04', volFromM04.dimension),
    );
    const conservative =
      volFromBars.dimension === 'HIGH_VOLATILITY' || volFromM04.dimension === 'HIGH_VOLATILITY'
        ? freezeDetected('HIGH_VOLATILITY', Math.min(volFromBars.strengthBps, volFromM04.strengthBps))
        : volFromBars;
    detected.push(conservative);
  } else if (volFromBars) {
    detected.push(volFromBars);
  } else if (volFromM04) {
    detected.push(volFromM04);
  }

  const liquidity = classifyLiquidity(input.spreadBps, input.liquidityState);
  if (liquidity) {
    detected.push(liquidity);
  }

  const riskRegime = classifyRiskRegime(input.crossAssetReturns, detected);
  if (riskRegime) {
    detected.push(riskRegime);
  }

  if (input.correlations?.some((row) => row.correlationBps >= CORRELATION_STRESS_BPS)) {
    const maxCorr = Math.max(...input.correlations.map((row) => row.correlationBps));
    detected.push(freezeDetected('CORRELATION_STRESS', clampStrength(maxCorr)));
    observations.push(freezeObservation('correlation', 'max_correlation_bps', String(maxCorr)));
  }

  if (input.macroEventActive) {
    detected.push(freezeDetected('MACRO_EVENT', 10000));
    observations.push(freezeObservation('macro', 'macro_event_active', 'true'));
  }

  if (input.longerTimeframeRegimes && input.longerTimeframeRegimes.length > 0) {
    const shortTrend = detected.find(
      (row) => row.dimension === 'TRENDING_UP' || row.dimension === 'TRENDING_DOWN',
    );
    if (shortTrend) {
      const opposite =
        (shortTrend.dimension === 'TRENDING_UP' && input.longerTimeframeRegimes.includes('TRENDING_DOWN')) ||
        (shortTrend.dimension === 'TRENDING_DOWN' && input.longerTimeframeRegimes.includes('TRENDING_UP'));
      if (opposite) {
        multiTimeframeDisagreement = true;
        observations.push(freezeObservation('timeframe', 'disagreement', 'short_vs_long_trend'));
        const idx = detected.indexOf(shortTrend);
        detected[idx] = freezeDetected(shortTrend.dimension, Math.floor(shortTrend.strengthBps / 2));
      }
    }
  }

  if (staleData) {
    for (let i = 0; i < detected.length; i += 1) {
      detected[i] = freezeDetected(detected[i].dimension, Math.floor(detected[i].strengthBps / 2));
    }
    if (detected.length === 0) {
      detected.push(freezeDetected('UNKNOWN', 0));
    }
  }

  if (detected.length === 0) {
    detected.push(freezeDetected('UNKNOWN', 0));
  }

  const dataQualityState = staleData
    ? 'STALE'
    : conflictingIndicators
      ? 'DEGRADED'
      : 'HEALTHY';

  if (conflictingIndicators) {
    invalidatingConditions.push('CONFLICTING_INDICATORS');
  }
  if (multiTimeframeDisagreement) {
    invalidatingConditions.push('MULTI_TIMEFRAME_DISAGREEMENT');
  }
  if (staleData) {
    invalidatingConditions.push('STALE_OBSERVATIONS');
  }

  const regime = buildRegimeArtifact({
    input,
    detected: Object.freeze(detected),
    observations,
    invalidatingConditions,
    dataQualityState,
    validForMs,
  });

  return freezeResult({
    regime,
    insufficientData,
    staleData,
    conflictingIndicators,
    multiTimeframeDisagreement,
  });
}

function buildRegimeArtifact(input: {
  readonly input: MarketRegimeEvaluationInput;
  readonly detected: readonly DetectedRegime[];
  readonly observations: readonly MarketRegimeObservation[];
  readonly invalidatingConditions: readonly string[];
  readonly dataQualityState: MarketRegime['dataQualityState'];
  readonly validForMs: number;
}): MarketRegime {
  const validUntil = asUtcInstant(new Date(Date.parse(input.input.now) + input.validForMs).toISOString());
  const regimeId = `regime_${input.input.scope}_${input.input.scopeId}_${input.input.now}`;
  return Object.freeze({
    regimeId,
    scope: input.input.scope,
    scopeId: input.input.scopeId,
    assetClass: input.input.assetClass ?? null,
    asOf: input.input.now,
    detectedRegimes: input.detected,
    dataQualityState: input.dataQualityState,
    observationsUsed: Object.freeze([...input.observations]),
    methodologyVersion: MARKET_REGIME_METHODOLOGY_VERSION,
    evidenceRefs: Object.freeze([...(input.input.evidenceRefs ?? [])]),
    validUntil,
    invalidatingConditions: Object.freeze([...input.invalidatingConditions]),
  });
}

function classifyVolatility(
  currentVolBps: number,
  percentileBps: number,
): DetectedRegime | null {
  if (percentileBps >= HIGH_VOL_PERCENTILE_BPS || currentVolBps >= 150) {
    return freezeDetected('HIGH_VOLATILITY', clampStrength(Math.max(percentileBps, currentVolBps * 40)));
  }
  if (percentileBps <= LOW_VOL_PERCENTILE_BPS || currentVolBps <= 20) {
    return freezeDetected('LOW_VOLATILITY', clampStrength(10000 - percentileBps));
  }
  return freezeDetected('NORMAL_VOLATILITY', clampStrength(7000));
}

function classifyVolatilityFromM04(state: MarketRegimeEvaluationInput['volatilityState']): DetectedRegime | null {
  if (state === 'EXTREME' || state === 'ELEVATED') {
    return freezeDetected('HIGH_VOLATILITY', state === 'EXTREME' ? 9500 : 7500);
  }
  if (state === 'LOW') {
    return freezeDetected('LOW_VOLATILITY', 8000);
  }
  if (state === 'NORMAL') {
    return freezeDetected('NORMAL_VOLATILITY', 7000);
  }
  return null;
}

function classifyLiquidity(
  spreadBps: number | null,
  liquidityState: MarketRegimeEvaluationInput['liquidityState'],
): DetectedRegime | null {
  const spreadStress = spreadBps !== null && spreadBps >= SPREAD_STRESS_BPS;
  const stateStress = liquidityState === 'THIN' || liquidityState === 'ILLIQUID';
  if (spreadStress || stateStress) {
    const strength = spreadStress && spreadBps !== null ? clampStrength(spreadBps * 50) : 7000;
    return freezeDetected('LIQUIDITY_STRESS', strength);
  }
  if (liquidityState === 'ADEQUATE') {
    return freezeDetected('NORMAL_LIQUIDITY', 8000);
  }
  return null;
}

function classifyRiskRegime(
  crossAssetReturns: MarketRegimeEvaluationInput['crossAssetReturns'],
  detected: readonly DetectedRegime[],
): DetectedRegime | null {
  if (!crossAssetReturns || crossAssetReturns.length === 0) {
    return null;
  }
  const avgReturnBps = Math.floor(
    crossAssetReturns.reduce((sum, row) => sum + row.returnBps, 0) / crossAssetReturns.length,
  );
  const highVol = detected.some((row) => row.dimension === 'HIGH_VOLATILITY');
  if (avgReturnBps >= RISK_RETURN_THRESHOLD_BPS && !highVol) {
    return freezeDetected('RISK_ON', clampStrength(5000 + avgReturnBps * 50));
  }
  if (avgReturnBps <= -RISK_RETURN_THRESHOLD_BPS) {
    return freezeDetected('RISK_OFF', clampStrength(5000 + Math.abs(avgReturnBps) * 50));
  }
  return null;
}

function computeReturns(bars: readonly RegimeBarInput[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const prev = bars[i - 1].closeMinor;
    const curr = bars[i].closeMinor;
    if (prev <= 0n) {
      continue;
    }
    returns.push(Number(((curr - prev) * 10000n) / prev));
  }
  return returns;
}

function sumLast(values: number[], count: number): number {
  return values.slice(-count).reduce((sum, value) => sum + value, 0);
}

function computeTrendStrengthBps(returns: number[], window: number): number {
  const sample = returns.slice(-window);
  if (sample.length === 0) {
    return 5000;
  }
  const positive = sample.filter((value) => value > 0).length;
  return Math.floor((positive / sample.length) * 10000);
}

function stdDevBps(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.floor(Math.sqrt(variance));
}

function rollingVolatilitySeries(returns: number[], window: number): number[] {
  const vols: number[] = [];
  for (let i = window; i <= returns.length; i += 1) {
    vols.push(stdDevBps(returns.slice(i - window, i)));
  }
  return vols.length > 0 ? vols : [stdDevBps(returns)];
}

function percentileRankBps(value: number, distribution: number[]): number {
  if (distribution.length === 0) {
    return 5000;
  }
  const sorted = [...distribution].sort((a, b) => a - b);
  const below = sorted.filter((entry) => entry < value).length;
  return Math.floor((below / sorted.length) * 10000);
}

function clampStrength(value: number): number {
  return Math.max(0, Math.min(10000, Math.floor(value)));
}

function freezeDetected(dimension: MarketRegimeDimension, strengthBps: number): DetectedRegime {
  return Object.freeze({ dimension, strengthBps: clampStrength(strengthBps) });
}

function freezeObservation(id: string, label: string, value: string): MarketRegimeObservation {
  return Object.freeze({ observationId: id, label, value });
}

function freezeResult(result: MarketRegimeEvaluationResult): MarketRegimeEvaluationResult {
  return Object.freeze(result);
}
