/**
 * HELIOS Multi-Asset M17 — portfolio correlation lookup for Risk Engine / Meta Allocator.
 *
 * Research query only. Does not approve or reject orders.
 */

import type { UtcInstant } from '@solstice/domain';
import type { CorrelationEngineStorePort } from './store.ts';
import type { DynamicCrossAssetCorrelationEngine } from './engine.ts';
import type { CorrelationWindowHorizon } from './taxonomy.ts';
import type { PortfolioCorrelationLookup, PortfolioExposurePosition } from './types.ts';
import { isMaterialCorrelationIncrease } from './detection.ts';

export function queryPortfolioCorrelation(input: {
  readonly engine: DynamicCrossAssetCorrelationEngine;
  readonly store: CorrelationEngineStorePort;
  readonly proposedInstrumentId: string;
  readonly positions: readonly PortfolioExposurePosition[];
  readonly asOf: UtcInstant;
  readonly horizon?: CorrelationWindowHorizon;
}): PortfolioCorrelationLookup {
  const horizon = input.horizon ?? 'MEDIUM';
  const positionCorrelations = input.positions.map((position) => {
    const artifact = input.engine.computePair({
      instrumentA: input.proposedInstrumentId,
      instrumentB: position.instrumentId,
      asOf: input.asOf,
      horizon,
    });
    return Object.freeze({
      instrumentId: position.instrumentId,
      correlationBps: artifact.correlationBps,
      relationshipState: artifact.relationshipState,
      artifactId: artifact.artifactId,
    });
  });

  let maxCorrelationBps: number | null = null;
  let maxCorrelatedInstrumentId: string | null = null;
  for (const row of positionCorrelations) {
    if (row.correlationBps === null) {
      continue;
    }
    const abs = Math.abs(row.correlationBps);
    if (maxCorrelationBps === null || abs > Math.abs(maxCorrelationBps)) {
      maxCorrelationBps = row.correlationBps;
      maxCorrelatedInstrumentId = row.instrumentId;
    }
  }

  const clusters = input.store.clusters(input.asOf);
  const positionIds = new Set(input.positions.map((row) => row.instrumentId));
  positionIds.add(input.proposedInstrumentId);
  const sharedRiskClusterIds = clusters
    .filter((cluster) => cluster.instrumentIds.some((id) => positionIds.has(id)))
    .filter((cluster) => {
      const members = cluster.instrumentIds.filter((id) => positionIds.has(id));
      return members.length >= 2 && members.includes(input.proposedInstrumentId);
    })
    .map((cluster) => cluster.clusterId);

  const wouldMateriallyIncreaseCorrelatedExposure = isMaterialCorrelationIncrease({
    currentMaxBps: maxCorrelationBps,
    proposedCorrelationBps: maxCorrelationBps,
  });

  return Object.freeze({
    proposedInstrumentId: input.proposedInstrumentId,
    asOf: input.asOf,
    horizon,
    positionCorrelations: Object.freeze(positionCorrelations),
    maxCorrelationBps,
    maxCorrelatedInstrumentId,
    wouldMateriallyIncreaseCorrelatedExposure,
    sharedRiskClusterIds: Object.freeze(sharedRiskClusterIds),
    researchOnly: true as const,
  });
}
