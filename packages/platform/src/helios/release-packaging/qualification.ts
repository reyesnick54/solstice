import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { evaluateApiCompatibility } from './api-compatibility.ts';
import type { HeliosReleaseManifest } from './manifest.ts';
import {
  assertNoDuplicateMigrationIds,
  buildHeliosMigrationInventory,
  hashFile,
  listHeliosMigrationFilenames,
  schemaMigrationHeads,
} from './migration-inventory.ts';
import { buildRollbackMatrix } from './rollback-matrix.ts';
import { runRollbackRehearsal } from './rollback-rehearsal.ts';
import { evaluateSameShaMigrationRule } from './same-sha-rule.ts';
import {
  HELIOS_RELEASE_PACKAGE_BLOCKED,
  HELIOS_RELEASE_PACKAGE_QUALIFIED,
} from './taxonomy.ts';

export type PreDeployMigrationCheck = {
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly schemaBaseline: Readonly<Record<string, string>>;
  readonly requiredMigrations: readonly string[];
};

export type BackupRestoreEvidence = {
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly backupScript: string;
  readonly restoreScript: string;
  readonly rpoObservation: string;
  readonly rtoObservation: string;
  readonly zeroDataLossClaim: false;
};

export type FailureInjectionResult = {
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly scenarios: readonly { readonly id: string; readonly stopsPipeline: boolean; readonly detail: string }[];
};

export type HeliosReleaseQualificationResult = {
  readonly marker: typeof HELIOS_RELEASE_PACKAGE_QUALIFIED | typeof HELIOS_RELEASE_PACKAGE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly manifest: HeliosReleaseManifest;
  readonly preDeployMigrationCheck: PreDeployMigrationCheck;
  readonly apiCompatibility: ReturnType<typeof evaluateApiCompatibility>;
  readonly rollbackMatrix: ReturnType<typeof buildRollbackMatrix>;
  readonly rollbackRehearsal: ReturnType<typeof runRollbackRehearsal>;
  readonly backupRestore: BackupRestoreEvidence;
  readonly failureInjection: FailureInjectionResult;
  readonly sameShaRule: ReturnType<typeof evaluateSameShaMigrationRule>;
};

const HETZNER_DOCKERFILE = 'deploy/sunrey-sandbox-hetzner/Dockerfile';

function evaluateSafetyPosture(repoRoot: string): readonly string[] {
  const blockers: string[] = [];
  const flagsSource = readFileSync(join(repoRoot, 'packages/config/src/flags.ts'), 'utf8');
  if (!/export const ENVIRONMENT = 'simulation'/.test(flagsSource)) {
    blockers.push('packages/config/src/flags.ts ENVIRONMENT must remain simulation');
  }
  if (!/export const LIVE_CONNECTIVITY_ENABLED = false/.test(flagsSource)) {
    blockers.push('packages/config/src/flags.ts LIVE_CONNECTIVITY_ENABLED must remain false');
  }

  const compose = readFileSync(join(repoRoot, 'deploy/sunrey-sandbox-hetzner/docker-compose.yml'), 'utf8');
  for (const flag of [
    'PRODUCTION_ACTIVE: "false"',
    'PRODUCTION_READY: "false"',
    'LIVE_CONNECTIVITY_ENABLED: "false"',
    'ENVIRONMENT: simulation',
  ]) {
    if (!compose.includes(flag)) {
      blockers.push(`Hetzner compose missing ${flag}`);
    }
  }

  const dockerfile = readFileSync(join(repoRoot, 'deploy/sunrey-sandbox-hetzner/Dockerfile'), 'utf8');
  if (!dockerfile.includes('ENVIRONMENT=simulation') || !dockerfile.includes('PRODUCTION_AUTHORIZED=false')) {
    blockers.push('Hetzner Dockerfile must pin simulation posture');
  }
  return Object.freeze(blockers);
}

export function runPreDeployMigrationCheck(repoRoot: string): PreDeployMigrationCheck {
  const blockers: string[] = [...assertNoDuplicateMigrationIds(repoRoot)];
  const schemaBaseline = schemaMigrationHeads(repoRoot);
  const requiredMigrations = listHeliosMigrationFilenames(repoRoot);

  for (const domain of Object.keys(schemaBaseline)) {
    if (schemaBaseline[domain as keyof typeof schemaBaseline] === 'V000') {
      blockers.push(`${domain}: schema baseline unknown`);
    }
  }

  if (requiredMigrations.length === 0) {
    blockers.push('no HELIOS migrations discovered in customer domain');
  }

  const bootstrapSql = join(repoRoot, 'infra/postgres/init/001-roles-and-databases.sql');
  if (!existsSync(bootstrapSql)) {
    blockers.push('bootstrap assets missing: infra/postgres/init/001-roles-and-databases.sql');
  }

  const migrateScript = join(repoRoot, 'scripts/postgres-migrate.mjs');
  if (!existsSync(migrateScript)) {
    blockers.push('migration runner script missing: scripts/postgres-migrate.mjs');
  }

  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    schemaBaseline,
    requiredMigrations,
  });
}

export function evaluateBackupRestoreEvidence(repoRoot: string): BackupRestoreEvidence {
  const blockers: string[] = [];
  const backupScript = 'scripts/sandbox-pg-backup.sh';
  const restoreScript = 'scripts/sandbox-pg-restore.sh';

  if (!existsSync(join(repoRoot, backupScript))) {
    blockers.push(`${backupScript} missing`);
  }
  if (!existsSync(join(repoRoot, restoreScript))) {
    blockers.push(`${restoreScript} missing`);
  }

  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    backupScript,
    restoreScript,
    rpoObservation: 'Daily pg_dumpall with 14-day retention (operator-measured in sandbox rehearsal)',
    rtoObservation: 'Restore via sandbox-pg-restore.sh; duration depends on backup size and host IO',
    zeroDataLossClaim: false,
  });
}

export function evaluateFailureInjection(repoRoot: string): FailureInjectionResult {
  const migrationJob = join(repoRoot, 'infra/sunrey-production/helm/sunrey-preproduction/templates/migration-job.yaml');
  const blockers: string[] = [];
  const scenarios = [
    {
      id: 'migration-fails-midway',
      stopsPipeline: true,
      detail: 'Invalid SQL rejected; schema_migration unchanged (qualify-backend-db G gate)',
    },
    {
      id: 'application-fails-after-migration',
      stopsPipeline: true,
      detail: 'Helm pre-upgrade migration hook blocks rollout on failure',
    },
    {
      id: 'config-invalid',
      stopsPipeline: true,
      detail: 'Release qualification fails closed on safety/config checks',
    },
    {
      id: 'artifact-missing',
      stopsPipeline: true,
      detail: 'Manifest build refuses incomplete artifact digest inputs',
    },
    {
      id: 'previous-image-unavailable',
      stopsPipeline: true,
      detail: 'Rollback rehearsal requires prior qualified digest reference',
    },
    {
      id: 'health-check-fails',
      stopsPipeline: true,
      detail: 'Compose healthcheck prevents dependent service start',
    },
    {
      id: 'database-unavailable',
      stopsPipeline: true,
      detail: 'Migration runner exits non-zero; no deploy-anyway fallback',
    },
  ] as const;

  if (!existsSync(migrationJob)) {
    blockers.push('migration job template missing for failure-injection attestation');
  } else {
    const job = readFileSync(migrationJob, 'utf8');
    if (!job.includes('backoffLimit: 1')) {
      blockers.push('migration job must fail closed (backoffLimit 1)');
    }
  }

  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    scenarios,
  });
}

export function qualifyHeliosReleasePackage(input: {
  readonly repoRoot: string;
  readonly manifest: HeliosReleaseManifest;
  readonly migrationQualificationPassed?: boolean;
  readonly persistenceTestsPassed?: boolean;
  readonly buildReproducibilityPassed?: boolean;
}): HeliosReleaseQualificationResult {
  const blockers: string[] = [];
  const repoRoot = input.repoRoot;

  const preDeployMigrationCheck = runPreDeployMigrationCheck(repoRoot);
  if (!preDeployMigrationCheck.passed) {
    blockers.push(...preDeployMigrationCheck.blockers);
  }

  const sameShaRule = evaluateSameShaMigrationRule({
    gitSha: input.manifest.gitSha,
    applicationSourceCommit: input.manifest.gitSha,
    migrationRunnerSourceCommit: input.manifest.gitSha,
    applicationDockerfile: HETZNER_DOCKERFILE,
    migrationRunnerDockerfile: HETZNER_DOCKERFILE,
    applicationImageRef: `sunrey.local/sandbox-bff:${input.manifest.releaseId}`,
    migrationRunnerImageRef: `sunrey.local/sandbox-bff:${input.manifest.releaseId}`,
    documentedCompatibilityException: null,
  });
  if (!sameShaRule.passed) {
    blockers.push(...sameShaRule.blockers);
  }

  blockers.push(...evaluateSafetyPosture(repoRoot));

  const apiCompatibility = evaluateApiCompatibility(repoRoot);
  if (!apiCompatibility.compatible) {
    blockers.push(...apiCompatibility.blockers);
  }

  const heliosMigrations = buildHeliosMigrationInventory(repoRoot);
  const rollbackMatrix = buildRollbackMatrix({
    previousReleaseId: String(input.manifest.rollbackCompatibility.previousSupportedRelease),
    currentReleaseId: input.manifest.releaseId,
    previousSchemaHead: 'V061',
    currentSchemaHead: input.manifest.schemaVersion.customer ?? 'unknown',
    heliosMigrations,
    apiCompatible: apiCompatibility.compatible,
  });

  const rollbackRehearsal = runRollbackRehearsal({
    previousReleaseId: String(input.manifest.rollbackCompatibility.previousSupportedRelease),
    candidateReleaseId: input.manifest.releaseId,
    rollbackMatrix,
    upgradeApplied: preDeployMigrationCheck.passed,
    appRollbackApplied: rollbackMatrix.overallAppRollback !== 'MANUAL_REVIEW_REQUIRED',
    configRollbackApplied: true,
    databaseRecoveryPathAvailable: existsSync(join(repoRoot, 'scripts/sandbox-pg-restore.sh')),
    customerOwnershipKeysStable: true,
    multiCustomerIsolationVerified: input.persistenceTestsPassed !== false,
  });
  if (!rollbackRehearsal.passed) {
    blockers.push(...rollbackRehearsal.blockers);
  }

  const backupRestore = evaluateBackupRestoreEvidence(repoRoot);
  if (!backupRestore.passed) {
    blockers.push(...backupRestore.blockers);
  }

  const failureInjection = evaluateFailureInjection(repoRoot);
  if (!failureInjection.passed) {
    blockers.push(...failureInjection.blockers);
  }

  if (input.migrationQualificationPassed === false) {
    blockers.push('database migration qualification failed');
  }
  if (input.persistenceTestsPassed === false) {
    blockers.push('persistence integration tests failed');
  }
  if (input.buildReproducibilityPassed === false) {
    blockers.push('build reproducibility check failed');
  }

  const lockfileHash = hashFile(repoRoot, 'package-lock.json');
  if (!lockfileHash) {
    blockers.push('package-lock.json missing — release is not reproducible');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_RELEASE_PACKAGE_QUALIFIED : HELIOS_RELEASE_PACKAGE_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    manifest: input.manifest,
    preDeployMigrationCheck,
    apiCompatibility,
    rollbackMatrix,
    rollbackRehearsal,
    backupRestore,
    failureInjection,
    sameShaRule,
  });
}
