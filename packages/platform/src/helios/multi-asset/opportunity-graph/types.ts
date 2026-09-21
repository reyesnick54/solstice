/**
 * HELIOS Multi-Asset M15 — Cross-Asset Opportunity Graph types.
 *
 * Research graph linking qualified instruments and cross-asset relationships.
 * Does not grant execution authority or approve orders.
 */

import type { UtcInstant } from '@solstice/domain';

export const CROSS_ASSET_OPPORTUNITY_EDGE_KINDS = [
  'CORRELATION',
  'COINTEGRATION_CANDIDATE',
  'REGIME_LINK',
  'MACRO_SENSITIVITY',
  'SPREAD_OPPORTUNITY',
] as const;
export type CrossAssetOpportunityEdgeKind = (typeof CROSS_ASSET_OPPORTUNITY_EDGE_KINDS)[number];

export const CROSS_ASSET_OPPORTUNITY_EVIDENCE_KINDS = [
  'CORRELATION_ARTIFACT',
  'CORRELATION_CHANGE',
  'CORRELATION_CLUSTER',
  'INSUFFICIENT_HISTORY',
] as const;
export type CrossAssetOpportunityEvidenceKind =
  (typeof CROSS_ASSET_OPPORTUNITY_EVIDENCE_KINDS)[number];

export type CrossAssetOpportunityNode = {
  readonly nodeId: string;
  readonly instrumentId: string;
  readonly assetClass: string;
  readonly symbol: string;
  readonly admitted: boolean;
  readonly updatedAt: UtcInstant;
};

export type CrossAssetOpportunityEdgeEvidence = {
  readonly evidenceId: string;
  readonly kind: CrossAssetOpportunityEvidenceKind;
  readonly artifactRef: string;
  readonly summary: string;
  readonly correlationBps: number | null;
  readonly relationshipState: string | null;
  readonly capturedAt: UtcInstant;
  readonly validUntil: UtcInstant;
};

export type CrossAssetOpportunityEdge = {
  readonly edgeId: string;
  readonly kind: CrossAssetOpportunityEdgeKind;
  readonly instrumentA: string;
  readonly instrumentB: string;
  readonly evidence: readonly CrossAssetOpportunityEdgeEvidence[];
  readonly updatedAt: UtcInstant;
};

export type CrossAssetOpportunityGraphSnapshot = {
  readonly nodes: readonly CrossAssetOpportunityNode[];
  readonly edges: readonly CrossAssetOpportunityEdge[];
  readonly capturedAt: UtcInstant;
};
