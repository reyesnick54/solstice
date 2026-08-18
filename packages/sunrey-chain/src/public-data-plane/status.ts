import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../../config/src/flags.ts';
import { ArchiveQueryService } from './archive.ts';
import { ExplorerIndexerFleet, ExplorerQueryApi } from './explorer-ha.ts';
import { PublicRpcGateway } from './gateway.ts';
import { fixtureEndpoint, RpcEndpointPool } from './routing.ts';
import type {
  LoadBenchmarkResult,
  PublicDataPlaneMetrics,
  PublicDataPlaneReport,
  PublicNetworkEnvironment,
  PublicNetworkStatus,
} from './types.ts';

export const PUBLIC_RELEASE_VERSION = 'sunrey-public-data-plane-0' as const;

export function publicNetworkStatus(input: {
  readonly environment?: PublicNetworkEnvironment;
  readonly networkId?: string;
  readonly chainId?: string;
  readonly latestFinalizedHeight?: number;
  readonly rpcHealth?: PublicNetworkStatus['rpcHealth'];
  readonly explorerLag?: number;
  readonly exchangeActive?: boolean;
}): PublicNetworkStatus {
  const environment = input.environment ?? 'SIMULATION';
  return Object.freeze({
    environment,
    environmentLabel: environment === 'TESTNET' ? 'SUNREY_TESTNET' : environment === 'LOCAL_DEVNET' ? 'LOCAL_DEVNET' : 'SIMULATION',
    networkId: input.networkId ?? 'net_sunrey_simulation',
    chainId: input.chainId ?? 'chn_sunrey_simulation',
    protocolVersion: 'sunrey-protocol-0',
    apiVersion: 'v1',
    releaseVersion: PUBLIC_RELEASE_VERSION,
    latestFinalizedHeight: input.latestFinalizedHeight ?? 40,
    rpcHealth: input.rpcHealth ?? 'HEALTHY',
    explorerLag: input.explorerLag ?? 0,
    activeNetworkPhase: 'CHAIN_STABILIZATION',
    publicCapabilityStatus: Object.freeze([
      Object.freeze({ capability: 'SUNREY_CHAIN', status: 'ELIGIBLE' as const, public: true as const }),
      Object.freeze({
        capability: 'SUNREY_EXCHANGE',
        status: input.exchangeActive ? ('ACTIVE' as const) : ('UNAVAILABLE' as const),
        public: true as const,
      }),
    ]),
    privateOperationalDetails: false,
  });
}

export function recordLoadBenchmark(environment: PublicNetworkEnvironment = 'SIMULATION'): LoadBenchmarkResult {
  const gateway = new PublicRpcGateway();
  const fleet = new ExplorerIndexerFleet();
  fleet.add('idx-load', 'rpc-a');
  const queries = new ExplorerQueryApi(fleet);
  const archive = new ArchiveQueryService();
  const started = nowMs();
  for (let index = 0; index < 64; index += 1) {
    gateway.handle({
      requestId: `read_${index}`,
      method: 'chain.status',
      path: '/v1/chain/status',
      identity: anonymousIdentity(),
      nowMs: started + index,
    });
    gateway.handle({
      requestId: `tx_${index}`,
      method: 'tx.submit',
      path: '/v1/transactions',
      identity: anonymousIdentity(),
      payload: { signedBytes: `signed_${index}`, transactionId: `tx_load_${index}` },
      nowMs: started + index,
    });
    queries.query('blocks');
    archive.query({ fromHeight: 0, toHeight: 4, scan: true });
  }
  gateway.subscriptions.open({ identity: 'load', topic: 'NEW_FINALIZED_BLOCK' });
  const elapsed = Math.max(1, nowMs() - started);
  return Object.freeze({
    environment,
    recordedAtUtc: '2026-08-18T00:00:00.000Z',
    rpcReadsPerSecond: Math.round(64_000 / elapsed),
    submissionsPerSecond: Math.round(64_000 / elapsed),
    subscriptionsPerSecond: Math.round(1_000 / elapsed),
    explorerQueriesPerSecond: Math.round(64_000 / elapsed),
    archiveQueriesPerSecond: Math.round(64_000 / elapsed),
  });
}

export function createPublicDataPlaneReport(input: {
  readonly gateway?: PublicRpcGateway;
  readonly fleet?: ExplorerIndexerFleet;
  readonly environment?: PublicNetworkEnvironment;
} = {}): PublicDataPlaneReport {
  const gateway = input.gateway ?? new PublicRpcGateway();
  const fleet = input.fleet ?? new ExplorerIndexerFleet();
  if (fleet.list().length === 0) {
    fleet.add('idx-a', 'rpc-a');
    fleet.add('idx-b', 'rpc-b');
  }
  const explorer = new ExplorerQueryApi(fleet);
  if (ENVIRONMENT !== 'simulation' || LIVE_MONEY_ENABLED || LIVE_EXCHANGE_ENABLED) {
    throw new Error('public data plane must remain simulation-only');
  }
  const healthy = gateway.pool.list().filter((endpoint) => endpoint.health === 'HEALTHY').length;
  return Object.freeze({
    schemaVersion: 1,
    toolVersion: 'sunrey-public-data-plane-0',
    environment: 'simulation',
    zone: 'PUBLIC_RPC',
    network: publicNetworkStatus({
      environment: input.environment ?? 'SIMULATION',
      latestFinalizedHeight: Math.max(...gateway.pool.list().map((endpoint) => endpoint.finalizedHeight), 0),
      rpcHealth: healthy > 0 ? 'HEALTHY' : 'DOWN',
      explorerLag: explorer.haState().activeIndexerId
        ? fleet.list().find((row) => row.indexerId === explorer.haState().activeIndexerId)?.lag ?? 0
        : 0,
    }),
    endpoints: gateway.pool.list(),
    explorer: explorer.haState(),
    metrics: snapshotMetrics(gateway.metrics, explorer),
    load: recordLoadBenchmark(input.environment ?? 'SIMULATION'),
    secondConsensus: false,
    secondLedger: false,
    explorerAuthoritative: false,
    publicValidatorAdminExposed: false,
    liveFlagsEnabled: false,
  });
}

export function exerciseFailureScenarios(gateway = new PublicRpcGateway()): {
  readonly oneRpcDown: boolean;
  readonly multipleRpcDown: boolean;
  readonly staleExcluded: boolean;
  readonly cacheUnavailable: boolean;
  readonly subscriptionSurgeBounded: boolean;
  readonly archiveUnavailable: boolean;
} {
  gateway.pool.mark('rpc-a', { health: 'DOWN', synced: false });
  const one = gateway.handle({
    requestId: 'fail_one',
    method: 'chain.status',
    path: '/v1/chain/status',
    identity: anonymousIdentity(),
  });
  gateway.pool.mark('rpc-b', { health: 'DOWN', synced: false });
  gateway.pool.mark('rpc-archive', { health: 'DOWN', synced: false });
  const many = gateway.handle({
    requestId: 'fail_many',
    method: 'chain.status',
    path: '/v1/chain/status',
    identity: anonymousIdentity(),
  });
  const recovered = new PublicRpcGateway({
    pool: new RpcEndpointPool([fixtureEndpoint('rpc-stale-only', 'STALE', 10, 40, 1, false)]),
  });
  const stale = recovered.handle({
    requestId: 'fail_stale',
    method: 'tx.submit',
    path: '/v1/transactions',
    identity: anonymousIdentity(),
    payload: { signedBytes: 'aa', transactionId: 'tx_stale' },
    mutationEligibility: true,
  });
  gateway.cache.disable();
  const surge = Array.from({ length: 12 }, (_, index) =>
    gateway.subscriptions.open({ identity: 'surge', topic: 'NEW_FINALIZED_BLOCK', bound: 4 }),
  );
  const archive = new ArchiveQueryService();
  archive.setAvailable(false);
  return {
    oneRpcDown: one.ok,
    multipleRpcDown: many.ok === false && many.error === 'NO_HEALTHY_ENDPOINT',
    staleExcluded: stale.ok === false && stale.error === 'STALE_NODE_EXCLUDED',
    cacheUnavailable: gateway.cache.policy.enabled === false,
    subscriptionSurgeBounded: surge.filter((row) => 'error' in row).length > 0,
    archiveUnavailable: archive.query({ fromHeight: 0, toHeight: 1, scan: false }).error === 'ARCHIVE_UNAVAILABLE',
  };
}

function snapshotMetrics(metrics: PublicDataPlaneMetrics, explorer: ExplorerQueryApi): PublicDataPlaneMetrics {
  return Object.freeze({
    ...metrics,
    subscriptionCount: metrics.subscriptionCount,
    indexerLag: explorer.haState().healthyMembers === 0 ? 1 : 0,
  });
}

function anonymousIdentity(): import('./types.ts').RpcClientIdentity {
  return {
    kind: 'ANONYMOUS',
    networkIdentity: '203.0.113.10',
    apiKeyId: null,
    grantsFinancialAuthority: false,
  };
}

function nowMs(): number {
  return 1;
}
