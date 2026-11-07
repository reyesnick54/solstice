/**
 * Map @solstice/external-data geospatial envelopes into ALT08 domain observations.
 */

import type { ExternalGeoAssetRecord, ExternalGeoObservation } from '@solstice/external-data';

import {
  DERIVED_METRIC_VERSION,
  HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA,
} from './taxonomy.ts';
import type { GeoAsset, GeoObservation, VersionedDerivedMetric } from './types.ts';

function mapDerived(external: ExternalGeoObservation): VersionedDerivedMetric {
  return Object.freeze({
    metricId: `${external.geoAssetId}:${external.kind}:${external.derivedMetricVersion}`,
    kind: external.kind,
    valueMinor: external.metricValueMinor,
    unit: external.metricUnit,
    processingVersion: external.processingVersion,
    derivedMetricVersion: external.derivedMetricVersion,
    quality: Object.freeze({
      cloudCoverRatioBps: external.quality.cloudCoverRatioBps,
      sensor: external.quality.sensor,
      resolutionMeters: external.quality.resolutionMeters,
      observationAngleDeg: external.quality.observationAngleDeg,
      captureTime: external.quality.captureTime,
      revisitIntervalHours: external.quality.revisitIntervalHours,
      processingVersion: external.quality.processingVersion,
      dataGap: external.quality.dataGap,
    }),
    calibration: external.calibration
      ? Object.freeze({
          electricityAccessIndexBps: external.calibration.electricityAccessIndexBps,
          lightingTechnology: external.calibration.lightingTechnology,
          urbanizationIndexBps: external.calibration.urbanizationIndexBps,
          sensorGeneration: external.calibration.sensorGeneration,
        })
      : null,
    lineage: Object.freeze({
      observationId: external.observationId,
      derivedMetricVersion: external.derivedMetricVersion,
      evidenceRef: external.provenance.evidence.evidenceRef,
      rawImageryRef: external.provenance.evidence.rawImageryRef,
      knowableAt: external.knowableAt,
    }),
    grantsExecutionAuthority: false,
  });
}

export function mapExternalGeoAsset(record: ExternalGeoAssetRecord): GeoAsset {
  return Object.freeze({
    schema: HELIOS_ALT08_GEOSPATIAL_ACTIVITY_SCHEMA,
    geoAssetId: record.geoAssetId,
    canonicalEntityId: record.canonicalEntityId,
    canonicalProductiveAssetId: record.canonicalProductiveAssetId,
    assetType: record.assetType,
    displayName: record.displayName,
    centroidLat: record.centroidLat,
    centroidLon: record.centroidLon,
    footprintWkt: record.footprintWkt,
    grantsExecutionAuthority: false,
  });
}

export function mapExternalGeoObservation(external: ExternalGeoObservation): GeoObservation {
  return Object.freeze({
    observationId: external.observationId,
    geoAssetId: external.geoAssetId,
    derived: mapDerived(external),
    providerAvailabilityTime: external.providerAvailabilityTime,
    sunreyArrivalTime: external.sunreyArrivalTime,
    knowableAt: external.knowableAt,
    grantsExecutionAuthority: false,
  });
}

export const ALT08_DERIVED_METRIC_VERSION = DERIVED_METRIC_VERSION;
