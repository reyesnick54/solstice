import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Client } from 'pg';

import { DATABASES, type PersistenceEnv } from './env.ts';
import { logPersistenceEvent } from './logging.ts';

export type MigrationFile = {
  readonly version: number;
  readonly filename: string;
  readonly absolutePath: string;
  readonly checksum: string;
  readonly sql: string;
};

export type DomainName = 'customer' | 'ledger' | 'evidence' | 'security';

const FILE_RE = /^V(\d+)__([A-Za-z0-9_]+)\.sql$/;

export function migrationsRoot(repoRoot: string, domain: DomainName): string {
  return join(repoRoot, 'db', domain, 'migrations');
}

export function listMigrationFiles(directory: string): MigrationFile[] {
  const names = readdirSync(directory).filter((name) => name.endsWith('.sql'));
  const files: MigrationFile[] = [];
  for (const filename of names) {
    const match = FILE_RE.exec(filename);
    if (!match) {
      throw new Error(`migration filename is not V<number>__<slug>.sql: ${filename}`);
    }
    const version = Number.parseInt(match[1]!, 10);
    const absolutePath = join(directory, filename);
    const sql = readFileSync(absolutePath, 'utf8');
    files.push({
      version,
      filename,
      absolutePath,
      checksum: sha256Hex(sql),
      sql,
    });
  }
  files.sort((a, b) => a.version - b.version);
  assertContiguous(files);
  return files;
}

function assertContiguous(files: readonly MigrationFile[]): void {
  for (let i = 0; i < files.length; i += 1) {
    const expected = i + 1;
    if (files[i]!.version !== expected) {
      throw new Error(
        `migration versions must be contiguous starting at 1; expected V${String(expected).padStart(3, '0')} got V${String(files[i]!.version).padStart(3, '0')}`,
      );
    }
  }
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function ensureMigrationTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migration (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL
    )
  `);
}

export async function appliedMigrations(
  client: Client,
): Promise<ReadonlyMap<number, { filename: string; checksum: string }>> {
  const result = await client.query<{
    version: number;
    filename: string;
    checksum: string;
  }>('SELECT version, filename, checksum FROM public.schema_migration ORDER BY version');
  const map = new Map<number, { filename: string; checksum: string }>();
  for (const row of result.rows) {
    map.set(row.version, { filename: row.filename, checksum: row.checksum });
  }
  return map;
}

export async function applyMigrations(input: {
  client: Client;
  files: readonly MigrationFile[];
  domain: DomainName;
}): Promise<{ applied: number; verified: number }> {
  await ensureMigrationTable(input.client);
  const already = await appliedMigrations(input.client);
  let applied = 0;
  let verified = 0;
  for (const file of input.files) {
    const prior = already.get(file.version);
    if (prior) {
      if (prior.checksum !== file.checksum || prior.filename !== file.filename) {
        throw new Error(
          `applied migration ${file.filename} is immutable; checksum or name changed`,
        );
      }
      verified += 1;
      continue;
    }
    await input.client.query('BEGIN');
    try {
      await input.client.query(file.sql);
      await input.client.query(
        `INSERT INTO public.schema_migration (version, filename, checksum, applied_at)
         VALUES ($1, $2, $3, NOW())`,
        [file.version, file.filename, file.checksum],
      );
      await input.client.query('COMMIT');
      applied += 1;
      logPersistenceEvent({
        level: 'info',
        code: 'MIGRATION_APPLIED',
        domain: input.domain,
        message: 'applied versioned SQL migration',
        migrationVersion: file.version,
      });
    } catch (error) {
      await input.client.query('ROLLBACK');
      logPersistenceEvent({
        level: 'error',
        code: 'MIGRATION_FAILED',
        domain: input.domain,
        message: 'versioned SQL migration failed; transaction rolled back',
        migrationVersion: file.version,
      });
      throw error;
    }
  }
  return { applied, verified };
}

export async function migrateDomain(input: {
  env: PersistenceEnv;
  repoRoot: string;
  domain: DomainName;
}): Promise<{ applied: number; verified: number }> {
  const database = DATABASES[input.domain];
  const client = new Client({
    host: input.env.host,
    port: input.env.port,
    user: input.env.migratorUser,
    password: input.env.migratorPassword,
    database,
  });
  await client.connect();
  try {
    const files = listMigrationFiles(migrationsRoot(input.repoRoot, input.domain));
    return await applyMigrations({ client, files, domain: input.domain });
  } finally {
    await client.end();
  }
}

export async function migrateAll(env: PersistenceEnv, repoRoot: string): Promise<void> {
  for (const domain of ['customer', 'ledger', 'evidence', 'security'] as const) {
    await migrateDomain({ env, repoRoot, domain });
  }
}
