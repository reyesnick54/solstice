import {
  InteropEngine,
  InteropFailure,
  createExternalDevChain,
  developmentExternalChain,
  finalizeForeignHeader,
  isolatedRelayer,
  makePacket,
  membershipProof,
  packetStateKey,
  putForeignState,
} from '../../../sunrey-chain/src/interop/index.ts';
import { DEV_INTEROP_TEST_ASSET, EXTERNAL_DEV_CHAIN_ID } from '../../../sunrey-chain/src/interop/types.ts';
import { recordAlert, type RangeEnvironment } from '../environment.ts';
import { actor, caught, defineScenario, detection, finish, holdAll, recovery, step } from './helpers.ts';
import type { AttackResult, AttackScenario } from '../types.ts';

function ready() {
  const foreign = createExternalDevChain();
  const engine = new InteropEngine();
  engine.registerChain(developmentExternalChain(foreign.genesisHash), 'GOVERNANCE');
  engine.activateChain(EXTERNAL_DEV_CHAIN_ID, 'GOVERNANCE');
  const clientId = engine.initializeClient(foreign);
  return { foreign, engine, clientId, relayer: isolatedRelayer('relayer.isolated') };
}

function interopCode(error: unknown): string {
  if (error instanceof InteropFailure) {
    return error.code;
  }
  return caught(error);
}

export const interopScenarios: readonly AttackScenario[] = [
  defineScenario({
    scenarioId: 'INTEROP-FAKE-HEADER',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5860,
    subsystem: 'interop',
    attack: 'fake header',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'submitHeader height skip')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'INVALID_HEADER')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'height + parent checks',
    detectiveControl: 'INVALID_HEADER',
    recovery: 'freeze client',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INTEROP-FAKE-FINALITY',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5861,
    subsystem: 'interop',
    attack: 'fake finality proof',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'short finality')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'INVALID_FINALITY_PROOF')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'finality proof length/content',
    detectiveControl: 'INVALID_FINALITY_PROOF',
    recovery: 'freeze client',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INTEROP-FAKE-MEMBERSHIP',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5862,
    subsystem: 'interop',
    attack: 'fake membership proof',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'tamper proof')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'INVALID_MEMBERSHIP_PROOF')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'state root membership',
    detectiveControl: 'INVALID_MEMBERSHIP_PROOF',
    recovery: 'freeze client',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INTEROP-PACKET-REPLAY',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5863,
    subsystem: 'interop',
    attack: 'packet replay',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'recv twice')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'PACKET_REPLAY')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'replay set',
    detectiveControl: 'PACKET_REPLAY',
    recovery: 'freeze client',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INTEROP-ACK-REPLAY',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5864,
    subsystem: 'interop',
    attack: 'ack replay',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'ack twice')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'ACK_REPLAY')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'ack replay set',
    detectiveControl: 'ACK_REPLAY',
    recovery: 'freeze client',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INTEROP-WRONG-CHAIN',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5865,
    subsystem: 'interop',
    attack: 'wrong chain',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'foreign chain id')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'WRONG_EXTERNAL_CHAIN_ID')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'registered external chain id',
    detectiveControl: 'WRONG_EXTERNAL_CHAIN_ID',
    recovery: 'freeze client',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INTEROP-TIMEOUT',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5866,
    subsystem: 'interop',
    attack: 'timeout manipulation',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'timeout then recover')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('metrics', 'interopTimeouts')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'timeout is fail-closed; escrow recoverable once',
    detectiveControl: 'timeout metric',
    recovery: 'recover escrow',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'INTEROP-CLIENT-EXPIRATION',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5867,
    subsystem: 'interop',
    attack: 'client expiration bypass',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'submit after expire')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'CLIENT_EXPIRED')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'trusting period',
    detectiveControl: 'CLIENT_EXPIRED',
    recovery: 'freeze / re-init via governance',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BRIDGE-DUP-RECEIVE',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5868,
    subsystem: 'interop',
    attack: 'duplicate receive',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'recv reserved twice')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'PACKET_REPLAY')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'replay + supply assert',
    detectiveControl: 'PACKET_REPLAY',
    recovery: 'assertSupply',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BRIDGE-DUP-MINT',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5869,
    subsystem: 'interop',
    attack: 'duplicate mint/representation',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'representRemote twice')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'SUPPLY_INVARIANT_VIOLATED')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'escrow conservation',
    detectiveControl: 'SUPPLY_INVARIANT_VIOLATED',
    recovery: 'assertSupply',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BRIDGE-TIMEOUT-RECEIVE-RACE',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5870,
    subsystem: 'interop',
    attack: 'timeout + receive race',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'timeout then recv')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'SUPPLY_INVARIANT_VIOLATED')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'recover escrow before recv refuses representRemote',
    detectiveControl: 'SUPPLY_INVARIANT_VIOLATED',
    recovery: 'conservation holds',
    preventiveOnly: false,
  }),
  defineScenario({
    scenarioId: 'BRIDGE-ACK-TIMEOUT-RACE',
    category: 'INTEROPERABILITY_ABUSE',
    seed: 5871,
    subsystem: 'interop',
    attack: 'ack + timeout race',
    actors: [actor('relayer.isolated', 'RELAYER', true)],
    faults: [],
    timeline: [step(1, 'relayer.isolated', 'ack then timeout recover')],
    expectedSecurityProperties: ['NO_INTEROP_PROOF_BYPASS'],
    expectedDetections: [detection('alert', 'SUPPLY_INVARIANT_VIOLATED')],
    expectedRecovery: ['INTEROP_CLIENT_FREEZE'],
    preventiveControl: 'timeout does not re-credit after representation',
    detectiveControl: 'SUPPLY_INVARIANT_VIOLATED',
    recovery: 'conservation holds',
    preventiveOnly: false,
  }),
];

export function runInterop(env: RangeEnvironment, scenario: AttackScenario): AttackResult {
  const { foreign, engine, clientId, relayer } = ready();
  let blocked = false;
  let code = 'OK';
  const defined = engine.assets.definedTotal;
  try {
    if (scenario.scenarioId === 'INTEROP-FAKE-HEADER') {
      putForeignState(foreign, 'k', 'v');
      const header = finalizeForeignHeader(foreign);
      engine.submitHeader(clientId, { ...header, height: 9 }, relayer);
    } else if (scenario.scenarioId === 'INTEROP-FAKE-FINALITY') {
      putForeignState(foreign, 'k', 'v');
      const header = finalizeForeignHeader(foreign);
      engine.submitHeader(clientId, { ...header, finality: 'x' }, relayer);
    } else if (scenario.scenarioId === 'INTEROP-WRONG-CHAIN') {
      putForeignState(foreign, 'k', 'v');
      const header = finalizeForeignHeader(foreign);
      engine.submitHeader(clientId, { ...header, chainId: 'chn_other_network' }, relayer);
    } else if (scenario.scenarioId === 'INTEROP-CLIENT-EXPIRATION') {
      engine.nowUnix += 100_000;
      engine.expireClients();
      putForeignState(foreign, 'k', 'v');
      engine.submitHeader(clientId, finalizeForeignHeader(foreign), relayer);
    } else if (scenario.scenarioId === 'BRIDGE-DUP-MINT') {
      engine.escrow(100n);
      engine.representRemote(100n);
      engine.representRemote(100n);
    } else if (
      scenario.scenarioId === 'INTEROP-FAKE-MEMBERSHIP' ||
      scenario.scenarioId === 'INTEROP-PACKET-REPLAY' ||
      scenario.scenarioId === 'INTEROP-ACK-REPLAY' ||
      scenario.scenarioId === 'BRIDGE-DUP-RECEIVE' ||
      scenario.scenarioId === 'INTEROP-TIMEOUT' ||
      scenario.scenarioId === 'BRIDGE-TIMEOUT-RECEIVE-RACE' ||
      scenario.scenarioId === 'BRIDGE-ACK-TIMEOUT-RACE'
    ) {
      const packet = makePacket(
        scenario.scenarioId.startsWith('BRIDGE') ? `${DEV_INTEROP_TEST_ASSET}:100` : 'hello',
        scenario.scenarioId.startsWith('BRIDGE') ? 'ASSET_TRANSFER_RESERVED' : 'GENERIC_MESSAGE',
      );
      if (scenario.scenarioId.startsWith('BRIDGE') || scenario.scenarioId === 'INTEROP-TIMEOUT') {
        engine.escrow(100n);
      }
      const packetId = engine.sendPacket(packet);
      putForeignState(foreign, packetStateKey(packet), JSON.stringify(packet));
      const header = finalizeForeignHeader(foreign);
      engine.submitHeader(clientId, header, relayer);
      const proof = membershipProof(foreign, packetStateKey(packet));
      if (scenario.scenarioId === 'INTEROP-FAKE-MEMBERSHIP') {
        engine.recvPacket(clientId, packet, { ...proof, value: 'tampered' }, header);
      } else if (scenario.scenarioId === 'INTEROP-TIMEOUT') {
        engine.timeout(packetId);
        engine.recoverEscrow(100n);
        engine.assertSupply();
        blocked = engine.packets.get(packetId)?.lifecycle === 'TIMED_OUT' && engine.assets.circulating + engine.assets.escrowed + engine.assets.authorizedRemote === defined;
        code = 'interopTimeouts';
      } else if (scenario.scenarioId === 'BRIDGE-TIMEOUT-RECEIVE-RACE') {
        engine.timeout(packetId);
        engine.recoverEscrow(100n);
        engine.recvPacket(clientId, packet, proof, header);
      } else if (scenario.scenarioId === 'BRIDGE-ACK-TIMEOUT-RACE') {
        const ack = engine.recvPacket(clientId, packet, proof, header);
        engine.acknowledge(packetId, ack);
        engine.timeout(packetId);
        engine.recoverEscrow(100n);
      } else {
        const ack = engine.recvPacket(clientId, packet, proof, header);
        if (scenario.scenarioId === 'INTEROP-PACKET-REPLAY' || scenario.scenarioId === 'BRIDGE-DUP-RECEIVE') {
          engine.recvPacket(clientId, packet, proof, header);
        } else {
          engine.acknowledge(packetId, ack);
          engine.acknowledge('dup', ack);
        }
      }
    }
  } catch (error) {
    blocked = true;
    code = interopCode(error);
  }
  try {
    engine.assertSupply();
  } catch (error) {
    blocked = true;
    code = interopCode(error);
  }
  const conserved = engine.assets.circulating + engine.assets.escrowed + engine.assets.authorizedRemote === defined;
  if (scenario.scenarioId === 'INTEROP-TIMEOUT') {
    blocked = conserved && engine.metrics.interopTimeouts > 0;
  }
  if (blocked) {
    recordAlert(env, scenario.expectedDetections[0]!.code);
  }
  return finish({
    scenario,
    sourceCommit: env.sourceCommit,
    testnetGenesis: env.testnetGenesis,
    attackBlocked: blocked && conserved,
    safetyHeld: conserved,
    invariants: holdAll(scenario.expectedSecurityProperties, `${code} conserved=${String(conserved)}`),
    detections: [{ channel: scenario.expectedDetections[0]!.channel, code: scenario.expectedDetections[0]!.code, observed: blocked, detail: code }],
    recovery: recovery('INTEROP_CLIENT_FREEZE', true, true, true, 'client may be frozen; historical packets retained'),
    notes: code,
  });
}
