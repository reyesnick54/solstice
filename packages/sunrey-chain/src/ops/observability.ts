import { createHash, randomUUID } from 'node:crypto';

import { assertSafeTelemetryRecord, lowCardinalityLabels } from './privacy.ts';
import {
  DEVELOPMENT_CHAIN_ID,
  DEVELOPMENT_NETWORK_ID,
  OPS_PROTOCOL_VERSION,
  type LogSeverity,
  type SecurityEventCode,
  type StructuredLogFields,
} from './types.ts';

export type MetricSample = {
  readonly name: string;
  readonly value: bigint;
  readonly labels: Readonly<Record<string, string>>;
};

export type SpanRecord = {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId: string | null;
  readonly name: string;
  readonly service: string;
  readonly attributes: Readonly<Record<string, string>>;
};

export type StructuredLogRecord = StructuredLogFields & {
  readonly message: string;
  readonly attributes: Readonly<Record<string, string>>;
};

const CONSENSUS_METRICS = [
  'finalized_height',
  'consensus_round',
  'round_changes',
  'proposal_latency',
  'prevote_power',
  'precommit_power',
  'finality_latency',
  'validator_missed_votes',
  'validator_peer_count',
  'signer_latency',
  'signer_errors',
  'wal_recovery_events',
] as const;

const NODE_METRICS = [
  'cpu',
  'memory',
  'disk',
  'database_size',
  'network_io',
  'p2p_connections',
  'mempool_count',
  'mempool_bytes',
  'block_execution_duration',
  'state_commit_duration',
  'rpc_latency',
  'rpc_error_rate',
] as const;

const ECONOMIC_METRICS = [
  'sunrey_transactions',
  'moonrey_issuance',
  'native_fees',
  'asset_reconciliation',
  'productive_contributions',
  'oracle_feed_health',
  'machine_settlements',
  'exchange_settlements',
] as const;

const CUSTODY_METRICS = [
  'deposit_finality_lag',
  'withdrawal_workflow_counts',
  'submission_unknown_count',
  'reconciliation_mismatches',
  'signer_health',
  'vault_security_status',
] as const;

const EXCHANGE_METRICS = [
  'order_ingress',
  'matching_latency',
  'settlement_latency',
  'pending_settlement_count',
  'reconciliation_mismatch',
  'market_data_lag',
  'surveillance_detector_count',
] as const;

const ORACLE_METRICS = [
  'provider_health',
  'observation_freshness',
  'quorum_availability',
  'conflicted_facts',
  'stale_facts',
  'aggregation_latency',
] as const;

const INTEROP_METRICS = [
  'client_height',
  'client_age',
  'verified_headers',
  'proof_failures',
  'packets',
  'timeouts',
  'frozen_clients',
  'relayer_latency',
] as const;

const PERFORMANCE_METRICS = [
  'finalized_tps',
  'mempool_admission_latency',
  'explorer_index_rate',
  'soak_rss_bytes',
] as const;

const FORMAL_METRICS = [
  'formal_models_verified',
  'formal_counterexamples',
  'formal_trace_alignment',
  'formal_rust_harnesses',
] as const;

export const REQUIRED_METRIC_NAMES = Object.freeze([
  ...CONSENSUS_METRICS,
  ...NODE_METRICS,
  ...ECONOMIC_METRICS,
  ...CUSTODY_METRICS,
  ...EXCHANGE_METRICS,
  ...ORACLE_METRICS,
  ...INTEROP_METRICS,
  ...PERFORMANCE_METRICS,
  ...FORMAL_METRICS,
]);

export class MetricRegistry {
  readonly #samples: MetricSample[] = [];

  observe(name: string, value: bigint, labels: Record<string, string> = {}): void {
    const safe = lowCardinalityLabels(labels);
    const sample = Object.freeze({ name, value, labels: Object.freeze(safe) });
    assertSafeTelemetryRecord(sample, 'metrics');
    this.#samples.push(sample);
  }

  snapshot(): readonly MetricSample[] {
    return this.#samples.slice();
  }

  latest(name: string): MetricSample | undefined {
    return [...this.#samples].reverse().find((row) => row.name === name);
  }

  prometheusText(): string {
    return this.#samples
      .map((sample) => {
        const labels = Object.entries(sample.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        const suffix = labels.length > 0 ? `{${labels}}` : '';
        return `${sample.name}${suffix} ${sample.value.toString()}`;
      })
      .join('\n');
  }
}

export class TraceCollector {
  readonly #spans: SpanRecord[] = [];

  start(name: string, service: string, parent?: SpanRecord, attributes: Record<string, string> = {}): SpanRecord {
    const span: SpanRecord = Object.freeze({
      traceId: parent?.traceId ?? createHash('sha256').update(randomUUID()).digest('hex').slice(0, 32),
      spanId: createHash('sha256').update(randomUUID()).digest('hex').slice(0, 16),
      parentSpanId: parent?.spanId ?? null,
      name,
      service,
      attributes: Object.freeze({ ...attributes }),
    });
    assertSafeTelemetryRecord(span, 'traces');
    this.#spans.push(span);
    return span;
  }

  spans(): readonly SpanRecord[] {
    return this.#spans.slice();
  }
}

export class StructuredLogSink {
  readonly #records: StructuredLogRecord[] = [];

  emit(
    fields: Omit<StructuredLogFields, 'network' | 'chain' | 'version'> & {
      readonly message: string;
      readonly attributes?: Record<string, string>;
      readonly network?: string;
      readonly chain?: string;
      readonly version?: string;
    },
  ): StructuredLogRecord {
    const record: StructuredLogRecord = Object.freeze({
      service: fields.service,
      version: fields.version ?? OPS_PROTOCOL_VERSION,
      network: fields.network ?? DEVELOPMENT_NETWORK_ID,
      chain: fields.chain ?? DEVELOPMENT_CHAIN_ID,
      requestId: fields.requestId,
      traceId: fields.traceId,
      ...(fields.blockHeight !== undefined ? { blockHeight: fields.blockHeight } : {}),
      ...(fields.transactionId !== undefined ? { transactionId: fields.transactionId } : {}),
      severity: fields.severity,
      eventCode: fields.eventCode,
      message: fields.message,
      attributes: Object.freeze({ ...(fields.attributes ?? {}) }),
    });
    assertSafeTelemetryRecord(record, 'logs');
    this.#records.push(record);
    return record;
  }

  security(code: SecurityEventCode, message: string, requestId: string, traceId: string): StructuredLogRecord {
    return this.emit({
      service: 'sunrey-ops',
      requestId,
      traceId,
      severity: securitySeverity(code),
      eventCode: code,
      message,
    });
  }

  records(): readonly StructuredLogRecord[] {
    return this.#records.slice();
  }
}

function securitySeverity(code: SecurityEventCode): LogSeverity {
  if (code === 'CUSTODY_SECURITY_HALT' || code === 'VALIDATOR_EVIDENCE') {
    return 'CRITICAL';
  }
  if (code === 'SIGNER_REJECTION' || code === 'INTEROP_CLIENT_FREEZE') {
    return 'ERROR';
  }
  return 'WARNING';
}

export function requiredMetricCatalog(): readonly string[] {
  return REQUIRED_METRIC_NAMES;
}
