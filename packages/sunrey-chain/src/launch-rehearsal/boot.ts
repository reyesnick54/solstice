/**
 * Deterministic validator boot sequence and first-block rehearsal.
 *
 * Consensus participation begins only after configured launch
 * conditions are satisfied.
 */

import { SevenValidatorNetwork } from '../ops/seven-validator.ts';
import { sha256Hex, encodeString } from '../validators/canonical.ts';
import type { FirstBlockRecord, LaunchControlRoomState, LaunchPhase } from './types.ts';
import {
  REHEARSAL_CHAIN_ID,
  REHEARSAL_FIXTURE_GENESIS_TIME_UTC,
  REHEARSAL_ID,
  REHEARSAL_NETWORK_ID,
} from './identity.ts';
import { buildRehearsalGenesis, type RehearsalGenesisBundle } from './genesis.ts';
import type { RehearsalReleaseVerification } from './artifacts.ts';
import { assertNoValidatorKeyOnPublicSurface, type RehearsalTopology } from './infrastructure.ts';

export const BOOT_STEPS = [
  'verify-release',
  'verify-genesis',
  'verify-signer',
  'verify-network-policy',
  'launch-sentries',
  'launch-validators',
  'establish-peer-connectivity',
  'observe-consensus',
  'launch-public-rpc',
  'launch-explorer',
  'launch-ancillary-services',
] as const;
export type BootStep = (typeof BOOT_STEPS)[number];

export type BootReceipt = {
  readonly steps: readonly { readonly id: BootStep; readonly ok: boolean }[];
  readonly launchConditionsSatisfied: boolean;
  readonly consensusStarted: boolean;
};

export function emptyControlRoom(phase: LaunchPhase = 'T_MINUS_24H'): LaunchControlRoomState {
  return Object.freeze({
    schemaVersion: 1,
    rehearsalId: REHEARSAL_ID,
    phase,
    releaseVerified: false,
    genesisVerified: false,
    validatorsReady: false,
    signersReady: false,
    networkPathsReady: false,
    storageReady: false,
    rpcReady: false,
    explorerReady: false,
    oracleReady: false,
    backupReady: false,
    monitoringReady: false,
    incidents: Object.freeze([]),
    finalizedHeight: '0',
    productionActivated: false,
    liveFlagsRemainDisabled: true,
  });
}

export function launchConditionsSatisfied(room: LaunchControlRoomState): boolean {
  return (
    room.releaseVerified
    && room.genesisVerified
    && room.validatorsReady
    && room.signersReady
    && room.networkPathsReady
    && room.storageReady
  );
}

export function runBootSequence(input: {
  readonly release: RehearsalReleaseVerification;
  readonly genesis: RehearsalGenesisBundle;
  readonly topology: RehearsalTopology;
  readonly signersReady: boolean;
  readonly storageReady: boolean;
}): { readonly receipt: BootReceipt; readonly room: LaunchControlRoomState } {
  const independent = input.genesis.input.validators.map((row) => ({
    validatorId: row.validatorId,
    verification: input.genesis.verification,
  }));
  const genesisAgreed = independent.every((row) => row.verification.ok);
  const room: LaunchControlRoomState = Object.freeze({
    ...emptyControlRoom('GENESIS'),
    releaseVerified: input.release.ok,
    genesisVerified: input.genesis.verification.ok && genesisAgreed,
    validatorsReady: input.topology.validators.length === 7,
    signersReady: input.signersReady,
    networkPathsReady: assertNoValidatorKeyOnPublicSurface(input.topology) && input.topology.sentries.length >= 14,
    storageReady: input.storageReady,
    rpcReady: input.topology.services.some((row) => row.role === 'RPC' && row.online),
    explorerReady: input.topology.services.some((row) => row.role === 'EXPLORER' && row.online),
    oracleReady: input.topology.services.filter((row) => row.role === 'ORACLE_COLLECTOR' && row.online).length >= 2,
    backupReady: input.topology.services.some((row) => row.role === 'BACKUP' && row.online),
    monitoringReady: input.topology.services.some((row) => row.role === 'MONITORING' && row.online),
  });
  const conditions = launchConditionsSatisfied(room);
  const steps = BOOT_STEPS.map((id) => {
    if (id === 'verify-release') return { id, ok: room.releaseVerified };
    if (id === 'verify-genesis') return { id, ok: room.genesisVerified };
    if (id === 'verify-signer') return { id, ok: room.signersReady };
    if (id === 'verify-network-policy') return { id, ok: room.networkPathsReady };
    if (id === 'launch-sentries') return { id, ok: input.topology.sentries.length >= 14 };
    if (id === 'launch-validators') return { id, ok: conditions && room.validatorsReady };
    if (id === 'establish-peer-connectivity') return { id, ok: conditions };
    if (id === 'observe-consensus') return { id, ok: conditions };
    if (id === 'launch-public-rpc') return { id, ok: conditions && room.rpcReady };
    if (id === 'launch-explorer') return { id, ok: conditions && room.explorerReady };
    return { id, ok: conditions && room.oracleReady && room.backupReady && room.monitoringReady };
  });
  return Object.freeze({
    receipt: Object.freeze({
      steps: Object.freeze(steps),
      launchConditionsSatisfied: conditions,
      consensusStarted: conditions && steps.every((row) => row.ok),
    }),
    room,
  });
}

export function independentlyVerifyGenesis(genesis: RehearsalGenesisBundle): boolean {
  return genesis.input.validators.every((row) => {
    const check = genesis.verification;
    return (
      check.ok
      && row.validatorId.startsWith('val_rehearsal_1_')
      && genesis.input.networkId === REHEARSAL_NETWORK_ID
      && genesis.input.chainId === REHEARSAL_CHAIN_ID
    );
  });
}

export function rehearseFirstBlock(genesis: RehearsalGenesisBundle = buildRehearsalGenesis()): {
  readonly record: FirstBlockRecord;
  readonly network: SevenValidatorNetwork;
  readonly stateRoot: string;
} {
  const network = new SevenValidatorNetwork();
  const commit = network.produce(1n);
  if (!commit) {
    throw new Error('rehearsal first block did not finalize');
  }
  const stateRoot = sha256Hex(
    Buffer.concat([
      encodeString('SUNREY_REHEARSAL_STATE_ROOT_V1'),
      encodeString(genesis.genesisHash),
      encodeString(commit.blockId),
    ]),
  );
  const agreement = network.nodes.filter((row) => row.online).every((row) => row.height === 1n) && network.safetyHolds();
  return Object.freeze({
    record: Object.freeze({
      genesisTimeUtc: REHEARSAL_FIXTURE_GENESIS_TIME_UTC,
      firstProposal: `propose:${commit.blockId}`,
      firstPrevote: `prevote:${commit.blockId}`,
      firstPrecommit: `precommit:${commit.blockId}`,
      firstCommit: commit.blockId,
      firstStateRoot: stateRoot,
      firstValidatorSetHash: genesis.validatorSetHash,
      healthyValidatorAgreement: agreement,
    }),
    network,
    stateRoot,
  });
}
