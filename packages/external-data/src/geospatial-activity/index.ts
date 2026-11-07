export {
  EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA,
  GEO_ASSET_TYPES,
  DERIVED_GEOSPATIAL_OBSERVATION_KINDS,
  REMOTE_SENSING_SENSOR_CLASSES,
  GEOSPATIAL_PROVIDER_KINDS,
  type GeoAssetType,
  type DerivedGeospatialObservationKind,
  type RemoteSensingSensorClass,
  type GeospatialProviderKind,
} from './taxonomy.ts';

export type {
  ExternalGeospatialProviderRef,
  RemoteSensingQualityEnvelope,
  NighttimeLightCalibrationEnvelope,
  GeospatialSourceEvidenceRef,
  ExternalGeoAssetRecord,
  ExternalGeoObservation,
  ExternalSatelliteObservation,
  IngestGeoObservationInput,
  IngestGeoObservationResult,
} from './types.ts';

export { ingestGeoObservation, resetGeoIngestDedupeForTests } from './ingest.ts';

export { DEMO_FACTORY_ASSET, DEMO_MINE_ASSET, DEMO_PORT_ASSET } from './fixtures/demo-assets.ts';
export {
  DEMO_FACTORY_NTL,
  DEMO_FACTORY_THERMAL,
  DEMO_MINE_SURFACE,
  DEMO_FUTURE_LEAKING_OBS,
} from './fixtures/demo-observations.ts';
