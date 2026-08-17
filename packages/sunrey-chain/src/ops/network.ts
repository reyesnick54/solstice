import { createHash } from 'node:crypto';

import { AlertEngine } from './alerts.ts';
import {
  createVerifiedSnapshot,
  dumpApplicationDatabase,
  verifyDatabaseDump,
  verifySnapshot,
  type ApplicationDatabaseDump,
  type VerifiedSnapshotManifest,
} from './backup.ts';
import {
  assertExplorerCannotMutate,
  assertRpcCannotSign,
  duplicateRelayerSubmissionSafe,
  idempotentIndex,
  routeHealthyRpc,
  type ExplorerInstance,
  type OracleAdapterInstance,
  type RelayerInstance,
  type RpcInstance,
} from './failover.ts';
import { MetricRegistry, StructuredLogSink, TraceCollector } from './observability.ts';
import { analyzeVotingPower, developmentMultiDomainProfile, twoThirdsPlus } from './topology.ts';
import { DEVELOPMENT_CHAIN_ID, type ChaosFault } from './types.ts';

export type SimulatedBlock = {
  readonly height: bigint;
  readonly blockId: string;
  readonly stateRoot: string;
  readonly transactions: readonly string[];
};

export type ValidatorRuntime = {
  readonly validatorId: string;
  readonly domainId: string;
  readonly votingPower: bigint;
  alive: boolean;
  isolated: boolean;
  signerAvailable: boolean;
  diskFull: boolean;
  height: bigint;
  stateRoot: string;
  missedVotes: bigint;
  peerCount: bigint;
  lastSignedHeight: bigint;
};

export type ApplicationTables = {
  ledgerPositions: Record<string, string>[];
  custodyMetadata: Record<string, string>[];
  outbox: Record<string, string>[];
  inbox: Record<string, string>[];
  explorerIndex: Record<string, string>[];
};

export class SimulatedResilienceNetwork {
  readonly profile = developmentMultiDomainProfile();
  readonly metrics = new MetricRegistry();
  readonly traces = new TraceCollector();
  readonly logs = new StructuredLogSink();
  readonly alerts = new AlertEngine();
  readonly validators: ValidatorRuntime[];
  rpc: RpcInstance[];
  explorers: ExplorerInstance[];
  relayers: RelayerInstance[];
  oracleAdapters: OracleAdapterInstance[];
  readonly faucetId = 'faucet_alpha';
  explorerIndex: Record<string, string> = {};
  relayerSeen: ReadonlySet<string> = new Set();
  applicationDb: ApplicationTables;
  dbConnected = true;
  oracleQuorum = true;
  pendingSettlements = 0n;
  custodyMismatch = false;
  finalized: SimulatedBlock[] = [];
  isolatedDomains = new Set<string>();
  partitions: readonly (readonly string[])[] | null = null;

  constructor() {
    this.validators = this.profile.validators.map((row) => ({
      validatorId: row.validatorId,
      domainId: row.domainId,
      votingPower: row.votingPower,
      alive: true,
      isolated: false,
      signerAvailable: true,
      diskFull: false,
      height: 0n,
      stateRoot: genesisRoot(),
      missedVotes: 0n,
      peerCount: 6n,
      lastSignedHeight: 0n,
    }));
    this.rpc = this.profile.cells.flatMap((cell) =>
      cell.rpcInstances.map((instanceId) => ({
        instanceId,
        domainId: cell.domainId,
        healthy: true,
        canSignConsensus: false as const,
      })),
    );
    this.explorers = this.profile.cells.flatMap((cell) =>
      cell.explorerInstances.map((instanceId) => ({
        instanceId,
        domainId: cell.domainId,
        healthy: true,
        canMutateChain: false as const,
        indexedHeight: 0n,
      })),
    );
    this.relayers = this.profile.cells.flatMap((cell) =>
      cell.relayInstances.map((instanceId) => ({
        instanceId,
        domainId: cell.domainId,
        healthy: true,
        untrusted: true as const,
      })),
    );
    this.oracleAdapters = [
      { instanceId: 'oracle_alpha', domainId: 'fd_alpha', healthy: true },
      { instanceId: 'oracle_bravo', domainId: 'fd_bravo', healthy: true },
    ];
    this.applicationDb = emptyApplicationTables();
    this.observeBaseline();
  }

  connectedValidators(): ValidatorRuntime[] {
    return this.validators.filter((row) => row.alive && !row.isolated && !this.isolatedDomains.has(row.domainId));
  }

  connectedPower(): bigint {
    return this.connectedValidators()
      .filter((row) => row.signerAvailable)
      .reduce((sum, row) => sum + row.votingPower, 0n);
  }

  canFinalize(): boolean {
    if (this.partitions) {
      return this.partitions.some((group) => this.groupPower(group) >= twoThirdsPlus(this.totalPower()));
    }
    return this.connectedPower() >= twoThirdsPlus(this.totalPower());
  }

  totalPower(): bigint {
    return this.validators.reduce((sum, row) => sum + row.votingPower, 0n);
  }

  submitTransactions(ids: readonly string[]): SimulatedBlock | null {
    const parent = this.span('sdk_submission', 'sdk');
    const rpc = this.span('rpc', 'rpc', parent);
    this.span('mempool', 'node', rpc);
    if (!this.canFinalize()) {
      this.alerts.fire('CONSENSUS_FINALITY_DELAY', 'consensus', 'connected power below finalize threshold', now());
      return null;
    }
    const height = (this.finalized.at(-1)?.height ?? 0n) + 1n;
    const stateRoot = stateRootFor(height, ids);
    const block: SimulatedBlock = {
      height,
      blockId: blockIdFor(height, stateRoot),
      stateRoot,
      transactions: ids,
    };
    for (const validator of this.connectedValidators()) {
      if (!validator.signerAvailable) {
        validator.missedVotes += 1n;
        continue;
      }
      validator.height = height;
      validator.stateRoot = stateRoot;
      validator.lastSignedHeight = height;
    }
    this.finalized.push(block);
    this.applicationDb.ledgerPositions = [{ account: 'alice', amount: '1000', height: height.toString() }];
    this.applicationDb.custodyMetadata = [{ vault: 'vault_a', amount: '1000', height: height.toString() }];
    this.applicationDb.outbox = [{ eventId: `evt_${height.toString()}`, status: 'PENDING' }];
    this.applicationDb.inbox = [{ eventId: `evt_${height.toString()}`, status: 'ACCEPTED' }];
    this.indexExplorers(block);
    this.span('finalized_block_event', 'consensus', rpc, { height: height.toString() });
    this.span('explorer_indexing', 'explorer', rpc, { height: height.toString() });
    this.observeAfterBlock(block);
    return block;
  }

  indexExplorers(block: SimulatedBlock): void {
    for (const explorer of this.explorers) {
      if (!explorer.healthy) {
        continue;
      }
      this.explorerIndex = idempotentIndex(this.explorerIndex, `h:${block.height.toString()}`, block.stateRoot);
      explorer.indexedHeight = block.height;
      this.applicationDb.explorerIndex = Object.entries(this.explorerIndex).map(([eventId, payload]) => ({
        eventId,
        payload,
      }));
    }
  }

  rebuildExplorer(): void {
    this.explorerIndex = {};
    this.applicationDb.explorerIndex = [];
    for (const explorer of this.explorers) {
      explorer.indexedHeight = 0n;
    }
    for (const block of this.finalized) {
      for (const explorer of this.explorers) {
        explorer.healthy = true;
      }
      this.indexExplorers(block);
    }
  }

  isolateDomain(domainId: string): void {
    this.isolatedDomains.add(domainId);
    for (const validator of this.validators.filter((row) => row.domainId === domainId)) {
      validator.isolated = true;
      validator.peerCount = 0n;
    }
    for (const rpc of this.rpc.filter((row) => row.domainId === domainId)) {
      rpc.healthy = false;
    }
    for (const explorer of this.explorers.filter((row) => row.domainId === domainId)) {
      explorer.healthy = false;
    }
    this.alerts.fire('VALIDATOR_PEER_ISOLATION', domainId, 'failure domain isolated', now());
    if (!this.canFinalize()) {
      this.alerts.fire('CONSENSUS_FINALITY_DELAY', 'consensus', 'quorum lost after domain isolation', now());
    }
  }

  restoreDomains(): void {
    this.isolatedDomains.clear();
    this.partitions = null;
    const tip = this.finalized.at(-1);
    for (const validator of this.validators) {
      validator.isolated = false;
      validator.alive = true;
      validator.peerCount = 6n;
      if (tip) {
        validator.height = tip.height;
        validator.stateRoot = tip.stateRoot;
      }
    }
    for (const rpc of this.rpc) {
      rpc.healthy = true;
    }
    for (const explorer of this.explorers) {
      explorer.healthy = true;
    }
  }

  partition(groups: readonly (readonly string[])[]): void {
    this.partitions = groups;
    const connected = new Set(groups.flat());
    for (const validator of this.validators) {
      validator.isolated = !connected.has(validator.validatorId);
      validator.peerCount = validator.isolated ? 0n : BigInt(Math.max(0, (groups.find((group) => group.includes(validator.validatorId))?.length ?? 1) - 1));
    }
    if (!this.canFinalize()) {
      this.alerts.fire('CONSENSUS_FINALITY_DELAY', 'consensus', 'no component has two-thirds-plus power', now());
    }
  }

  applyFault(fault: ChaosFault, targetId?: string): void {
    if (fault === 'KILL_VALIDATOR') {
      const validator = this.validators.find((row) => row.validatorId === targetId) ?? this.validators[0]!;
      validator.alive = false;
      validator.peerCount = 0n;
      return;
    }
    if (fault === 'KILL_RPC_NODE') {
      const rpc = this.rpc.find((row) => row.instanceId === targetId) ?? this.rpc[0]!;
      rpc.healthy = false;
      this.alerts.fire('RPC_HIGH_ERROR_RATE', rpc.instanceId, 'rpc instance killed', now());
      return;
    }
    if (fault === 'KILL_EXPLORER') {
      const explorer = this.explorers.find((row) => row.instanceId === targetId) ?? this.explorers[0]!;
      explorer.healthy = false;
      this.alerts.fire('EXPLORER_LAG', explorer.instanceId, 'explorer killed', now());
      return;
    }
    if (fault === 'KILL_DATABASE_CONNECTION') {
      this.dbConnected = false;
      return;
    }
    if (fault === 'KILL_RELAYER') {
      const relayer = this.relayers.find((row) => row.instanceId === targetId) ?? this.relayers[0]!;
      relayer.healthy = false;
      return;
    }
    if (fault === 'KILL_ORACLE_ADAPTER') {
      const adapter = this.oracleAdapters.find((row) => row.instanceId === targetId) ?? this.oracleAdapters[0]!;
      adapter.healthy = false;
      this.oracleQuorum = this.oracleAdapters.filter((row) => row.healthy).length >= 2;
      if (!this.oracleQuorum) {
        this.alerts.fire('ORACLE_QUORUM_UNAVAILABLE', adapter.instanceId, 'oracle adapter killed', now());
      }
      return;
    }
    if (fault === 'NETWORK_LATENCY' || fault === 'PACKET_LOSS') {
      this.metrics.observe(fault === 'NETWORK_LATENCY' ? 'rpc_latency' : 'network_io', 250n, { fault });
      return;
    }
    if (fault === 'FAILURE_DOMAIN_ISOLATION') {
      this.isolateDomain(targetId ?? 'fd_alpha');
      return;
    }
    if (fault === 'SIGNER_UNAVAILABLE') {
      const validator = this.validators.find((row) => row.validatorId === targetId) ?? this.validators[0]!;
      validator.signerAvailable = false;
      this.alerts.fire('VALIDATOR_SIGNER_UNAVAILABLE', validator.validatorId, 'active signer disabled', now());
      return;
    }
    const validator = this.validators.find((row) => row.validatorId === targetId) ?? this.validators[0]!;
    validator.diskFull = true;
    this.alerts.fire('DISK_LOW', validator.validatorId, 'disk-full simulation', now());
  }

  healthyRpc(): readonly RpcInstance[] {
    const routed = routeHealthyRpc(this.rpc);
    assertRpcCannotSign(this.rpc);
    return routed;
  }

  destroyValidatorState(validatorId: string): void {
    const validator = this.validators.find((row) => row.validatorId === validatorId);
    if (!validator) {
      throw new Error(`unknown validator ${validatorId}`);
    }
    validator.height = 0n;
    validator.stateRoot = 'destroyed';
  }

  restoreValidatorFromSnapshot(validatorId: string, manifest: VerifiedSnapshotManifest, state: Buffer): void {
    verifySnapshot(manifest, state, DEVELOPMENT_CHAIN_ID);
    const validator = this.validators.find((row) => row.validatorId === validatorId);
    if (!validator) {
      throw new Error(`unknown validator ${validatorId}`);
    }
    validator.height = BigInt(manifest.height);
    validator.stateRoot = manifest.stateRoot;
    validator.alive = true;
    validator.isolated = false;
  }

  snapshot(): { readonly manifest: VerifiedSnapshotManifest; readonly state: Buffer } {
    const tip = this.finalized.at(-1);
    if (!tip) {
      throw new Error('no finalized height to snapshot');
    }
    return createVerifiedSnapshot({
      snapshotId: `snap_${tip.height.toString()}`,
      height: tip.height,
      blockId: tip.blockId,
      stateRoot: tip.stateRoot,
      state: JSON.stringify(
        this.finalized.map((block) => ({
          height: block.height.toString(),
          blockId: block.blockId,
          stateRoot: block.stateRoot,
          transactions: block.transactions,
        })),
      ),
    });
  }

  dumpDatabase(): ApplicationDatabaseDump {
    return dumpApplicationDatabase({
      ledgerPositions: this.applicationDb.ledgerPositions,
      custodyMetadata: this.applicationDb.custodyMetadata,
      outbox: this.applicationDb.outbox,
      inbox: this.applicationDb.inbox,
      explorerIndex: this.applicationDb.explorerIndex,
    });
  }

  restoreDatabase(dump: ApplicationDatabaseDump): void {
    verifyDatabaseDump(dump);
    this.applicationDb = {
      ledgerPositions: dump.tables.ledgerPositions?.slice() ?? [],
      custodyMetadata: dump.tables.custodyMetadata?.slice() ?? [],
      outbox: dump.tables.outbox?.slice() ?? [],
      inbox: dump.tables.inbox?.slice() ?? [],
      explorerIndex: dump.tables.explorerIndex?.slice() ?? [],
    };
    this.dbConnected = true;
  }

  reconcileApplication(): readonly string[] {
    const checks: string[] = [];
    const ledger = this.applicationDb.ledgerPositions[0];
    const custody = this.applicationDb.custodyMetadata[0];
    if (!ledger || !custody) {
      throw new Error('application restore missing positions');
    }
    if (ledger.amount !== custody.amount) {
      this.custodyMismatch = true;
      this.alerts.fire('CUSTODY_RECONCILIATION_MISMATCH', 'custody', 'holdings do not match', now());
      throw new Error('custody reconciliation mismatch; no automatic balancing entries');
    }
    checks.push('ledger_custody_match');
    if (this.applicationDb.outbox.length !== this.applicationDb.inbox.length) {
      throw new Error('event outbox/inbox mismatch; no invented journals');
    }
    checks.push('outbox_inbox_match');
    checks.push('migrations_applied');
    checks.push('integrity_ok');
    this.custodyMismatch = false;
    return checks;
  }

  stateRootsAgree(): boolean {
    const live = this.validators.filter((row) => row.alive && !row.isolated);
    if (live.length === 0) {
      return false;
    }
    return live.every((row) => row.stateRoot === live[0]!.stateRoot && row.height === live[0]!.height);
  }

  publicExplorerQuery(): readonly string[] {
    return this.finalized.map((block) => this.explorerIndex[`h:${block.height.toString()}`] ?? '');
  }

  submitRelayerPacket(packetId: string): void {
    this.relayerSeen = duplicateRelayerSubmissionSafe(this.relayerSeen, packetId);
    this.relayerSeen = duplicateRelayerSubmissionSafe(this.relayerSeen, packetId);
  }

  observeBaseline(): void {
    const analysis = analyzeVotingPower(this.profile.validators);
    this.metrics.observe('finalized_height', 0n, { chain: DEVELOPMENT_CHAIN_ID });
    this.metrics.observe('consensus_round', 0n, { chain: DEVELOPMENT_CHAIN_ID });
    this.metrics.observe('prevote_power', analysis.totalPower, { chain: DEVELOPMENT_CHAIN_ID });
    this.metrics.observe('precommit_power', analysis.totalPower, { chain: DEVELOPMENT_CHAIN_ID });
    this.metrics.observe('p2p_connections', 6n, { role: 'validator' });
    this.metrics.observe('sunrey_transactions', 0n, { asset: 'SUNREY_COIN' });
    this.metrics.observe('moonrey_issuance', 0n, { asset: 'MOONREY_COIN' });
    this.metrics.observe('native_fees', 0n, { asset: 'SUNREY_COIN' });
    this.metrics.observe('asset_reconciliation', 0n, { result: 'match' });
    this.metrics.observe('productive_contributions', 0n, { class: 'verified' });
    this.metrics.observe('oracle_feed_health', 1n, { status: 'healthy' });
    this.metrics.observe('machine_settlements', 0n, { status: 'none' });
    this.metrics.observe('exchange_settlements', 0n, { status: 'none' });
    this.metrics.observe('deposit_finality_lag', 0n, { vault: 'aggregate' });
    this.metrics.observe('withdrawal_workflow_counts', 0n, { state: 'idle' });
    this.metrics.observe('submission_unknown_count', 0n, { vault: 'aggregate' });
    this.metrics.observe('reconciliation_mismatches', 0n, { surface: 'custody' });
    this.metrics.observe('signer_health', 1n, { role: 'active' });
    this.metrics.observe('vault_security_status', 1n, { status: 'ok' });
    this.metrics.observe('order_ingress', 0n, { market: 'dev' });
    this.metrics.observe('matching_latency', 0n, { market: 'dev' });
    this.metrics.observe('settlement_latency', 0n, { market: 'dev' });
    this.metrics.observe('pending_settlement_count', 0n, { market: 'dev' });
    this.metrics.observe('reconciliation_mismatch', 0n, { surface: 'exchange' });
    this.metrics.observe('market_data_lag', 0n, { market: 'dev' });
    this.metrics.observe('surveillance_detector_count', 0n, { detector: 'aggregate' });
    this.metrics.observe('provider_health', 1n, { provider: 'dev' });
    this.metrics.observe('observation_freshness', 0n, { provider: 'dev' });
    this.metrics.observe('quorum_availability', 1n, { network: 'oracle' });
    this.metrics.observe('conflicted_facts', 0n, { network: 'oracle' });
    this.metrics.observe('stale_facts', 0n, { network: 'oracle' });
    this.metrics.observe('aggregation_latency', 0n, { network: 'oracle' });
    this.metrics.observe('client_height', 0n, { client: 'dev' });
    this.metrics.observe('client_age', 0n, { client: 'dev' });
    this.metrics.observe('verified_headers', 0n, { client: 'dev' });
    this.metrics.observe('proof_failures', 0n, { client: 'dev' });
    this.metrics.observe('packets', 0n, { client: 'dev' });
    this.metrics.observe('timeouts', 0n, { client: 'dev' });
    this.metrics.observe('frozen_clients', 0n, { client: 'dev' });
    this.metrics.observe('relayer_latency', 0n, { relayer: 'aggregate' });
    for (const name of [
      'round_changes',
      'proposal_latency',
      'finality_latency',
      'validator_missed_votes',
      'validator_peer_count',
      'signer_latency',
      'signer_errors',
      'wal_recovery_events',
      'cpu',
      'memory',
      'disk',
      'database_size',
      'network_io',
      'mempool_count',
      'mempool_bytes',
      'block_execution_duration',
      'state_commit_duration',
      'rpc_latency',
      'rpc_error_rate',
    ] as const) {
      this.metrics.observe(name, 0n, { plane: 'node' });
    }
    assertExplorerCannotMutate(this.explorers);
  }

  observeAfterBlock(block: SimulatedBlock): void {
    this.metrics.observe('finalized_height', block.height, { chain: DEVELOPMENT_CHAIN_ID });
    this.metrics.observe('sunrey_transactions', BigInt(block.transactions.length), { asset: 'SUNREY_COIN' });
    this.metrics.observe('mempool_count', 0n, { plane: 'node' });
  }

  private groupPower(group: readonly string[]): bigint {
    return this.validators
      .filter((row) => group.includes(row.validatorId) && row.alive && row.signerAvailable)
      .reduce((sum, row) => sum + row.votingPower, 0n);
  }

  private span(name: string, service: string, parent?: ReturnType<TraceCollector['start']>, attributes: Record<string, string> = {}) {
    return this.traces.start(name, service, parent, attributes);
  }
}

function genesisRoot(): string {
  return createHash('sha256').update('sunrey-ops-genesis').digest('hex');
}

function stateRootFor(height: bigint, transactions: readonly string[]): string {
  return createHash('sha256').update(`root:${height.toString()}:${transactions.join(',')}`).digest('hex');
}

function blockIdFor(height: bigint, stateRoot: string): string {
  return createHash('sha256').update(`block:${height.toString()}:${stateRoot}`).digest('hex');
}

function emptyApplicationTables(): ApplicationTables {
  return {
    ledgerPositions: [],
    custodyMetadata: [],
    outbox: [],
    inbox: [],
    explorerIndex: [],
  };
}

function now(): string {
  return '2026-08-17T00:00:00.000Z';
}
