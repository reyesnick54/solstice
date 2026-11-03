/**
 * Committed vendor/assimilation quarantine posture (NATIVE01 source-import archives).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ASSIMILATION_REL = 'vendor/assimilation';
const QUARANTINE_REL = `${ASSIMILATION_REL}/QUARANTINE.json`;
const MANIFEST_REL = `${ASSIMILATION_REL}/SOURCE_IMPORT_MANIFEST.json`;

export type CommittedAssimilationQuarantine = {
  readonly active: boolean;
  readonly vendorPaths: readonly string[];
  readonly blockers: readonly string[];
};

type SourceImportManifest = {
  readonly sources?: readonly {
    readonly vendorPath?: string;
    readonly runtimeDependency?: boolean;
    readonly upstreamRequiredAtRuntime?: boolean;
    readonly submodule?: boolean;
    readonly sourceAssimilationState?: string;
  }[];
};

export function loadCommittedAssimilationQuarantine(root: string): CommittedAssimilationQuarantine {
  const blockers: string[] = [];
  const quarantinePath = join(root, QUARANTINE_REL);
  const manifestPath = join(root, MANIFEST_REL);

  if (!existsSync(quarantinePath) || !existsSync(manifestPath)) {
    return Object.freeze({ active: false, vendorPaths: Object.freeze([]), blockers: Object.freeze([]) });
  }

  let quarantineState: string | undefined;
  try {
    const quarantine = JSON.parse(readFileSync(quarantinePath, 'utf8')) as { state?: string };
    quarantineState = quarantine.state;
  } catch {
    blockers.push('vendor/assimilation/QUARANTINE.json is not valid JSON');
    return Object.freeze({ active: false, vendorPaths: Object.freeze([]), blockers: Object.freeze(blockers) });
  }

  if (quarantineState !== 'QUARANTINED') {
    blockers.push(`vendor/assimilation quarantine state must be QUARANTINED (got ${quarantineState ?? 'missing'})`);
    return Object.freeze({ active: false, vendorPaths: Object.freeze([]), blockers: Object.freeze(blockers) });
  }

  let manifest: SourceImportManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SourceImportManifest;
  } catch {
    blockers.push('vendor/assimilation/SOURCE_IMPORT_MANIFEST.json is not valid JSON');
    return Object.freeze({ active: false, vendorPaths: Object.freeze([]), blockers: Object.freeze(blockers) });
  }

  const vendorPaths: string[] = [];
  for (const source of manifest.sources ?? []) {
    if (!source.vendorPath?.startsWith(`${ASSIMILATION_REL}/`)) {
      blockers.push('SOURCE_IMPORT_MANIFEST entry missing vendorPath under vendor/assimilation/');
      continue;
    }
    if (source.runtimeDependency === true || source.upstreamRequiredAtRuntime === true) {
      blockers.push(`${source.vendorPath}: assimilation source must not be a runtime dependency`);
    }
    if (source.submodule === true) {
      blockers.push(`${source.vendorPath}: assimilation source must not use git submodules`);
    }
    if (source.sourceAssimilationState !== 'QUARANTINED') {
      blockers.push(`${source.vendorPath}: sourceAssimilationState must remain QUARANTINED`);
    }
    vendorPaths.push(source.vendorPath);
  }

  if (vendorPaths.length === 0) {
    blockers.push('SOURCE_IMPORT_MANIFEST has no assimilation sources');
  }

  const active = blockers.length === 0;
  return Object.freeze({
    active,
    vendorPaths: Object.freeze(vendorPaths),
    blockers: Object.freeze(blockers),
  });
}

export function isUnderCommittedAssimilationQuarantine(
  repoRelativePath: string,
  quarantine: CommittedAssimilationQuarantine,
): boolean {
  if (!quarantine.active) return false;
  const normalized = repoRelativePath.replace(/\\/g, '/');
  if (normalized === ASSIMILATION_REL || normalized.startsWith(`${ASSIMILATION_REL}/`)) {
    if (normalized === QUARANTINE_REL || normalized === MANIFEST_REL) return true;
    return quarantine.vendorPaths.some(
      (vendorPath) => normalized === vendorPath || normalized.startsWith(`${vendorPath}/`),
    );
  }
  return false;
}
