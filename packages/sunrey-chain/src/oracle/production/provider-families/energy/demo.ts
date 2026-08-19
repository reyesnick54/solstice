/**
 * Chunk 129 demo — sandbox generator meter through the energy fabric.
 *
 * Does not contact a real provider, finalize production ingestion, or
 * mint MoonRey.
 */

import { CONSENSUS_CALLED_HTTP, DEFAULT_CONNECTOR_RUNTIME_CONFIG } from '../../runtime-types.ts';
import { FakeExternalHttpTransport } from '../../transport.ts';
import { EconomicDataConnectorRuntime, createDeterministicRandom, createFrozenConnectorClock } from '../../runtime.ts';
import { sandboxApiKeyAuth, sandboxEndpointProfile, sandboxFeed, sandboxIdentity, sandboxSecrets, sandboxSource } from '../../sandbox-fixture.ts';
import { profileUrl } from '../../auth-runtime.ts';
import { OracleEngine, developmentEnergyFeed } from '../../../engine.ts';
import { registerEnergyProviders, signDraft } from '../../../demo-helpers.ts';
import { quantity } from '../../../units.ts';
import { ENERGY_FACT_AUTO_MINTS_MOONREY, ENERGY_PRODUCTION_ACTIVE, ENERGY_REFERENCE_PRICE_CREATES_CLAIM, REAL_EXTERNAL_PROVIDER_CONTACTED } from './types.ts';
import { EnergyProviderFamilyAdapter } from './adapter.ts';
import { certifyEnergyScenario } from './certification.ts';
import { ENERGY_NOW_UNIX, validGeneratorIntervalFeed } from './fixtures.ts';
import { ingestEnergyObservation } from './adapter.ts';
import { energyReferencePriceCannotCreateClaim } from './adapter.ts';

const observation = validGeneratorIntervalFeed();
const profile = sandboxEndpointProfile({
  pathPrefix: '/v1/energy-interval',
  profileId: 'profile_sandbox_energy_interval',
});
const transport = new FakeExternalHttpTransport();
transport.on('GET', profileUrl(profile), {
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    identifier: observation.meterRef,
    numericValue: observation.quantity,
    unit: observation.unit,
    sourceTimestampUnix: observation.sourceTimestampUnix,
    schemaId: 'energy.resource.v1',
    schemaVersion: 1,
    extras: {
      schemaId: observation.schemaId,
      measurementStartUnix: observation.measurementStartUnix,
      measurementEndUnix: observation.measurementEndUnix,
    },
  }),
});

const runtime = new EconomicDataConnectorRuntime({
  config: DEFAULT_CONNECTOR_RUNTIME_CONFIG,
  transport,
  clock: createFrozenConnectorClock(ENERGY_NOW_UNIX),
  random: createDeterministicRandom(),
  sleeper: async () => undefined,
});
const adapter = new EnergyProviderFamilyAdapter(runtime, 'API_KEY_REFERENCE');
const collected = await adapter.collectDraft({
  request: {
    source: sandboxSource({
      schemaId: 'energy.resource.v1',
      unit: 'kWh',
      factType: 'ENERGY_PRODUCTION',
    }),
    identity: sandboxIdentity(),
    feed: { ...sandboxFeed(), schema: { ...sandboxFeed().schema, unit: 'kWh', schemaId: 'energy.resource.v1' }, measurementUnit: 'kWh' },
    endpointProfile: profile,
    subject: observation.subject.canonicalRef,
    nowUnix: ENERGY_NOW_UNIX,
  },
  context: runtime.context({ secrets: sandboxSecrets(), auth: sandboxApiKeyAuth() }),
  observation,
});
if (!collected.ok) {
  throw new Error(`${collected.error.code}: ${collected.error.detail}`);
}

const ingested = ingestEnergyObservation(observation, ENERGY_NOW_UNIX);
if (!ingested.ok) {
  throw new Error(`${ingested.error.code}: ${ingested.error.detail}`);
}
const certified = certifyEnergyScenario('VALID_GENERATOR_INTERVAL');

const engine = new OracleEngine({
  networkId: 'net_sunrey_simulation',
  chainId: 'chn_sunrey_simulation',
  clock: { nowUnix: () => ENERGY_NOW_UNIX },
});
const providers = registerEnergyProviders(engine);
const value = quantity(ingested.value.sourceQuantity.mantissa, 0, 'kWh');
if (!value.ok) {
  throw new Error(value.error.detail);
}
const feedDef = engine.registerFeed(developmentEnergyFeed({ measurementUnit: 'kWh', maxObservationSpread: 50n }));
if (!feedDef.ok) {
  throw new Error(feedDef.error.detail);
}
for (let i = 0; i < providers.length; i += 1) {
  const provider = providers[i]!;
  const draft = {
    schemaVersion: 1 as const,
    oracleId: provider.record.oracleId,
    feedId: feedDef.value.feedId,
    subject: 'plant_sim_1',
    value: value.value,
    measurementStartUnix: ENERGY_NOW_UNIX - 3_600n,
    measurementEndUnix: ENERGY_NOW_UNIX,
    observationTimeUnix: ENERGY_NOW_UNIX,
    validUntilUnix: ENERGY_NOW_UNIX + 3_600n,
    geography: { schemaVersion: 1 as const, jurisdiction: 'US', region: 'sim-west', locality: 'grid-zone-a' },
    sourceReferenceCommitment: ingested.value.provenanceCommitment,
    methodologyReference: 'method.energy.fabric.v1',
    confidence: { schemaVersion: 1 as const, scoreBps: 9_000, sampleCount: 1, notesRef: 'energy-fabric' },
    sequence: 1n,
    networkId: engine.networkId,
    chainId: engine.chainId,
    deviceProvenance: ingested.value.deviceProvenance,
    weight: 1n,
  };
  const submitted = engine.submitObservation(signDraft(engine, provider.label, draft));
  if (!submitted.ok) {
    throw new Error(submitted.error.detail);
  }
}
const finalized = engine.finalizeWindow({
  feedId: feedDef.value.feedId,
  subject: 'plant_sim_1',
  startUnix: ENERGY_NOW_UNIX - 3_600n,
  endUnix: ENERGY_NOW_UNIX,
});
if (!finalized.ok) {
  throw new Error(finalized.error.detail);
}

console.log('SunRey energy economic data fabric demo');
console.log('sandbox generator meter → connector runtime → canonical energy schema → certification → observation draft');
console.log(`schema=${observation.schemaId}`);
console.log(`sourceUnit=${ingested.value.sourceQuantity.originalUnit}`);
console.log(`canonicalUnit=${ingested.value.canonicalMeasurement?.canonicalUnit ?? 'none'}`);
console.log(`canonicalWh=${ingested.value.canonicalMeasurement?.canonicalQuantity.mantissa.toString() ?? 'none'}`);
console.log(`certificationStatus=${certified.suite?.record.status ?? 'energy-domain'}`);
console.log(`observationDraftId=${collected.value.draft.observationDraftId}`);
console.log(`verifiedFact=${finalized.value.factId}`);
console.log(`verifiedFactStatus=${finalized.value.qualityStatus}`);
console.log(`mintedMoonRey=false`);
console.log(`REAL_EXTERNAL_PROVIDER_CONTACTED=${String(REAL_EXTERNAL_PROVIDER_CONTACTED)}`);
console.log(`ENERGY_REFERENCE_PRICE_CREATES_CLAIM=${String(ENERGY_REFERENCE_PRICE_CREATES_CLAIM && energyReferencePriceCannotCreateClaim())}`);
console.log(`CONSENSUS_CALLED_HTTP=${String(CONSENSUS_CALLED_HTTP)}`);
console.log(`ENERGY_FACT_AUTO_MINTS_MOONREY=${String(ENERGY_FACT_AUTO_MINTS_MOONREY)}`);
console.log(`PRODUCTION_ACTIVE=${String(ENERGY_PRODUCTION_ACTIVE)}`);
console.log('demo ok — energy fabric collected a draft and did not mint MoonRey');
