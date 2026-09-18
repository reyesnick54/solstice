import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type MigrationDomain = 'customer' | 'ledger' | 'evidence' | 'security';

export type HeliosMigrationEntry = {
  readonly migrationId: string;
  readonly domain: MigrationDomain;
  readonly filename: string;
  readonly heliosWorkPackage: string | null;
  readonly forwardEffect: string;
  readonly dependency: readonly string[];
  readonly dataBackfillRequired: boolean;
  readonly downtimeRequired: boolean;
  readonly compatibilityImpact: 'ADDITIVE' | 'SCHEMA_EXTENSION' | 'MANUAL_REVIEW';
  readonly rollbackStrategy: 'FORWARD_FIX_ONLY' | 'APP_ROLLBACK_COMPATIBLE' | 'DATABASE_RESTORE_REQUIRED';
  readonly qualificationTests: readonly string[];
  readonly checksum: string;
};

const FILE_RE = /^V(\d+)__([A-Za-z0-9_]+)\.sql$/;
const HELIOS_HEADER_RE = /HELIOS(?:\s+Phase\s+\d+\s+)?\s*(H\d+)/i;
const H18_HEADER_RE = /Strategy Lab\s+H18/i;

const MIGRATED_DOMAINS: readonly MigrationDomain[] = ['customer', 'ledger', 'evidence', 'security'];

const HELIOS_QUALIFICATION_TESTS: Readonly<Record<string, readonly string[]>> = {
  H04: ['tests/helios-h04-h05-authority-binding.test.ts', 'tests/persistence/helios-work.test.ts'],
  H05: ['tests/helios-h05-mandate-capability-approval-binding.test.ts', 'tests/persistence/helios-work.test.ts'],
  H06: [
    'tests/helios-h06-durable-work-execution.test.ts',
    'packages/platform/src/helios/helios-h06.test.ts',
    'tests/persistence/helios-work.test.ts',
  ],
  H08: ['tests/helios-h08-observation-provenance-freshness-entitlements.test.ts'],
  H09: ['tests/helios-h09-executable-opportunity-binding.test.ts', 'tests/persistence/helios-executable-opportunity.test.ts'],
  H13: ['tests/helios-h13-sandbox-capital-allocation.test.ts'],
  H14: ['tests/helios-h14-paper-grow-strategy.test.ts', 'tests/persistence/helios-paper-strategy.test.ts'],
  H16: ['packages/strategy-lab/src/capsule/strategy-capsule.test.ts'],
  H18: ['tests/helios-h18-strategy-promotion.test.ts'],
  H20: ['tests/helios-h20-meta-allocator.test.ts', 'tests/persistence/helios-meta-allocator.test.ts'],
  H21: ['tests/helios-h21-decision-validity-envelope.test.ts', 'tests/persistence/helios-decision-validity.test.ts'],
  H22: ['tests/helios-h22-provider-orchestration.test.ts', 'tests/persistence/helios-provider-orchestration.test.ts'],
  H23: ['tests/helios-h23-order-fill-settlement-lifecycle.test.ts', 'tests/persistence/helios-order-lifecycle.test.ts'],
  H29: ['tests/helios-h29-regulatory-evidence-reporting-lifecycle.test.ts', 'tests/persistence/helios-regulatory-evidence.test.ts'],
  H30: ['tests/helios-h30-supervisory-governance.test.ts'],
  H32: ['tests/helios-h32-economic-evaluation.test.ts', 'tests/persistence/helios-economic-evaluation.test.ts'],
};

type ParsedMigrationFile = {
  readonly version: number;
  readonly filename: string;
  readonly sql: string;
  readonly checksum: string;
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function migrationsDir(repoRoot: string, domain: MigrationDomain): string {
  return join(repoRoot, 'db', domain, 'migrations');
}

function listDomainMigrationFiles(repoRoot: string, domain: MigrationDomain): readonly ParsedMigrationFile[] {
  const directory = migrationsDir(repoRoot, domain);
  if (!existsSync(directory)) {
    return Object.freeze([]);
  }
  const files: ParsedMigrationFile[] = [];
  for (const filename of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    const match = FILE_RE.exec(filename);
    if (!match) {
      throw new Error(`migration filename is not V<number>__<slug>.sql: ${domain}/${filename}`);
    }
    const sql = readFileSync(join(directory, filename), 'utf8');
    files.push({
      version: Number.parseInt(match[1]!, 10),
      filename,
      sql,
      checksum: sha256Hex(sql),
    });
  }
  return Object.freeze(files);
}

function parseHeliosWorkPackage(sql: string): string | null {
  const heliosMatch = HELIOS_HEADER_RE.exec(sql);
  if (heliosMatch) {
    return heliosMatch[1]!.toUpperCase();
  }
  if (H18_HEADER_RE.test(sql)) {
    return 'H18';
  }
  return null;
}

function forwardEffectFromSql(sql: string): string {
  const firstLine = sql.split('\n').find((line) => line.trim().length > 0)?.trim() ?? '';
  return firstLine.replace(/^--\s*/, '');
}

function classifyRollback(workPackage: string | null): HeliosMigrationEntry['rollbackStrategy'] {
  if (workPackage === 'H30' || workPackage === 'H29') {
    return 'FORWARD_FIX_ONLY';
  }
  return 'APP_ROLLBACK_COMPATIBLE';
}

function classifyCompatibility(workPackage: string | null): HeliosMigrationEntry['compatibilityImpact'] {
  if (workPackage === 'H30') {
    return 'MANUAL_REVIEW';
  }
  return 'SCHEMA_EXTENSION';
}

function dependencyForVersion(version: number): readonly string[] {
  if (version <= 1) {
    return Object.freeze([]);
  }
  return Object.freeze([`V${String(version - 1).padStart(3, '0')}`]);
}

export function buildHeliosMigrationInventory(repoRoot: string): readonly HeliosMigrationEntry[] {
  const entries: HeliosMigrationEntry[] = [];
  for (const file of listDomainMigrationFiles(repoRoot, 'customer')) {
    const workPackage = parseHeliosWorkPackage(file.sql);
    if (!workPackage) {
      continue;
    }
    entries.push(
      Object.freeze({
        migrationId: `V${String(file.version).padStart(3, '0')}`,
        domain: 'customer',
        filename: file.filename,
        heliosWorkPackage: workPackage,
        forwardEffect: forwardEffectFromSql(file.sql),
        dependency: dependencyForVersion(file.version),
        dataBackfillRequired: false,
        downtimeRequired: false,
        compatibilityImpact: classifyCompatibility(workPackage),
        rollbackStrategy: classifyRollback(workPackage),
        qualificationTests: Object.freeze(HELIOS_QUALIFICATION_TESTS[workPackage] ?? ['tests/persistence/*.test.ts']),
        checksum: file.checksum,
      }),
    );
  }
  return Object.freeze(entries);
}

export function schemaMigrationHeads(repoRoot: string): Readonly<Record<MigrationDomain, string>> {
  const heads = {} as Record<MigrationDomain, string>;
  for (const domain of MIGRATED_DOMAINS) {
    const files = listDomainMigrationFiles(repoRoot, domain);
    const last = files.at(-1);
    heads[domain] = last ? `V${String(last.version).padStart(3, '0')}` : 'V000';
  }
  return Object.freeze(heads);
}

export function migrationChecksumManifest(repoRoot: string): Readonly<Record<string, string>> {
  const manifest: Record<string, string> = {};
  for (const domain of MIGRATED_DOMAINS) {
    for (const file of listDomainMigrationFiles(repoRoot, domain)) {
      manifest[`${domain}/${file.filename}`] = file.checksum;
    }
  }
  return Object.freeze(manifest);
}

export function hashFile(repoRoot: string, relPath: string): string | null {
  const absolute = join(repoRoot, relPath);
  if (!existsSync(absolute)) {
    return null;
  }
  return sha256Hex(readFileSync(absolute, 'utf8'));
}

export function listHeliosMigrationFilenames(repoRoot: string): readonly string[] {
  return Object.freeze(buildHeliosMigrationInventory(repoRoot).map((row) => row.filename));
}

export function assertNoDuplicateMigrationIds(repoRoot: string): readonly string[] {
  const blockers: string[] = [];
  for (const domain of readdirSync(join(repoRoot, 'db')).filter((name) =>
    existsSync(join(repoRoot, 'db', name, 'migrations')),
  )) {
    const dir = join(repoRoot, 'db', domain, 'migrations');
    const versions = readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => name.split('__')[0]!);
    const seen = new Set<string>();
    for (const version of versions) {
      if (seen.has(version)) {
        blockers.push(`${domain}: duplicate migration version ${version}`);
      }
      seen.add(version);
    }
  }
  return Object.freeze(blockers);
}
