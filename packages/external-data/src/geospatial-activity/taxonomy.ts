/**
 * HELIOS ALT08 — external geospatial / satellite observation taxonomy.
 */

export const EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA = 'sunrey.external.geospatial-activity.v1' as const;

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

export const DERIVED_GEOSPATIAL_OBSERVATION_KINDS = [
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
export type DerivedGeospatialObservationKind = (typeof DERIVED_GEOSPATIAL_OBSERVATION_KINDS)[number];

export const REMOTE_SENSING_SENSOR_CLASSES = [
  'optical',
  'multispectral',
  'sar',
  'thermal',
  'nighttime_light',
  'air_quality',
  'weather',
  'licensed_vehicle',
] as const;
export type RemoteSensingSensorClass = (typeof REMOTE_SENSING_SENSOR_CLASSES)[number];

export const GEOSPATIAL_PROVIDER_KINDS = ['open_eo', 'licensed_commercial', 'government', 'sandbox_fixture'] as const;
export type GeospatialProviderKind = (typeof GEOSPATIAL_PROVIDER_KINDS)[number];
