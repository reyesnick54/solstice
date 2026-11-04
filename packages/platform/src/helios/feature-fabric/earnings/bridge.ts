/**
 * Bridge EARN01 domain observations into Feature Fabric contribution inputs.
 */

import type { UtcInstant } from '../../../../../domain/src/time.ts';
import type { FeatureContributionInput } from '../types.ts';
import { isFeatureVisibleAt } from '../knowable-at.ts';
import type {
  EarningsActualObservation,
  EarningsConsensusSnapshot,
  EarningsIntelligenceManifest,
} from '../../earnings-intelligence/types.ts';
import { filterKnowableEarningsArtifacts } from '../../earnings-intelligence/knowable-at.ts';
import type { EarningsFeaturePlaneSnapshot, EarningsFeatureValue } from './types.ts';
import {
  EARNINGS_FEATURE_FORMULA_VERSION,
  EARNINGS_FEATURE_IDS,
  HELIOS_EARNINGS_FEATURE_PLANE_SCHEMA,
} from './taxonomy.ts';

function metricMinor(
  metrics: readonly { readonly metricId: string; readonly valueMinor: bigint | null }[],
  metricId: string,
): bigint | null {
  return metrics.find((row) => row.metricId === metricId)?.valueMinor ?? null;
}

function surpriseBps(consensus: bigint | null, actual: bigint | null): bigint | null {
  if (consensus === null || actual === null || consensus === 0n) {
    return null;
  }
  return ((actual - consensus) * 10_000n) / consensus;
}

export function earningsObservationsToContributions(input: {
  readonly evaluationTime: UtcInstant;
  readonly consensus: EarningsConsensusSnapshot | null;
  readonly actual: EarningsActualObservation | null;
}): readonly FeatureContributionInput[] {
  const rows: FeatureContributionInput[] = [];
  const push = (observationId: string, knowableAt: UtcInstant, valueMinor: bigint | null) => {
    if (!isFeatureVisibleAt(input.evaluationTime, knowableAt)) {
      return;
    }
    rows.push(
      Object.freeze({
        observationId,
        informationTime: Object.freeze({
          sourceEventTime: null,
          sourcePublishedTime: null,
          providerAvailabilityTime: knowableAt,
          sunreyArrivalTime: knowableAt,
          ingestionTime: knowableAt,
          knowableAt,
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
        ...(valueMinor !== null ? { numericValueMinor: valueMinor } : {}),
      }),
    );
  };

  if (input.consensus) {
    push(
      input.consensus.snapshotId,
      input.consensus.knowableAt,
      metricMinor(input.consensus.metrics, 'eps'),
    );
  }
  if (input.actual) {
    push(input.actual.observationId, input.actual.knowableAt, metricMinor(input.actual.metrics, 'eps'));
  }
  return Object.freeze(rows);
}

export function compileEarningsFeaturePlaneFromManifest(input: {
  readonly manifest: EarningsIntelligenceManifest;
}): EarningsFeaturePlaneSnapshot | null {
  const evaluationTime = input.manifest.evaluationTime;
  const events = filterKnowableEarningsArtifacts(evaluationTime, input.manifest.events);
  if (events.length === 0) {
    return null;
  }
  const event = events[0]!;
  const observations = filterKnowableEarningsArtifacts(evaluationTime, input.manifest.observations);
  const consensus = observations.find((row) => row.observationKind === 'consensus') ?? null;
  const actual = observations.find((row) => row.observationKind === 'actual') ?? null;

  const consensusEps = consensus ? metricMinor(consensus.metrics, 'eps') : null;
  const actualEps = actual ? metricMinor(actual.metrics, 'eps') : null;
  const surprise = surpriseBps(consensusEps, actualEps);

  const mkFeature = (
    featureId: (typeof EARNINGS_FEATURE_IDS)[number],
    valueMinor: bigint | null,
    valueText: string | null,
    knowableAt: UtcInstant,
    observationRefs: readonly string[],
  ): EarningsFeatureValue =>
    Object.freeze({
      featureId,
      formulaVersion: EARNINGS_FEATURE_FORMULA_VERSION,
      valueMinor,
      valueText,
      knowableAt,
      quality: valueMinor === null && valueText === null ? 'UNAVAILABLE' : 'VALID',
      observationRefs,
      grantsExecutionAuthority: false,
    });

  const features: EarningsFeatureValue[] = [];
  if (consensus) {
    features.push(
      mkFeature('earn01.consensus_eps', consensusEps, null, consensus.knowableAt, [consensus.snapshotId]),
    );
  }
  if (actual) {
    features.push(
      mkFeature('earn01.actual_eps', actualEps, null, actual.knowableAt, [actual.observationId]),
    );
  }
  if (consensus && actual && surprise !== null) {
    const knowableAt =
      Date.parse(consensus.knowableAt) >= Date.parse(actual.knowableAt)
        ? consensus.knowableAt
        : actual.knowableAt;
    features.push(
      mkFeature('earn01.eps_surprise_bps', surprise, null, knowableAt, [
        consensus.snapshotId,
        actual.observationId,
      ]),
    );
  }
  features.push(
    mkFeature('earn01.announcement_state', null, event.announcementState, event.knowableAt, [
      event.eventId,
    ]),
  );
  features.push(
    mkFeature('earn01.session_classification', null, event.sessionClassification, event.knowableAt, [
      event.eventId,
    ]),
  );

  return Object.freeze({
    schema: HELIOS_EARNINGS_FEATURE_PLANE_SCHEMA,
    canonicalEntityId: event.canonicalEntityId,
    canonicalInstrumentId: event.canonicalInstrumentId,
    evaluationTimeUtc: evaluationTime,
    features: Object.freeze(features),
    grantsExecutionAuthority: false,
  });
}
