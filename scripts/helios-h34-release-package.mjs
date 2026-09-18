#!/usr/bin/env node
/**
 * HELIOS H34 — release candidate packaging, migration qualification, and rollback evidence.
 * Does not deploy, does not activate production, does not authorize live finance.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_REL = 'release/helios-release-manifest.json';
const EVIDENCE_REL = 'release/helios-h34-evidence.json';

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? (result.stdout ?? '').trim() : '';
}

function run(command, args, env = process.env) {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', env });
  return {
    command: [command, ...args].join(' '),
    status: result.status ?? 1,
    durationMs: Date.now() - started,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function loadPlatform() {
  return import('../packages/platform/src/helios/release-packaging/index.ts');
}

function sha256File(relPath) {
  const absolute = join(ROOT, relPath);
  if (!existsSync(absolute)) {
    return null;
  }
  return createHash('sha256').update(readFileSync(absolute)).digest('hex');
}

function collectBuildReproducibility(gitSha) {
  const inputs = {
    nodeVersion: process.version,
    rustToolchain: existsSync(join(ROOT, 'packages/sunrey-chain/rust/rust-toolchain.toml'))
      ? readFileSync(join(ROOT, 'packages/sunrey-chain/rust/rust-toolchain.toml'), 'utf8').match(/channel\s*=\s*"([^"]+)"/)?.[1] ?? 'unknown'
      : 'unknown',
    lockfileDigest: sha256File('package-lock.json'),
    dockerfileDigest: sha256File('deploy/sunrey-sandbox-hetzner/Dockerfile'),
    composeDigest: sha256File('deploy/sunrey-sandbox-hetzner/docker-compose.yml'),
    gitSha,
  };
  const passed = Boolean(inputs.lockfileDigest && inputs.dockerfileDigest && inputs.composeDigest && /^[0-9a-f]{40}$/.test(gitSha));
  return { passed, inputs };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const skipDb = args.has('--skip-db');
  const skipTests = args.has('--skip-tests');
  const gitSha = git(['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/.test(gitSha)) {
    console.error('[H34] unable to resolve git SHA');
    process.exit(1);
  }

  const platform = await loadPlatform();
  const buildRepro = collectBuildReproducibility(gitSha);

  let migrationQualificationPassed = null;
  let persistenceTestsPassed = null;
  const gateRuns = [];

  gateRuns.push(run('node', ['scripts/check-migration-quality.mjs']));
  gateRuns.push(run('node', ['scripts/check-production-safety.mjs']));
  gateRuns.push(run('node', ['scripts/check-api-specs.mjs']));

  if (!skipDb) {
    const dbMigrate = run('npm', ['run', 'db:migrate']);
    gateRuns.push(dbMigrate);
    if (dbMigrate.status === 0) {
      const dbQualify = run('npm', ['run', 'qualify:backend-db', '--', '--skip-persistence']);
      gateRuns.push(dbQualify);
      migrationQualificationPassed = dbQualify.status === 0;
    } else {
      migrationQualificationPassed = false;
    }
  }

  if (!skipTests && process.env.SUNREY_PERSISTENCE_TEST === '1') {
    const persistence = run('npm', ['run', 'test:persistence']);
    gateRuns.push(persistence);
    persistenceTestsPassed = persistence.status === 0;
  }

  // H34-specific gate only; workflow runs full `npm test` for H01–H33 regression separately.
  const heliosCritical = run('node', [
    '--experimental-strip-types',
    '--disable-warning=ExperimentalWarning',
    '--test',
    '--test-concurrency=1',
    '--test-reporter=spec',
    'tests/helios-h34-release-packaging.test.ts',
  ]);
  gateRuns.push(heliosCritical);

  const supplyChain = run('node', ['scripts/sunrey-release.mjs', 'audit']);
  gateRuns.push(supplyChain);

  const sameShaBindings = [
    {
      role: 'application',
      imageRef: `sunrey.local/sandbox-bff:helios-rc-h34-${gitSha.slice(0, 12)}`,
      sourceCommit: gitSha,
      dockerfile: 'deploy/sunrey-sandbox-hetzner/Dockerfile',
    },
    {
      role: 'migration-runner',
      imageRef: `sunrey.local/sandbox-bff:helios-rc-h34-${gitSha.slice(0, 12)}`,
      sourceCommit: gitSha,
      dockerfile: 'deploy/sunrey-sandbox-hetzner/Dockerfile',
    },
  ];

  const manifest = platform.buildHeliosReleaseManifest({
    repoRoot: ROOT,
    gitSha,
    buildTimestampUtc: new Date().toISOString(),
    builtByWorkflow: process.env.GITHUB_WORKFLOW ?? null,
    buildRunId: process.env.GITHUB_RUN_ID ?? null,
    sameShaBindings,
    sbomReference: 'dist/sunrey-supply-chain/sbom.json',
    provenanceReference: 'dist/sunrey-supply-chain/provenance.json',
  });

  const qualification = platform.qualifyHeliosReleasePackage({
    repoRoot: ROOT,
    manifest,
    migrationQualificationPassed: skipDb ? undefined : migrationQualificationPassed === true,
    persistenceTestsPassed: skipTests ? undefined : persistenceTestsPassed === true,
    buildReproducibilityPassed: buildRepro.passed,
  });

  const allBlockers = [...qualification.blockers];
  for (const gate of gateRuns) {
    if (gate.status !== 0) {
      allBlockers.push(`gate failed: ${gate.command}`);
    }
  }

  const marker =
    allBlockers.length === 0
      ? platform.HELIOS_RELEASE_PACKAGE_QUALIFIED
      : platform.HELIOS_RELEASE_PACKAGE_BLOCKED;

  const evidence = {
    schema: 'helios.release.evidence.v1',
    workPackage: 'H34',
    sourceSha: gitSha,
    marker,
    qualified: allBlockers.length === 0,
    blockers: allBlockers,
    buildReproducibility: buildRepro,
    gateRuns: gateRuns.map((row) => ({
      command: row.command,
      status: row.status,
      durationMs: row.durationMs,
    })),
    migrationQualification: {
      passed: skipDb ? null : migrationQualificationPassed,
      skipped: skipDb,
      inventoryCount: platform.buildHeliosMigrationInventory(ROOT).length,
      schemaHeads: platform.schemaMigrationHeads(ROOT),
    },
    persistenceTests: {
      passed: skipTests ? null : persistenceTestsPassed,
      skipped: skipTests,
    },
    preDeployMigrationCheck: qualification.preDeployMigrationCheck,
    apiCompatibility: qualification.apiCompatibility,
    rollbackMatrix: qualification.rollbackMatrix,
    rollbackRehearsal: qualification.rollbackRehearsal,
    backupRestore: qualification.backupRestore,
    failureInjection: qualification.failureInjection,
    sameShaRule: qualification.sameShaRule,
    knownLimitations: Object.freeze([
      'Does not authorize live financial activity',
      'Does not publish to a container registry',
      'Does not deploy to Hetzner — artifact + evidence only',
      'Zero-data-loss is not claimed; RPO/RTO are operator-measured',
      'H34 rollback rehearsal is sandbox simulation, not production DR proof',
    ]),
  };

  mkdirSync(join(ROOT, 'release'), { recursive: true });
  writeFileSync(join(ROOT, MANIFEST_REL), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  writeFileSync(join(ROOT, EVIDENCE_REL), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');

  console.log(`[H34] wrote ${MANIFEST_REL}`);
  console.log(`[H34] wrote ${EVIDENCE_REL}`);
  console.log(`[H34] marker=${marker}`);
  if (allBlockers.length > 0) {
    for (const blocker of allBlockers) {
      console.error(`[H34] blocker: ${blocker}`);
    }
    for (const gate of gateRuns) {
      if (gate.status !== 0) {
        console.error(`[H34] gate output (${gate.command}):`);
        if (gate.stdout) {
          console.error(gate.stdout.split('\n').slice(-40).join('\n'));
        }
        if (gate.stderr) {
          console.error(gate.stderr.split('\n').slice(-40).join('\n'));
        }
      }
    }
    process.exit(1);
  }
}

await main();
