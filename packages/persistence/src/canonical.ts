/**
 * Canonical JSON for persisted payloads. Matches Evidence Vault key order
 * so hashes remain stable across restart. Never used for secrets.
 */

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}

export function parseCanonicalJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}
