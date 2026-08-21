#!/usr/bin/env node
/**
 * Validate PostgreSQL migration naming and ordering.
 * Does not apply migrations; CI persistence job applies them on empty Postgres.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION_RE = /^V(\d{3})__[A-Za-z0-9_]+\.sql$/;

export function checkMigrationQuality(root = ROOT) {
  const findings = [];
  const dbRoot = join(root, 'db');
  if (!existsSync(dbRoot)) {
    return { findings: ['db/: missing migration root'], databases: [] };
  }
  const databases = readdirSync(dbRoot).sort().filter((name) => existsSync(join(dbRoot, name, 'migrations')));
  if (databases.length === 0) {
    findings.push('db/: no bounded-database migration directories found');
  }
  for (const database of databases) {
    const dir = join(dbRoot, database, 'migrations');
    const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
    const versions = [];
    for (const name of files) {
      const match = VERSION_RE.exec(name);
      if (!match) {
        findings.push(`db/${database}/migrations/${name}: expected VNNN__name.sql`);
        continue;
      }
      versions.push(Number(match[1]));
    }
    const seen = new Set();
    let previous = 0;
    for (const version of versions) {
      if (seen.has(version)) {
        findings.push(`db/${database}: duplicate migration version V${String(version).padStart(3, '0')}`);
      }
      seen.add(version);
      if (version <= previous) {
        findings.push(`db/${database}: migration versions are not strictly increasing`);
      }
      previous = version;
    }
    if (versions.length > 0 && versions[0] !== 1) {
      findings.push(`db/${database}: first migration must be V001 so empty-database apply starts from zero`);
    }
  }
  return { findings, databases };
}

function main() {
  const { findings } = checkMigrationQuality(ROOT);
  if (findings.length > 0) {
    console.error('[DATABASE] migration quality failed:');
    for (const finding of findings) {
      console.error(`  ${finding}`);
    }
    process.exit(1);
  }
  console.log('[DATABASE] migration ordering: ok');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
