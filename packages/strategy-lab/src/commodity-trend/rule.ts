import type { UtcInstant } from '@solstice/domain';

import {
  DEFAULT_M11_CONFIG,
  HELIOS_M11_RULE_ID,
  HELIOS_M11_RULE_VERSION,
  type CommodityTrendFollowingConfig,
} from './constants.ts';
import type {
  CommodityTrendDecision,
  CommodityTrendEvaluateInput,
  CommodityTrendMarketState,
  CommodityPositionSide,
} from './types.ts';

export function isContinuousResearchInstrument(instrumentId: string): boolean {
  return instrumentId.includes(':CONTINUOUS');
}

export function isExecutableInstrumentKind(
  kind: CommodityTrendMarketState['instrumentKind'],
): boolean {
  return kind === 'etf_proxy' || kind === 'futures_contract';
}

function hoursBetween(start: UtcInstant, end: UtcInstant): number {
  return (Date.parse(end) - Date.parse(start)) / 3_600_000;
}

function trailingStopLong(
  highWaterMarkMinor: bigint,
  realizedVolatilityBps: number,
  multiplier: number,
): bigint {
  const stopDistance = (highWaterMarkMinor * BigInt(Math.round(realizedVolatilityBps * multiplier))) / 10_000n;
  return highWaterMarkMinor - stopDistance;
}

function trailingStopShort(
  lowWaterMarkMinor: bigint,
  realizedVolatilityBps: number,
  multiplier: number,
): bigint {
  const stopDistance = (lowWaterMarkMinor * BigInt(Math.round(realizedVolatilityBps * multiplier))) / 10_000n;
  return lowWaterMarkMinor + stopDistance;
}

function decision(
  input: CommodityTrendEvaluateInput,
  config: CommodityTrendFollowingConfig,
  action: CommodityTrendDecision['action'],
  side: CommodityPositionSide | null,
  recommendedConfidenceBps: number,
  rationale: string,
  invalidationReason: string | null,
  exitReason: string | null,
): CommodityTrendDecision {
  return Object.freeze({
    strategyId: input.strategyId,
    action,
    instrumentId: input.instrumentId,
    side,
    recommendedConfidenceBps,
    rationale,
    ruleVersion: HELIOS_M11_RULE_VERSION,
    invalidationReason,
    exitReason,
    closeMinor: input.bar.closeMinor.toString(),
    trendDirection1h: input.market.trendDirection1h,
    spreadBps: input.market.spreadBps,
    realizedVolatilityBps: input.market.realizedVolatilityBps,
    decidedAt: input.now,
  });
}

function invalidation(
  input: CommodityTrendEvaluateInput,
  config: CommodityTrendFollowingConfig,
  reason: string,
): CommodityTrendDecision {
  return decision(input, config, 'NO_ACTION', null, 0, reason, reason, null);
}

function passesOperatingEnvelope(
  market: CommodityTrendMarketState,
  config: CommodityTrendFollowingConfig,
): string | null {
  if (market.freshnessStatus === 'stale' || market.freshnessStatus === 'expired') {
    return 'STALE_OBSERVATION';
  }
  if (market.observationAgeMs > config.maxObservationAgeMs) {
    return 'OBSERVATION_AGE_EXCEEDED';
  }
  if (market.providerHealth === 'unavailable') {
    return 'PROVIDER_OUTAGE';
  }
  if (market.providerHealth === 'degraded') {
    return 'PROVIDER_DEGRADED';
  }
  if (market.marketState === 'STALE' || market.marketState === 'UNAVAILABLE') {
    return 'MARKET_STATE_INVALID';
  }
  if (market.sessionState === 'CLOSED') {
    return 'MARKET_SESSION_CLOSED';
  }
  if (market.spreadBps > config.maxSpreadBps) {
    return 'SPREAD_TOO_WIDE';
  }
  if (market.liquidityScore < config.minLiquidityScore) {
    return 'LIQUIDITY_INSUFFICIENT';
  }
  if (market.realizedVolatilityBps < config.minRealizedVolatilityBps) {
    return 'VOLATILITY_TOO_LOW';
  }
  if (market.realizedVolatilityBps > config.maxRealizedVolatilityBps) {
    return 'VOLATILITY_TOO_HIGH';
  }
  if (market.historyBars < config.minHistoryBars) {
    return 'INSUFFICIENT_HISTORY';
  }
  return null;
}

function passesFuturesGuards(
  input: CommodityTrendEvaluateInput,
): string | null {
  if (isContinuousResearchInstrument(input.instrumentId)) {
    return 'SYNTHETIC_CONTINUOUS_NON_EXECUTABLE';
  }
  if (input.market.instrumentKind === 'futures_continuous') {
    return 'SYNTHETIC_CONTINUOUS_NON_EXECUTABLE';
  }
  if (input.market.contractExpired) {
    return 'CONTRACT_EXPIRED';
  }
  if (input.market.rollState === 'ROLLING') {
    return 'FUTURES_ROLL_RESTRICTION';
  }
  return null;
}

function uptrendConfirmed(
  market: CommodityTrendMarketState,
  closeMinor: bigint,
  config: CommodityTrendFollowingConfig,
): boolean {
  const maAligned = market.fastMaMinor > market.slowMaMinor && closeMinor > market.fastMaMinor;
  const tfAligned =
    market.trendDirection1h === 'UP' &&
    market.trendDirection4h === 'UP' &&
    (market.contextTrend1d === null || market.contextTrend1d !== 'DOWN');
  const rocOk = market.rateOfChangeBps >= config.minRocBps;
  const breakoutOk = market.breakoutState === 'BULLISH' || market.breakoutState === 'NONE';
  return maAligned && tfAligned && rocOk && breakoutOk;
}

function downtrendConfirmed(
  market: CommodityTrendMarketState,
  closeMinor: bigint,
  config: CommodityTrendFollowingConfig,
): boolean {
  const maAligned = market.fastMaMinor < market.slowMaMinor && closeMinor < market.fastMaMinor;
  const tfAligned =
    market.trendDirection1h === 'DOWN' &&
    market.trendDirection4h === 'DOWN' &&
    (market.contextTrend1d === null || market.contextTrend1d !== 'UP');
  const rocOk = market.rateOfChangeBps <= -config.minRocBps;
  const breakoutOk = market.breakoutState === 'BEARISH' || market.breakoutState === 'NONE';
  return maAligned && tfAligned && rocOk && breakoutOk;
}

function trendConfidenceBps(market: CommodityTrendMarketState, direction: CommodityPositionSide): number {
  const maSpreadBps =
    market.slowMaMinor === 0n
      ? 0
      : Number(((market.fastMaMinor - market.slowMaMinor) * 10_000n) / market.slowMaMinor);
  const magnitude = Math.min(Math.abs(maSpreadBps) + Math.abs(market.rateOfChangeBps), 2_000);
  const aligned =
    (direction === 'LONG' && market.trendDirection4h === 'UP') ||
    (direction === 'SHORT' && market.trendDirection4h === 'DOWN');
  return Math.max(0, Math.min(10_000, Math.floor(magnitude * (aligned ? 1.2 : 0.8))));
}

function evaluateExit(
  input: CommodityTrendEvaluateInput,
  config: CommodityTrendFollowingConfig,
): CommodityTrendDecision | null {
  if (input.forced?.emergencyClose || input.forced?.riskForcedExit || input.forced?.customerPauseOrClose) {
    const reason = input.forced.emergencyClose
      ? 'EMERGENCY_CLOSE'
      : input.forced.customerPauseOrClose
        ? 'CUSTOMER_PAUSE_OR_CLOSE'
        : 'RISK_FORCED_EXIT';
    return decision(
      input,
      config,
      'EXIT',
      input.position.side,
      0,
      `Forced exit: ${reason}`,
      null,
      reason,
    );
  }

  const envelopeFailure = passesOperatingEnvelope(input.market, config);
  if (envelopeFailure !== null) {
    return decision(
      input,
      config,
      'EXIT',
      input.position.side,
      0,
      `Exit on invalidation: ${envelopeFailure}`,
      null,
      envelopeFailure,
    );
  }

  if (input.market.rollState === 'ROLLING') {
    return decision(
      input,
      config,
      'EXIT',
      input.position.side,
      0,
      'Futures roll requirement — flatten before roll window',
      null,
      'FUTURES_ROLL_REQUIREMENT',
    );
  }

  if (input.position.entryAt !== null) {
    const heldHours = hoursBetween(input.position.entryAt, input.now);
    if (heldHours >= config.maxHoldingPeriodHours) {
      return decision(
        input,
        config,
        'EXIT',
        input.position.side,
        0,
        'Maximum holding period reached',
        null,
        'MAX_HOLDING_PERIOD',
      );
    }
  }

  if (input.position.adverseExcursionBps >= config.maxAdverseExcursionBps) {
    return decision(
      input,
      config,
      'EXIT',
      input.position.side,
      0,
      `Maximum adverse excursion ${input.position.adverseExcursionBps} bps exceeded`,
      null,
      'MAX_ADVERSE_EXCURSION',
    );
  }

  if (input.position.side === 'LONG') {
    const highWater = input.position.highWaterMarkMinor ?? input.bar.closeMinor;
    const stop = trailingStopLong(
      highWater,
      input.market.realizedVolatilityBps,
      config.trailingStopVolMultiplier,
    );
    if (input.bar.closeMinor <= stop) {
      return decision(
        input,
        config,
        'EXIT',
        'LONG',
        0,
        `Volatility-adjusted trailing stop at ${stop}`,
        null,
        'TRAILING_STOP',
      );
    }
    if (
      input.market.trendDirection1h === 'DOWN' ||
      input.market.fastMaMinor < input.market.slowMaMinor
    ) {
      return decision(
        input,
        config,
        'EXIT',
        'LONG',
        0,
        'Trend reversal — fast MA crossed below slow MA',
        null,
        'TREND_REVERSAL',
      );
    }
  }

  if (input.position.side === 'SHORT') {
    const lowWater = input.position.lowWaterMarkMinor ?? input.bar.closeMinor;
    const stop = trailingStopShort(
      lowWater,
      input.market.realizedVolatilityBps,
      config.trailingStopVolMultiplier,
    );
    if (input.bar.closeMinor >= stop) {
      return decision(
        input,
        config,
        'EXIT',
        'SHORT',
        0,
        `Volatility-adjusted trailing stop at ${stop}`,
        null,
        'TRAILING_STOP',
      );
    }
    if (
      input.market.trendDirection1h === 'UP' ||
      input.market.fastMaMinor > input.market.slowMaMinor
    ) {
      return decision(
        input,
        config,
        'EXIT',
        'SHORT',
        0,
        'Trend reversal — fast MA crossed above slow MA',
        null,
        'TREND_REVERSAL',
      );
    }
  }

  return null;
}

/**
 * Deterministic multi-timeframe commodity trend following for Gold and WTI.
 * Forward-paper / research only. Does not authorize live commodity or futures execution.
 */
export function evaluateCommodityTrendFollowingRule(
  input: CommodityTrendEvaluateInput,
): CommodityTrendDecision {
  const config: CommodityTrendFollowingConfig = Object.freeze({
    ...DEFAULT_M11_CONFIG,
    ...(input.config ?? {}),
  });

  if (!input.governance.workOrderActive) {
    return invalidation(input, config, 'WORK_ORDER_INACTIVE');
  }
  if (!input.governance.customerMandateValid) {
    return invalidation(input, config, 'CUSTOMER_MANDATE_INVALID');
  }
  if (!input.governance.decisionValidityEnvelopeValid) {
    return invalidation(input, config, 'DECISION_VALIDITY_ENVELOPE_INVALID');
  }

  if (input.position.hasOpenPosition && input.position.side !== null) {
    const exit = evaluateExit(input, config);
    if (exit !== null) {
      return exit;
    }
    return decision(
      input,
      config,
      'HOLD',
      input.position.side,
      trendConfidenceBps(input.market, input.position.side),
      `Hold open ${input.position.side} trend position`,
      null,
      null,
    );
  }

  const futuresGuard = passesFuturesGuards(input);
  if (futuresGuard !== null) {
    return invalidation(input, config, futuresGuard);
  }

  const envelopeFailure = passesOperatingEnvelope(input.market, config);
  if (envelopeFailure !== null) {
    return invalidation(input, config, envelopeFailure);
  }

  if (!isExecutableInstrumentKind(input.market.instrumentKind) &&
    input.market.instrumentKind !== 'commodity_reference') {
    return invalidation(input, config, 'INSTRUMENT_NOT_ELIGIBLE');
  }

  if (input.market.instrumentKind === 'commodity_reference') {
    return decision(
      input,
      config,
      'NO_ACTION',
      null,
      0,
      'Reference instrument — signal research only, no direct execution target',
      'REFERENCE_ONLY_NON_EXECUTION',
      null,
    );
  }

  const rangeBound =
    input.market.trendDirection1h === 'NEUTRAL' &&
    input.market.trendDirection4h === 'NEUTRAL' &&
    input.market.breakoutState === 'NONE';
  if (rangeBound) {
    return decision(
      input,
      config,
      'NO_ACTION',
      null,
      0,
      'Range-bound — no confirmed directional trend',
      null,
      null,
    );
  }

  if (uptrendConfirmed(input.market, input.bar.closeMinor, config) && input.governance.longPermitted) {
    return decision(
      input,
      config,
      'ENTER_LONG',
      'LONG',
      trendConfidenceBps(input.market, 'LONG'),
      `Confirmed multi-timeframe uptrend: 1h/4h aligned, ROC ${input.market.rateOfChangeBps} bps`,
      null,
      null,
    );
  }

  if (downtrendConfirmed(input.market, input.bar.closeMinor, config) && input.governance.shortPermitted) {
    return decision(
      input,
      config,
      'ENTER_SHORT',
      'SHORT',
      trendConfidenceBps(input.market, 'SHORT'),
      `Confirmed multi-timeframe downtrend: 1h/4h aligned, ROC ${input.market.rateOfChangeBps} bps`,
      null,
      null,
    );
  }

  if (downtrendConfirmed(input.market, input.bar.closeMinor, config) && !input.governance.shortPermitted) {
    return decision(
      input,
      config,
      'NO_ACTION',
      null,
      0,
      'Downtrend detected but short direction not permitted by mandate/jurisdiction',
      'SHORT_NOT_PERMITTED',
      null,
    );
  }

  return decision(
    input,
    config,
    'NO_ACTION',
    null,
    0,
    'No qualified commodity trend entry',
    null,
    null,
  );
}

export const HELIOS_M11_COMMODITY_TREND_FOLLOWING_V1 = HELIOS_M11_RULE_ID;
