import type { EvidenceVault } from '@solstice/evidence';
import type { PredictionMarketFeatureSnapshot, PredictionMarketObservation, ProbabilityEdgeObservation } from './types.ts';

export function sealOs14PredictionMarketObservation(
  vault: EvidenceVault | undefined,
  observation: PredictionMarketObservation,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_OS14_PREDICTION_MARKET_OBSERVATION', {
    observationId: observation.observationId,
    instrumentId: observation.instrumentId,
    marketSlug: observation.marketSlug,
    observationKind: observation.observationKind,
    impliedMarketMidPpm: observation.impliedMarketMidPpm?.toString() ?? null,
    authority: observation.authority,
    upstreamReferenceSha: observation.provenance.upstreamReferenceSha,
    researchOnly: true,
    permitsLiveWagering: false,
  });
  return sealed?.evidenceId ?? null;
}

export function sealOs14ProbabilityEdgeObservation(
  vault: EvidenceVault | undefined,
  edge: ProbabilityEdgeObservation,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_OS14_PROBABILITY_EDGE_RESEARCH', {
    observationId: edge.observationId,
    instrumentId: edge.instrumentId,
    impliedMarketMidPpm: edge.impliedMarketMidPpm.toString(),
    researchPriorPpm: edge.researchPriorPpm.toString(),
    feeAdjustedEdgePpm: edge.feeAdjustedEdgePpm.toString(),
    researchSignalKind: edge.researchSignalKind,
    authority: edge.authority,
    researchOnly: true,
  });
  return sealed?.evidenceId ?? null;
}

export function sealOs14FeatureSnapshot(
  vault: EvidenceVault | undefined,
  features: PredictionMarketFeatureSnapshot,
): string | null {
  if (!vault) {
    return null;
  }
  const sealed = vault.seal('HELIOS_OS14_PREDICTION_MARKET_FEATURES', {
    instrumentId: features.instrumentId,
    knowableAt: features.knowableAt,
    impliedMarketMidPpm: features.impliedMarketMidPpm?.toString() ?? null,
    bookImbalancePpm: features.bookImbalancePpm?.toString() ?? null,
    schema: features.schema,
    researchOnly: true,
  });
  return sealed?.evidenceId ?? null;
}
