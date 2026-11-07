import type { TemporalEntityGraphStore } from '../../feature-fabric/entity-resolution/graph-store.ts';
import type { ConfidenceState } from '../../feature-fabric/entity-resolution/types.ts';
import type { AltAppendAssetRelationInput } from './types.ts';

function confidenceStateForScore(score: number): ConfidenceState {
  if (score >= 0.95) return 'CONFIRMED';
  if (score >= 0.75) return 'PROVISIONAL';
  if (score >= 0.5) return 'INFERRED';
  return 'DISPUTED';
}

export function appendAltAssetRelation(
  store: TemporalEntityGraphStore,
  input: AltAppendAssetRelationInput,
): void {
  store.appendEdge({
    relationshipType: input.relationshipType,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    evidenceRefs: Object.freeze([...input.sourceRefs]),
    source: 'helios:alt03:entity-asset-graph',
    confidenceState: confidenceStateForScore(input.confidence),
    ambiguityState: 'UNAMBIGUOUS',
    confidence: input.confidence,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    observedAt: input.observedAt,
    knowableAt: input.knowableAt,
    jurisdiction: input.jurisdiction,
  });
}
