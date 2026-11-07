import type { UtcInstant } from '@solstice/domain';

import type { GeospatialFeatureId } from './taxonomy.ts';
import { HELIOS_GEOSPATIAL_FEATURE_PLANE_SCHEMA } from './taxonomy.ts';

export type GeospatialFeatureValue = {
  readonly featureId: GeospatialFeatureId;
  readonly geoAssetId: string;
  readonly valueMinor: bigint | null;
  readonly knowableAt: UtcInstant;
  readonly derivedMetricVersion: string;
  readonly lineageObservationIds: readonly string[];
  readonly rawImageryExcluded: true;
};

export type GeospatialFeaturePlaneSnapshot = {
  readonly schema: typeof HELIOS_GEOSPATIAL_FEATURE_PLANE_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly features: readonly GeospatialFeatureValue[];
};
