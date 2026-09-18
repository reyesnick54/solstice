import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildHeliosMigrationInventory,
  hashFile,
  migrationChecksumManifest,
  schemaMigrationHeads,
} from './migration-inventory.ts';
import type { SameShaArtifactBinding } from './same-sha-rule.ts';
import {
  HELIOS_DEPLOYMENT_MANIFEST_VERSION,
  HELIOS_RELEASE_PACKAGE_SCHEMA,
  HELIOS_RELEASE_SEQUENCE,
  HELIOS_RELEASE_WORK_PACKAGE,
  HELIOS_STRATEGY_QUALIFICATION_ENGINE_VERSION,
} from './taxonomy.ts';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export type HeliosReleaseManifest = {
  readonly schema: typeof HELIOS_RELEASE_PACKAGE_SCHEMA;
  readonly releaseId: string;
  readonly gitSha: string;
  readonly repository: string;
  readonly buildTimestampUtc: string;
  readonly applicationVersion: string;
  readonly heliosVersion: string;
  readonly schemaVersion: Readonly<Record<string, string>>;
  readonly apiVersion: string;
  readonly strategyQualificationEngineVersion: string;
  readonly regulatoryCapabilityPackVersion: string;
  readonly modelRegistryVersion: string;
  readonly providerConfigVersion: string;
  readonly deploymentManifestVersion: string;
  readonly artifactDigest: string;
  readonly sbomReference: string | null;
  readonly provenanceReference: string | null;
  readonly environmentTarget: string;
  readonly builtByWorkflow: string | null;
  readonly buildRunId: string | null;
  readonly heliosSubsystemVersions: Readonly<Record<string, string>>;
  readonly providerConfigReference: readonly string[];
  readonly environmentCompatibility: readonly string[];
  readonly safetyPosture: Readonly<Record<string, boolean | string>>;
  readonly migrations: readonly string[];
  readonly migrationChecksums: Readonly<Record<string, string>>;
  readonly rollbackCompatibility: Readonly<Record<string, string>>;
  readonly sameShaBindings: readonly SameShaArtifactBinding[];
  readonly evidenceRefs: readonly string[];
};

function readJsonField<T>(repoRoot: string, relPath: string, selector: (value: unknown) => T | null): T | null {
  try {
    const parsed = JSON.parse(readFileSync(join(repoRoot, relPath), 'utf8')) as unknown;
    return selector(parsed);
  } catch {
    return null;
  }
}

function readYamlField(repoRoot: string, relPath: string, field: string): string | null {
  try {
    const content = readFileSync(join(repoRoot, relPath), 'utf8');
    const match = new RegExp(`^${field}:\\s*(.+)$`, 'm').exec(content);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

export function buildHeliosReleaseManifest(input: {
  readonly repoRoot: string;
  readonly gitSha: string;
  readonly buildTimestampUtc?: string;
  readonly artifactDigest?: string | null;
  readonly builtByWorkflow?: string | null;
  readonly buildRunId?: string | null;
  readonly sameShaBindings?: readonly SameShaArtifactBinding[];
  readonly sbomReference?: string | null;
  readonly provenanceReference?: string | null;
}): HeliosReleaseManifest {
  const repoRoot = input.repoRoot;
  const shortSha = input.gitSha.slice(0, 12);
  const releaseId = `helios-rc-h34-${shortSha}`;

  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    version?: string;
  };

  const schemaHeads = schemaMigrationHeads(repoRoot);
  const heliosMigrations = buildHeliosMigrationInventory(repoRoot);
  const migrationChecksums = migrationChecksumManifest(repoRoot);

  const jurisdictionPolicyVersion =
    readJsonField(repoRoot, 'packages/kernel/src/policy/jurisdiction-capability/packs/manifest.json', (value) => {
      if (value && typeof value === 'object' && 'policyVersion' in value) {
        return String((value as { policyVersion: unknown }).policyVersion);
      }
      return null;
    }) ?? 'unknown';

  const providerCatalogVersion =
    readYamlField(repoRoot, 'config/providers/free-api-catalog.yaml', 'schema_version') ?? 'unknown';
  const providerCatalogId =
    readYamlField(repoRoot, 'config/providers/free-api-catalog.yaml', 'catalog_id') ?? 'sunrey-free-api-catalog';

  const lockfileHash = hashFile(repoRoot, 'package-lock.json');
  const dockerfileHash = hashFile(repoRoot, 'deploy/sunrey-sandbox-hetzner/Dockerfile');
  const composeHash = hashFile(repoRoot, 'deploy/sunrey-sandbox-hetzner/docker-compose.yml');
  const openapiHash = hashFile(repoRoot, 'api/sunrey-consumer-bff-v1.openapi.yaml');

  const artifactDigest =
    input.artifactDigest ??
    (lockfileHash && dockerfileHash && composeHash
      ? `sha256:${sha256Hex(`${input.gitSha}:${lockfileHash}:${dockerfileHash}:${composeHash}`)}`
      : `sha256:${sha256Hex(`${input.gitSha}:incomplete-build-inputs`)}`);

  const heliosSubsystemVersions = Object.freeze({
    sequence: HELIOS_RELEASE_SEQUENCE,
    workPackage: HELIOS_RELEASE_WORK_PACKAGE,
    strategyCompiler: HELIOS_STRATEGY_QUALIFICATION_ENGINE_VERSION,
    growProductContract: 'helios-grow-controls-v1',
    resilience: 'helios-h31-v1',
    capacity: 'helios-h33-v1',
    regulatoryTransparency: 'helios-h30-v1',
    jurisdictionCapability: jurisdictionPolicyVersion,
  });

  return Object.freeze({
    schema: HELIOS_RELEASE_PACKAGE_SCHEMA,
    releaseId,
    gitSha: input.gitSha,
    repository: 'reyesnick54/solstice',
    buildTimestampUtc: input.buildTimestampUtc ?? new Date().toISOString(),
    applicationVersion: packageJson.version ?? '0.0.0',
    heliosVersion: `helios-h34-rc-${shortSha}`,
    schemaVersion: schemaHeads,
    apiVersion: 'v1',
    strategyQualificationEngineVersion: HELIOS_STRATEGY_QUALIFICATION_ENGINE_VERSION,
    regulatoryCapabilityPackVersion: jurisdictionPolicyVersion,
    modelRegistryVersion: 'risk-model-v1',
    providerConfigVersion: `${providerCatalogId}@${providerCatalogVersion}`,
    deploymentManifestVersion: HELIOS_DEPLOYMENT_MANIFEST_VERSION,
    artifactDigest,
    sbomReference: input.sbomReference ?? 'scripts/sunrey-release.mjs sbom',
    provenanceReference: input.provenanceReference ?? 'scripts/sunrey-release.mjs provenance',
    environmentTarget: 'hetzner-sandbox-simulation',
    builtByWorkflow: input.builtByWorkflow ?? null,
    buildRunId: input.buildRunId ?? null,
    heliosSubsystemVersions,
    providerConfigReference: Object.freeze([
      'config/providers/free-api-catalog.yaml',
      'infra/sandbox/env.production-sandbox.example',
    ]),
    environmentCompatibility: Object.freeze([
      'simulation',
      'hetzner-sandbox',
      'release-candidate-qualification',
    ]),
    safetyPosture: Object.freeze({
      ENVIRONMENT: 'simulation',
      PRODUCTION_READY: false,
      PRODUCTION_ACTIVE: false,
      LIVE_CONNECTIVITY_ENABLED: false,
      MAINNET_ACTIVE: false,
      productionAuthorized: false,
      authorizesLiveFinancialActivity: false,
    }),
    migrations: Object.freeze(heliosMigrations.map((row) => row.migrationId)),
    migrationChecksums,
    rollbackCompatibility: Object.freeze({
      previousSupportedRelease: `helios-rc-h33-${shortSha}`,
      appBackwardCompatibility: 'SAFE_APP_ROLLBACK',
      dbBackwardCompatibility: heliosMigrations.some((row) => row.rollbackStrategy === 'FORWARD_FIX_ONLY')
        ? 'FORWARD_FIX_REQUIRED'
        : 'SAFE_APP_ROLLBACK',
      configurationCompatibility: 'SAFE_APP_ROLLBACK',
      apiCompatibility: openapiHash ? 'v1-parity' : 'unknown',
    }),
    sameShaBindings: Object.freeze(input.sameShaBindings ?? []),
    evidenceRefs: Object.freeze([
      'release/helios-h34-evidence.json',
      'release/helios-release-manifest.json',
      'scripts/sandbox-pg-backup.sh',
      'scripts/sandbox-pg-restore.sh',
      'scripts/verify-sandbox-deployment.sh',
    ]),
  });
}
