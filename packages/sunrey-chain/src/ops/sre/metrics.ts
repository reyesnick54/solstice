import { ALLOWED_METRIC_LABEL_KEYS, type SafeMetricLabels } from '../control-room/types.ts';
import { controlRoomMetricCatalog, MetricRegistry } from '../observability.ts';
import { assertAllowedMetricLabels } from '../control-room/catalog.ts';
import type { MetricConvention, TelemetrySystem } from './types.ts';

export const PRODUCTIZATION_METRIC_NAMES = Object.freeze([
  'api_requests',
  'api_latency_ms',
  'api_error_rate_bps',
  'api_throughput',
  'auth_requests',
  'auth_error_rate_bps',
  'ledger_post_success',
  'ledger_post_failure',
  'ledger_latency_ms',
  'account_workflow_status',
  'payment_throughput',
  'fx_quote_latency_ms',
  'card_workflow_status',
  'treasury_liquidity_warning',
  'reconciliation_breaks',
  'queue_depth',
  'job_age_ms',
  'database_health',
  'provider_health',
  'grow_proposal_throughput',
  'agent_health',
  'agent_response_latency_ms',
  'exchange_health',
  'exchange_order_throughput',
  'chain_height',
  'chain_finality_lag_ms',
  'wallet_processing_backlog',
  'vault_access_anomaly',
  'hin_marketplace_health',
] as const);

export type ProductizationMetricName = (typeof PRODUCTIZATION_METRIC_NAMES)[number];

const CONVENTIONS: readonly MetricConvention[] = Object.freeze([
  { name: 'api_requests', system: 'API', unit: 'count', description: 'Inbound API requests by status class.' },
  { name: 'api_latency_ms', system: 'API', unit: 'ms', description: 'API handler latency.' },
  { name: 'api_error_rate_bps', system: 'API', unit: 'bps', description: 'API 5xx rate in basis points.' },
  { name: 'api_throughput', system: 'API', unit: 'count', description: 'Completed API requests in the scrape window.' },
  { name: 'auth_requests', system: 'AUTHENTICATION', unit: 'count', description: 'Authentication attempts by result class.' },
  { name: 'auth_error_rate_bps', system: 'AUTHENTICATION', unit: 'bps', description: 'Authentication failure rate in basis points.' },
  { name: 'ledger_post_success', system: 'LEDGER', unit: 'count', description: 'Successful Ledger.postJournal calls.' },
  { name: 'ledger_post_failure', system: 'LEDGER', unit: 'count', description: 'Refused or failed journal posts.' },
  { name: 'ledger_latency_ms', system: 'LEDGER', unit: 'ms', description: 'Journal post latency.' },
  { name: 'account_workflow_status', system: 'ACCOUNTS', unit: 'gauge', description: 'Open/deposit/withdraw/transfer terminal status counts.' },
  { name: 'payment_throughput', system: 'PAYMENTS', unit: 'count', description: 'Payment orchestration completions.' },
  { name: 'fx_quote_latency_ms', system: 'FX', unit: 'ms', description: 'FX quote evaluation latency.' },
  { name: 'card_workflow_status', system: 'CARDS', unit: 'gauge', description: 'Card auth/clear/settle status counts.' },
  { name: 'treasury_liquidity_warning', system: 'TREASURY', unit: 'gauge', description: '1 when liquidity is below the engineering reserve.' },
  { name: 'reconciliation_breaks', system: 'RECONCILIATION', unit: 'count', description: 'Unmatched reconciliation breaks.' },
  { name: 'queue_depth', system: 'QUEUES_JOBS', unit: 'gauge', description: 'Outbox/inbox/job queue depth.' },
  { name: 'job_age_ms', system: 'QUEUES_JOBS', unit: 'ms', description: 'Age of the oldest unprocessed job.' },
  { name: 'database_health', system: 'DATABASE', unit: 'gauge', description: '1 when the writable primary answers health.' },
  { name: 'provider_health', system: 'PROVIDERS', unit: 'gauge', description: '1 when technical health is TECHNICALLY_HEALTHY.' },
  { name: 'grow_proposal_throughput', system: 'GROW', unit: 'count', description: 'Growth proposals created. Not a return-rate field.' },
  { name: 'agent_health', system: 'AGENT', unit: 'gauge', description: '1 when the model/tool path is reachable.' },
  { name: 'agent_response_latency_ms', system: 'AGENT', unit: 'ms', description: 'Agent model response latency.' },
  { name: 'exchange_health', system: 'EXCHANGE', unit: 'gauge', description: '1 when matching accepts order entry.' },
  { name: 'exchange_order_throughput', system: 'EXCHANGE', unit: 'count', description: 'Orders accepted for matching.' },
  { name: 'chain_height', system: 'CHAIN', unit: 'height', description: 'Finalized chain height.' },
  { name: 'chain_finality_lag_ms', system: 'CHAIN', unit: 'ms', description: 'Time from propose to finalize.' },
  { name: 'wallet_processing_backlog', system: 'WALLETS', unit: 'gauge', description: 'Wallet operations waiting on chain/custody.' },
  { name: 'vault_access_anomaly', system: 'VAULT', unit: 'gauge', description: '1 when PDV/evidence access policy rejected an unexpected pattern.' },
  { name: 'hin_marketplace_health', system: 'HIN', unit: 'gauge', description: '1 when the information-rights marketplace is serving reads.' },
]);

export function metricConventions(): readonly MetricConvention[] {
  return CONVENTIONS;
}

export function productizationMetricCatalog(): readonly string[] {
  return PRODUCTIZATION_METRIC_NAMES;
}

export function unifiedOperationalMetricCatalog(): readonly string[] {
  return Object.freeze([...new Set([...controlRoomMetricCatalog(), ...PRODUCTIZATION_METRIC_NAMES])]);
}

export function emitProductizationMetric(
  registry: MetricRegistry,
  name: ProductizationMetricName,
  value: bigint,
  labels: SafeMetricLabels = {},
): void {
  const convention = CONVENTIONS.find((row) => row.name === name);
  if (!convention) {
    throw new Error(`unknown productization metric ${name}`);
  }
  const safe = assertAllowedMetricLabels({
    ...labels,
    domain: labels.domain ?? domainFor(convention.system),
    environment: labels.environment ?? 'simulation',
    component: labels.component ?? convention.system.toLowerCase(),
  });
  registry.observe(name, value, asRecord(safe));
}

export function assertNoPiiMetricLabels(labels: Readonly<Record<string, string>>): void {
  for (const key of Object.keys(labels)) {
    if (!(ALLOWED_METRIC_LABEL_KEYS as readonly string[]).includes(key)) {
      throw new Error(`metrics label ${key} is forbidden`);
    }
  }
}

function domainFor(system: TelemetrySystem): string {
  switch (system) {
    case 'API':
    case 'AUTHENTICATION':
      return 'api';
    case 'LEDGER':
    case 'ACCOUNTS':
      return 'ledger';
    case 'PAYMENTS':
    case 'FX':
    case 'CARDS':
      return 'payments';
    case 'TREASURY':
    case 'RECONCILIATION':
      return 'treasury';
    case 'PROVIDERS':
      return 'providers';
    case 'GROW':
      return 'growth';
    case 'AGENT':
      return 'ai';
    case 'EXCHANGE':
      return 'exchange';
    case 'CHAIN':
    case 'WALLETS':
      return 'chain';
    case 'CUSTODY':
      return 'custody';
    case 'VAULT':
      return 'vault';
    case 'HIN':
      return 'hin';
    case 'DATABASE':
      return 'persistence';
    case 'QUEUES_JOBS':
      return 'events';
  }
}

function asRecord(labels: SafeMetricLabels): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
