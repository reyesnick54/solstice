/**
 * HELIOS Alternative Data Intelligence — ALT08 geospatial activity taxonomy.
 */

export const HELIOS_ALTERNATIVE_DATA_INTELLIGENCE_SCHEMA = 'helios.alternative-data-intelligence.v1' as const;
export const HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA =
  'sunrey.helios.alt08.geospatial-activity.v1' as const;

export const HELIOS_ALT08_AUTHORITY =
  'packages/platform/src/helios/alternative-data-intelligence/geospatial-activity' as const;

export const HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED =
  'HELIOS_ALT08_GEOSPATIAL_ACTIVITY_QUALIFIED' as const;
export const HELIOS_ALT08_GEOSPATIAL_ACTIVITY_BLOCKED =
  'HELIOS_ALT08_GEOSPATIAL_ACTIVITY_BLOCKED' as const;

export const ALT_WORK_PACKAGES = ['ALT08'] as const;
export type AltWorkPackageId = (typeof ALT_WORK_PACKAGES)[number];

/** Facility-scale assets only — no individual tracking. */
export const GEO_ASSET_TYPES = [
  'factory',
  'mine',
  'refinery',
  'port',
  'warehouse',
  'power_plant',
  'data_center',
  'farm_agriculture',
  'retail_complex',
] as const;
export type GeoAssetType = (typeof GEO_ASSET_TYPES)[number];

export const DERIVED_OBSERVATION_KINDS = [
  'nighttimeLight',
  'thermalActivity',
  'airPollution',
  'parkingVehicleCount',
  'surfaceChange',
  'constructionProgress',
  'landUse',
  'vegetation',
  'waterLevel',
  'fire',
  'flood',
  'weatherHazard',
] as const;
export type DerivedObservationKind = (typeof DERIVED_OBSERVATION_KINDS)[number];

export const PHYSICAL_ACTIVITY_BANDS = ['IDLE', 'LOW', 'MODERATE', 'ELEVATED', 'UNKNOWN'] as const;
export type PhysicalActivityBand = (typeof PHYSICAL_ACTIVITY_BANDS)[number];

export const DERIVED_METRIC_VERSION = 'helios.alt08.derived-metric.v1' as const;
export const FUSION_ALGORITHM_VERSION = 'helios.alt08.fusion.robust-median-v1' as const;
