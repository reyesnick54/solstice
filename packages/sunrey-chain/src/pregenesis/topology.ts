/**
 * Candidate V2 production-like topology instantiated with shadow identities.
 *
 * 7 validators, sentries, remote signers, RPC, Explorer, monitoring,
 * backup, oracle collectors, database, Exchange/custody sandbox.
 */

import { SERVICE_ROLES } from '../mainnet/candidate-v2/types.ts';
import { sevenShadowValidators, type PregenesisValidatorPublic } from './genesis.ts';
import { PREGENESIS_CHAIN_ID, PREGENESIS_NETWORK_ID } from './identity.ts';

export type ShadowTopologyNode = {
  readonly nodeId: string;
  readonly role: (typeof SERVICE_ROLES)[number] | 'remote_signer';
  readonly failureDomain: string;
  readonly pairedValidatorId: string | null;
  readonly canSign: boolean;
  readonly sandboxOnly: boolean;
};

export type ShadowTopology = {
  readonly networkId: typeof PREGENESIS_NETWORK_ID;
  readonly chainId: typeof PREGENESIS_CHAIN_ID;
  readonly validators: readonly ShadowTopologyNode[];
  readonly sentries: readonly ShadowTopologyNode[];
  readonly remoteSigners: readonly ShadowTopologyNode[];
  readonly rpc: readonly ShadowTopologyNode[];
  readonly explorer: readonly ShadowTopologyNode[];
  readonly monitoring: readonly ShadowTopologyNode[];
  readonly backup: readonly ShadowTopologyNode[];
  readonly oracleCollectors: readonly ShadowTopologyNode[];
  readonly database: readonly ShadowTopologyNode[];
  readonly exchangeSandbox: readonly ShadowTopologyNode[];
  readonly custodySandbox: readonly ShadowTopologyNode[];
  readonly failureDomains: readonly string[];
};

function domainFor(index: number): string {
  return `fd_pregenesis_${['alpha', 'bravo', 'charlie'][index % 3]}`;
}

function node(
  nodeId: string,
  role: ShadowTopologyNode['role'],
  index: number,
  pairedValidatorId: string | null,
  canSign: boolean,
  sandboxOnly: boolean,
): ShadowTopologyNode {
  return Object.freeze({
    nodeId,
    role,
    failureDomain: domainFor(index),
    pairedValidatorId,
    canSign,
    sandboxOnly,
  });
}

export function shadowTopology(validators: readonly PregenesisValidatorPublic[] = sevenShadowValidators()): ShadowTopology {
  const validatorNodes = validators.map((row, index) =>
    node(row.validatorId, 'validator', index, row.validatorId, false, false),
  );
  const sentries = validators.map((row, index) =>
    node(`sentry_${row.validatorId}`, 'sentry', index, row.validatorId, false, false),
  );
  const remoteSigners = validators.map((row, index) =>
    node(`signer_${row.validatorId}`, 'remote_signer', index, row.validatorId, true, false),
  );
  return Object.freeze({
    networkId: PREGENESIS_NETWORK_ID,
    chainId: PREGENESIS_CHAIN_ID,
    validators: Object.freeze(validatorNodes),
    sentries: Object.freeze(sentries),
    remoteSigners: Object.freeze(remoteSigners),
    rpc: Object.freeze([node('rpc_pregenesis_1', 'rpc', 0, null, false, false)]),
    explorer: Object.freeze([node('explorer_pregenesis_1', 'explorer', 1, null, false, false)]),
    monitoring: Object.freeze([node('monitoring_pregenesis_1', 'monitoring', 2, null, false, false)]),
    backup: Object.freeze([node('backup_pregenesis_1', 'backup', 0, null, false, false)]),
    oracleCollectors: Object.freeze([node('oracle_pregenesis_1', 'oracle_collector', 1, null, false, true)]),
    database: Object.freeze([node('database_pregenesis_1', 'database', 2, null, false, false)]),
    exchangeSandbox: Object.freeze([node('exchange_sandbox_pregenesis_1', 'exchange', 0, null, false, true)]),
    custodySandbox: Object.freeze([node('custody_sandbox_pregenesis_1', 'custody', 1, null, false, true)]),
    failureDomains: Object.freeze(['fd_pregenesis_alpha', 'fd_pregenesis_bravo', 'fd_pregenesis_charlie']),
  });
}

export function topologyCounts(topology: ShadowTopology = shadowTopology()) {
  return Object.freeze({
    validators: 7 as const,
    sentries: topology.sentries.length,
    remoteSigners: topology.remoteSigners.length,
    rpc: topology.rpc.length,
    explorer: topology.explorer.length,
    monitoring: topology.monitoring.length,
    backup: topology.backup.length,
    oracleCollectors: topology.oracleCollectors.length,
    database: topology.database.length,
    exchangeSandbox: topology.exchangeSandbox.length,
    custodySandbox: topology.custodySandbox.length,
  });
}
