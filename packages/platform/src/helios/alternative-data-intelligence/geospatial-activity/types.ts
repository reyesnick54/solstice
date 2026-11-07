/**
 * ALT08 — geospatial and satellite physical-activity domain types.
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  DerivedObservationKind,
  GeoAssetType,
  HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA,
  PhysicalActivityBand,
} from '../taxonomy.ts';

export type GeoAsset = {
  readonly schema: typeof HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA;
  readonly geoAssetId: string;
  readonly canonicalEntityId: string | null;
  readonly canonicalProductiveAssetId: string | null;
  readonly assetType: GeoAssetType;
  readonly displayName: string;
  readonly centroidLat: string;
  readonly centroidLon: string;
  readonly footprintWkt: string | null;
  readonly grantsExecutionAuthority: false;
};

export type RemoteSensingQualityState = {
  readonly cloudCoverRatioBps: number | null;
  readonly sensor: string;
  readonly resolutionMeters: number | null;
  readonly observationAngleDeg: number | null;
  readonly captureTime: UtcInstant;
  readonly revisitIntervalHours: number | null;
  readonly processingVersion: string;
  readonly dataGap: boolean;
};

export type NighttimeLightCalibration = {
  readonly electricityAccessIndexBps: number | null;
  readonly lightingTechnology: string | null;
  readonly urbanizationIndexBps: number | null;
  readonly sensorGeneration: string | null;
};

export type SourceLineageRef = {
  readonly observationId: string;
  readonly derivedMetricVersion: string;
  readonly evidenceRef: string;
  readonly rawImageryRef: string | null;
  readonly knowableAt: UtcInstant;
};

export type VersionedDerivedMetric = {
  readonly metricId: string;
  readonly kind: DerivedObservationKind;
  readonly valueMinor: bigint;
  readonly unit: string;
  readonly processingVersion: string;
  readonly derivedMetricVersion: string;
  readonly quality: RemoteSensingQualityState;
  readonly calibration: NighttimeLightCalibration | null;
  readonly lineage: SourceLineageRef;
  readonly grantsExecutionAuthority: false;
};

export type GeoObservation = {
  readonly observationId: string;
  readonly geoAssetId: string;
  readonly derived: VersionedDerivedMetric;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type SatelliteObservation = GeoObservation & {
  readonly sensorClass: string;
  readonly orbitPassId: string | null;
};

export type PhysicalActivityState = {
  readonly stateId: string;
  readonly geoAssetId: string;
  readonly asOf: UtcInstant;
  readonly band: PhysicalActivityBand;
  readonly fusedActivityIndexBps: number;
  readonly contributingMetrics: readonly VersionedDerivedMetric[];
  readonly grantsExecutionAuthority: false;
};

export type SourceContribution = {
  readonly observationId: string;
  readonly kind: DerivedObservationKind;
  readonly weightBps: number;
  readonly activityIndexBps: number;
};

export type PhysicalActivityEstimate = {
  readonly estimateId: string;
  readonly geoAssetId: string;
  readonly evaluationTime: UtcInstant;
  readonly activityIndexBps: number;
  readonly uncertaintyBps: number;
  readonly sourceContributions: readonly SourceContribution[];
  readonly calibrationApplied: boolean;
  readonly luminosityIsNotProduction: true;
  readonly grantsExecutionAuthority: false;
};

export type GeospatialActivityManifest = {
  readonly schema: typeof HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA;
  readonly evaluationTime: UtcInstant;
  readonly compiledAt: UtcInstant;
  readonly assets: readonly GeoAsset[];
  readonly observations: readonly GeoObservation[];
  readonly estimates: readonly PhysicalActivityEstimate[];
  readonly grantsExecutionAuthority: false;
};

export type GeospatialActivityStoreSnapshot = {
  readonly assets: readonly GeoAsset[];
  readonly observations: readonly GeoObservation[];
  readonly estimates: readonly PhysicalActivityEstimate[];
};
