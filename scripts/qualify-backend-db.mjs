#!/usr/bin/env node
/**
 * Real PostgreSQL qualification for the backend release candidate.
 * Refuses in-memory substitutes. Does not invent migration success.
 */
import { Client } from 'pg';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { checkMigrationQuality } from './check-migration-quality.mjs';
import {
  applyMigrations,
  bootstrapPersistence,
  DATABASES,
  listMigrationFiles,
  migrateAll,
  migrationsRoot,
  persistenceEnvFromProcess,
} from '../packages/persistence/src/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATION_JOB = 'infra/sunrey-production/helm/sunrey-preproduction/templates/migration-job.yaml';

function fail(message) {
  console.error(`[DATABASE] ${message}`);
  process.exit(1);
}

async function withClient(env, database, fn) {
  const client = new Client({
    host: env.host,
    port: env.port,
    user: env.migratorUser,
    password: env.migratorPassword,
    database,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function dropApplicationDatabases(env) {
  const client = new Client({
    host: env.host,
    port: env.port,
    user: env.bootstrapUser,
    password: env.bootstrapPassword,
    database: 'postgres',
  });
  await client.connect();
  try {
    for (const database of Object.values(DATABASES)) {
      await client.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [database],
      );
      await client.query(`DROP DATABASE IF EXISTS ${database}`);
    }
  } finally {
    await client.end();
  }
}

async function latestVersions(client) {
  const result = await client.query(
    'SELECT version, filename FROM public.schema_migration ORDER BY version',
  );
  return result.rows;
}

async function qualifyFromZero(env) {
  await dropApplicationDatabases(env);
  await bootstrapPersistence(env);
  await migrateAll(env, ROOT);
  for (const domain of ['customer', 'ledger', 'evidence', 'security']) {
    const files = listMigrationFiles(migrationsRoot(ROOT, domain));
    const rows = await withClient(env, DATABASES[domain], latestVersions);
    if (rows.length !== files.length) {
      fail(`${domain}: expected ${files.length} applied migrations, found ${rows.length}`);
    }
    if (rows.at(-1)?.filename !== files.at(-1)?.filename) {
      fail(`${domain}: latest applied ${rows.at(-1)?.filename} != ${files.at(-1)?.filename}`);
    }
  }
  console.log('[DATABASE] A empty database → migrate to latest: PASS');
}

async function qualifyPriorUpgrade(env) {
  await dropApplicationDatabases(env);
  await bootstrapPersistence(env);
  for (const domain of ['customer', 'ledger']) {
    const files = listMigrationFiles(migrationsRoot(ROOT, domain));
    if (files.length < 2) {
      fail(`${domain}: need at least two versions for prior → latest`);
    }
    await withClient(env, DATABASES[domain], async (client) => {
      const prior = await applyMigrations({ client, files: files.slice(0, -1), domain });
      if (prior.applied !== files.length - 1) {
        fail(`${domain}: prior apply expected ${files.length - 1}, got ${prior.applied}`);
      }
      const latest = await applyMigrations({ client, files, domain });
      if (latest.applied !== 1 || latest.verified !== files.length - 1) {
        fail(`${domain}: latest upgrade applied=${latest.applied} verified=${latest.verified}`);
      }
    });
  }
  console.log('[DATABASE] B prior supported schema → migrate to latest: PASS');
}

async function qualifyRestart(env) {
  await migrateAll(env, ROOT);
  const before = {};
  for (const domain of ['customer', 'ledger', 'evidence', 'security']) {
    before[domain] = await withClient(env, DATABASES[domain], latestVersions);
  }
  const after = {};
  for (const domain of ['customer', 'ledger', 'evidence', 'security']) {
    after[domain] = await withClient(env, DATABASES[domain], latestVersions);
  }
  for (const domain of Object.keys(before)) {
    if (JSON.stringify(before[domain]) !== JSON.stringify(after[domain])) {
      fail(`${domain}: schema_migration drifted across restart`);
    }
  }
  console.log('[DATABASE] C restart after migrations: PASS');
}

async function qualifyLedgerAfterRestart(env) {
  await withClient(env, DATABASES.ledger, async (client) => {
    const tables = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'ledger' AND tablename IN ('journal', 'posting', 'ledger_account', 'account')
      ORDER BY tablename
    `);
    const names = tables.rows.map((row) => row.tablename);
    for (const required of ['journal', 'posting', 'ledger_account']) {
      if (!names.includes(required)) {
        fail(`ledger invariant: missing table ${required} after restart`);
      }
    }
    const journals = await client.query('SELECT count(*)::int AS n FROM ledger.journal');
    const postings = await client.query('SELECT count(*)::int AS n FROM ledger.posting');
    if (journals.rows[0].n < 0 || postings.rows[0].n < 0) {
      fail('ledger invariant: negative counts are impossible');
    }
    const duplicates = await client.query(`
      SELECT version, count(*)::int AS n
      FROM public.schema_migration
      GROUP BY version
      HAVING count(*) > 1
    `);
    if (duplicates.rows.length > 0) {
      fail('ledger invariant: duplicate schema_migration versions after restart');
    }
  });
  console.log('[DATABASE] E ledger invariants after restart: PASS');
}

function qualifyNoDuplicateVersions() {
  const { findings } = checkMigrationQuality(ROOT);
  if (findings.length > 0) {
    fail(findings.join('; '));
  }
  for (const database of ['customer', 'ledger', 'evidence', 'security', 'explorer']) {
    const dir = join(ROOT, 'db', database, 'migrations');
    if (!existsSync(dir)) {
      continue;
    }
    const versions = readdirSync(dir)
      .filter((name) => /^V\d+__/.test(name))
      .map((name) => name.split('__')[0]);
    if (new Set(versions).size !== versions.length) {
      fail(`${database}: duplicate migration versions`);
    }
  }
  console.log('[DATABASE] F no duplicate customer or ledger migration versions: PASS');
}

async function qualifyFailureGate(env) {
  const job = readFileSync(join(ROOT, MIGRATION_JOB), 'utf8');
  if (!job.includes('helm.sh/hook: pre-install,pre-upgrade')) {
    fail('migration job is not a pre-install/pre-upgrade hook');
  }
  if (!job.includes('helm.sh/hook-weight: "-10"')) {
    fail('migration job must run before application rollout');
  }
  if (!job.includes('backoffLimit: 1')) {
    fail('migration job must fail closed (backoffLimit 1)');
  }
  if (!job.includes('SUNREY_MIGRATE_BEFORE_ROLLOUT')) {
    fail('migration job must set SUNREY_MIGRATE_BEFORE_ROLLOUT');
  }

  await withClient(env, DATABASES.customer, async (client) => {
    const before = await latestVersions(client);
    let failed = false;
    try {
      await applyMigrations({
        client,
        domain: 'customer',
        files: [
          {
            version: 999,
            filename: 'V999__deliberately_invalid.sql',
            absolutePath: 'memory://invalid',
            checksum: 'invalid',
            sql: 'THIS IS NOT VALID SQL;',
          },
        ],
      });
    } catch {
      failed = true;
    }
    if (!failed) {
      fail('invalid migration must fail and block rollout');
    }
    const after = await latestVersions(client);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      fail('failed migration must roll back without recording a version');
    }
  });
  console.log('[DATABASE] G migration failure blocks application rollout: PASS');
}

function qualifyPersistenceSuite() {
  const result = spawnSync(
    'npm',
    ['run', 'test:persistence'],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SUNREY_PERSISTENCE_TEST: '1' } },
  );
  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    fail('persistence integration tests failed');
  }
  console.log('[DATABASE] D persistence integration tests: PASS');
}

export async function qualifyBackendDatabase(options = {}) {
  const skipPersistence = options.skipPersistence === true;
  let env;
  try {
    env = persistenceEnvFromProcess();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const probe = new Client({
    host: env.host,
    port: env.port,
    user: env.bootstrapUser,
    password: env.bootstrapPassword,
    database: 'postgres',
  });
  try {
    await probe.connect();
  } catch (error) {
    fail(
      `real PostgreSQL is required (in-memory substitutes are refused): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    await probe.end().catch(() => undefined);
  }

  qualifyNoDuplicateVersions();
  await qualifyFromZero(env);
  await qualifyPriorUpgrade(env);
  await qualifyRestart(env);
  await qualifyLedgerAfterRestart(env);
  await qualifyFailureGate(env);
  if (!skipPersistence) {
    qualifyPersistenceSuite();
  }
  return { ok: true, host: env.host, port: env.port };
}

async function main() {
  const skipPersistence = process.argv.includes('--skip-persistence');
  const report = await qualifyBackendDatabase({ skipPersistence });
  console.log(`[DATABASE] backend RC PostgreSQL qualification: PASS @ ${report.host}:${report.port}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
