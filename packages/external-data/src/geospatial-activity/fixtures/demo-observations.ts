import { asUtcInstant } from '@solstice/domain';

import type { ExternalGeoObservation } from '../types.ts';
import { EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA } from '../taxonomy.ts';
import { DEMO_FACTORY_ASSET, DEMO_MINE_ASSET } from './demo-assets.ts';

const T1 = asUtcInstant('2025-06-01T08:00:00.000Z');
const T2 = asUtcInstant('2025-06-01T08:15:00.000Z');

function baseObservation(
  partial: Omit<ExternalGeoObservation, 'schema' | 'grantsExecutionAuthority'>,
): ExternalGeoObservation {
  return Object.freeze({
    schema: EXTERNAL_GEOSPATIAL_ACTIVITY_SCHEMA,
    ...partial,
    grantsExecutionAuthority: false,
  });
}

/** Nighttime luminance index — not a production proxy (calibration required downstream). */
export const DEMO_FACTORY_NTL: ExternalGeoObservation = baseObservation({
  observationId: 'geo-obs:factory-ntl-viirs-20250601',
  geoAssetId: DEMO_FACTORY_ASSET.geoAssetId,
  kind: 'nighttimeLight',
  metricValueMinor: 42_500n,
  metricUnit: 'ntl_index_micro',
  quality: Object.freeze({
    cloudCoverRatioBps: 1200,
    sensor: 'nighttime_light',
    resolutionMeters: 750,
    observationAngleDeg: null,
    captureTime: T1,
    revisitIntervalHours: 24,
    processingVersion: 'viirs-vcmcfg-2024.1',
    dataGap: false,
  }),
  calibration: Object.freeze({
    electricityAccessIndexBps: 9_800,
    lightingTechnology: 'led_mixed',
    urbanizationIndexBps: 8_500,
    sensorGeneration: 'VIIRS-DNB',
  }),
  source: Object.freeze({ providerId: 'noaa-eog', feedId: 'ntl-monthly', capability: 'geospatial.alt08' }),
  provenance: Object.freeze({
    providerKind: 'open_eo',
    sourceId: 'noaa-viirs-ntl',
    evidence: Object.freeze({
      evidenceRef: 'evidence:raw:ntl-raster:factory-202506',
      rawImageryRef: 'blob:simulation:ntl-tile-42n-83w',
      payloadHash: 'sha256:ntl-factory-demo',
    }),
    dedupeKey: 'ntl:factory:20250601',
  }),
  processingVersion: 'viirs-vcmcfg-2024.1',
  derivedMetricVersion: 'ntl.index.v2',
  providerAvailabilityTime: T1,
  sunreyArrivalTime: T2,
  knowableAt: T2,
});

export const DEMO_FACTORY_THERMAL: ExternalGeoObservation = baseObservation({
  observationId: 'geo-obs:factory-thermal-landsat-20250601',
  geoAssetId: DEMO_FACTORY_ASSET.geoAssetId,
  kind: 'thermalActivity',
  metricValueMinor: 6_200n,
  metricUnit: 'thermal_anomaly_index_bps',
  quality: Object.freeze({
    cloudCoverRatioBps: 800,
    sensor: 'thermal',
    resolutionMeters: 100,
    observationAngleDeg: 5.2,
    captureTime: T1,
    revisitIntervalHours: 192,
    processingVersion: 'landsat-l2-2024.3',
    dataGap: false,
  }),
  calibration: null,
  source: Object.freeze({ providerId: 'usgs-eros', feedId: 'landsat-l2', capability: 'geospatial.alt08' }),
  provenance: Object.freeze({
    providerKind: 'government',
    sourceId: 'landsat-8-tirs',
    evidence: Object.freeze({
      evidenceRef: 'evidence:raw:thermal-raster:factory-202506',
      rawImageryRef: 'blob:simulation:thermal-tile-dearborn',
      payloadHash: 'sha256:thermal-factory-demo',
    }),
    dedupeKey: 'thermal:factory:20250601',
  }),
  processingVersion: 'landsat-l2-2024.3',
  derivedMetricVersion: 'thermal.anomaly.v1',
  providerAvailabilityTime: T1,
  sunreyArrivalTime: T2,
  knowableAt: T2,
});

export const DEMO_MINE_SURFACE: ExternalGeoObservation = baseObservation({
  observationId: 'geo-obs:mine-sar-surface-20250601',
  geoAssetId: DEMO_MINE_ASSET.geoAssetId,
  kind: 'surfaceChange',
  metricValueMinor: 3_100n,
  metricUnit: 'surface_delta_index_bps',
  quality: Object.freeze({
    cloudCoverRatioBps: null,
    sensor: 'sar',
    resolutionMeters: 10,
    observationAngleDeg: 35,
    captureTime: T1,
    revisitIntervalHours: 12,
    processingVersion: 'sentinel-1-rtc-2024.2',
    dataGap: false,
  }),
  calibration: null,
  source: Object.freeze({ providerId: 'esa-copernicus', feedId: 'sentinel-1', capability: 'geospatial.alt08' }),
  provenance: Object.freeze({
    providerKind: 'open_eo',
    sourceId: 'sentinel-1-iw',
    evidence: Object.freeze({
      evidenceRef: 'evidence:raw:sar-raster:mine-202506',
      rawImageryRef: 'blob:simulation:sar-tile-chuqui',
      payloadHash: 'sha256:sar-mine-demo',
    }),
    dedupeKey: 'sar:surface:mine:20250601',
  }),
  processingVersion: 'sentinel-1-rtc-2024.2',
  derivedMetricVersion: 'surface.change.v1',
  providerAvailabilityTime: T1,
  sunreyArrivalTime: T2,
  knowableAt: T2,
});

/** Future-dated knowableAt used for leakage tests. */
export const DEMO_FUTURE_LEAKING_OBS: ExternalGeoObservation = baseObservation({
  ...DEMO_FACTORY_NTL,
  observationId: 'geo-obs:factory-ntl-future-leak',
  provenance: Object.freeze({
    ...DEMO_FACTORY_NTL.provenance,
    dedupeKey: 'ntl:factory:future-leak',
  }),
  knowableAt: asUtcInstant('2030-01-01T00:00:00.000Z'),
});
