import { assertSafeTelemetryRecord } from '../privacy.ts';
import { StructuredLogSink } from '../observability.ts';
import { LOG_ARE_NOT_FINANCIAL_EVIDENCE, type StructuredOperationalLog } from './types.ts';

const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_RE =
  /pass(word|wd)?|secret|token|refresh|authorization|private[_-]?key|seed|mnemonic|ssn|pan|card([_-]?number)?|cvv|cvc|api[_-]?key|hmac|cookie|prompt|kyc|pdv|consent|beneficiary|email|phone|passport/i;

const SENSITIVE_VALUE_RE =
  /bearer\s+[a-z0-9._~+/=-]+|eyj[a-z0-9_-]+\.[a-z0-9_-]+|sk_[a-z0-9]+|-----begin [a-z ]+private key-----|pdv:raw:|kyc:raw:|consent:raw:/i;

export function redactAttribute(key: string, value: string): string {
  if (SENSITIVE_KEY_RE.test(key) || SENSITIVE_VALUE_RE.test(value)) {
    return REDACTED;
  }
  return value;
}

export function redactAttributes(input: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactAttribute(key, value);
  }
  return Object.freeze(out);
}

export function emitOperationalLog(
  sink: StructuredLogSink,
  input: {
    readonly timestamp: string;
    readonly service: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly traceId: string;
    readonly severity: StructuredOperationalLog['severity'];
    readonly eventCode: string;
    readonly message: string;
    readonly attributes?: Readonly<Record<string, string>>;
  },
): StructuredOperationalLog {
  const attributes = redactAttributes({
    ...(input.attributes ?? {}),
    correlationId: input.correlationId,
    environment: 'simulation',
    timestamp: input.timestamp,
  });
  const record: StructuredOperationalLog = Object.freeze({
    timestamp: input.timestamp,
    service: input.service,
    environment: 'simulation',
    requestId: input.requestId,
    correlationId: input.correlationId,
    traceId: input.traceId,
    severity: input.severity,
    eventCode: input.eventCode,
    message: input.message,
    attributes,
    canonicalFinancialEvidence: false,
  });
  if (!LOG_ARE_NOT_FINANCIAL_EVIDENCE || record.canonicalFinancialEvidence !== false) {
    throw new Error('logs must never be treated as canonical financial evidence');
  }
  assertSafeTelemetryRecord(record, 'logs');
  sink.emit({
    service: record.service,
    requestId: record.requestId,
    traceId: record.traceId,
    severity: record.severity,
    eventCode: record.eventCode,
    message: record.message,
    attributes: { ...attributes },
  });
  return record;
}

export function requiredLogFields(): readonly string[] {
  return Object.freeze([
    'timestamp',
    'service',
    'environment',
    'requestId',
    'correlationId',
    'traceId',
    'severity',
    'eventCode',
  ]);
}
