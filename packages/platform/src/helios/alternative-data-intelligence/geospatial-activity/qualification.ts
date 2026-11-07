import {
  HELIOS_ALT08_GEOSPATIAL_ACTIVITY_BLOCKED,
  HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED,
} from './taxonomy.ts';

export type Alt08QualificationChecks = {
  readonly coreTypesDefined: boolean;
  readonly assetTaxonomyComplete: boolean;
  readonly derivedObservationKindsComplete: boolean;
  readonly qualityStateTracked: boolean;
  readonly rawImageryNotOnFeaturePlane: boolean;
  readonly knowableAtEnforced: boolean;
  readonly multiSensorFusionPresent: boolean;
  readonly noIndividualBehaviorInference: boolean;
  readonly luminosityNotProductionProxy: boolean;
  readonly featureFabricBridgePresent: boolean;
  readonly noExecutionAuthorityOnArtifacts: boolean;
};

export type Alt08QualificationResult = {
  readonly marker:
    | typeof HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED
    | typeof HELIOS_ALT08_GEOSPATIAL_ACTIVITY_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateAlt08GeospatialActivityQualification(
  checks: Alt08QualificationChecks,
): Alt08QualificationResult {
  const blockers: string[] = [];
  if (!checks.coreTypesDefined) blockers.push('core_types');
  if (!checks.assetTaxonomyComplete) blockers.push('asset_taxonomy');
  if (!checks.derivedObservationKindsComplete) blockers.push('derived_observation_kinds');
  if (!checks.qualityStateTracked) blockers.push('quality_state');
  if (!checks.rawImageryNotOnFeaturePlane) blockers.push('raw_imagery_lineage');
  if (!checks.knowableAtEnforced) blockers.push('knowable_at');
  if (!checks.multiSensorFusionPresent) blockers.push('multi_sensor_fusion');
  if (!checks.noIndividualBehaviorInference) blockers.push('individual_behavior_guard');
  if (!checks.luminosityNotProductionProxy) blockers.push('luminosity_calibration');
  if (!checks.featureFabricBridgePresent) blockers.push('feature_fabric_bridge');
  if (!checks.noExecutionAuthorityOnArtifacts) blockers.push('execution_authority');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified
      ? HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED
      : HELIOS_ALT08_GEOSPATIAL_ACTIVITY_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}
