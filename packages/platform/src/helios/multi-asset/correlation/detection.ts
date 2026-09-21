/**
 * HELIOS Multi-Asset M17 — relationship state and change detection.
 */

import type { CorrelationDataQualityBand, CorrelationRelationshipState } from './taxonomy.ts';
import {
  CORRELATION_BREAKDOWN_DELTA_BPS,
  CORRELATION_BPS_SCALE,
  ELEVATED_CORRELATION_THRESHOLD_BPS,
} from './taxonomy.ts';

export function assessDataQuality(input: {
  readonly sampleSize: number;
  readonly minSampleSize: number;
  readonly stale: boolean;
  readonly alignedPairs: number;
}): CorrelationDataQualityBand {
  if (input.stale) {
    return 'UNUSABLE';
  }
  if (input.sampleSize < input.minSampleSize || input.alignedPairs < 2) {
    return 'UNUSABLE';
  }
  if (input.sampleSize < input.minSampleSize + 4) {
    return 'LOW';
  }
  if (input.sampleSize < input.minSampleSize + 12) {
    return 'MEDIUM';
  }
  return 'HIGH';
}

export function classifyRelationshipState(input: {
  readonly correlationBps: number | null;
  readonly sampleSize: number;
  readonly minSampleSize: number;
  readonly stale: boolean;
  readonly priorCorrelationBps: number | null;
  readonly shortHorizonCorrelationBps: number | null;
  readonly mediumHorizonCorrelationBps: number | null;
}): CorrelationRelationshipState {
  if (input.sampleSize < input.minSampleSize || input.correlationBps === null) {
    return 'INSUFFICIENT_HISTORY';
  }
  if (input.stale) {
    return 'STALE_OBSERVATIONS';
  }

  const abs = Math.abs(input.correlationBps);
  const priorAbs =
    input.priorCorrelationBps === null ? null : Math.abs(input.priorCorrelationBps);

  if (
    priorAbs !== null &&
    priorAbs >= ELEVATED_CORRELATION_THRESHOLD_BPS &&
    input.correlationBps !== null &&
    priorAbs - abs >= CORRELATION_BREAKDOWN_DELTA_BPS
  ) {
    return 'CORRELATION_BREAKDOWN';
  }

  if (
    input.shortHorizonCorrelationBps !== null &&
    input.mediumHorizonCorrelationBps !== null &&
    Math.abs(input.shortHorizonCorrelationBps - input.mediumHorizonCorrelationBps) >= 3_500
  ) {
    return 'UNSTABLE_RELATIONSHIP';
  }

  if (abs >= ELEVATED_CORRELATION_THRESHOLD_BPS) {
    return 'ELEVATED_CORRELATION';
  }

  return 'NORMAL';
}

export function absCorrelationBps(value: number | null): number {
  if (value === null) {
    return 0;
  }
  return Math.abs(value);
}

export function correlationSign(value: number | null): -1 | 0 | 1 {
  if (value === null || value === 0) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

export function isMaterialCorrelationIncrease(input: {
  readonly currentMaxBps: number | null;
  readonly proposedCorrelationBps: number | null;
  readonly thresholdBps?: number;
}): boolean {
  const threshold = input.thresholdBps ?? ELEVATED_CORRELATION_THRESHOLD_BPS;
  if (input.proposedCorrelationBps === null) {
    return false;
  }
  const proposedAbs = Math.abs(input.proposedCorrelationBps);
  if (proposedAbs < threshold) {
    return false;
  }
  const currentMax = input.currentMaxBps ?? 0;
  return proposedAbs > currentMax + Math.floor(CORRELATION_BPS_SCALE / 20);
}
