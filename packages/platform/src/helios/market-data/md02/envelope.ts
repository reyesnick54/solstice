/**
 * Build institutional MarketTimeEnvelope without collapsing pipeline stages.
 */

import type { UtcInstant } from '@solstice/domain';
import { DEFAULT_CLOCK_AHEAD_TOLERANCE_MS, HELIOS_MD02_PRECISION_TIME_SCHEMA } from './taxonomy.ts';
import { ciSoftwareClockDiscipline, defaultReceiveTimestampPrecision } from './clock.ts';
import { computeMarketKnowableAt } from './knowable-at.ts';
import { computeMarketTimeLatencies } from './latency.ts';
import type { BuildMarketTimeEnvelopeInput, MarketTimeEnvelope, TimestampQualityState } from './types.ts';

function detectClockInconsistency(input: {
  readonly exchangeEventTime: UtcInstant | null;
  readonly sunreyNetworkReceiveTime: UtcInstant;
  readonly toleranceMs: number;
}): boolean {
  if (!input.exchangeEventTime) {
    return false;
  }
  const eventMs = Date.parse(input.exchangeEventTime);
  const receiveMs = Date.parse(input.sunreyNetworkReceiveTime);
  if (!Number.isFinite(eventMs) || !Number.isFinite(receiveMs)) {
    return false;
  }
  return eventMs > receiveMs + input.toleranceMs;
}

export function buildMarketTimeEnvelope(input: BuildMarketTimeEnvelopeInput): MarketTimeEnvelope {
  const clockDiscipline = input.clockDiscipline ?? ciSoftwareClockDiscipline(input.sunreyNetworkReceiveTime);
  const sunreyDecodeTime = input.sunreyDecodeTime ?? input.sunreyNormalizeTime ?? input.sunreyNetworkReceiveTime;
  const sunreyNormalizeTime = input.sunreyNormalizeTime ?? input.sunreyPersistTime ?? sunreyDecodeTime;
  const sunreyPersistTime = input.sunreyPersistTime ?? sunreyNormalizeTime;

  const stages = {
    exchangeEventTime: input.exchangeEventTime ?? null,
    exchangeSendTime: input.exchangeSendTime ?? null,
    providerReceiveTime: input.providerReceiveTime ?? null,
    providerPublishTime: input.providerPublishTime ?? null,
    sunreyNetworkReceiveTime: input.sunreyNetworkReceiveTime,
    sunreyDecodeTime,
    sunreyNormalizeTime,
    sunreyPersistTime,
  };

  const knowableAt = computeMarketKnowableAt(stages);
  const toleranceMs = input.clockAheadToleranceMs ?? DEFAULT_CLOCK_AHEAD_TOLERANCE_MS;
  const clockInconsistency = detectClockInconsistency({
    exchangeEventTime: stages.exchangeEventTime,
    sunreyNetworkReceiveTime: stages.sunreyNetworkReceiveTime,
    toleranceMs,
  });

  const partialEnvelope: MarketTimeEnvelope = Object.freeze({
    schema: HELIOS_MD02_PRECISION_TIME_SCHEMA,
    ...stages,
    knowableAt,
    clockDiscipline,
    timestampQuality: Object.freeze({
      sourceTimestampPrecision: input.sourceTimestampPrecision ?? 'MILLISECOND',
      receiveTimestampPrecision:
        input.receiveTimestampPrecision ?? defaultReceiveTimestampPrecision(clockDiscipline),
      clockInconsistency: false,
      negativeLatencyDetected: false,
    }),
  });

  const latencies = computeMarketTimeLatencies(partialEnvelope, input.processMonotonicNs);
  const timestampQuality: TimestampQualityState = Object.freeze({
    sourceTimestampPrecision: partialEnvelope.timestampQuality.sourceTimestampPrecision,
    receiveTimestampPrecision: partialEnvelope.timestampQuality.receiveTimestampPrecision,
    clockInconsistency,
    negativeLatencyDetected: latencies.negativeSegments.length > 0,
  });

  return Object.freeze({
    ...partialEnvelope,
    timestampQuality,
  });
}
