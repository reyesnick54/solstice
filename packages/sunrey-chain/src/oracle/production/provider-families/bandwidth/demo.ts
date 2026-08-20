/**
 * Chunk 136 demo — sandbox network source through the bandwidth fabric.
 *
 * Capacity stays a rate. Measured rate + duration becomes exact
 * transferred-volume evidence. CDN, ISP, and edge meters observe the
 * same transfer without automatically creating triple output.
 */

import { FakeExternalHttpTransport } from '../../transport.ts';
import { EconomicDataConnectorRuntime, createDeterministicRandom, createFrozenConnectorClock } from '../../runtime.ts';
import {
  CONSENSUS_CALLED_HTTP,
  CREDENTIALS_EXPOSED,
  DEFAULT_CONNECTOR_RUNTIME_CONFIG,
  FETCH_AUTO_FINALIZED_ORACLE,
  FETCH_AUTO_MINTED_MOONREY,
  liveMainnetConnectivityEnabled,
} from '../../runtime-types.ts';
import {
  SANDBOX_NOW_UNIX,
  sandboxApiKeyAuth,
  sandboxEndpointProfile,
  sandboxFeed,
  sandboxIdentity,
  sandboxSecrets,
  sandboxSource,
} from '../../sandbox-fixture.ts';
import { EconomicAssetRegistry } from '../../../../../../economic-asset-registry/src/index.ts';
import { ingestBandwidthObservation } from './adapter.ts';
import { certifyBandwidthObservation, bandwidthCertificationDoesNotMint } from './certification.ts';
import {
  SANDBOX_NOW,
  capacityRateFixture,
  corroboratingSources,
  rateOverTimeFixture,
} from './fixtures.ts';
import { bandwidthEventId, sameBandwidthTransfer } from './lineage.ts';
import { projectBandwidthMetadata } from './ear.ts';
import { rateTimesDuration, sourceQuantityOf } from './transfer.ts';
import {
  BANDWIDTH_FACT_AUTO_MINTS_MOONREY,
  CAPACITY_EQUALS_REALIZED_USAGE,
  DATA_RATE_EQUALS_DATA_VOLUME,
  PACKET_PAYLOAD_STORED,
  PRODUCTION_ACTIVE,
  REAL_PROVIDER_CONTACTED,
  USER_BROWSING_HISTORY_STORED,
} from './types.ts';

const capacity = ingestBandwidthObservation(capacityRateFixture(), SANDBOX_NOW);
if (!capacity.ok) {
  throw new Error(`${capacity.error.code}: ${capacity.error.detail}`);
}
const rate = rateOverTimeFixture();
const usage = ingestBandwidthObservation(rate, SANDBOX_NOW);
if (!usage.ok) {
  throw new Error(`${usage.error.code}: ${usage.error.detail}`);
}
const source = sourceQuantityOf(rate);
if (!source.ok) {
  throw new Error(source.error.detail);
}
const derived = rateTimesDuration({
  rate: source.value,
  durationSeconds: 10n,
  factType: 'BANDWIDTH_USAGE',
});
if (!derived.ok) {
  throw new Error(derived.error.detail);
}

const sources = corroboratingSources();
const ingested = sources.map((item) => ingestBandwidthObservation(item, SANDBOX_NOW));
if (ingested.some((item) => !item.ok)) {
  throw new Error('corroborating bandwidth sources must ingest');
}
const sameEvent =
  sameBandwidthTransfer(sources[0]!, sources[1]!) &&
  sameBandwidthTransfer(sources[1]!, sources[2]!) &&
  sameBandwidthTransfer(sources[0]!, sources[2]!);

const profile = sandboxEndpointProfile({
  profileId: 'profile_sandbox_bandwidth',
  pathPrefix: '/v1/bandwidth',
});
const transport = new FakeExternalHttpTransport();
transport.on('GET', `${profile.scheme}://${profile.hostname}:${profile.port}${profile.pathPrefix}`, {
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    identifier: rate.identifier,
    numericValue: rate.numericValue,
    unit: 'GB_s',
    sourceTimestampUnix: SANDBOX_NOW.toString(),
    schemaId: 'bandwidth.usage.v1',
    schemaVersion: 1,
  }),
});
const runtime = new EconomicDataConnectorRuntime({
  config: DEFAULT_CONNECTOR_RUNTIME_CONFIG,
  transport,
  clock: createFrozenConnectorClock(SANDBOX_NOW_UNIX),
  random: createDeterministicRandom(),
  sleeper: async () => undefined,
});
const collected = await runtime.collect({
  request: {
    source: sandboxSource({
      category: 'bandwidth',
      factType: 'BANDWIDTH_USAGE',
      feedId: 'feed_bandwidth_sim',
      unit: 'GB_s',
      schemaId: 'bandwidth.usage.v1',
    }),
    identity: sandboxIdentity(),
    feed: Object.freeze({
      ...sandboxFeed(),
      feedId: 'feed_bandwidth_sim',
      factType: 'BANDWIDTH_USAGE' as const,
      measurementUnit: 'GB_s' as const,
      schema: Object.freeze({
        schemaVersion: 1 as const,
        schemaId: 'bandwidth.usage.v1',
        version: 1,
        factType: 'BANDWIDTH_USAGE' as const,
        requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
        unit: 'GB_s' as const,
        quantityScale: 0,
        identifierPattern: '^[A-Za-z0-9_.:-]+$',
        maxRecordBytes: 2_048,
        maxArrayLength: 8,
        allowFloat: false,
        breakingChangeCreatesNewVersion: true,
      }),
    }),
    endpointProfile: profile,
    subject: rate.identifier,
    nowUnix: SANDBOX_NOW_UNIX,
  },
  secrets: sandboxSecrets(),
  auth: sandboxApiKeyAuth(),
});
if (!collected.ok) {
  throw new Error(`${collected.error.code}: ${collected.error.detail}`);
}

const certified = certifyBandwidthObservation(rate, SANDBOX_NOW);
const registry = new EconomicAssetRegistry();
const projected = projectBandwidthMetadata(registry, usage.value);

const report = {
  connectorObservationDraftId: collected.value.canonical.observationDraftId,
  capacityUnit: capacity.value.canonicalUnit,
  capacityDimension: capacity.value.dimension,
  usageCanonicalGb: usage.value.canonicalQuantity.mantissa.toString(),
  usageCanonicalUnit: usage.value.canonicalUnit,
  derivedVolumeGb: derived.value.volume.mantissa.toString(),
  sameEconomicEvent: sameEvent,
  evidenceSourceCount: sources.length,
  eventIds: sources.map((item) => bandwidthEventId(item)),
  earProjected: projected.ok,
  certificationStatus: certified.record.status,
  CONSENSUS_CALLED_HTTP,
  CREDENTIALS_EXPOSED,
  FETCH_AUTO_FINALIZED_ORACLE,
  FETCH_AUTO_MINTED_MOONREY,
  liveMainnet: liveMainnetConnectivityEnabled(),
};

console.log('SunRey bandwidth, telecom, and digital network economic data fabric demo');
console.log('network source → capacity rate');
console.log('measured rate + duration → exact transferred-volume evidence');
console.log('CDN + ISP + edge observe one transfer without triple output');
console.log(JSON.stringify(report, null, 2));
console.log(`DATA_RATE_EQUALS_DATA_VOLUME=${DATA_RATE_EQUALS_DATA_VOLUME}`);
console.log(`PACKET_PAYLOAD_STORED=${PACKET_PAYLOAD_STORED}`);
console.log(`USER_BROWSING_HISTORY_STORED=${USER_BROWSING_HISTORY_STORED}`);
console.log(`CAPACITY_EQUALS_REALIZED_USAGE=${CAPACITY_EQUALS_REALIZED_USAGE}`);
console.log(`REAL_PROVIDER_CONTACTED=${REAL_PROVIDER_CONTACTED}`);
console.log(`PRODUCTION_ACTIVE=${PRODUCTION_ACTIVE}`);
console.log(`BANDWIDTH_FACT_AUTO_MINTS_MOONREY=${BANDWIDTH_FACT_AUTO_MINTS_MOONREY}`);
console.log(`CERTIFICATION_AUTO_MINTS_MOONREY=${bandwidthCertificationDoesNotMint()}`);
console.log('demo ok — capacity is rate, usage is volume, one transfer, no live provider, no mint');
