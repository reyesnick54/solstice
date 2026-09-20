import type { UtcInstant } from '../../../domain/src/time.ts';

import {
  DEFAULT_M10_CONFIG,
  HELIOS_M10_RULE_ID,
  HELIOS_M10_RULE_VERSION,
  type CryptoMomentumBreakoutConfig,
} from './constants.ts';
import type {
  CryptoMomentumDecision,
  CryptoMomentumEvaluateInput,
  CryptoMomentumMarketState,
} from './types.ts';

function hoursBetween(start: UtcInstant, end: UtcInstant): number {
  return (Date.parse(end) - Date.parse(start)) / 3_600_000;
}

function applyBuffer(rangeHighMinor: bigint, bufferBps: number): bigint {
  return rangeHighMinor + (rangeHighMinor * BigInt(bufferBps)) / 10_000n;
}

function trailingStopMinor(
  highWaterMarkMinor: bigint,
  realizedVolatilityBps: number,
  multiplier: number,
): bigint {
  const stopDistance = (highWaterMarkMinor * BigInt(Math.round(realizedVolatilityBps * multiplier))) / 10_000n;
  return highWaterMarkMinor - stopDistance;
}

function invalidation(
  input: CryptoMomentumEvaluateInput,
  config: CryptoMomentumBreakoutConfig,
  reason: string,
): CryptoMomentumDecision {
  return Object.freeze({
    strategyId: input.strategyId,
    action: 'NO_ACTION',
    instrumentId: input.instrumentId,
    quantityUnits: '0',
    rationale: reason,
    ruleVersion: HELIOS_M10_RULE_VERSION,
    invalidationReason: reason,
    exitReason: null,
    closeMinor: input.bar.closeMinor.toString(),
    rollingRangeHighMinor: input.market.rollingRangeHighMinor.toString(),
    relativeVolumeRatio: input.market.relativeVolumeRatio,
    spreadBps: input.market.spreadBps,
    realizedVolatilityBps: input.market.realizedVolatilityBps,
    decidedAt: input.now,
  });
}

function sellDecision(
  input: CryptoMomentumEvaluateInput,
  config: CryptoMomentumBreakoutConfig,
  rationale: string,
  exitReason: string,
): CryptoMomentumDecision {
  return Object.freeze({
    strategyId: input.strategyId,
    action: 'SELL',
    instrumentId: input.instrumentId,
    quantityUnits: config.quantityUnits,
    rationale,
    ruleVersion: HELIOS_M10_RULE_VERSION,
    invalidationReason: null,
    exitReason,
    closeMinor: input.bar.closeMinor.toString(),
    rollingRangeHighMinor: input.market.rollingRangeHighMinor.toString(),
    relativeVolumeRatio: input.market.relativeVolumeRatio,
    spreadBps: input.market.spreadBps,
    realizedVolatilityBps: input.market.realizedVolatilityBps,
    decidedAt: input.now,
  });
}

function buyDecision(
  input: CryptoMomentumEvaluateInput,
  config: CryptoMomentumBreakoutConfig,
  rationale: string,
): CryptoMomentumDecision {
  return Object.freeze({
    strategyId: input.strategyId,
    action: 'BUY',
    instrumentId: input.instrumentId,
    quantityUnits: config.quantityUnits,
    rationale,
    ruleVersion: HELIOS_M10_RULE_VERSION,
    invalidationReason: null,
    exitReason: null,
    closeMinor: input.bar.closeMinor.toString(),
    rollingRangeHighMinor: input.market.rollingRangeHighMinor.toString(),
    relativeVolumeRatio: input.market.relativeVolumeRatio,
    spreadBps: input.market.spreadBps,
    realizedVolatilityBps: input.market.realizedVolatilityBps,
    decidedAt: input.now,
  });
}

function noAction(
  input: CryptoMomentumEvaluateInput,
  rationale: string,
): CryptoMomentumDecision {
  return Object.freeze({
    strategyId: input.strategyId,
    action: 'NO_ACTION',
    instrumentId: input.instrumentId,
    quantityUnits: '0',
    rationale,
    ruleVersion: HELIOS_M10_RULE_VERSION,
    invalidationReason: null,
    exitReason: null,
    closeMinor: input.bar.closeMinor.toString(),
    rollingRangeHighMinor: input.market.rollingRangeHighMinor.toString(),
    relativeVolumeRatio: input.market.relativeVolumeRatio,
    spreadBps: input.market.spreadBps,
    realizedVolatilityBps: input.market.realizedVolatilityBps,
    decidedAt: input.now,
  });
}

function passesOperatingEnvelope(
  market: CryptoMomentumMarketState,
  config: CryptoMomentumBreakoutConfig,
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
  if (market.spreadBps > config.maxSpreadBps) {
    return 'SPREAD_TOO_WIDE';
  }
  if (market.realizedVolatilityBps < config.minRealizedVolatilityBps) {
    return 'VOLATILITY_TOO_LOW';
  }
  if (market.realizedVolatilityBps > config.maxRealizedVolatilityBps) {
    return 'VOLATILITY_TOO_HIGH';
  }
  return null;
}

function passesEntryBreakout(
  input: CryptoMomentumEvaluateInput,
  config: CryptoMomentumBreakoutConfig,
): boolean {
  const threshold = applyBuffer(input.market.rollingRangeHighMinor, config.breakoutBufferBps);
  const closeBeyond = input.bar.closeMinor >= input.controls.minimumCloseBeyondBreakoutMinor;
  const rangeBreak = input.bar.closeMinor > threshold;
  const volumeOk = input.market.relativeVolumeRatio >= config.volumeRatioThreshold;
  const persistenceOk = input.controls.persistenceBarsConfirmed >= config.persistenceBars;
  return rangeBreak && closeBeyond && volumeOk && persistenceOk;
}

function evaluateExit(
  input: CryptoMomentumEvaluateInput,
  config: CryptoMomentumBreakoutConfig,
): CryptoMomentumDecision | null {
  if (input.forced?.emergencyClose || input.forced?.riskForcedExit) {
    return sellDecision(
      input,
      config,
      input.forced.emergencyClose ? 'Emergency close requested' : 'Risk engine forced exit',
      input.forced.emergencyClose ? 'EMERGENCY_CLOSE' : 'RISK_FORCED_EXIT',
    );
  }

  const envelopeFailure = passesOperatingEnvelope(input.market, config);
  if (envelopeFailure !== null) {
    return sellDecision(
      input,
      config,
      `Exit on invalidation: ${envelopeFailure}`,
      envelopeFailure,
    );
  }

  if (input.position.entryAt !== null) {
    const heldHours = hoursBetween(input.position.entryAt, input.now);
    if (heldHours >= config.maxHoldingPeriodHours) {
      return sellDecision(input, config, 'Maximum holding period reached', 'MAX_HOLDING_PERIOD');
    }
  }

  const highWater = input.position.highWaterMarkMinor ?? input.bar.closeMinor;
  const stop = trailingStopMinor(
    highWater,
    input.market.realizedVolatilityBps,
    config.trailingStopVolMultiplier,
  );
  if (input.bar.closeMinor <= stop) {
    return sellDecision(
      input,
      config,
      `Volatility-adjusted trailing stop at ${stop}`,
      'TRAILING_STOP',
    );
  }

  if (input.bar.closeMinor <= input.market.rollingRangeHighMinor) {
    return sellDecision(
      input,
      config,
      'Momentum failure: close returned inside rolling range',
      'MOMENTUM_FAILURE',
    );
  }

  return null;
}

/**
 * Deterministic 1h crypto momentum breakout with volume confirmation.
 * Forward-paper / research only. Does not authorize live crypto execution.
 */
export function evaluateCryptoMomentumBreakoutRule(
  input: CryptoMomentumEvaluateInput,
): CryptoMomentumDecision {
  const config: CryptoMomentumBreakoutConfig = Object.freeze({
    ...DEFAULT_M10_CONFIG,
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

  if (input.position.hasOpenPosition) {
    const exit = evaluateExit(input, config);
    if (exit !== null) {
      return exit;
    }
    return noAction(input, 'Hold open momentum breakout position');
  }

  const envelopeFailure = passesOperatingEnvelope(input.market, config);
  if (envelopeFailure !== null) {
    return invalidation(input, config, envelopeFailure);
  }

  if (!passesEntryBreakout(input, config)) {
    if (input.bar.closeMinor > applyBuffer(input.market.rollingRangeHighMinor, config.breakoutBufferBps) &&
      input.market.relativeVolumeRatio < config.volumeRatioThreshold) {
      return noAction(
        input,
        `Breakout without volume confirmation: ratio ${input.market.relativeVolumeRatio} < ${config.volumeRatioThreshold}`,
      );
    }
    if (input.bar.closeMinor > input.market.rollingRangeHighMinor &&
      input.bar.closeMinor < input.controls.minimumCloseBeyondBreakoutMinor) {
      return noAction(input, 'False breakout: close did not exceed minimum beyond threshold');
    }
    return noAction(input, 'No qualified momentum breakout entry');
  }

  return buyDecision(
    input,
    config,
    `Volume-confirmed breakout above ${input.market.rollingRangeHighMinor} with ratio ${input.market.relativeVolumeRatio}`,
  );
}

export const HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1 = HELIOS_M10_RULE_ID;
