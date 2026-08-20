import { FORBIDDEN_TELEMETRY_KEYS, HIGH_CARDINALITY_METRIC_LABELS } from './types.ts';

const FORBIDDEN = new Set<string>(FORBIDDEN_TELEMETRY_KEYS);
const HIGH_CARDINALITY = new Set<string>(HIGH_CARDINALITY_METRIC_LABELS);

const FORBIDDEN_VALUE_PATTERNS = [
  /BEGIN [A-Z ]*PRIVATE KEY/i,
  /pdv:raw:/i,
  /kyc:raw:/i,
  /cleanroom:raw:/i,
  /hsm:secret:/i,
  /consent:raw:/i,
  /api[_-]?token/i,
  /bearer [a-z0-9._~+/-]+=*/i,
  /sk_live_/i,
  /secretPath=/i,
];

export function assertSafeTelemetryRecord(
  record: Record<string, unknown>,
  surface: 'metrics' | 'traces' | 'logs' | 'evidence',
): void {
  walk(record, surface, '');
}

function walk(value: unknown, surface: string, path: string): void {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
      if (pattern.test(value)) {
        throw new Error(`${surface} contains forbidden secret material at ${path || 'root'}`);
      }
    }
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, surface, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN.has(key)) {
        throw new Error(`${surface} label ${key} is forbidden`);
      }
      walk(child, surface, path ? `${path}.${key}` : key);
    }
  }
}

export function lowCardinalityLabels(labels: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (FORBIDDEN.has(key) || HIGH_CARDINALITY.has(key)) {
      throw new Error(`metrics label ${key} is forbidden`);
    }
    if (value.length > 64) {
      throw new Error(`metrics label ${key} exceeds low-cardinality bound`);
    }
    out[key] = value;
  }
  return out;
}
