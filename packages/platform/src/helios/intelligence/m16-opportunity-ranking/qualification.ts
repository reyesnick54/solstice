export const HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED =
  'HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_BLOCKED =
  'HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_BLOCKED' as const;

export type M16QualificationChecks = {
  readonly deterministicRanking: boolean;
  readonly versionedPolicy: boolean;
  readonly explainableScorecard: boolean;
  readonly reproducibleFingerprint: boolean;
  readonly auditableEvidence: boolean;
  readonly noInventedExpectedReturn: boolean;
  readonly noLlmFinalRank: boolean;
  readonly rankNotTradePermission: boolean;
  readonly metaAllocatorGating: boolean;
  readonly crossStrategyComparison: boolean;
  readonly expirationHandling: boolean;
  readonly restartPersistence: boolean;
  readonly evidenceLineage: boolean;
};

export type M16QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateM16Qualification(checks: M16QualificationChecks): M16QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof M16QualificationChecks, boolean][]) {
    if (!passed) blockers.push(String(key));
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M16_OPPORTUNITY_RANKING_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
