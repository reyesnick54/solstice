/**
 * AAFV2.1 universal feature fabric qualification gate.
 */

export const HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED =
  'HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED' as const;

export const HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_BLOCKED =
  'HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_BLOCKED' as const;

export type Aafv2UniversalQualificationChecks = {
  readonly futureDataBlockedAtDecisionTime: boolean;
  readonly derivedCannotPredateInputs: boolean;
  readonly revisionPreservesPriorFeatureVersions: boolean;
  readonly staleInputsDegradeQuality: boolean;
  readonly restrictedEntitlementPropagates: boolean;
  readonly deterministicFeatureManifestHash: boolean;
  readonly fundamentalBridgeCompatible: boolean;
  readonly technicalAdapterCompatible: boolean;
  readonly predictionMarketAdapterCompatible: boolean;
  readonly crossAssetRetainsLineage: boolean;
  readonly restartPreservesFeatureHistory: boolean;
};

export type Aafv2UniversalQualificationResult = {
  readonly marker:
    | typeof HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED
    | typeof HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

const CHECK_LABELS: Record<keyof Aafv2UniversalQualificationChecks, string> = {
  futureDataBlockedAtDecisionTime: 'future_data_blocked_at_decision_time',
  derivedCannotPredateInputs: 'derived_cannot_predate_inputs',
  revisionPreservesPriorFeatureVersions: 'revision_preserves_prior_feature_versions',
  staleInputsDegradeQuality: 'stale_inputs_degrade_quality',
  restrictedEntitlementPropagates: 'restricted_entitlement_propagates',
  deterministicFeatureManifestHash: 'deterministic_feature_manifest_hash',
  fundamentalBridgeCompatible: 'fundamental_bridge_compatible',
  technicalAdapterCompatible: 'technical_adapter_compatible',
  predictionMarketAdapterCompatible: 'prediction_market_adapter_compatible',
  crossAssetRetainsLineage: 'cross_asset_retains_lineage',
  restartPreservesFeatureHistory: 'restart_preserves_feature_history',
};

export function evaluateAafv2UniversalFeatureFabricQualification(
  checks: Aafv2UniversalQualificationChecks,
): Aafv2UniversalQualificationResult {
  const blockers: string[] = [];
  for (const [key, pass] of Object.entries(checks) as [keyof Aafv2UniversalQualificationChecks, boolean][]) {
    if (!pass) {
      blockers.push(CHECK_LABELS[key]);
    }
  }

  if (blockers.length === 0) {
    return Object.freeze({
      marker: HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_QUALIFIED,
      qualified: true,
      blockers: Object.freeze([]),
    });
  }

  return Object.freeze({
    marker: HELIOS_AAFV2_01_UNIVERSAL_FEATURE_FABRIC_BLOCKED,
    qualified: false,
    blockers: Object.freeze(blockers),
  });
}
