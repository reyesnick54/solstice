/**
 * HELIOS Multi-Asset Expansion M15 qualification gate.
 */

export const HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED =
  'HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_BLOCKED =
  'HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_BLOCKED' as const;

export type MultiAssetM15QualificationChecks = {
  readonly instrumentRelationshipModeled: boolean;
  readonly measuredCorrelationEdgeComputed: boolean;
  readonly hypothesisEdgeSeparated: boolean;
  readonly expiredEdgeHandled: boolean;
  readonly contradictoryRelationshipsDetected: boolean;
  readonly dataQualityDegradationPropagated: boolean;
  readonly graphTraversalWorks: boolean;
  readonly relatedOpportunitySearchWorks: boolean;
  readonly evidenceLineageTraceable: boolean;
  readonly restartPreservesHistory: boolean;
  readonly tenantIsolationEnforced: boolean;
  readonly noExecutionAuthority: boolean;
  readonly noLlmHypothesisAsConfirmed: boolean;
};

export type MultiAssetM15QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMultiAssetM15Qualification(
  checks: MultiAssetM15QualificationChecks,
): MultiAssetM15QualificationResult {
  const blockers: string[] = [];
  const entries: Array<[keyof MultiAssetM15QualificationChecks, string]> = [
    ['instrumentRelationshipModeled', 'instrument structural relationship not modeled'],
    ['measuredCorrelationEdgeComputed', 'measured correlation edge not computed from evidence'],
    ['hypothesisEdgeSeparated', 'hypothesis edge not separated from measured/structural'],
    ['expiredEdgeHandled', 'expired edge not handled'],
    ['contradictoryRelationshipsDetected', 'contradictory relationships not detected'],
    ['dataQualityDegradationPropagated', 'data quality degradation not propagated to edges'],
    ['graphTraversalWorks', 'graph traversal failed'],
    ['relatedOpportunitySearchWorks', 'related opportunity search failed'],
    ['evidenceLineageTraceable', 'evidence lineage not traceable'],
    ['restartPreservesHistory', 'restart did not preserve relationship history'],
    ['tenantIsolationEnforced', 'tenant/customer isolation not enforced'],
    ['noExecutionAuthority', 'graph grants execution authority'],
    ['noLlmHypothesisAsConfirmed', 'LLM hypothesis stored as confirmed relationship'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M15_CROSS_ASSET_GRAPH_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
