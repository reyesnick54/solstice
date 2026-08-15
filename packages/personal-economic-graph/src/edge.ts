import type { UtcInstant } from '../../domain/src/time.ts';
import type { EconomicEdgeId, EconomicGraphId, EconomicNodeId } from './ids.ts';
import type { DataQualityState, FactConfidence, Provenance } from './provenance.ts';
import type { EconomicEdgeKind } from './taxonomy.ts';

export type EconomicEdge = {
  readonly edgeId: EconomicEdgeId;
  readonly graphId: EconomicGraphId;
  readonly kind: EconomicEdgeKind;
  readonly fromNodeId: EconomicNodeId;
  readonly toNodeId: EconomicNodeId;
  readonly validFrom: UtcInstant;
  readonly validTo: UtcInstant | null;
  readonly quality: DataQualityState;
  readonly confidence: FactConfidence;
  readonly provenance: Provenance;
  readonly createdAt: UtcInstant;
  readonly survivesRebuild: boolean;
};

export function freezeEdge(edge: EconomicEdge): EconomicEdge {
  return Object.freeze({
    ...edge,
    provenance: Object.freeze({ ...edge.provenance }),
  });
}
