/**
 * Exact version + content-hash bindings. "latest", "current", and
 * "default" are never legal references. Unversioned implicit
 * dependencies are rejected.
 */

import { encodeString, sha256Hex } from '../../../validators/canonical.ts';

import {
  REJECTED_IMPLICIT_VERSIONS,
  type ExactVersionBinding,
} from './types.ts';

export const BINDING_DOMAIN = 'SUNREY_PRODUCTION_ECONOMIC_CONSTITUTION_BINDING_V1' as const;

export function hashOf(value: string): string {
  return sha256Hex(encodeString(value));
}

export function bindExact(key: string, versionId: string, content?: string): ExactVersionBinding {
  return Object.freeze({
    key,
    versionId,
    contentHash: hashOf(content ?? `${key}:${versionId}`),
  });
}

export function implicitVersionRejected(versionId: string): boolean {
  const normalized = versionId.trim().toLowerCase();
  return (REJECTED_IMPLICIT_VERSIONS as readonly string[]).includes(normalized);
}

export function rejectImplicitBindings(bindings: readonly ExactVersionBinding[]): readonly string[] {
  const failures: string[] = [];
  for (const row of bindings) {
    if (row.versionId.trim().length === 0) {
      failures.push(`${row.key}:unversioned`);
    }
    if (implicitVersionRejected(row.versionId)) {
      failures.push(`${row.key}:${row.versionId.toLowerCase()}`);
    }
  }
  return Object.freeze(failures);
}

export function orderedBindingHash(bindings: readonly ExactVersionBinding[]): string {
  const sorted = [...bindings].sort((a, b) => a.key.localeCompare(b.key));
  const parts = [encodeString(BINDING_DOMAIN), encodeString(String(sorted.length))];
  for (const row of sorted) {
    parts.push(encodeString(row.key), encodeString(row.versionId), encodeString(row.contentHash));
  }
  return sha256Hex(Buffer.concat(parts));
}
