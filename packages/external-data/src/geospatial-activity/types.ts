/**
 * External geospatial activity observation envelopes (provider-neutral, simulation-first).
 */

import type { UtcInstant } from '@solstice/domain';
import type {
  DerivedGeospatialObservationKind,
  GeoAssetType,
  GeospatialProviderKind,
  RemoteSensingSensorClass,
} from './taxonomy.ts';
import { EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA } from './taxonomy.ts';

export type ExternalGeospatialProviderRef = {
  readonly providerId: string;
  readonly feedId: string;
  readonly capability: string;
};

export type RemoteSensingQualityEnvelope = {
  readonly cloudCoverRatioBps: number | null;
  readonly sensor: RemoteSensingSensorClass;
  readonly resolutionMeters: number | null;
  readonly observationAngleDeg: number | null;
  readonly captureTime: UtcInstant;
  readonly revisitIntervalHours: number | null;
  readonly processingVersion: string;
  readonly dataGap: boolean;
};

export type NighttimeLightCalibrationEnvelope = {
  readonly electricityAccessIndexBps: number | null;
  readonly lightingTechnology: string | null;
  readonly urbanizationIndexBps: number | null;
  readonly sensorGeneration: string | null;
};

/** Raw imagery and source raster metadata stay off the feature plane — referenced by evidence only. */
export type GeospatialSourceEvidenceRef = {
  readonly evidenceRef: string;
  readonly rawImageryRef: string | null;
  readonly payloadHash: string;
};

export type ExternalGeoAssetRecord = {
  readonly schema: typeof EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA;
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

export type ExternalGeoObservation = {
  readonly schema: typeof EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA;
  readonly observationId: string;
  readonly geoAssetId: string;
  readonly kind: DerivedGeospatialObservationKind;
  readonly metricValueMinor: bigint;
  readonly metricUnit: string;
  readonly quality: RemoteSensingQualityEnvelope;
  readonly calibration: NighttimeLightCalibrationEnvelope | null;
  readonly source: ExternalGeospatialProviderRef;
  readonly provenance: {
    readonly providerKind: GeospatialProviderKind;
    readonly sourceId: string;
    readonly evidence: GeospatialSourceEvidenceRef;
    readonly dedupeKey: string;
  };
  readonly processingVersion: string;
  readonly derivedMetricVersion: string;
  readonly providerAvailabilityTime: UtcInstant;
  readonly sunreyArrivalTime: UtcInstant;
  readonly knowableAt: UtcInstant;
  readonly grantsExecutionAuthority: false;
};

export type ExternalSatelliteObservation = ExternalGeoObservation & {
  readonly sensor: RemoteSensingSensorClass;
  readonly orbitPassId: string | null;
};

export type IngestGeoObservationInput = Omit<ExternalGeoObservation, 'schema' | 'grantsExecutionAuthority'>;

export type IngestGeoObservationResult =
  | { readonly ok: true; readonly observation: ExternalGeoObservation; readonly deduplicated: boolean }
  | { readonly ok: false; readonly reason: string };
