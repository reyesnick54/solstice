/**
 * Chunk 127 demo — off-chain connector runtime against a local sandbox.
 *
 * Does not finalize an oracle fact and does not mint MoonRey.
 */

import { FakeExternalHttpTransport } from './transport.ts';
import { EconomicDataConnectorRuntime, createDeterministicRandom, createFrozenConnectorClock } from './runtime.ts';
import {
  CONSENSUS_CALLED_HTTP,
  CREDENTIALS_EXPOSED,
  DEFAULT_CONNECTOR_RUNTIME_CONFIG,
  FETCH_AUTO_FINALIZED_ORACLE,
  FETCH_AUTO_MINTED_MOONREY,
  liveMainnetConnectivityEnabled,
} from './runtime-types.ts';
import {
  SANDBOX_NOW_UNIX,
  sandboxApiKeyAuth,
  sandboxEnergyRecord,
  sandboxEndpointProfile,
  sandboxFeed,
  sandboxIdentity,
  sandboxSecrets,
  sandboxSource,
} from './sandbox-fixture.ts';

const profile = sandboxEndpointProfile();
const transport = new FakeExternalHttpTransport();
transport.on('GET', `${profile.scheme}://${profile.hostname}:${profile.port}${profile.pathPrefix}`, {
  status: 200,
  headers: { 'content-type': 'application/json' },
  body: sandboxEnergyRecord(),
});
const runtime = new EconomicDataConnectorRuntime({
  config: DEFAULT_CONNECTOR_RUNTIME_CONFIG,
  transport,
  clock: createFrozenConnectorClock(SANDBOX_NOW_UNIX),
  random: createDeterministicRandom(),
  sleeper: async () => undefined,
});
const result = await runtime.collect({
  request: {
    source: sandboxSource(),
    identity: sandboxIdentity(),
    feed: sandboxFeed(),
    endpointProfile: profile,
    subject: 'plant_sim_1',
    nowUnix: SANDBOX_NOW_UNIX,
  },
  secrets: sandboxSecrets(),
  auth: sandboxApiKeyAuth(),
});
if (!result.ok) {
  throw new Error(`${result.error.code}: ${result.error.detail}`);
}

const report = {
  CONSENSUS_CALLED_HTTP,
  LIVE_MAINNET_CONNECTIVITY: liveMainnetConnectivityEnabled(),
  CREDENTIALS_EXPOSED,
  FETCH_AUTO_FINALIZED_ORACLE,
  FETCH_AUTO_MINTED_MOONREY,
  mode: DEFAULT_CONNECTOR_RUNTIME_CONFIG.mode,
  mainnetConnectivity: DEFAULT_CONNECTOR_RUNTIME_CONFIG.mainnetConnectivity,
  observationDraftId: result.value.canonical.observationDraftId,
  contentHash: result.value.provenance.contentHash,
  sourceTimestampUnix: result.value.provenance.sourceTimestampUnix.toString(),
  collectionTimestampUnix: result.value.provenance.collectionTimestampUnix.toString(),
  verifiedEconomicFact: result.value.verifiedEconomicFact,
  mintedMoonRey: result.value.mintedMoonRey,
};

console.log('SunRey economic data connector runtime demo');
console.log('off-chain HTTP source → authentication → schema validation → SourceProvenance → CanonicalCollectedObservation');
console.log(JSON.stringify(report, null, 2));
console.log('CONSENSUS_CALLED_HTTP=false');
console.log('LIVE_MAINNET_CONNECTIVITY=false');
console.log('CREDENTIALS_EXPOSED=false');
console.log('FETCH_AUTO_FINALIZED_ORACLE=false');
console.log('FETCH_AUTO_MINTED_MOONREY=false');
console.log('demo ok — fetch is not a verified fact and does not mint MoonRey');
