/**
 * Bridge ALT08 versioned derived metrics into Feature Fabric contribution inputs.
 */

import type { UtcInstant } from '@solstice/domain';
import type { FeatureContributionInput } from '../types.ts';
import { isFeatureVisibleAt } from '../knowable-at.ts';
import type { GeospatialActivityManifest, PhysicalActivityEstimate } from '../../alternative-data-intelligence/geospatial-activity/types.ts';
import { filterKnowableManifest } from '../../alternative-data-intelligence/geospatial-activity/knowable-at.ts';
import { calibratedNighttimeActivityIndexBps } from '../../alternative-data-intelligence/geospatial-activity/calibration.ts';
import type { GeospatialFeaturePlaneSnapshot, GeospatialFeatureValue } from './types.ts';
import {
  GEOSPATIAL_FEATURE_FORMULA_VERSION,
  GEOSPATIAL_FEATURE_IDS,
  HELIOS_GEOSPATIAL_FEATURE_PLANE_SCHEMA,
} from './taxonomy.ts';

function pushContribution(
  rows: FeatureContributionInput[],
  input: {
    readonly evaluationTime: UtcInstant;
    readonly observationId: string;
    readonly knowableAt: UtcInstant;
    readonly valueMinor: bigint | null;
  },
): void {
  if (!isFeatureVisibleAt(input.evaluationTime, input.knowableAt)) {
    return;
  }
  if (input.valueMinor === null) {
    return;
  }
  rows.push(
    Object.freeze({
      observationId: input.observationId,
      informationTime: Object.freeze({
        sourceEventTime: null,
        sourcePublishedTime: null,
        providerAvailabilityTime: input.knowableAt,
        sunreyArrivalTime: input.knowableAt,
        ingestionTime: input.knowableAt,
        knowableAt: input.knowableAt,
      }),
      entitlement: Object.freeze({
        entitlementClass: 'sandbox_test',
        commercialUseStatus: 'permitted',
        redistributionStatus: 'restricted',
        feedDelayClassification: 'unknown',
        unavailable: false,
      }),
      qualityState: 'VALID',
      sourceIndependence: 'INDEPENDENT',
      evidenceRef: null,
      numericValueMinor: input.valueMinor,
    }),
  );
}

export function geospatialEstimatesToContributions(input: {
  readonly evaluationTime: UtcInstant;
  readonly estimates: readonly PhysicalActivityEstimate[];
}): readonly FeatureContributionInput[] {
  const rows: FeatureContributionInput[] = [];
  for (const estimate of input.estimates) {
    pushContribution(rows, {
      evaluationTime: input.evaluationTime,
      observationId: estimate.estimateId,
      knowableAt: estimate.evaluationTime,
      valueMinor: BigInt(estimate.activityIndexBps),
    });
    pushContribution(rows, {
      evaluationTime: input.evaluationTime,
      observationId: `${estimate.estimateId}:uncertainty`,
      knowableAt: estimate.evaluationTime,
      valueMinor: BigInt(estimate.uncertaintyBps),
    });
  }
  return Object.freeze(rows);
}

export function compileGeospatialFeaturePlaneFromManifest(input: {
  readonly manifest: GeospatialActivityManifest;
}): GeospatialFeaturePlaneSnapshot | null {
  const evaluationTime = input.manifest.evaluationTime;
  const manifest = filterKnowableManifest(evaluationTime, input.manifest);
  if (manifest.assets.length === 0) {
    return null;
  }

  const features: GeospatialFeatureValue[] = [];
  for (const estimate of manifest.estimates) {
    const lineageObservationIds = estimate.sourceContributions.map((row) => row.observationId);
    features.push(
      Object.freeze({
        featureId: 'physical_activity_index',
        geoAssetId: estimate.geoAssetId,
        valueMinor: BigInt(estimate.activityIndexBps),
        knowableAt: estimate.evaluationTime,
        derivedMetricVersion: GEOSPATIAL_FEATURE_FORMULA_VERSION,
        lineageObservationIds,
        rawImageryExcluded: true,
      }),
    );
    features.push(
      Object.freeze({
        featureId: 'physical_activity_uncertainty',
        geoAssetId: estimate.geoAssetId,
        valueMinor: BigInt(estimate.uncertaintyBps),
        knowableAt: estimate.evaluationTime,
        derivedMetricVersion: GEOSPATIAL_FEATURE_FORMULA_VERSION,
        lineageObservationIds,
        rawImageryExcluded: true,
      }),
    );
  }

  for (const obs of manifest.observations) {
    if (obs.derived.kind === 'nighttimeLight') {
      const calibrated = calibratedNighttimeActivityIndexBps({
        rawIndexMinor: obs.derived.valueMinor,
        calibration: obs.derived.calibration,
      });
      features.push(
        Object.freeze({
          featureId: 'nighttime_light_calibrated_index',
          geoAssetId: obs.geoAssetId,
          valueMinor: BigInt(calibrated.indexBps),
          knowableAt: obs.knowableAt,
          derivedMetricVersion: obs.derived.derivedMetricVersion,
          lineageObservationIds: Object.freeze([obs.observationId]),
          rawImageryExcluded: true,
        }),
      );
    }
    if (obs.derived.kind === 'thermalActivity') {
      features.push(
        Object.freeze({
          featureId: 'thermal_activity_index',
          geoAssetId: obs.geoAssetId,
          valueMinor: obs.derived.valueMinor,
          knowableAt: obs.knowableAt,
          derivedMetricVersion: obs.derived.derivedMetricVersion,
          lineageObservationIds: Object.freeze([obs.observationId]),
          rawImageryExcluded: true,
        }),
      );
    }
    if (obs.derived.kind === 'surfaceChange') {
      features.push(
        Object.freeze({
          featureId: 'surface_change_index',
          geoAssetId: obs.geoAssetId,
          valueMinor: obs.derived.valueMinor,
          knowableAt: obs.knowableAt,
          derivedMetricVersion: obs.derived.derivedMetricVersion,
          lineageObservationIds: Object.freeze([obs.observationId]),
          rawImageryExcluded: true,
        }),
      );
    }
  }

  return Object.freeze({
    schema: HELIOS_GEOSPATIAL_FEATURE_PLANE_SCHEMA,
    evaluationTime,
    features: Object.freeze(features),
  });
}

export const GEOSPATIAL_FEATURE_ID_LIST = GEOSPATIAL_FEATURE_IDS;
