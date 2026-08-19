/**
 * Chunk 130 demo — sandbox GPU cluster through the compute fabric.
 *
 * scheduler + billing meter + GPU telemetry observe one execution.
 * No live provider is contacted. Facts do not mint MoonRey.
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
import { evaluateAttribution } from '../../../../productive/policy-governance/attribution/engine.ts';
import { developmentAttributionPolicy } from '../../../../productive/policy-governance/attribution/policy.ts';
import { computePair, relationship } from '../../../../productive/policy-governance/attribution/fixtures.ts';
import { assessEventLinkage } from '../../../../productive/policy-governance/attribution/identity.ts';
import { ingestComputeObservation } from './adapter.ts';
import { certifyComputeObservation, computeCertificationDoesNotMint } from './certification.ts';
import { corroboratingSources, gpuExecutionFixture, SANDBOX_NOW } from './fixtures.ts';
import { computeEventEvidence, executionReferenceOf, sameComputeExecution } from './jobs.ts';
import { projectComputeMetadata } from './ear.ts';
import {
  CAPACITY_EQUALS_REALIZED_OUTPUT,
  COMPUTE_FACT_AUTO_MINTS_MOONREY,
  PROMPT_CONTENT_STORED,
  REAL_PROVIDER_CONTACTED,
  TOKEN_EQUALS_GPU_TIME,
} from './types.ts';

const sources = corroboratingSources();
const scheduler = sources[0]!;
const billing = sources[1]!;
const telemetry = sources[2]!;

const profile = sandboxEndpointProfile({
  profileId: 'profile_sandbox_compute',
  pathPrefix: '/v1/compute',
});
const transport = new FakeExternalHttpTransport();
transport.on('GET', `${profile.scheme}://${profile.hostname}:${profile.port}${profile.pathPrefix}`, {
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    identifier: telemetry.identifier,
    numericValue: telemetry.numericValue,
    unit: 'gpu_s',
    sourceTimestampUnix: SANDBOX_NOW.toString(),
    schemaId: 'compute.gpu-usage.v1',
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
      category: 'compute',
      factType: 'COMPUTE_USAGE',
      feedId: 'feed_compute_gpu_sim',
      unit: 'gpu_s',
      schemaId: 'compute.gpu-usage.v1',
    }),
    identity: sandboxIdentity(),
    feed: Object.freeze({
      ...sandboxFeed(),
      feedId: 'feed_compute_gpu_sim',
      factType: 'COMPUTE_USAGE' as const,
      measurementUnit: 'gpu_s' as const,
      schema: Object.freeze({
        schemaVersion: 1 as const,
        schemaId: 'compute.gpu-usage.v1',
        version: 1,
        factType: 'COMPUTE_USAGE' as const,
        requiredFields: Object.freeze(['identifier', 'numericValue', 'unit', 'sourceTimestampUnix']),
        unit: 'gpu_s' as const,
        quantityScale: 0,
        identifierPattern: '^[A-Za-z0-9_.:-]+$',
        maxRecordBytes: 2_048,
        maxArrayLength: 8,
        allowFloat: false,
        breakingChangeCreatesNewVersion: true,
      }),
    }),
    endpointProfile: profile,
    subject: telemetry.identifier,
    nowUnix: SANDBOX_NOW_UNIX,
  },
  secrets: sandboxSecrets(),
  auth: sandboxApiKeyAuth(),
});
if (!collected.ok) {
  throw new Error(`${collected.error.code}: ${collected.error.detail}`);
}

const gpu = ingestComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
if (!gpu.ok) {
  throw new Error(`${gpu.error.code}: ${gpu.error.detail}`);
}
const ingested = sources.map((source) => ingestComputeObservation(source, SANDBOX_NOW));
if (ingested.some((item) => !item.ok)) {
  throw new Error('corroborating compute sources must ingest');
}
const sameEvent =
  sameComputeExecution(scheduler, billing) &&
  sameComputeExecution(billing, telemetry) &&
  sameComputeExecution(scheduler, telemetry);

const leftEvidence = computeEventEvidence(scheduler, executionReferenceOf(scheduler), gpu.value.receipt.receiptId);
const rightEvidence = computeEventEvidence(telemetry, executionReferenceOf(telemetry), gpu.value.receipt.receiptId);
const linkage = assessEventLinkage(leftEvidence, rightEvidence);

const certified = certifyComputeObservation(gpuExecutionFixture(), SANDBOX_NOW);
const registry = new EconomicAssetRegistry();
const projected = projectComputeMetadata(registry, gpu.value);
const pair = computePair(true);
const attribution = evaluateAttribution({
  height: 1,
  policy: developmentAttributionPolicy(),
  subjects: [pair.compute, pair.ai],
  relationships: [relationship(pair.compute.economicEventId, pair.ai.economicEventId, 'SAME_UNDERLYING_EVENT')],
});

const report = {
  connectorObservationDraftId: collected.value.canonical.observationDraftId,
  schemaId: gpu.value.schemaId,
  certificationStatus: certified.record.status,
  canonicalGpuSeconds: gpu.value.canonicalQuantity.mantissa.toString(),
  canonicalUnit: gpu.value.canonicalUnit,
  receiptId: gpu.value.receipt.receiptId,
  sameEconomicEvent: sameEvent,
  linkage: linkage.relation,
  evidenceSourceCount: sources.length,
  earProjected: projected.ok,
  attributionPrimary: attribution.decisions.find((item) => item.category === 'COMPUTE')?.decision,
  attributionAi: attribution.decisions.find((item) => item.category === 'AI_COMPUTE')?.decision,
  CONSENSUS_CALLED_HTTP,
  CREDENTIALS_EXPOSED,
  FETCH_AUTO_FINALIZED_ORACLE,
  FETCH_AUTO_MINTED_MOONREY,
  liveMainnet: liveMainnetConnectivityEnabled(),
};

console.log('SunRey compute and AI economic data fabric demo');
console.log('sandbox GPU cluster → connector runtime → compute schema → certification → canonical GPU-time → event identity');
console.log(JSON.stringify(report, null, 2));
console.log(`PROMPT_CONTENT_STORED=${PROMPT_CONTENT_STORED}`);
console.log(`TOKEN_EQUALS_GPU_TIME=${TOKEN_EQUALS_GPU_TIME}`);
console.log(`CAPACITY_EQUALS_REALIZED_OUTPUT=${CAPACITY_EQUALS_REALIZED_OUTPUT}`);
console.log(`REAL_PROVIDER_CONTACTED=${REAL_PROVIDER_CONTACTED}`);
console.log(`COMPUTE_FACT_AUTO_MINTS_MOONREY=${COMPUTE_FACT_AUTO_MINTS_MOONREY}`);
console.log(`CERTIFICATION_AUTO_MINTS_MOONREY=${computeCertificationDoesNotMint()}`);
console.log('demo ok — one execution, three corroborating sources, no live provider, no mint');
