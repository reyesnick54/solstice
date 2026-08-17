import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DASHBOARD_IDS, type DashboardDefinition, type DashboardId } from './types.ts';

export function dashboardDefinitions(): readonly DashboardDefinition[] {
  return Object.freeze([
    { id: 'NETWORK_OVERVIEW', title: 'Network Overview', panels: ['finalized_height', 'rpc_error_rate', 'p2p_connections'] },
    { id: 'CONSENSUS', title: 'Consensus', panels: ['consensus_round', 'finality_latency', 'round_changes'] },
    { id: 'VALIDATOR', title: 'Validator', panels: ['validator_missed_votes', 'signer_errors', 'validator_peer_count'] },
    { id: 'RPC', title: 'RPC', panels: ['rpc_latency', 'rpc_error_rate'] },
    { id: 'EXPLORER', title: 'Explorer', panels: ['explorer_lag'] },
    { id: 'NATIVE_ASSETS', title: 'Native Assets', panels: ['sunrey_transactions', 'native_fees', 'asset_reconciliation'] },
    { id: 'MOONREY_PRODUCTIVE_ECONOMY', title: 'MoonRey / Productive Economy', panels: ['moonrey_issuance', 'productive_contributions'] },
    { id: 'ORACLE', title: 'Oracle', panels: ['quorum_availability', 'stale_facts', 'aggregation_latency'] },
    { id: 'EXCHANGE', title: 'Exchange', panels: ['order_ingress', 'matching_latency', 'pending_settlement_count'] },
    { id: 'CUSTODY', title: 'Custody', panels: ['deposit_finality_lag', 'submission_unknown_count', 'reconciliation_mismatches'] },
    { id: 'INTEROP', title: 'Interop', panels: ['verified_headers', 'frozen_clients', 'relayer_latency'] },
    {
      id: 'PERFORMANCE',
      title: 'Performance',
      panels: [
        'finality_latency',
        'sunrey_transactions',
        'mempool_count',
        'block_execution_duration',
        'state_commit_duration',
        'rpc_latency',
        'explorer_lag',
        'matching_latency',
        'aggregation_latency',
        'relayer_latency',
      ],
    },
  ]);
}

export function dashboardConfigDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'ops', 'grafana', 'dashboards');
}

export function validateDashboardConfigs(): readonly DashboardId[] {
  const ids: DashboardId[] = [];
  for (const dashboard of dashboardDefinitions()) {
    const path = join(dashboardConfigDir(), `${dashboard.id.toLowerCase()}.json`);
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      readonly id: DashboardId;
      readonly title: string;
      readonly panels: readonly string[];
    };
    if (parsed.id !== dashboard.id || parsed.title !== dashboard.title) {
      throw new Error(`dashboard config mismatch for ${dashboard.id}`);
    }
    if (parsed.panels.length === 0) {
      throw new Error(`dashboard ${dashboard.id} has no panels`);
    }
    ids.push(parsed.id);
  }
  if (ids.length !== DASHBOARD_IDS.length) {
    throw new Error('dashboard catalog is incomplete');
  }
  return ids;
}
