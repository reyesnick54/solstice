/**
 * Read controlled OSS assimilation quarantine posture (NATIVE01 import manifest).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ASSIMILATION_VENDOR_REL = 'vendor/assimilation' as const;

export type AssimilationQuarantinePosture = {
  readonly active: boolean;
  readonly assimilationRel: typeof ASSIMILATION_VENDOR_REL;
  readonly vendorPaths: readonly string[];
};

const INACTIVE: AssimilationQuarantinePosture = Object.freeze({
  active: false,
  assimilationRel: ASSIMILATION_VENDOR_REL,
  vendorPaths: Object.freeze([]),
});

function normalizeRel(path: string): string {
  return path.replace(/\\/g, '/');
}

export function readAssimilationQuarantinePosture(root: string): AssimilationQuarantinePosture {
  const qPath = join(root, ASSIMILATION_VENDOR_REL, 'QUARANTINE.json');
  const mPath = join(root, ASSIMILATION_VENDOR_REL, 'SOURCE_IMPORT_MANIFEST.json');
  if (!existsSync(qPath) || !existsSync(mPath)) {
    return INACTIVE;
  }

  let quarantine: { state?: string };
  let manifest: {
    sources?: readonly {
      vendorPath?: string;
      sourceAssimilationState?: string;
      runtimeDependency?: boolean;
      upstreamRequiredAtRuntime?: boolean;
      submodule?: boolean;
    }[];
  };
  try {
    quarantine = JSON.parse(readFileSync(qPath, 'utf8')) as { state?: string };
    manifest = JSON.parse(readFileSync(mPath, 'utf8')) as typeof manifest;
  } catch {
    return INACTIVE;
  }

  if (quarantine.state !== 'QUARANTINED') {
    return INACTIVE;
  }

  const vendorPaths: string[] = [];
  for (const source of manifest.sources ?? []) {
    if (source.sourceAssimilationState !== 'QUARANTINED') {
      return INACTIVE;
    }
    if (
      source.runtimeDependency !== false ||
      source.upstreamRequiredAtRuntime !== false ||
      source.submodule !== false
    ) {
      return INACTIVE;
    }
    if (!source.vendorPath) {
      return INACTIVE;
    }
    const vendorPath = normalizeRel(source.vendorPath);
    if (!existsSync(join(root, vendorPath))) {
      return INACTIVE;
    }
    vendorPaths.push(vendorPath);
  }

  if (vendorPaths.length === 0) {
    return INACTIVE;
  }

  return Object.freeze({
    active: true,
    assimilationRel: ASSIMILATION_VENDOR_REL,
    vendorPaths: Object.freeze(vendorPaths),
  });
}

/** True when the repository-relative path lies under an active quarantined assimilation tree. */
export function isQuarantinedAssimilationPath(
  repoRelativePath: string,
  posture: AssimilationQuarantinePosture = INACTIVE,
): boolean {
  if (!posture.active) {
    return false;
  }
  const norm = normalizeRel(repoRelativePath);
  if (norm === posture.assimilationRel || norm.startsWith(`${posture.assimilationRel}/`)) {
    return true;
  }
  for (const vendorPath of posture.vendorPaths) {
    if (norm === vendorPath || norm.startsWith(`${vendorPath}/`)) {
      return true;
    }
  }
  return false;
}
