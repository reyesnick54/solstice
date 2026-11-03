/**
 * Committed quarantine OSS archives (NATIVE01) — reference inputs only, never runtime.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type CommittedQuarantineArchivePolicy = {
  readonly active: boolean;
  readonly vendorPathPrefixes: readonly string[];
};

const ASSIMILATION_REL = 'vendor/assimilation';

export function readCommittedQuarantineArchivePolicy(root: string): CommittedQuarantineArchivePolicy {
  const quarantinePath = join(root, ASSIMILATION_REL, 'QUARANTINE.json');
  const manifestPath = join(root, ASSIMILATION_REL, 'SOURCE_IMPORT_MANIFEST.json');
  if (!existsSync(quarantinePath) || !existsSync(manifestPath)) {
    return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
  }

  let quarantine: { state?: string };
  let manifest: { sources?: readonly Record<string, unknown>[] };
  try {
    quarantine = JSON.parse(readFileSync(quarantinePath, 'utf8')) as { state?: string };
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      sources?: readonly Record<string, unknown>[];
    };
  } catch {
    return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
  }

  if (quarantine.state !== 'QUARANTINED') {
    return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
  }

  const prefixes: string[] = [];
  for (const source of manifest.sources ?? []) {
    if (source.runtimeDependency !== false || source.upstreamRequiredAtRuntime !== false) {
      return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
    }
    if (source.submodule !== false) {
      return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
    }
    if (source.sourceAssimilationState !== 'QUARANTINED') {
      return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
    }
    const vendorPath = source.vendorPath;
    if (typeof vendorPath !== 'string' || !vendorPath.startsWith(`${ASSIMILATION_REL}/`)) {
      return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
    }
    prefixes.push(vendorPath.replace(/\/+$/, ''));
  }

  if (prefixes.length === 0) {
    return Object.freeze({ active: false, vendorPathPrefixes: Object.freeze([]) });
  }

  return Object.freeze({
    active: true,
    vendorPathPrefixes: Object.freeze([...new Set(prefixes)].sort()),
  });
}

export function isPathUnderCommittedQuarantineArchive(
  repoRelativePath: string,
  policy: CommittedQuarantineArchivePolicy,
): boolean {
  if (!policy.active) return false;
  const normalized = repoRelativePath.replaceAll('\\', '/');
  return policy.vendorPathPrefixes.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}
