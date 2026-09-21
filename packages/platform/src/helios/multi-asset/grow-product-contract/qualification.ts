export const HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED =
  'HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED' as const;

export const HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_BLOCKED =
  'HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_BLOCKED' as const;

export type MultiAssetM26GrowProductContractChecks = {
  readonly summaryEndpoint: boolean;
  readonly positionsEndpoint: boolean;
  readonly normalizedActivityEvents: boolean;
  readonly strategySummary: boolean;
  readonly performancePeriods: boolean;
  readonly controlsWired: boolean;
  readonly depositsNotGrowth: boolean;
  readonly unrealizedNotWithdrawable: boolean;
  readonly paperLabelingTruthful: boolean;
  readonly customerIsolation: boolean;
  readonly noFrontendFinancialTruth: boolean;
  readonly noSecretLeakage: boolean;
  readonly malformedRequestsRejected: boolean;
  readonly staleCacheNoStore: boolean;
  readonly restartPreservesState: boolean;
  readonly openapiDocumented: boolean;
  readonly productionSafetyChecksPass: boolean;
};

export type MultiAssetM26GrowProductContractResult = {
  readonly marker:
    | typeof HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED
    | typeof HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMultiAssetM26GrowProductContractQualification(
  checks: MultiAssetM26GrowProductContractChecks,
): MultiAssetM26GrowProductContractResult {
  const blockers: string[] = [];
  const entries: Array<[keyof MultiAssetM26GrowProductContractChecks, string]> = [
    ['summaryEndpoint', 'Grow summary endpoint missing or incomplete'],
    ['positionsEndpoint', 'Grow positions endpoint missing or incomplete'],
    ['normalizedActivityEvents', 'normalized Grow activity events missing'],
    ['strategySummary', 'Grow strategy summary missing'],
    ['performancePeriods', 'Grow performance period slices missing'],
    ['controlsWired', 'Grow controls not wired through governed requests'],
    ['depositsNotGrowth', 'deposits incorrectly counted as growth'],
    ['unrealizedNotWithdrawable', 'unrealized P&L treated as withdrawable cash'],
    ['paperLabelingTruthful', 'operating mode labeling not truthful'],
    ['customerIsolation', 'customer isolation failure on Grow product contract'],
    ['noFrontendFinancialTruth', 'frontend-derived financial truth allowed'],
    ['noSecretLeakage', 'provider secrets or chain-of-thought leaked'],
    ['malformedRequestsRejected', 'malformed requests not rejected'],
    ['staleCacheNoStore', 'financial responses cached publicly or without no-store'],
    ['restartPreservesState', 'restart loses Grow product contract state'],
    ['openapiDocumented', 'OpenAPI missing M26 Grow product contract resources'],
    ['productionSafetyChecksPass', 'production safety checks failed'],
  ];
  for (const [key, message] of entries) {
    if (!checks[key]) {
      blockers.push(message);
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      marker: HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_BLOCKED,
      qualified: false,
      blockers: Object.freeze(blockers),
    });
  }
  return Object.freeze({
    marker: HELIOS_MULTI_ASSET_M26_GROW_PRODUCT_CONTRACT_QUALIFIED,
    qualified: true,
    blockers: Object.freeze([]),
  });
}
