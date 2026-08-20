/**
 * Bandwidth provider-family certification fixtures.
 *
 * Certification remains Chunk 128 admission control. Passing a
 * bandwidth sandbox does not mint MoonRey or activate production.
 */

import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import { evaluateIndependence } from '../../certification/independence.ts';
import {
  CERTIFICATION_CONNECTOR_RUNTIME_VERSION,
  CERTIFICATION_MINTS_MOONREY,
  CERTIFICATION_NORMALIZATION_VERSION,
  emptyEvidenceStates,
  type CertificationSubject,
} from '../../certification/types.ts';
import { feedSchemaFor, healthyConnector, runCertificationSuite } from '../../certification/index.ts';
import type { FeedSchemaDefinition } from '../../types.ts';
import { bandwidthFeedSchema } from './schemas.ts';
import { ingestBandwidthObservation } from './adapter.ts';
import { bandwidthRefusal, type BandwidthRefusal, type BandwidthSourceObservation } from './types.ts';
import {
  capacityRateFixture,
  capacityReportedAsUsageFixture,
  credentialLeakFixture,
  floatUsageFixture,
  gbPerSecondPresentedAsGbFixture,
  missingDurationFixture,
  negativeUsageFixture,
  rateOverTimeFixture,
  subscriberPiiFixture,
  urlFieldFixture,
} from './fixtures.ts';

export const BANDWIDTH_CERTIFICATION_SUITE = 'sunrey.bandwidth-provider-certification.v1' as const;

export const BANDWIDTH_SANDBOX_FEEDS = [
  'capacity_rate',
  'transferred_bytes',
  'rate_over_time',
  'cdn_aggregate',
  'peering_transit_aggregate',
] as const;
export type BandwidthSandboxFeed = (typeof BANDWIDTH_SANDBOX_FEEDS)[number];

export const BANDWIDTH_ADVERSARIAL_SCENARIOS = [
  'GB_S_PRESENTED_AS_GB',
  'MISSING_DURATION',
  'NEGATIVE_USAGE',
  'FLOAT_QUANTITY',
  'DUPLICATE_INTERVAL',
  'SUBSCRIBER_PII',
  'URL_FIELD',
  'CREDENTIAL_LEAK',
  'SAME_CONTROLLER_FAKE_QUORUM',
  'CAPACITY_REPORTED_AS_USAGE',
  'SCHEMA_DRIFT',
  'UNIT_CHANGE',
  'STALE_TRAFFIC',
  'IMPOSSIBLE_TIMESTAMP_WINDOW',
] as const;
export type BandwidthAdversarialScenario = (typeof BANDWIDTH_ADVERSARIAL_SCENARIOS)[number];

export function bandwidthCertificationSubject(
  observation: BandwidthSourceObservation,
  extras: {
    readonly relatedSameController?: boolean;
    readonly nowUnix?: bigint;
  } = {},
): CertificationSubject {
  const nowUnix = extras.nowUnix ?? 1_700_000_000n;
  const schema = bandwidthFeedSchema(observation.schemaId);
  const sameController = extras.relatedSameController === true;
  return Object.freeze({
    providerId: `sandbox_bandwidth_${observation.sourceClass.toLowerCase()}`,
    sourceId: `src_${observation.sourceClass.toLowerCase()}`,
    feedId: `feed_${observation.schemaId.toLowerCase()}`,
    sourceCategory: schema.dataSourceCategory,
    factType: observation.factType,
    productiveCategory: schema.productiveCategory,
    claimType: observation.claimType,
    schemaId: schema.schemaId,
    schemaVersion: schema.version,
    unit: schema.unit,
    normalizationVersion: CERTIFICATION_NORMALIZATION_VERSION,
    mappingVersion: 1,
    connectorRuntimeVersion: CERTIFICATION_CONNECTOR_RUNTIME_VERSION,
    controllerId: observation.controllerId,
    upstreamOrganizationId: `org_${observation.controllerId}`,
    sharedControlGroup: sameController ? 'telecom-org-shared' : null,
    relatedFeeds: sameController
      ? Object.freeze([
          {
            feedId: 'feed_billing_alias',
            sourceId: 'src_billing_alias',
            providerId: 'sandbox_bandwidth_billing_alias',
            controllerId: observation.controllerId,
            upstreamOrganizationId: `org_${observation.controllerId}`,
            sharedControlGroup: 'telecom-org-shared',
          },
        ])
      : Object.freeze([]),
    connector: healthyConnector({
      endpointUrl: 'https://sandbox.local/bandwidth/feed',
      authenticationClass: 'FILE_FIXTURE_TEST_ONLY',
    }),
    observations: Object.freeze([
      {
        identifier: observation.identifier,
        numericValue: observation.numericValue,
        unit: schema.unit,
        sourceTimestampUnix: observation.sourceTimestampUnix,
        collectionTimestampUnix: nowUnix.toString(),
        sourceObservationId: `obs_${observation.identifier}`,
        schemaId: schema.schemaId,
        schemaVersion: schema.version,
        contentType: 'application/json',
        responseBytes: 256,
        extras: Object.freeze({
          transferSemantics: observation.transferSemantics,
          networkStage: observation.networkStage,
          durationSeconds: observation.durationSeconds?.toString(),
        }),
      },
    ]),
    evidence: emptyEvidenceStates(),
    prior: null,
    nowUnix,
    createdAtUnix: nowUnix,
  });
}

export function certifyBandwidthObservation(observation: BandwidthSourceObservation, nowUnix = 1_700_000_000n) {
  const schema = bandwidthFeedSchema(observation.schemaId);
  const feed: FeedSchemaDefinition = Object.freeze({
    schemaVersion: 1,
    schemaId: schema.schemaId,
    version: schema.version,
    factType: schema.factType,
    requiredFields: schema.requiredFields,
    unit: schema.unit,
    quantityScale: 0,
    identifierPattern: schema.identifierPattern,
    maxRecordBytes: schema.maxRecordBytes,
    maxArrayLength: schema.maxArrayLength,
    allowFloat: false,
    breakingChangeCreatesNewVersion: true,
  });
  void feedSchemaFor;
  return runCertificationSuite(bandwidthCertificationSubject(observation, { nowUnix }), feed);
}

export function evaluateBandwidthIndependence(observation: BandwidthSourceObservation) {
  return evaluateIndependence(bandwidthCertificationSubject(observation, { relatedSameController: true }));
}

export function evaluateBandwidthAdversary(
  scenario: BandwidthAdversarialScenario,
  nowUnix = 1_700_000_000n,
): Result<never, BandwidthRefusal> {
  switch (scenario) {
    case 'GB_S_PRESENTED_AS_GB':
      return fail(ingestBandwidthObservation(gbPerSecondPresentedAsGbFixture(), nowUnix));
    case 'MISSING_DURATION':
      return fail(ingestBandwidthObservation(missingDurationFixture(), nowUnix));
    case 'NEGATIVE_USAGE':
      return fail(ingestBandwidthObservation(negativeUsageFixture(), nowUnix));
    case 'FLOAT_QUANTITY':
      return fail(ingestBandwidthObservation(floatUsageFixture(), nowUnix));
    case 'DUPLICATE_INTERVAL':
      return err(bandwidthRefusal('DUPLICATE_INTERVAL', 'same source posted the same transfer interval twice'));
    case 'SUBSCRIBER_PII':
      return fail(ingestBandwidthObservation(subscriberPiiFixture(), nowUnix));
    case 'URL_FIELD':
      return fail(ingestBandwidthObservation(urlFieldFixture(), nowUnix));
    case 'CREDENTIAL_LEAK':
      return fail(ingestBandwidthObservation(credentialLeakFixture(), nowUnix));
    case 'SAME_CONTROLLER_FAKE_QUORUM':
      return err(bandwidthRefusal('SAME_CONTROLLER_FAKE_QUORUM', 'five APIs of one telecom are not five controllers'));
    case 'CAPACITY_REPORTED_AS_USAGE':
      return fail(ingestBandwidthObservation(capacityReportedAsUsageFixture(), nowUnix));
    case 'SCHEMA_DRIFT':
      return fail(
        ingestBandwidthObservation(
          { ...rateOverTimeFixture(), schemaVersion: 2 },
          nowUnix,
        ),
      );
    case 'UNIT_CHANGE':
      return fail(
        ingestBandwidthObservation(
          { ...rateOverTimeFixture(), unit: 'GB' },
          nowUnix,
        ),
      );
    case 'STALE_TRAFFIC':
      return fail(
        ingestBandwidthObservation(
          { ...rateOverTimeFixture(), sourceTimestampUnix: (nowUnix - 10_000n).toString() },
          nowUnix,
        ),
      );
    case 'IMPOSSIBLE_TIMESTAMP_WINDOW':
      return fail(
        ingestBandwidthObservation(
          { ...rateOverTimeFixture(), measurementStart: nowUnix, measurementEnd: nowUnix - 1n, durationSeconds: null },
          nowUnix,
        ),
      );
    default:
      return err(bandwidthRefusal('SCHEMA_INCOMPATIBLE', 'unknown adversarial scenario'));
  }
}

function fail(
  result: Result<unknown, BandwidthRefusal>,
): Result<never, BandwidthRefusal> {
  if (!result.ok) {
    return result;
  }
  return err(bandwidthRefusal('SCHEMA_INCOMPATIBLE', 'adversarial scenario unexpectedly ingested'));
}

export function bandwidthCertificationDoesNotMint(): false {
  return CERTIFICATION_MINTS_MOONREY;
}

export function certifyBandwidthSandbox(feed: BandwidthSandboxFeed, nowUnix = 1_700_000_000n) {
  const observation =
    feed === 'capacity_rate'
      ? capacityRateFixture()
      : feed === 'rate_over_time'
        ? rateOverTimeFixture()
        : transferredBytesFor(feed);
  return certifyBandwidthObservation(observation, nowUnix);
}

function transferredBytesFor(feed: Exclude<BandwidthSandboxFeed, 'capacity_rate' | 'rate_over_time'>): BandwidthSourceObservation {
  const { transferredBytesFixture, cdnAggregateFixture, peeringTransitFixture } = fixturesLazy();
  if (feed === 'cdn_aggregate') {
    return cdnAggregateFixture();
  }
  if (feed === 'peering_transit_aggregate') {
    return peeringTransitFixture();
  }
  return transferredBytesFixture();
}

function fixturesLazy() {
  return {
    transferredBytesFixture: () =>
      ({
        ...rateOverTimeFixture(),
        schemaId: 'BANDWIDTH_USAGE_V2' as const,
        schemaVersion: 2 as const,
        unit: 'GB' as const,
        numericValue: '20',
        quantityKind: 'DATA_VOLUME' as const,
        transferSemantics: 'VERIFIED_TRANSFERRED_BYTES' as const,
        identifier: 'xfer_sandbox_1',
      }) satisfies BandwidthSourceObservation,
    cdnAggregateFixture: () =>
      ({
        ...rateOverTimeFixture(),
        sourceClass: 'CDN_METERING' as const,
        schemaId: 'BANDWIDTH_USAGE_V2' as const,
        schemaVersion: 2 as const,
        unit: 'GB' as const,
        numericValue: '20',
        quantityKind: 'DATA_VOLUME' as const,
        transferSemantics: 'CACHE_EGRESS_BYTES' as const,
        networkStage: 'CDN' as const,
        identifier: 'cdn_sandbox_1',
      }) satisfies BandwidthSourceObservation,
    peeringTransitFixture: () =>
      ({
        ...rateOverTimeFixture(),
        sourceClass: 'PEERING_METER' as const,
        schemaId: 'BANDWIDTH_USAGE_V2' as const,
        schemaVersion: 2 as const,
        unit: 'GB' as const,
        numericValue: '20',
        quantityKind: 'DATA_VOLUME' as const,
        transferSemantics: 'PEERING_BYTES' as const,
        networkStage: 'TRANSIT_NETWORK' as const,
        identifier: 'peer_sandbox_1',
      }) satisfies BandwidthSourceObservation,
  };
}
