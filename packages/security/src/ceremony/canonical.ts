import { sha256Hex } from '../hash.ts';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function artifactHash(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sortValue(record[key])]),
    );
  }
  return value;
}

export function publicKeyFingerprint(publicKeyHex: string): string {
  return sha256Hex(publicKeyHex.toLowerCase());
}
