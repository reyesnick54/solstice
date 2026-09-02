export const RUNTIME_METRICS = [
  'block_height',
  'finalized_height',
  'block_time_ms',
  'validator_status',
  'peer_count',
  'peer_status',
  'mempool_size',
  'transaction_throughput',
  'transaction_accepted',
  'transaction_rejected',
  'transaction_failures',
  'rpc_latency_ms',
  'consensus_round',
  'consensus_rounds',
  'finality_delay_ms',
  'block_execution_duration_ms',
  'state_commit_duration_ms',
  'state_sync_status',
  'validator_participation',
  'supply_reconciliation_status',
  'snapshot_status',
  'storage_errors',
] as const;

export type RuntimeMetricName = (typeof RUNTIME_METRICS)[number];

export type RuntimeMetricSample = {
  readonly name: RuntimeMetricName;
  readonly value: number;
  readonly labels: Readonly<Record<string, string>>;
};

export function metricSample(
  name: RuntimeMetricName,
  value: number,
  labels: Readonly<Record<string, string>> = {},
): RuntimeMetricSample {
  const forbidden = ['private_key', 'secret', 'token', 'password', 'mnemonic'];
  for (const [key, label] of Object.entries(labels)) {
    if (forbidden.some((needle) => key.includes(needle) || label.includes(needle))) {
      throw new Error('METRIC_SECRET_FORBIDDEN');
    }
  }
  return { name, value, labels };
}
