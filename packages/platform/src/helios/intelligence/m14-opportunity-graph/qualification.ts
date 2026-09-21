export const HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_QUALIFIED =
  'HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_QUALIFIED' as const;
export const HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_BLOCKED =
  'HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_BLOCKED' as const;

export type M14QualificationChecks = {
  readonly graphBuildDeterministic: boolean;
  readonly correlationWarningsEmitted: boolean;
  readonly portfolioExposureLinked: boolean;
  readonly versionTracked: boolean;
};

export type M14QualificationResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateM14Qualification(checks: M14QualificationChecks): M14QualificationResult {
  const blockers: string[] = [];
  for (const [key, passed] of Object.entries(checks) as [keyof M14QualificationChecks, boolean][]) {
    if (!passed) blockers.push(String(key));
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M14_CROSS_ASSET_OPPORTUNITY_GRAPH_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
