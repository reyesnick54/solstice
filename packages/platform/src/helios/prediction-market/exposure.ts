/**
 * Paper exposure metrics — no independent wallet or portfolio subsystem.
 */

import { PREDICTION_PROBABILITY_SCALE } from './taxonomy.ts';
import type { ExposureMetrics, PaperPositionRecord, PredictionOutcomeSide } from './types.ts';

const SIDES: readonly PredictionOutcomeSide[] = ['YES', 'NO'];

export function computeExposureMetrics(
  conditionId: string,
  positions: readonly PaperPositionRecord[],
): ExposureMetrics {
  const relevant = positions.filter((p) => p.conditionId === conditionId);
  let gross = 0n;
  let netYes = 0n;
  let notional = 0n;
  let maxLoss = 0n;
  const concentration: Record<PredictionOutcomeSide, bigint> = { YES: 0n, NO: 0n };

  for (const pos of relevant) {
    for (const leg of pos.legs) {
      gross += leg.quantityContracts;
      concentration[leg.side] += leg.quantityContracts;
      if (leg.side === 'YES') {
        netYes += leg.quantityContracts;
      } else {
        netYes -= leg.quantityContracts;
      }
      notional += leg.quantityContracts * leg.averagePriceMinor;
      maxLoss += leg.quantityContracts * leg.averagePriceMinor;
    }
  }

  return Object.freeze({
    conditionId,
    grossContracts: gross,
    netYesContracts: netYes,
    notionalAtRiskMinor: notional,
    maxLossMinor: maxLoss > PREDICTION_PROBABILITY_SCALE ? maxLoss : maxLoss,
    concentrationBySide: Object.freeze({ ...concentration }),
  });
}

export function aggregateExposureAcrossConditions(
  positions: readonly PaperPositionRecord[],
): readonly ExposureMetrics[] {
  const ids = [...new Set(positions.map((p) => p.conditionId))];
  return Object.freeze(ids.map((id) => computeExposureMetrics(id, positions)));
}

export function emptyExposure(conditionId: string): ExposureMetrics {
  return Object.freeze({
    conditionId,
    grossContracts: 0n,
    netYesContracts: 0n,
    notionalAtRiskMinor: 0n,
    maxLossMinor: 0n,
    concentrationBySide: Object.freeze({ YES: 0n, NO: 0n }),
  });
}

export function sideKeys(): readonly PredictionOutcomeSide[] {
  return SIDES;
}
