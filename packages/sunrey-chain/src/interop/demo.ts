import {
  InteropEngine,
  createExternalDevChain,
  developmentExternalChain,
  finalizeForeignHeader,
  isolatedRelayer,
  makePacket,
  membershipProof,
  packetStateKey,
  putForeignState,
} from './engine.ts';
import { DEV_INTEROP_TEST_ASSET, EXTERNAL_DEV_CHAIN_ID } from './types.ts';

console.log('SunRey sovereign interoperability demo');
console.log('ENVIRONMENT=simulation  relayers untrusted  no wrapped fiat');

const foreign = createExternalDevChain();
const engines = [0, 1, 2, 3].map(() => {
  const engine = new InteropEngine();
  engine.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
  engine.activateChain(EXTERNAL_DEV_CHAIN_ID, 'GOVERNANCE');
  return engine;
});
const clients = engines.map((engine) => engine.initializeClient(foreign));

const lead = engines[0];
if (!lead) {
  throw new Error('missing engine');
}
lead.escrow(100n);
const packet = makePacket(`${DEV_INTEROP_TEST_ASSET}:100`, 'ASSET_TRANSFER_RESERVED');
putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
const header = finalizeForeignHeader(foreign);
const proof = membershipProof(foreign, packetStateKey(packet));

for (const [index, engine] of engines.entries()) {
  const clientId = clients[index];
  if (!clientId) {
    throw new Error('missing client');
  }
  if (index > 0) {
    engine.escrow(100n);
  }
  engine.submitHeader(clientId, header, isolatedRelayer('relayer-a'));
  engine.submitHeader(clientId, header, isolatedRelayer('relayer-b'));
  const ack = engine.recvPacket(clientId, packet, proof, header);
  engine.acknowledge(
    `pkt/${packet.sourceChain}/${packet.destinationChain}/${packet.protocolVersion}/${packet.sourceChannel}/${packet.sequence}`,
    ack,
  );
}

const roots = engines.map((engine) => engine.stateRoot());
const firstRoot = roots[0];
const firstClient = clients[0];
if (!firstClient) {
  throw new Error('missing client');
}
console.log('external_chain', EXTERNAL_DEV_CHAIN_ID);
console.log('verified_height', lead.clients.get(firstClient)?.latestHeight);
console.log('packets_received', lead.metrics.interopPacketsReceived);
console.log('four_validator_state_agree', roots.every((root) => root === firstRoot));
console.log('asset_remote', lead.assets.authorizedRemote.toString());
console.log('weakest_domain', lead.securityProfile(firstClient).weakestTrustDomain);
console.log('demo ok — development interop only; production interop is not enabled');
