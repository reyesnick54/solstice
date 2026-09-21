/**
 * HELIOS Multi-Asset Expansion M17 — pairwise correlation types.
 */

export const CORRELATION_METHODS = ['PEARSON_LOG_RETURN', 'INSUFFICIENT_DATA'] as const;
export type CorrelationMethod = (typeof CORRELATION_METHODS)[number];

export type CorrelationPair = {
  readonly instrumentAId: string;
  readonly instrumentBId: string;
  readonly correlation: number | null;
  readonly sampleCount: number;
  readonly method: CorrelationMethod;
  readonly provenanceKind: 'MODEL_ESTIMATED';
  readonly sourceRefs: readonly string[];
};

export type CorrelationCluster = {
  readonly clusterId: string;
  readonly instrumentIds: readonly string[];
  readonly averagePairwiseCorrelation: number | null;
  readonly provenanceKind: 'MODEL_ESTIMATED';
  readonly sourceRefs: readonly string[];
};

export type CorrelationMatrix = {
  readonly asOf: string;
  readonly pairs: readonly CorrelationPair[];
  readonly clusters: readonly CorrelationCluster[];
  readonly simulationOnly: true;
};
