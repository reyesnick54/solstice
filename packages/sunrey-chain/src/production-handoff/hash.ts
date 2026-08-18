import { encodeString, sha256Hex } from '../validators/canonical.ts';
import { FORBIDDEN_INVENTORY_SECRET_KEYS } from './types.ts';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner) => {
    if (typeof inner === 'bigint') {
      return inner.toString();
    }
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(inner as Record<string, unknown>).sort()) {
        sorted[key] = (inner as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return inner;
  });
}

export function handoffHash(value: unknown): string {
  return sha256Hex(encodeString(canonicalJson(value)));
}

export function assertNoSecrets(value: unknown, path = 'root'): void {
  if (value === null || value === undefined) {
    return;
  }
  if (typeof value === 'string') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecrets(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_INVENTORY_SECRET_KEYS as readonly string[]).includes(key)) {
        throw new TypeError(`secret key ${key} excluded from inventory at ${path}`);
      }
      assertNoSecrets(inner, `${path}.${key}`);
    }
  }
}

export function containsSecretKey(value: unknown): boolean {
  try {
    assertNoSecrets(value);
    return false;
  } catch {
    return true;
  }
}
