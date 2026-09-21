import type { UtcInstant } from '@solstice/domain';

import {
  buildPortfolioExposureGraph,
  positionFromProposedTrade,
} from './build.ts';
import { queryConcentrationBps, queryTotalExposureMinor } from './query.ts';
import type {
  PortfolioExposureGraph,
  PortfolioExposureGraphBuildInput,
  PreTradeExposureSimulationResult,
  ProposedTradeInput,
  ProvisionalExposureThreshold,
} from './types.ts';

function diffContributions(
  before: PortfolioExposureGraph,
  after: PortfolioExposureGraph,
): readonly PortfolioExposureGraph['contributions'][number][] {
  const beforeIds = new Set(before.contributions.map((row) => row.contributionId));
  return Object.freeze(after.contributions.filter((row) => !beforeIds.has(row.contributionId)));
}

function evaluateThresholds(
  after: PortfolioExposureGraph,
  thresholds: readonly ProvisionalExposureThreshold[],
): PreTradeExposureSimulationResult['breachedThresholds'] {
  const breached: PreTradeExposureSimulationResult['breachedThresholds'][number][] = [];
  for (const threshold of thresholds) {
    const bucketKey = threshold.bucketKey ?? 'PORTFOLIO';
    const totals = queryTotalExposureMinor(after, threshold.dimension, threshold.bucketKey);
    const concentration = threshold.bucketKey
      ? queryConcentrationBps(after, threshold.dimension, threshold.bucketKey)
      : queryConcentrationBps(after, threshold.dimension, bucketKey);
    let breachedFlag = false;
    const messages: string[] = [];
    if (threshold.maxGrossExposureMinor !== undefined && totals.gross > threshold.maxGrossExposureMinor) {
      breachedFlag = true;
      messages.push('gross exposure exceeded');
    }
    if (threshold.maxNetExposureMinor !== undefined && absBig(totals.net) > threshold.maxNetExposureMinor) {
      breachedFlag = true;
      messages.push('net exposure exceeded');
    }
    if (threshold.maxConcentrationBps !== undefined && concentration > threshold.maxConcentrationBps) {
      breachedFlag = true;
      messages.push('concentration exceeded');
    }
    if (breachedFlag) {
      breached.push(
        Object.freeze({
          thresholdId: threshold.thresholdId,
          dimension: threshold.dimension,
          bucketKey,
          observedGrossExposureMinor: totals.gross,
          observedNetExposureMinor: totals.net,
          observedConcentrationBps: concentration,
          message: messages.join('; '),
        }),
      );
    }
  }
  return Object.freeze(breached);
}

function absBig(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function simulateProposedTradeExposure(input: {
  readonly beforeGraph: PortfolioExposureGraph;
  readonly proposedTrade: ProposedTradeInput;
  readonly buildInput: Omit<PortfolioExposureGraphBuildInput, 'graphId' | 'positions'>;
  readonly provisionalThresholds?: readonly ProvisionalExposureThreshold[];
  readonly proposedPositionId?: string;
  readonly asOf?: UtcInstant;
}): PreTradeExposureSimulationResult {
  const asOf = input.asOf ?? input.beforeGraph.asOf;
  const proposedPosition = positionFromProposedTrade(
    input.proposedPositionId ?? `sim_${input.proposedTrade.instrumentId}`,
    input.proposedTrade,
    asOf,
  );
  const mergedPositions = Object.freeze([...input.beforeGraph.positions, proposedPosition]);
  const after = buildPortfolioExposureGraph({
    ...input.buildInput,
    graphId: `${input.beforeGraph.graphId}_sim`,
    portfolioId: input.beforeGraph.portfolioId,
    asOf,
    positions: mergedPositions,
  });
  const proposedChange = diffContributions(input.beforeGraph, after);
  const warnings: string[] = [];
  if (!input.buildInput.instruments.some((row) => row.instrumentId === input.proposedTrade.instrumentId)) {
    warnings.push('proposed trade instrument metadata missing; exposure may be incomplete');
  }
  if (after.topCorrelatedCluster && (after.topCorrelatedCluster.instrumentIds.length ?? 0) > 2) {
    warnings.push('proposed trade increases correlated cluster concentration');
  }
  const breachedThresholds = evaluateThresholds(after, input.provisionalThresholds ?? []);
  return Object.freeze({
    before: input.beforeGraph,
    proposedChange,
    after,
    warnings: Object.freeze(warnings),
    breachedThresholds,
    simulationOnly: true,
  });
}
