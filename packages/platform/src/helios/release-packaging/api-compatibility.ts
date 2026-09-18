import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hashFile } from './migration-inventory.ts';

export type ApiCompatibilityFinding = {
  readonly specPath: string;
  readonly specHash: string;
  readonly infoVersion: string;
  readonly breakingChanges: readonly string[];
  readonly deprecatedFields: readonly string[];
  readonly frontendUpdateRequired: boolean;
  readonly sdkRegenerationRequired: boolean;
  readonly migrationPath: string;
};

export type ApiCompatibilityReport = {
  readonly primarySpec: string;
  readonly compatible: boolean;
  readonly blockers: readonly string[];
  readonly findings: readonly ApiCompatibilityFinding[];
};

const PRIMARY_BFF_SPEC = 'api/sunrey-consumer-bff-v1.openapi.yaml';

function parseInfoVersion(yaml: string): string {
  const match = /^info:\s*\n(?:[ \t].*\n)*?[ \t]+version:\s*(.+)$/m.exec(yaml);
  return match?.[1]?.trim() ?? 'unknown';
}

export function evaluateApiCompatibility(repoRoot: string): ApiCompatibilityReport {
  const blockers: string[] = [];
  const specHash = hashFile(repoRoot, PRIMARY_BFF_SPEC);
  if (!specHash) {
    blockers.push(`${PRIMARY_BFF_SPEC} missing`);
    return Object.freeze({
      primarySpec: PRIMARY_BFF_SPEC,
      compatible: false,
      blockers,
      findings: Object.freeze([]),
    });
  }

  const yaml = readFileSync(join(repoRoot, PRIMARY_BFF_SPEC), 'utf8');
  const infoVersion = parseInfoVersion(yaml);

  const breakingChanges: string[] = [];
  const deprecatedFields: string[] = [];

  if (infoVersion !== 'v1') {
    breakingChanges.push(`OpenAPI info.version changed from v1 to ${infoVersion}`);
  }

  const frontendUpdateRequired = breakingChanges.length > 0;
  const sdkRegenerationRequired = breakingChanges.length > 0;

  if (frontendUpdateRequired) {
    blockers.push('breaking OpenAPI changes require coordinated frontend update before deploy');
  }

  const finding: ApiCompatibilityFinding = Object.freeze({
    specPath: PRIMARY_BFF_SPEC,
    specHash,
    infoVersion,
    breakingChanges: Object.freeze(breakingChanges),
    deprecatedFields: Object.freeze(deprecatedFields),
    frontendUpdateRequired,
    sdkRegenerationRequired,
    migrationPath: frontendUpdateRequired
      ? 'Regenerate @solstice/sunrey-sdk consumer exports and deploy frontend before backend'
      : 'No frontend change required for v1 contract parity',
  });

  return Object.freeze({
    primarySpec: PRIMARY_BFF_SPEC,
    compatible: blockers.length === 0,
    blockers: Object.freeze(blockers),
    findings: Object.freeze([finding]),
  });
}
