/**
 * Privacy-safe connector metrics and audit records.
 *
 * Never include credential material, tokens, certificate keys, or
 * payload bodies by default.
 */

import type { ConnectorResponseClass } from './runtime-types.ts';
import type { ProductionOracleRejectionCode } from './types.ts';

export type ConnectorMetrics = {
  fetchAttempts: number;
  fetchSuccesses: number;
  fetchFailures: number;
  authFailures: number;
  timeouts: number;
  http429s: number;
  http5xxs: number;
  schemaFailures: number;
  staleRecords: number;
  oversizedResponses: number;
  circuitOpen: number;
  rateLimitDelays: number;
  latencyMsTotal: number;
};

export type ConnectorAuditRecord = {
  readonly providerId: string;
  readonly sourceId: string;
  readonly requestProfileId: string;
  readonly status: 'ACCEPTED' | 'REJECTED';
  readonly attemptCount: number;
  readonly responseClass: ConnectorResponseClass;
  readonly schemaResult: 'VALID' | 'INVALID' | 'NOT_EVALUATED';
  readonly provenanceHash: string | null;
  readonly timestampUnix: bigint;
  readonly rejectionCode: ProductionOracleRejectionCode | null;
  readonly payloadPersisted: false;
};

const AUTH_CODES = new Set<ProductionOracleRejectionCode>([
  'AUTH_FAILED',
  'OAUTH_TOKEN_FAILED',
  'SIGNATURE_PROFILE_INVALID',
  'CREDENTIAL_NOT_ASSIGNED',
  'CREDENTIAL_ISOLATION_VIOLATION',
]);
const SCHEMA_CODES = new Set<ProductionOracleRejectionCode>([
  'SCHEMA_INCOMPATIBLE',
  'SCHEMA_DRIFT',
  'SOURCE_RECORD_INVALID',
  'WRONG_NUMERIC_REPRESENTATION',
  'WRONG_UNIT',
  'FLOAT_FORBIDDEN',
  'UNBOUNDED_ARRAY',
  'RECORD_OVERSIZED',
]);

export function emptyConnectorMetrics(): ConnectorMetrics {
  return {
    fetchAttempts: 0,
    fetchSuccesses: 0,
    fetchFailures: 0,
    authFailures: 0,
    timeouts: 0,
    http429s: 0,
    http5xxs: 0,
    schemaFailures: 0,
    staleRecords: 0,
    oversizedResponses: 0,
    circuitOpen: 0,
    rateLimitDelays: 0,
    latencyMsTotal: 0,
  };
}

export class ConnectorObservability {
  readonly metrics: ConnectorMetrics = emptyConnectorMetrics();
  readonly audit: ConnectorAuditRecord[] = [];

  recordAttempt(): void {
    this.metrics.fetchAttempts += 1;
  }

  recordLatency(ms: number): void {
    this.metrics.latencyMsTotal += Math.max(0, ms);
  }

  recordSuccess(audit: ConnectorAuditRecord): void {
    this.metrics.fetchSuccesses += 1;
    this.audit.push(redactAudit(audit));
  }

  recordFailure(code: ProductionOracleRejectionCode, audit: ConnectorAuditRecord): void {
    this.metrics.fetchFailures += 1;
    if (AUTH_CODES.has(code)) {
      this.metrics.authFailures += 1;
    }
    if (code === 'REQUEST_TIMEOUT') {
      this.metrics.timeouts += 1;
    }
    if (code === 'RATE_LIMITED' || audit.responseClass === 'HTTP_429') {
      this.metrics.http429s += 1;
      this.metrics.rateLimitDelays += 1;
    }
    if (audit.responseClass === 'HTTP_5XX') {
      this.metrics.http5xxs += 1;
    }
    if (SCHEMA_CODES.has(code)) {
      this.metrics.schemaFailures += 1;
    }
    if (code === 'SOURCE_TIMESTAMP_STALE') {
      this.metrics.staleRecords += 1;
    }
    if (code === 'RESPONSE_TOO_LARGE' || code === 'RECORD_OVERSIZED') {
      this.metrics.oversizedResponses += 1;
    }
    if (code === 'CIRCUIT_OPEN') {
      this.metrics.circuitOpen += 1;
    }
    this.audit.push(redactAudit(audit));
  }
}

function redactAudit(record: ConnectorAuditRecord): ConnectorAuditRecord {
  return Object.freeze({
    ...record,
    payloadPersisted: false,
  });
}

export function classifyHttpStatus(status: number | undefined): ConnectorResponseClass {
  if (status === undefined) {
    return 'TRANSPORT';
  }
  if (status === 429) {
    return 'HTTP_429';
  }
  if (status >= 500) {
    return 'HTTP_5XX';
  }
  if (status >= 400) {
    return 'HTTP_4XX';
  }
  if (status >= 200 && status < 300) {
    return 'SUCCESS';
  }
  return 'TRANSPORT';
}

export function classifyRejection(code: ProductionOracleRejectionCode): ConnectorResponseClass {
  if (AUTH_CODES.has(code)) {
    return 'AUTH';
  }
  if (SCHEMA_CODES.has(code) || code === 'CONTENT_TYPE_INVALID') {
    return 'SCHEMA';
  }
  if (
    code === 'SSRF_DESTINATION_FORBIDDEN' ||
    code === 'TLS_POLICY_VIOLATION' ||
    code === 'ENDPOINT_NOT_APPROVED'
  ) {
    return 'SECURITY';
  }
  if (code === 'CONNECTIVITY_DISABLED' || code === 'CIRCUIT_OPEN' || code === 'RATE_LIMITED') {
    return 'POLICY';
  }
  if (code === 'REQUEST_TIMEOUT') {
    return 'TIMEOUT';
  }
  if (code === 'HTTP_STATUS_REJECTED') {
    return 'HTTP_4XX';
  }
  return 'TRANSPORT';
}

export function auditContainsCredential(record: ConnectorAuditRecord, secrets: readonly string[]): boolean {
  const encoded = JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  return secrets.some((secret) => secret.length > 0 && encoded.includes(secret));
}
