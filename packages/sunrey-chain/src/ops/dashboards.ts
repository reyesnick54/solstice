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
    {
      id: 'FORMAL_ASSURANCE',
      title: 'Formal Assurance',
      panels: ['formal_models_verified', 'formal_counterexamples', 'formal_trace_alignment', 'formal_rust_harnesses'],
    },
    {
      id: 'GLOBAL_SYSTEM',
      title: 'Global System',
      panels: [
        'postgres_primary_health',
        'outbox_backlog',
        'provider_sessions',
        'oracle_quorum_degradation',
        'supply_reconciliation',
      ],
      drillLinks: ['CHAIN', 'PAYMENTS', 'PROVIDERS', 'PERSISTENCE', 'SECURITY'],
    },
    {
      id: 'CHAIN',
      title: 'Chain',
      panels: ['finalized_height', 'finality_latency', 'supply_reconciliation'],
      drillLinks: ['CONSENSUS', 'NATIVE_ASSETS', 'ECONOMIC_CONSTITUTION'],
    },
    {
      id: 'ECONOMIC_CONSTITUTION',
      title: 'Economic Constitution',
      panels: ['supply_reconciliation', 'moonrey_issuance', 'productive_value_review_queue', 'human_contribution_review_queue'],
      drillLinks: ['MOONREY_PRODUCTIVE_ECONOMY', 'ORACLES'],
    },
    {
      id: 'PAYMENTS',
      title: 'Payments',
      panels: [
        'payment_submission_unknown',
        'payment_reconciliation_required',
        'payment_callback_replays',
        'payment_settlement_lag',
        'fx_quote_stale_rejections',
      ],
      drillLinks: ['PROVIDERS', 'PERSISTENCE', 'EVENT_FABRIC'],
    },
    {
      id: 'PROVIDERS',
      title: 'Providers',
      panels: [
        'provider_sessions',
        'provider_auth_failures',
        'provider_circuit_open',
        'provider_schema_drift',
        'provider_revalidation_required',
        'credential_expiry_horizon',
      ],
      drillLinks: ['SECURITY', 'COMPLIANCE', 'PAYMENTS'],
    },
    {
      id: 'COMPLIANCE',
      title: 'Compliance',
      panels: [
        'kyc_provider_unavailable',
        'sanctions_provider_unavailable',
        'aml_provider_unavailable',
        'compliance_manual_review_queue',
      ],
      drillLinks: ['PROVIDERS', 'SECURITY'],
    },
    {
      id: 'ORACLES',
      title: 'Oracles',
      panels: ['oracle_quorum_degradation', 'quorum_availability', 'observation_freshness', 'stale_facts'],
      drillLinks: ['ORACLE', 'ECONOMIC_CONSTITUTION'],
    },
    {
      id: 'PERSISTENCE',
      title: 'Persistence',
      panels: [
        'postgres_primary_health',
        'replica_lag',
        'outbox_backlog',
        'inbox_failed',
        'dead_letter_count',
        'recovery_reconciliation_queue',
        'backup_age',
      ],
      drillLinks: ['EVENT_FABRIC', 'GLOBAL_SYSTEM'],
    },
    {
      id: 'EVENT_FABRIC',
      title: 'Event Fabric',
      panels: ['outbox_backlog', 'inbox_failed', 'dead_letter_count'],
      drillLinks: ['PERSISTENCE', 'PAYMENTS'],
    },
    {
      id: 'SECURITY',
      title: 'Security',
      panels: [
        'credential_expiry_horizon',
        'credential_rotation_required',
        'credential_scope_rejections',
        'credential_resolution_failures',
        'hsm_health',
      ],
      drillLinks: ['PROVIDERS', 'CUSTODY'],
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
