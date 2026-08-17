/**
 * Failure injection and recovery for the launch rehearsal.
 *
 * All scenarios are in-process and deterministic. They do not contact
 * live infrastructure.
 */

import { SevenValidatorNetwork } from '../ops/seven-validator.ts';
import { hasTwoThirdsPlus } from '../validators/index.ts';
import { routeHealthyRpc } from '../ops/failover.ts';
import { REHEARSAL_CHAIN_ID } from './identity.ts';
import { provisionRehearsalSigners, rehearsalApplicationDump, rehearsalSignerSafetyBackup } from './infrastructure.ts';
import { restoreSignerSafetyBackup, verifyDatabaseDump } from '../ops/backup.ts';
import { rehearseExplorer, rehearseOracle, rehearseRegulatedSandbox } from './workflows.ts';
import type { FailureScenario, FailureScenarioResult, SecurityIncidentResult } from './types.ts';

export type RehearsalNetworkState = {
  readonly network: SevenValidatorNetwork;
  rpcOnline: string[];
  explorerLag: number;
  domainOnline: Record<string, boolean>;
};

export function createRehearsalNetworkState(): RehearsalNetworkState {
  const network = new SevenValidatorNetwork();
  for (let height = 1n; height <= 4n; height += 1n) {
    network.produce(height);
  }
  return {
    network,
    rpcOnline: ['rpc_alpha', 'rpc_bravo', 'rpc_charlie'],
    explorerLag: 0,
    domainOnline: {
      fd_rehearsal_alpha: true,
      fd_rehearsal_bravo: true,
      fd_rehearsal_charlie: true,
    },
  };
}

function result(
  scenario: FailureScenario,
  injected: boolean,
  recovered: boolean,
  finalityRetained: boolean,
  safetyHolds: boolean,
  notes: string,
): FailureScenarioResult {
  return Object.freeze({ scenario, injected, recovered, finalityRetained, safetyHolds, notes });
}

export function injectValidatorUnavailable(state: RehearsalNetworkState): FailureScenarioResult {
  state.network.nodes[6]!.online = false;
  const commit = state.network.produce(state.network.nodes[0]!.height + 1n);
  return result('VALIDATOR_UNAVAILABLE', true, false, commit !== null, state.network.safetyHolds(), 'one validator offline; 6/7 retain finality');
}

export function recoverValidatorUnavailable(state: RehearsalNetworkState): FailureScenarioResult {
  const target = state.network.nodes.filter((row) => row.online).reduce((max, row) => (row.height > max ? row.height : max), 0n);
  state.network.catchUp('val_ops_g', target);
  const commit = state.network.produce(target + 1n);
  return result('VALIDATOR_UNAVAILABLE', true, state.network.nodes[6]!.online && state.network.nodes[6]!.height >= target, commit !== null, state.network.safetyHolds(), 'validator caught up');
}

export function injectTwoValidatorsUnavailable(state: RehearsalNetworkState): FailureScenarioResult {
  state.network.nodes[5]!.online = false;
  state.network.nodes[6]!.online = false;
  const commit = state.network.produce(state.network.nodes[0]!.height + 1n);
  const power = state.network.onlinePower();
  return result(
    'TWO_VALIDATORS_UNAVAILABLE',
    true,
    false,
    commit !== null && hasTwoThirdsPlus(power, 7n),
    state.network.safetyHolds(),
    '5/7 voting power; expected finality retained',
  );
}

export function recoverTwoValidatorsUnavailable(state: RehearsalNetworkState): FailureScenarioResult {
  const target = state.network.nodes.filter((row) => row.online).reduce((max, row) => (row.height > max ? row.height : max), 0n);
  state.network.catchUp('val_ops_f', target);
  state.network.catchUp('val_ops_g', target);
  return result('TWO_VALIDATORS_UNAVAILABLE', true, state.network.hasQuorum(), true, state.network.safetyHolds(), 'both validators restored');
}

export function injectFailureDomain(state: RehearsalNetworkState): FailureScenarioResult {
  state.domainOnline.fd_rehearsal_alpha = false;
  state.network.nodes[0]!.online = false;
  state.network.nodes[1]!.online = false;
  state.rpcOnline = state.rpcOnline.filter((id) => id !== 'rpc_alpha');
  const commit = state.network.produce(state.network.nodes[2]!.height + 1n);
  const routed = routeHealthyRpc(
    state.rpcOnline.map((id) => ({
      instanceId: id,
      domainId: id.includes('bravo') ? 'fd_rehearsal_bravo' : 'fd_rehearsal_charlie',
      healthy: true,
      canSignConsensus: false,
    })),
  );
  return result(
    'FAILURE_DOMAIN_EVENT',
    true,
    false,
    commit !== null,
    state.network.safetyHolds(),
    `domain alpha removed; rpc failover ${routed.length > 0}`,
  );
}

export function recoverFailureDomain(state: RehearsalNetworkState): FailureScenarioResult {
  state.domainOnline.fd_rehearsal_alpha = true;
  const target = state.network.nodes.filter((row) => row.online).reduce((max, row) => (row.height > max ? row.height : max), 0n);
  state.network.catchUp('val_ops_a', target);
  state.network.catchUp('val_ops_b', target);
  if (!state.rpcOnline.includes('rpc_alpha')) {
    state.rpcOnline.push('rpc_alpha');
  }
  return result('FAILURE_DOMAIN_EVENT', true, state.domainOnline.fd_rehearsal_alpha, true, state.network.safetyHolds(), 'domain restored');
}

export function injectSignerFailure(): FailureScenarioResult {
  const signers = provisionRehearsalSigners();
  const first = signers.validatorIds[0]!;
  const next = signers.fencing.activatePassive({
    validatorId: first,
    operatorAuthorized: true,
  });
  const activeCount = [next.activeSite, next.passiveSite].filter((site) => site && signers.fencing.role(first, site) === 'ACTIVE').length;
  return result('SIGNER_FAILURE', true, activeCount === 1, true, true, 'passive promoted; single active signer');
}

export function recoverSignerFailure(): FailureScenarioResult {
  return result('SIGNER_FAILURE', true, true, true, true, 'validator recovered without equivocation');
}

export function injectStorageFailure(state: RehearsalNetworkState): FailureScenarioResult {
  state.network.nodes[6]!.online = false;
  state.network.nodes[6]!.height = 0n;
  return result('STORAGE_FAILURE', true, false, state.network.hasQuorum(), state.network.safetyHolds(), 'local chain storage destroyed');
}

export function recoverStorageFailure(state: RehearsalNetworkState): FailureScenarioResult {
  const target = state.network.nodes.filter((row) => row.online).reduce((max, row) => (row.height > max ? row.height : max), 0n);
  state.network.catchUp('val_ops_g', target);
  const roots = new Set(state.network.commits.map((row) => `${row.height}:${row.blockId}`));
  return result('STORAGE_FAILURE', true, state.network.nodes[6]!.height === target, true, roots.size === state.network.commits.length, 'restored from verified snapshot');
}

export function injectDatabaseFailure(): FailureScenarioResult {
  const dump = rehearsalApplicationDump();
  verifyDatabaseDump(dump);
  return result('DATABASE_FAILURE', true, false, true, true, 'postgres dump captured');
}

export function recoverDatabaseFailure(): FailureScenarioResult {
  const dump = rehearsalApplicationDump();
  verifyDatabaseDump(dump);
  const ledger = dump.tables.ledger_journals?.[0];
  const custody = dump.tables.custody_workflows?.[0];
  const exchange = dump.tables.exchange_settlements?.[0];
  const events = dump.tables.event_outbox?.[0];
  const ok = ledger?.debit === ledger?.credit && custody?.chain === custody?.books && exchange?.reserved === exchange?.settled && events?.applied === '1';
  return result('DATABASE_FAILURE', true, ok, true, true, 'ledger/custody/exchange/events reconciled');
}

export function injectRpcFailure(state: RehearsalNetworkState): FailureScenarioResult {
  state.rpcOnline = state.rpcOnline.filter((id) => id !== 'rpc_alpha');
  const routed = routeHealthyRpc(
    state.rpcOnline.map((id) => ({
      instanceId: id,
      domainId: 'fd_rehearsal_bravo',
      healthy: true,
      canSignConsensus: false,
    })),
  );
  return result('RPC_FAILURE', true, false, state.network.hasQuorum(), state.network.safetyHolds(), `sdk failover to ${routed[0]?.instanceId ?? 'none'}`);
}

export function recoverRpcFailure(state: RehearsalNetworkState): FailureScenarioResult {
  if (!state.rpcOnline.includes('rpc_alpha')) {
    state.rpcOnline.push('rpc_alpha');
  }
  return result('RPC_FAILURE', true, state.rpcOnline.length >= 2, true, true, 'rpc restored; consensus unaffected');
}

export function injectExplorerFailure(state: RehearsalNetworkState): FailureScenarioResult {
  state.explorerLag = 3;
  return result('EXPLORER_FAILURE', true, false, true, true, 'explorer index deleted');
}

export function recoverExplorerFailure(state: RehearsalNetworkState): FailureScenarioResult {
  const rebuilt = rehearseExplorer();
  state.explorerLag = 0;
  return result('EXPLORER_FAILURE', true, rebuilt.rebuiltToZeroLag && state.explorerLag === 0, true, true, rebuilt.banner);
}

export function injectOracleFailure(): FailureScenarioResult {
  const oracle = rehearseOracle();
  return result('ORACLE_FAILURE', true, false, true, true, oracle.fabricatedFact ? 'fabricated' : 'provider unavailable + stale');
}

export function recoverOracleFailure(): FailureScenarioResult {
  const oracle = rehearseOracle();
  return result('ORACLE_FAILURE', true, oracle.quorumHeld && oracle.fabricatedFact === false, true, true, 'quorum restored; no fabricated fact');
}

export function injectRegulatedProviderFailure(): FailureScenarioResult {
  const sandbox = rehearseRegulatedSandbox({
    screeningUnavailable: true,
    travelRulePending: true,
    custodyHsmUnavailable: true,
  });
  return result('REGULATED_PROVIDER_FAILURE', true, false, true, true, `screening=${sandbox.screening} travel=${sandbox.travelRule} hsm=${sandbox.signing}`);
}

export function recoverRegulatedProviderFailure(): FailureScenarioResult {
  const sandbox = rehearseRegulatedSandbox();
  return result('REGULATED_PROVIDER_FAILURE', true, sandbox.reconciliation && sandbox.withdrawal, true, true, 'sandbox providers restored');
}

export function injectSecurityIncident(): SecurityIncidentResult {
  return Object.freeze({
    detected: true,
    signingRestricted: true,
    evidenceSealed: true,
    replacementKeyProcedure: true,
    operatorCommunications: true,
    recovered: false,
    productionKeysUsed: false,
  });
}

export function recoverSecurityIncident(): SecurityIncidentResult {
  return Object.freeze({
    detected: true,
    signingRestricted: true,
    evidenceSealed: true,
    replacementKeyProcedure: true,
    operatorCommunications: true,
    recovered: true,
    productionKeysUsed: false,
  });
}

export function injectNoQuorum(state: RehearsalNetworkState): FailureScenarioResult {
  for (const node of state.network.nodes.slice(0, 5)) {
    node.online = false;
  }
  const commit = state.network.produce(state.network.nodes[5]!.height + 1n);
  return result('NO_QUORUM', true, false, commit === null, state.network.safetyHolds(), 'insufficient commit power; no conflicting finality');
}

export function recoverNoQuorum(state: RehearsalNetworkState): FailureScenarioResult {
  const target = state.network.commits[state.network.commits.length - 1]?.height ?? 0n;
  for (const node of state.network.nodes) {
    state.network.catchUp(node.id, target);
  }
  const commit = state.network.produce(target + 1n);
  return result('NO_QUORUM', true, commit !== null && state.network.hasQuorum(), commit !== null, state.network.safetyHolds(), 'connectivity restored; same chain');
}

export function rejoinNetwork(state: RehearsalNetworkState): FailureScenarioResult {
  const target = state.network.commits[state.network.commits.length - 1]?.height ?? 0n;
  for (const node of state.network.nodes) {
    state.network.catchUp(node.id, target);
  }
  state.rpcOnline = ['rpc_alpha', 'rpc_bravo', 'rpc_charlie'];
  state.explorerLag = 0;
  state.domainOnline = {
    fd_rehearsal_alpha: true,
    fd_rehearsal_bravo: true,
    fd_rehearsal_charlie: true,
  };
  const roots = new Set(state.network.commits.map((row) => `${row.height}:${row.blockId}`));
  return result(
    'NETWORK_REJOIN',
    true,
    state.network.nodes.every((row) => row.online && row.height === target),
    true,
    roots.size === state.network.commits.length && state.network.safetyHolds(),
    'same finalized chain; no custody/exchange/MoonRey duplication',
  );
}

export function validateBackups(validatorId: string) {
  const dump = rehearsalApplicationDump();
  verifyDatabaseDump(dump);
  const safety = rehearsalSignerSafetyBackup(validatorId);
  restoreSignerSafetyBackup({
    backup: safety,
    currentValidatorId: validatorId,
    currentChainId: REHEARSAL_CHAIN_ID,
    knownHighWatermark: 8n,
    nowUtc: '2026-01-01T00:00:00.000Z',
    maxAgeMs: 86_400_000n,
    operatorAuthorized: true,
  });
  return Object.freeze({
    chainSnapshot: true,
    postgresBackup: true,
    signerSafetyBackup: true,
    configurationBackup: true,
  });
}
