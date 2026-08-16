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

engines[0].escrow(100n);
const packet = makePacket(`${DEV_INTEROP_TEST_ASSET}:100`, 'ASSET_TRANSFER_RESERVED');
putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
const header = finalizeForeignHeader(foreign);
const proof = membershipProof(foreign, packetStateKey(packet));

for (const [index, engine] of engines.entries()) {
  if (index > 0) {
    engine.escrow(100n);
  }
  engine.submitHeader(clients[index], header, isolatedRelayer('relayer-a'));
  engine.submitHeader(clients[index], header, isolatedRelayer('relayer-b'));
  const ack = engine.recvPacket(clients[index], packet, proof, header);
  engine.acknowledge(
    `pkt/${packet.sourceChain}/${packet.destinationChain}/${packet.protocolVersion}/${packet.sourceChannel}/${packet.sequence}`,
    ack,
  );
}

const roots = engines.map((engine) => engine.stateRoot());
console.log('external_chain', EXTERNAL_DEV_CHAIN_ID);
console.log('verified_height', engines[0].clients.get(clients[0])?.latestHeight);
console.log('packets_received', engines[0].metrics.interopPacketsReceived);
console.log('four_validator_state_agree', roots.every((root) => root === roots[0]));
console.log('asset_remote', engines[0].assets.authorizedRemote.toString());
console.log('weakest_domain', engines[0].securityProfile(clients[0]).weakestTrustDomain);
console.log('demo ok — development interop only; production interop is not enabled');
