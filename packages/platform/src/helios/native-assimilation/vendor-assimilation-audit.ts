/**
 * Audit vendor/assimilation/ for quarantined foreign application source.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  isPathUnderCommittedQuarantineArchive,
  readCommittedQuarantineArchivePolicy,
} from './quarantine-archive-policy.ts';

const ASSIMILATION_REL = 'vendor/assimilation';

/** Allowed filenames under vendor/assimilation when no foreign runtime source remains. */
const LEGAL_ONLY_BASENAMES = new Set([
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'NOTICE',
  'NOTICE.md',
  'THIRD_PARTY_NOTICES',
  'THIRD_PARTY_NOTICES.md',
  'README.md',
  'RETIRED.md',
  'PROVENANCE.json',
  'provenance-manifest.json',
]);

const FORBIDDEN_SOURCE_EXTENSIONS = new Set([
  '.cs',
  '.csproj',
  '.sln',
  '.py',
  '.pyc',
  '.pyo',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.dll',
  '.so',
  '.exe',
  '.wasm',
]);

export type VendorAssimilationAuditCheck = {
  readonly id: string;
  readonly passed: boolean;
  readonly message: string;
};

export type VendorAssimilationAuditResult = {
  readonly assimilationPath: typeof ASSIMILATION_REL;
  readonly present: boolean;
  readonly checks: readonly VendorAssimilationAuditCheck[];
  readonly pass: boolean;
  readonly blockers: readonly string[];
  readonly retainedLegalPaths: readonly string[];
  readonly removedForeignSource: boolean;
};

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function isLegalOnlyFile(relFromAssimilation: string): boolean {
  const base = relFromAssimilation.split('/').pop() ?? relFromAssimilation;
  if (LEGAL_ONLY_BASENAMES.has(base)) return true;
  if (base.startsWith('LICENSE') || base.startsWith('COPYRIGHT')) return true;
  if (relFromAssimilation.startsWith('legal/')) return true;
  return false;
}

export function auditVendorAssimilationTree(root: string): VendorAssimilationAuditResult {
  const assimilationAbs = join(root, ASSIMILATION_REL);
  const checks: VendorAssimilationAuditCheck[] = [];
  const blockers: string[] = [];
  const present = existsSync(assimilationAbs);

  const docNoticesPath = join(root, 'docs/helios/native-assimilation/THIRD_PARTY_NOTICES.md');
  const docProvenancePath = join(
    root,
    'docs/helios/native-assimilation/NATIVE_ASSIMILATION_PROVENANCE_MANIFEST.json',
  );
  const legalDocsPresent = existsSync(docNoticesPath) && existsSync(docProvenancePath);

  if (!present) {
    checks.push({
      id: 'vendor.assimilation.absent',
      passed: true,
      message: `${ASSIMILATION_REL}/ not present — no quarantined foreign application tree in repository`,
    });
    checks.push({
      id: 'vendor.assimilation.legal_notices_preserved',
      passed: legalDocsPresent,
      message: legalDocsPresent
        ? 'legal notices and provenance manifest under docs/helios/native-assimilation/'
        : 'missing THIRD_PARTY_NOTICES or NATIVE_ASSIMILATION_PROVENANCE_MANIFEST',
    });
    const absentBlockers = legalDocsPresent
      ? []
      : ['legal attribution artifacts missing (THIRD_PARTY_NOTICES or provenance manifest)'];
    return Object.freeze({
      assimilationPath: ASSIMILATION_REL,
      present: false,
      checks: Object.freeze(checks),
      pass: absentBlockers.length === 0,
      blockers: Object.freeze(absentBlockers),
      retainedLegalPaths: Object.freeze([]),
      removedForeignSource: true,
    });
  }

  const committedQuarantine = readCommittedQuarantineArchivePolicy(root);

  if (committedQuarantine.active) {
    for (const prefix of committedQuarantine.vendorPathPrefixes) {
      if (!existsSync(join(root, prefix))) {
        blockers.push(`committed quarantine archive missing at ${prefix}`);
      }
    }

    const assimilationRootArtifacts = new Set([
      'vendor/assimilation/QUARANTINE.json',
      'vendor/assimilation/SOURCE_IMPORT_MANIFEST.json',
      'vendor/assimilation/README.md',
    ]);

    const files = walk(assimilationAbs);
    for (const abs of files) {
      const rel = relative(assimilationAbs, abs);
      const repoRel = join(ASSIMILATION_REL, rel).replaceAll('\\', '/');
      if (assimilationRootArtifacts.has(repoRel)) continue;
      if (!isPathUnderCommittedQuarantineArchive(repoRel, committedQuarantine)) {
        blockers.push(`file outside committed quarantine manifest paths: ${repoRel}`);
      }
    }

    checks.push({
      id: 'vendor.assimilation.committed_quarantine_archives',
      passed: blockers.length === 0,
      message:
        blockers.length === 0
          ? `committed QUARANTINED OSS archives under ${committedQuarantine.vendorPathPrefixes.length} manifest path(s); excluded from runtime`
          : 'committed quarantine archive layout invalid',
    });
    checks.push({
      id: 'vendor.assimilation.legal_notices_preserved',
      passed: legalDocsPresent,
      message: legalDocsPresent
        ? 'legal notices and provenance manifest under docs/helios/native-assimilation/'
        : 'missing THIRD_PARTY_NOTICES or NATIVE_ASSIMILATION_PROVENANCE_MANIFEST',
    });
    if (!legalDocsPresent) {
      blockers.push('legal attribution artifacts missing (THIRD_PARTY_NOTICES or provenance manifest)');
    }

    const pass = blockers.length === 0;
    return Object.freeze({
      assimilationPath: ASSIMILATION_REL,
      present: true,
      checks: Object.freeze(checks),
      pass,
      blockers: Object.freeze(blockers),
      retainedLegalPaths: Object.freeze([]),
      removedForeignSource: false,
    });
  }

  const files = walk(assimilationAbs);
  const retainedLegal: string[] = [];
  let foreignSourceFound = false;

  for (const abs of files) {
    const rel = relative(assimilationAbs, abs);
    const repoRel = join(ASSIMILATION_REL, rel);
    const ext = rel.includes('.') ? `.${rel.split('.').pop()}` : '';

    if (FORBIDDEN_SOURCE_EXTENSIONS.has(ext)) {
      foreignSourceFound = true;
      blockers.push(`foreign source file retained: ${repoRel}`);
      continue;
    }

    if (isLegalOnlyFile(rel)) {
      retainedLegal.push(repoRel);
    } else if (!rel.endsWith('.md') && !rel.endsWith('.json')) {
      foreignSourceFound = true;
      blockers.push(`non-legal artifact under assimilation quarantine: ${repoRel}`);
    }
  }

  checks.push({
    id: 'vendor.assimilation.no_foreign_source',
    passed: !foreignSourceFound,
    message: foreignSourceFound
      ? 'foreign application source still present under vendor/assimilation'
      : 'only legal/provenance artifacts remain (or tree empty)',
  });

  checks.push({
    id: 'vendor.assimilation.legal_notices_preserved',
    passed: retainedLegal.length > 0 || legalDocsPresent,
    message:
      retainedLegal.length > 0
        ? `${retainedLegal.length} legal/provenance file(s) under vendor/assimilation`
        : legalDocsPresent
          ? 'legal notices and provenance manifest under docs/helios/native-assimilation/'
          : 'missing THIRD_PARTY_NOTICES or NATIVE_ASSIMILATION_PROVENANCE_MANIFEST',
  });
  if (!retainedLegal.length && !legalDocsPresent) {
    blockers.push('legal attribution artifacts missing (THIRD_PARTY_NOTICES or provenance manifest)');
  }

  const pass = blockers.length === 0;

  return Object.freeze({
    assimilationPath: ASSIMILATION_REL,
    present: true,
    checks: Object.freeze(checks),
    pass,
    blockers: Object.freeze(blockers),
    retainedLegalPaths: Object.freeze(retainedLegal),
    removedForeignSource: !foreignSourceFound,
  });
}

/** Scan TypeScript/JavaScript sources for runtime imports of vendor/assimilation. */
export function scanRuntimeAssimilationImports(root: string): readonly string[] {
  const violations: string[] = [];
  const scanRoots = ['packages', 'services', 'scripts', 'tests'].map((rel) => join(root, rel));

  function scanDir(dir: string): void {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        scanDir(full);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) continue;
      const source = readFileSync(full, 'utf8');
      if (
        /(?:from|import)\s+['"]vendor\/assimilation/.test(source) ||
        /require\s*\(\s*['"]vendor\/assimilation/.test(source) ||
        /import\s*\(\s*['"]vendor\/assimilation/.test(source)
      ) {
        violations.push(relative(root, full));
      }
    }
  }

  for (const dir of scanRoots) scanDir(dir);
  return Object.freeze(violations);
}
