import { createHash } from 'node:crypto';

import {
  ALPHA13_HIGH_RETURN_CORRELATION_SCALE,
  ALPHA13_POSITION_OVERLAP_NOTIFY_BPS,
  type StrategyInteractionKind,
} from './taxonomy.ts';
import type {
  CombinedInstrumentExposure,
  ForwardStrategyPortfolio,
  PortfolioCapitalAllocation,
  StrategyInteractionRecord,
  StrategyInteractionState,
} from './types.ts';

function correlationScale(seriesA: readonly number[], seriesB: readonly number[]): number {
  if (seriesA.length !== seriesB.length || seriesA.length === 0) {
    return 0;
  }
  const n = seriesA.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += seriesA[i]!;
    sumB += seriesB[i]!;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = seriesA[i]! - meanA;
    const db = seriesB[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA <= 0 || varB <= 0) {
    return 0;
  }
  const r = cov / Math.sqrt(varA * varB);
  return Math.round(Math.max(-1, Math.min(1, r)) * 10_000);
}

function interactionId(kind: StrategyInteractionKind, material: string): string {
  return `alpha13-ix:${createHash('sha256').update(`${kind}|${material}`).digest('hex').slice(0, 16)}`;
}

export function buildStrategyInteractionState(input: {
  readonly portfolio: ForwardStrategyPortfolio;
  readonly allocation: PortfolioCapitalAllocation;
}): StrategyInteractionState {
  const weightByStrategy = new Map(
    input.allocation.deployments.map((row) => [row.strategyId, row.weightBps] as const),
  );

  const instrumentNet = new Map<string, { net: number; gross: number; strategies: Set<string> }>();
  for (const leg of input.portfolio.legs) {
    const sleeveBps = weightByStrategy.get(leg.strategyId) ?? 0;
    for (const pos of leg.positions) {
      const scaled = Math.round((pos.weightBps * sleeveBps) / 10_000);
      const bucket = instrumentNet.get(pos.instrumentId) ?? { net: 0, gross: 0, strategies: new Set<string>() };
      bucket.net += scaled;
      bucket.gross += Math.abs(scaled);
      bucket.strategies.add(leg.strategyId);
      instrumentNet.set(pos.instrumentId, bucket);
    }
  }

  const combinedExposures: CombinedInstrumentExposure[] = [];
  for (const [instrumentId, bucket] of instrumentNet) {
    combinedExposures.push(
      Object.freeze({
        instrumentId,
        contributingStrategies: Object.freeze([...bucket.strategies].sort()),
        netWeightBps: bucket.net,
        grossWeightBps: bucket.gross,
      }),
    );
  }
  combinedExposures.sort((a, b) => a.instrumentId.localeCompare(b.instrumentId));

  const interactions: StrategyInteractionRecord[] = [];
  let duplicateAlphaExposureBps = 0;
  let executionCompetitionScoreBps = 0;

  for (const exposure of combinedExposures) {
    if (exposure.contributingStrategies.length > 1) {
      const overlapBps = Math.min(exposure.grossWeightBps, exposure.netWeightBps > 0 ? exposure.netWeightBps : 0);
      if (Math.abs(exposure.netWeightBps) >= ALPHA13_POSITION_OVERLAP_NOTIFY_BPS) {
        interactions.push(
          Object.freeze({
            interactionId: interactionId('OVERLAPPING_POSITION', exposure.instrumentId),
            kind: 'OVERLAPPING_POSITION',
            strategyIds: exposure.contributingStrategies,
            instrumentId: exposure.instrumentId,
            detail: 'Multiple strategies hold the same-signed economic exposure.',
            severityBps: Math.min(10_000, overlapBps),
          }),
        );
        duplicateAlphaExposureBps += overlapBps;
        executionCompetitionScoreBps += Math.min(3_000, exposure.contributingStrategies.length * 750);
      }
      if (exposure.grossWeightBps > Math.abs(exposure.netWeightBps) + ALPHA13_POSITION_OVERLAP_NOTIFY_BPS) {
        interactions.push(
          Object.freeze({
            interactionId: interactionId('OFFSETTING_TRADE', exposure.instrumentId),
            kind: 'OFFSETTING_TRADE',
            strategyIds: exposure.contributingStrategies,
            instrumentId: exposure.instrumentId,
            detail: 'Gross exposure exceeds net — strategies partially offset on the same instrument.',
            severityBps: Math.min(10_000, exposure.grossWeightBps - Math.abs(exposure.netWeightBps)),
          }),
        );
      }
      if (exposure.contributingStrategies.length >= 2) {
        interactions.push(
          Object.freeze({
            interactionId: interactionId('EXECUTION_COMPETITION', exposure.instrumentId),
            kind: 'EXECUTION_COMPETITION',
            strategyIds: exposure.contributingStrategies,
            instrumentId: exposure.instrumentId,
            detail: 'Multiple sleeves compete for the same executable liquidity.',
            severityBps: Math.min(10_000, exposure.contributingStrategies.length * 1_500),
          }),
        );
      }
    }
  }

  const pairwiseReturnCorrelationScale: Record<string, number> = {};
  const legs = input.portfolio.legs;
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      const a = legs[i]!;
      const b = legs[j]!;
      const key = `${a.strategyId}|${b.strategyId}`;
      const scale = correlationScale(a.returnSeriesBps, b.returnSeriesBps);
      pairwiseReturnCorrelationScale[key] = scale;
      if (scale >= ALPHA13_HIGH_RETURN_CORRELATION_SCALE) {
        interactions.push(
          Object.freeze({
            interactionId: interactionId('CORRELATED_RETURN', key),
            kind: 'CORRELATED_RETURN',
            strategyIds: Object.freeze([a.strategyId, b.strategyId]),
            detail: 'Highly correlated return streams — likely one economic edge expressed twice.',
            severityBps: scale,
          }),
        );
        interactions.push(
          Object.freeze({
            interactionId: interactionId('DUPLICATE_EXPOSURE', key),
            kind: 'DUPLICATE_EXPOSURE',
            strategyIds: Object.freeze([a.strategyId, b.strategyId]),
            detail: 'Correlated strategies with overlapping factor/position structure.',
            severityBps: Math.min(10_000, Math.round(scale * 0.85)),
          }),
        );
      }
    }
  }

  for (const leg of legs) {
    if (leg.riskLimitUtilizationBps >= 9_500) {
      interactions.push(
        Object.freeze({
          interactionId: interactionId('RISK_LIMIT_BINDING', leg.strategyId),
          kind: 'RISK_LIMIT_BINDING',
          strategyIds: Object.freeze([leg.strategyId]),
          detail: 'Strategy risk limits bind under combined portfolio path.',
          severityBps: leg.riskLimitUtilizationBps,
        }),
      );
    }
  }

  executionCompetitionScoreBps = Math.min(10_000, executionCompetitionScoreBps);

  return Object.freeze({
    portfolioId: input.portfolio.portfolioId,
    combinedExposures: Object.freeze(combinedExposures),
    interactions: Object.freeze(interactions),
    pairwiseReturnCorrelationScale: Object.freeze(pairwiseReturnCorrelationScale),
    duplicateAlphaExposureBps: Math.min(10_000, duplicateAlphaExposureBps),
    executionCompetitionScoreBps,
  });
}
