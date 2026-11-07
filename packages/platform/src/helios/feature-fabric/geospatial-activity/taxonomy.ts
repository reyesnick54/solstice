/**
 * Feature Fabric extension for ALT08 geospatial derived metrics.
 */

export const HELIOS_GEOSPATIAL_FEATURE_PLANE_SCHEMA =
  'sunrey.helios.feature-fabric.geospatial-activity.v1' as const;

export const GEOSPATIAL_FEATURE_IDS = [
  'physical_activity_index',
  'physical_activity_uncertainty',
  'nighttime_light_calibrated_index',
  'thermal_activity_index',
  'surface_change_index',
] as const;
export type GeospatialFeatureId = (typeof GEOSPATIAL_FEATURE_IDS)[number];

export const GEOSPATIAL_FEATURE_FORMULA_VERSION = 'helios.alt08.feature.v1' as const;
