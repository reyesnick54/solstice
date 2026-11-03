/**
 * Research signal helpers ported from upstream StrategyEngine (simulation thresholds only).
 * Outputs research annotations — not orders or wagers.
 */

import {
  feeAdjustedResearchEdgePpm,
  PROBABILITY_PPM_SCALE,
  researchEdgeVsImpliedMarketPpm,
} from './probability.ts';
import type { PredictionMicrostructureMetrics, PredictionOrderBook, ProbabilityEdgeObservation } from './types.ts';
import type { PredictionMarketProvenance } from './types.ts';
import type { PredictionOutcomeSide, ResearchSignalKind } from './taxonomy.ts';
import { HELIOS_OS14_PREDICTION_MARKET_AUTHORITY, HELIOS_OS14_PREDICTION_MARKET_SCHEMA } from './taxonomy.ts';
import type { UtcInstant } from '@solstice/domain';

export type Os14ResearchSignalConfig = {
  readonly probEdgeThresholdPpm: bigint;
  readonly imbalanceSkewPpm: bigint;
  readonly liquiditySpreadThresholdPpm: bigint;
  readonly defaultFeePpmPerSide: bigint;
};

export const DEFAULT_OS14_RESEARCH_SIGNAL_CONFIG: Os14ResearchSignalConfig = Object.freeze({
  probEdgeThresholdPpm: 50_000n,
  imbalanceSkewPpm: 300_000n,
  liquiditySpreadThresholdPpm: 40_000n,
  defaultFeePpmPerSide: 2_000n,
});

export type ResearchSignalAnnotation = {
  readonly kind: ResearchSignalKind;
  readonly side: PredictionOutcomeSide | null;
  readonly confidencePpm: bigint;
  readonly detail: string;
};

export function researchProbEdgeSignal(input: {
  readonly impliedMarketMidPpm: bigint;
  readonly researchPriorPpm: bigint | null;
  readonly config?: Os14ResearchSignalConfig;
}): ResearchSignalAnnotation | null {
  if (input.researchPriorPpm === null) {
    return null;
  }
  const cfg = input.config ?? DEFAULT_OS14_RESEARCH_SIGNAL_CONFIG;
  const edge = researchEdgeVsImpliedMarketPpm(input.impliedMarketMidPpm, input.researchPriorPpm);
  if (absPpm(edge) <= cfg.probEdgeThresholdPpm) {
    return null;
  }
  const side: PredictionOutcomeSide = edge > 0n ? 'NO' : 'YES';
  const conf = minPpm(PROBABILITY_PPM_SCALE, (absPpm(edge) * PROBABILITY_PPM_SCALE) / (cfg.probEdgeThresholdPpm * 2n));
  return Object.freeze({
    kind: 'PROB_EDGE',
    side,
    confidencePpm: conf,
    detail: `implied market mid vs research prior edge ${edge.toString()} ppm`,
  });
}

export function researchImbalanceSignal(
  micro: PredictionMicrostructureMetrics,
  config: Os14ResearchSignalConfig = DEFAULT_OS14_RESEARCH_SIGNAL_CONFIG,
): ResearchSignalAnnotation | null {
  const imb = micro.bookImbalancePpm;
  if (absPpm(imb) < config.imbalanceSkewPpm) {
    return null;
  }
  const side: PredictionOutcomeSide = imb > 0n ? 'YES' : 'NO';
  return Object.freeze({
    kind: 'IMBALANCE',
    side,
    confidencePpm: minPpm(PROBABILITY_PPM_SCALE, absPpm(imb)),
    detail: `book imbalance ${imb.toString()} ppm`,
  });
}

export function researchLiquiditySignal(
  micro: PredictionMicrostructureMetrics,
  config: Os14ResearchSignalConfig = DEFAULT_OS14_RESEARCH_SIGNAL_CONFIG,
): ResearchSignalAnnotation | null {
  if (micro.yesSpreadPpm < config.liquiditySpreadThresholdPpm) {
    return null;
  }
  const conf = minPpm(
    PROBABILITY_PPM_SCALE,
    (micro.yesSpreadPpm * PROBABILITY_PPM_SCALE) / (config.liquiditySpreadThresholdPpm * 2n),
  );
  return Object.freeze({
    kind: 'LIQUIDITY',
    side: 'YES',
    confidencePpm: conf,
    detail: `wide YES spread ${micro.yesSpreadPpm.toString()} ppm — resting-limit research only`,
  });
}

export function buildProbabilityEdgeObservation(input: {
  readonly observationId: string;
  readonly instrumentId: string;
  readonly marketSlug: string;
  readonly computedAt: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly impliedMarketMidPpm: bigint;
  readonly researchPriorPpm: bigint;
  readonly provenance: PredictionMarketProvenance;
  readonly signal: ResearchSignalAnnotation;
  readonly config?: Os14ResearchSignalConfig;
}): ProbabilityEdgeObservation {
  const cfg = input.config ?? DEFAULT_OS14_RESEARCH_SIGNAL_CONFIG;
  const rawEdge = researchEdgeVsImpliedMarketPpm(input.impliedMarketMidPpm, input.researchPriorPpm);
  const feeAdjusted = feeAdjustedResearchEdgePpm(rawEdge, cfg.defaultFeePpmPerSide, 2);

  return Object.freeze({
    schema: HELIOS_OS14_PREDICTION_MARKET_SCHEMA,
    authority: HELIOS_OS14_PREDICTION_MARKET_AUTHORITY,
    observationId: input.observationId,
    instrumentId: input.instrumentId,
    marketSlug: input.marketSlug,
    computedAt: input.computedAt,
    knowableAt: input.knowableAt,
    impliedMarketMidPpm: input.impliedMarketMidPpm,
    researchPriorPpm: input.researchPriorPpm,
    rawEdgePpm: rawEdge,
    feePpmPerSide: cfg.defaultFeePpmPerSide,
    feeAdjustedEdgePpm: feeAdjusted,
    suggestedResearchSide: input.signal.side,
    researchSignalKind: input.signal.kind,
    detail: input.signal.detail,
    provenance: input.provenance,
  });
}

export function evaluateResearchSignals(input: {
  readonly book: PredictionOrderBook;
  readonly micro: PredictionMicrostructureMetrics;
  readonly researchPriorPpm: bigint | null;
  readonly config?: Os14ResearchSignalConfig;
}): readonly ResearchSignalAnnotation[] {
  const cfg = input.config ?? DEFAULT_OS14_RESEARCH_SIGNAL_CONFIG;
  const out: ResearchSignalAnnotation[] = [];
  const prob = researchProbEdgeSignal({
    impliedMarketMidPpm: input.micro.impliedMarketMidPpm,
    researchPriorPpm: input.researchPriorPpm,
    config: cfg,
  });
  if (prob) out.push(prob);
  const imb = researchImbalanceSignal(input.micro, cfg);
  if (imb) out.push(imb);
  const liq = researchLiquiditySignal(input.micro, cfg);
  if (liq) out.push(liq);
  if (input.micro.crossOutcomeConsistency !== 'COMPLEMENT_OK') {
    out.push(
      Object.freeze({
        kind: 'CROSS_OUTCOME',
        side: null,
        confidencePpm: 500_000n,
        detail: `cross-outcome consistency ${input.micro.crossOutcomeConsistency}`,
      }),
    );
  }
  return Object.freeze(out);
}

function absPpm(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function minPpm(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
