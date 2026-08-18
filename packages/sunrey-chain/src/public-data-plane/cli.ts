import { ArchiveQueryService } from './archive.ts';
import { ExplorerIndexerFleet, ExplorerQueryApi } from './explorer-ha.ts';
import { PublicRpcGateway } from './gateway.ts';
import { DEFAULT_RPC_QUOTA_POLICY, DEFAULT_RPC_RATE_LIMIT_POLICY } from './policy.ts';
import { createPublicDataPlaneReport, publicNetworkStatus } from './status.ts';

export type PublicDataPlaneCliResult = {
  readonly ok: boolean;
  readonly command: string;
  readonly payload: unknown;
};

const RPC_COMMANDS = ['status', 'endpoints', 'limits', 'health', 'help'] as const;
const EXPLORER_COMMANDS = ['status', 'lag', 'rebuild', 'verify', 'help'] as const;

export function publicDataPlaneUsage(): string {
  return [
    'sunrey-ops rpc status',
    'sunrey-ops rpc endpoints',
    'sunrey-ops rpc limits',
    'sunrey-ops rpc health',
    'sunrey-ops explorer status',
    'sunrey-ops explorer lag',
    'sunrey-ops explorer rebuild',
    'sunrey-ops explorer verify',
  ].join('\n');
}

export function runPublicDataPlaneCommand(args: readonly string[]): PublicDataPlaneCliResult {
  const [group, action] = args;
  const gateway = new PublicRpcGateway();
  const fleet = new ExplorerIndexerFleet();
  fleet.add('idx-a', 'rpc-a');
  fleet.add('idx-b', 'rpc-b');
  const queries = new ExplorerQueryApi(fleet);
  if (group === 'rpc') {
    return runRpc(action ?? 'status', gateway);
  }
  if (group === 'explorer') {
    return runExplorer(action ?? 'status', fleet, queries);
  }
  return { ok: false, command: group ?? 'missing', payload: { error: 'unknown public data plane command', usage: publicDataPlaneUsage() } };
}

function runRpc(action: string, gateway: PublicRpcGateway): PublicDataPlaneCliResult {
  if (!(RPC_COMMANDS as readonly string[]).includes(action)) {
    return { ok: false, command: `rpc ${action}`, payload: { error: 'unknown rpc command', usage: publicDataPlaneUsage() } };
  }
  if (action === 'help') {
    return { ok: true, command: 'rpc help', payload: { usage: publicDataPlaneUsage() } };
  }
  if (action === 'endpoints') {
    return { ok: true, command: 'rpc endpoints', payload: { endpoints: gateway.pool.list() } };
  }
  if (action === 'limits') {
    return {
      ok: true,
      command: 'rpc limits',
      payload: { quota: DEFAULT_RPC_QUOTA_POLICY, rate: DEFAULT_RPC_RATE_LIMIT_POLICY },
    };
  }
  if (action === 'health') {
    const healthy = gateway.pool.list().filter((endpoint) => endpoint.health === 'HEALTHY');
    return {
      ok: healthy.length > 0,
      command: 'rpc health',
      payload: {
        healthy: healthy.map((endpoint) => endpoint.endpointId),
        signer: gateway.assertNoSignerAccess(),
      },
    };
  }
  return {
    ok: true,
    command: 'rpc status',
    payload: publicNetworkStatus({
      latestFinalizedHeight: Math.max(...gateway.pool.list().map((endpoint) => endpoint.finalizedHeight)),
      rpcHealth: 'HEALTHY',
    }),
  };
}

function runExplorer(
  action: string,
  fleet: ExplorerIndexerFleet,
  queries: ExplorerQueryApi,
): PublicDataPlaneCliResult {
  if (!(EXPLORER_COMMANDS as readonly string[]).includes(action)) {
    return { ok: false, command: `explorer ${action}`, payload: { error: 'unknown explorer command', usage: publicDataPlaneUsage() } };
  }
  if (action === 'help') {
    return { ok: true, command: 'explorer help', payload: { usage: publicDataPlaneUsage() } };
  }
  if (action === 'lag') {
    return { ok: true, command: 'explorer lag', payload: { members: fleet.list() } };
  }
  if (action === 'rebuild') {
    const rebuilt = fleet.rebuild('idx-a');
    return { ok: rebuilt.health !== 'CORRUPT', command: 'explorer rebuild', payload: rebuilt };
  }
  if (action === 'verify') {
    return { ok: true, command: 'explorer verify', payload: { idxA: fleet.verify('idx-a'), idxB: fleet.verify('idx-b'), compare: fleet.compare() } };
  }
  return {
    ok: true,
    command: 'explorer status',
    payload: { ha: queries.haState(), report: createPublicDataPlaneReport({ fleet }) },
  };
}

export function publicDataPlaneArchiveProbe(): { readonly available: boolean; readonly signingAuthority: false } {
  const archive = new ArchiveQueryService();
  return { available: archive.query({ fromHeight: 0, toHeight: 1, scan: false }).ok, signingAuthority: false };
}
