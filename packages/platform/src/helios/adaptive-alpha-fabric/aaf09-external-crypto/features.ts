/**
 * AAF09 point-in-time features — descriptive market state only (not trading signals).
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { isFeatureVisibleAt } from '../../feature-fabric/knowable-at.ts';
import { computeFeatureObservation } from '../../feature-fabric/compute.ts';
import type { FeatureContributionInput, FeatureDefinition, FeatureObservation } from '../../feature-fabric/types.ts';
import { HELIOS_FEATURE_FABRIC_SCHEMA } from '../../feature-fabric/types.ts';
import type { QualityState, SourceIndependence } from '../../observation/types.ts';
import { AAF09_FEATURE_IDS } from './types.ts';
import type { NormalizedCryptoMarketObservation, SourceHealthState } from './types.ts';
import { classifyWitness } from './lineage.ts';

const TRANSFORMATION_ID = 'helios.aaf09.crypto.features';
const TRANSFORMATION_VERSION = 'v1';

function definition(featureId: string, displayName: string, valueKind: FeatureDefinition['valueKind']): FeatureDefinition {
  return Object.freeze({
    schemaVersion: HELIOS_FEATURE_FABRIC_SCHEMA,
    featureId,
    featureVersion: '1.0.0',
    displayName,
    description: displayName,
    valueKind,
    unit: valueKind === 'ratio' ? 'bps' : valueKind === 'text' ? null : 'minor_units',
    transformationId: TRANSFORMATION_ID,
    transformationVersion: TRANSFORMATION_VERSION,
    transformationParameters: Object.freeze({}),
    grantsExecutionAuthority: false,
  });
}

export const AAF09_FEATURE_DEFINITIONS: readonly FeatureDefinition[] = Object.freeze([
  definition(AAF09_FEATURE_IDS.RETURN_1, 'One-period return', 'ratio'),
  definition(AAF09_FEATURE_IDS.REALIZED_VOL, 'Realized volatility', 'decimal'),
  definition(AAF09_FEATURE_IDS.VOLUME, 'Volume', 'integer_minor'),
  definition(AAF09_FEATURE_IDS.SPREAD, 'Bid-ask spread', 'integer_minor'),
  definition(AAF09_FEATURE_IDS.PRICE_DISPERSION, 'Cross-source price dispersion', 'ratio'),
  definition(AAF09_FEATURE_IDS.VENUE_DISLOCATION, 'Venue vs reference dislocation', 'ratio'),
  definition(AAF09_FEATURE_IDS.SOURCE_QUALITY, 'Source quality state', 'text'),
]);

function midMinor(observation: NormalizedCryptoMarketObservation): bigint | null {
  if (observation.bidMinorUnits !== null && observation.askMinorUnits !== null) {
    return (observation.bidMinorUnits + observation.askMinorUnits) / 2n;
  }
  return observation.lastMinorUnits ?? observation.tradePriceMinorUnits;
}

function qualityFromHealth(health: SourceHealthState): QualityState {
  switch (health) {
    case 'HEALTHY':
      return 'VALID';
    case 'DEGRADED_STALE':
      return 'DEGRADED_STALE';
    case 'DEGRADED_SEQUENCE_GAP':
      return 'DEGRADED_SEQUENCE';
    case 'DEGRADED_CROSSED_MARKET':
    case 'DEGRADED_PROVIDER':
      return 'DEGRADED_MALFORMED';
    case 'OUTAGE':
      return 'UNAVAILABLE';
    default:
      return 'VALID';
  }
}

function contributionFromObservation(
  observation: NormalizedCryptoMarketObservation,
  numericValueMinor: bigint,
): FeatureContributionInput {
  const witness = classifyWitness(observation);
  const sourceIndependence: SourceIndependence = witness.countsAsIndependentWitness
    ? 'INDEPENDENT'
    : 'SHARED_UPSTREAM';
  return Object.freeze({
    observationId: observation.observationId,
    informationTime: Object.freeze({
      sourceEventTime: observation.providerEventTime,
      sourcePublishedTime: null,
      providerAvailabilityTime: null,
      sunreyArrivalTime: observation.sunreyArrivalTime,
      ingestionTime: observation.sunreyArrivalTime,
      knowableAt: observation.knowableAt,
    }),
    entitlement: Object.freeze({
      entitlementClass: 'provider_feed_real_time',
      commercialUseStatus: 'permitted',
      redistributionStatus: 'permitted',
      feedDelayClassification: 'real_time',
      unavailable: observation.sourceHealth === 'OUTAGE',
    }),
    qualityState: qualityFromHealth(observation.sourceHealth),
    sourceIndependence,
    evidenceRef: observation.rawPayloadHash,
    numericValueMinor,
  });
}

export type Aaf09FeatureSnapshot = {
  readonly evaluationTime: UtcInstant;
  readonly instrumentId: string;
  readonly features: readonly FeatureObservation[];
  readonly grantsExecutionAuthority: false;
};

export function computeAaf09Features(input: {
  readonly evaluationTime: UtcInstant;
  readonly instrumentId: string;
  readonly observations: readonly NormalizedCryptoMarketObservation[];
  readonly dispersionBps: number | null;
  readonly venueDislocationBps: number | null;
}): Aaf09FeatureSnapshot {
  const visible = input.observations.filter((row) =>
    isFeatureVisibleAt(input.evaluationTime, row.knowableAt),
  );
  const venue = visible.filter((row) => row.sourceClass === 'VENUE_MARKET_DATA');
  const reference = visible.filter((row) => row.sourceClass === 'REFERENCE_AGGREGATE');
  const latestVenue = venue[venue.length - 1] ?? null;
  const priorVenue = venue.length > 1 ? venue[venue.length - 2] : null;
  const latestReference = reference[reference.length - 1] ?? null;

  const features: FeatureObservation[] = [];
  const eventTime = latestVenue?.providerEventTime ?? latestReference?.providerEventTime ?? input.evaluationTime;
  const computedAt = input.evaluationTime;

  const pushFeature = (
    def: FeatureDefinition,
    contributions: FeatureContributionInput[],
    numericOverride?: bigint,
  ) => {
    if (contributions.length === 0) return;
    const result = computeFeatureObservation({
      definition: def,
      canonicalEntityId: input.instrumentId,
      canonicalInstrumentId: input.instrumentId,
      eventTime,
      computedAt,
      revisionId: `aaf09.${input.evaluationTime}`,
      validFrom: eventTime,
      contributions: contributions.map((row) =>
        numericOverride !== undefined ? { ...row, numericValueMinor: numericOverride } : row,
      ),
      evaluationTimeForVisibility: input.evaluationTime,
    });
    if (result.ok) features.push(result.observation);
  };

  if (latestVenue) {
    const mid = midMinor(latestVenue);
    if (mid !== null) {
      pushFeature(
        AAF09_FEATURE_DEFINITIONS[3],
        [contributionFromObservation(latestVenue, latestVenue.spreadMinorUnits ?? 0n)],
        latestVenue.spreadMinorUnits ?? 0n,
      );
      if (latestVenue.volumeMinorUnits !== null) {
        pushFeature(
          AAF09_FEATURE_DEFINITIONS[2],
          [contributionFromObservation(latestVenue, latestVenue.volumeMinorUnits)],
          latestVenue.volumeMinorUnits,
        );
      }
    }
    if (priorVenue && mid !== null) {
      const priorMid = midMinor(priorVenue);
      if (priorMid !== null && priorMid > 0n) {
        const delta = Number(mid - priorMid) / Number(priorMid);
        const bps = BigInt(Math.round(delta * 10_000));
        pushFeature(
          AAF09_FEATURE_DEFINITIONS[0],
          [contributionFromObservation(latestVenue, bps), contributionFromObservation(priorVenue, priorMid)],
          bps,
        );
        const retBps = Math.abs(delta * 10_000);
        const volMinor = BigInt(Math.round(Math.sqrt(retBps) * 100));
        pushFeature(
          AAF09_FEATURE_DEFINITIONS[1],
          [contributionFromObservation(latestVenue, volMinor)],
          volMinor,
        );
      }
    }
    const health = latestVenue.sourceHealth;
    pushFeature(
      AAF09_FEATURE_DEFINITIONS[6],
      [contributionFromObservation(latestVenue, 0n)],
      0n,
    );
    const qualityFeature = features[features.length - 1];
    if (qualityFeature) {
      features[features.length - 1] = Object.freeze({
        ...qualityFeature,
        value: Object.freeze({
          kind: 'text',
          unit: null,
          decimal: null,
          integerMinor: null,
          boolean: null,
          text: health,
        }),
      });
    }
  }

  if (input.dispersionBps !== null && latestVenue) {
    const bps = BigInt(input.dispersionBps);
    pushFeature(
      AAF09_FEATURE_DEFINITIONS[4],
      visible.map((row) => {
        const mid = midMinor(row);
        return contributionFromObservation(row, mid ?? 0n);
      }),
      bps,
    );
  }

  if (input.venueDislocationBps !== null && latestVenue && latestReference) {
    const bps = BigInt(input.venueDislocationBps);
    pushFeature(
      AAF09_FEATURE_DEFINITIONS[5],
      [
        contributionFromObservation(latestVenue, midMinor(latestVenue) ?? 0n),
        contributionFromObservation(latestReference, midMinor(latestReference) ?? 0n),
      ],
      bps,
    );
  }

  return Object.freeze({
    evaluationTime: input.evaluationTime,
    instrumentId: input.instrumentId,
    features: Object.freeze(features),
    grantsExecutionAuthority: false,
  });
}

export function venueDislocationBps(
  venue: NormalizedCryptoMarketObservation,
  reference: NormalizedCryptoMarketObservation,
): number | null {
  const venueMid = midMinor(venue);
  const refMid = midMinor(reference);
  if (venueMid === null || refMid === null || refMid === 0n) return null;
  const delta = Number(venueMid - refMid) / Number(refMid);
  return Math.round(delta * 10_000);
}
