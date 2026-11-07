export {
  HELIOS_GEOSPATIAL_FEATURE_PLANE_SCHEMA,
  GEOSPATIAL_FEATURE_IDS,
  GEOSPATIAL_FEATURE_FORMULA_VERSION,
  type GeospatialFeatureId,
} from './taxonomy.ts';

export type { GeospatialFeatureValue, GeospatialFeaturePlaneSnapshot } from './types.ts';

export {
  geospatialEstimatesToContributions,
  compileGeospatialFeaturePlaneFromManifest,
  GEOSPATIAL_FEATURE_ID_LIST,
} from './bridge.ts';
