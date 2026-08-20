/**
 * Chunk 141 naming audit. Read-only scan of tracked files.
 * Does not rewrite protocol identifiers, hashes, or migrations.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { matchNamingAllowlist, type NamingAllowlistEntry } from './naming-allowlist.ts';
import {
  classifyLegacyOccurrence,
  extractLegacyTokens,
  isPublicNameClassification,
  type MigrationPolicy,
  type NameClassification,
} from './naming-classification.ts';
import { LEGACY_ENVIRONMENT_VARIABLES } from './naming-env-inventory.ts';
import { PROTOCOL_IDENTIFIERS_MUST_NOT_CHANGE } from './naming-symbol-inventory.ts';
import {
  NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN,
  PRODUCT_IDENTITY,
} from './product-identity.ts';

export const NAMING_INVENTORY_JSON = 'docs/architecture/sunrey-naming-inventory.json';
export const NAMING_INVENTORY_MD = 'docs/architecture/sunrey-naming-inventory.md';
export const NAMING_PUBLIC_DEBT_JSON = 'docs/architecture/sunrey-naming-public-debt.json';

const SKIP_SUFFIXES = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.woff',
  '.woff2',
  '.ttf',
  '.ico',
  '.pdf',
  '.wasm',
  '.lock',
]);

const SKIP_NAMES = new Set(['package-lock.json', 'Cargo.lock', 'yarn.lock', 'pnpm-lock.yaml']);

const SKIP_PATHS = new Set([
  NAMING_INVENTORY_JSON,
  NAMING_INVENTORY_MD,
  NAMING_PUBLIC_DEBT_JSON,
]);

export type NamingOccurrence = {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly token: string;
  readonly classification: NameClassification;
  readonly recommendedAction: MigrationPolicy;
  readonly allowlisted: boolean;
  readonly allowlistId?: string;
  readonly reason: string;
  readonly lineText: string;
};

export type NamingInventorySummary = {
  readonly generatedAt: 'deterministic';
  readonly masterBrand: typeof PRODUCT_IDENTITY.masterBrand;
  readonly tickerStatus: typeof PRODUCT_IDENTITY.tickerStatus;
  readonly occurrenceCount: number;
  readonly publicLegacyCount: number;
  readonly allowlistedCount: number;
  readonly mustMigrateCount: number;
  readonly migrateWithAliasCount: number;
  readonly preserveImmutableCount: number;
  readonly historicalOnlyCount: number;
  readonly manualReviewCount: number;
  readonly byClassification: Readonly<Record<NameClassification, number>>;
  readonly byAction: Readonly<Record<MigrationPolicy, number>>;
};

export type NamingInventory = {
  readonly schemaVersion: 1;
  readonly productIdentity: typeof PRODUCT_IDENTITY;
  readonly newPublicSolsticeBrandingForbidden: typeof NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN;
  readonly protocolIdsPreserved: readonly string[];
  readonly environmentVariables: typeof LEGACY_ENVIRONMENT_VARIABLES;
  readonly summary: NamingInventorySummary;
  readonly occurrences: readonly NamingOccurrence[];
};

export type PublicSurfaceDebtEntry = {
  readonly path: string;
  readonly token: string;
  readonly lineText: string;
};

export type PublicSurfaceDebt = {
  readonly schemaVersion: 1;
  readonly note: string;
  readonly entries: readonly PublicSurfaceDebtEntry[];
};

export type PublicSurfaceGuardFinding = {
  readonly path: string;
  readonly line: number;
  readonly token: string;
  readonly lineText: string;
  readonly reason: string;
};

export type NamingAuditResult = {
  readonly inventory: NamingInventory;
  readonly publicFindings: readonly PublicSurfaceGuardFinding[];
  readonly ok: boolean;
};

function emptyClassificationCounts(): Record<NameClassification, number> {
  return {
    PUBLIC_PRODUCT_NAME: 0,
    PUBLIC_API_METADATA: 0,
    PUBLIC_CLI_OUTPUT: 0,
    PUBLIC_SDK_METADATA: 0,
    PUBLIC_EXPLORER_METADATA: 0,
    PACKAGE_METADATA: 0,
    ENVIRONMENT_VARIABLE: 0,
    INTERNAL_RUNTIME_SYMBOL: 0,
    INTERNAL_PACKAGE_PATH: 0,
    DATABASE_IDENTIFIER: 0,
    MIGRATION_IDENTIFIER: 0,
    PROTOCOL_IDENTIFIER: 0,
    EVENT_TYPE_IDENTIFIER: 0,
    HASH_DOMAIN: 0,
    FIXTURE: 0,
    HISTORICAL_DOCUMENTATION: 0,
    REPOSITORY_NAME: 0,
    GIT_REFERENCE: 0,
    NAMING_CONSTITUTION: 0,
  };
}

function emptyActionCounts(): Record<MigrationPolicy, number> {
  return {
    MUST_MIGRATE: 0,
    MIGRATE_WITH_ALIAS: 0,
    PRESERVE_IMMUTABLE: 0,
    HISTORICAL_ONLY: 0,
    MANUAL_REVIEW: 0,
  };
}

export function listTrackedScanFiles(root: string): readonly string[] {
  const output = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return output
    .split('\0')
    .filter((rel) => rel.length > 0)
    .filter((rel) => {
      const name = rel.split('/').pop() ?? rel;
      if (SKIP_NAMES.has(name) || SKIP_PATHS.has(rel)) {
        return false;
      }
      const dot = name.lastIndexOf('.');
      if (dot >= 0 && SKIP_SUFFIXES.has(name.slice(dot))) {
        return false;
      }
      return true;
    })
    .sort();
}

function classifyWithAllowlist(
  path: string,
  lineText: string,
  token: string,
): {
  classification: NameClassification;
  recommendedAction: MigrationPolicy;
  reason: string;
  allowlisted: boolean;
  allowlistId?: string;
} {
  const classified = classifyLegacyOccurrence({ path, lineText, token });
  const allow = matchNamingAllowlist(path, token, lineText);
  if (allow.allowlisted) {
    const entry: NamingAllowlistEntry = allow.entry;
    return {
      classification: classified.classification,
      recommendedAction: classified.recommendedAction,
      reason: classified.reason,
      allowlisted: true,
      allowlistId: entry.id,
    };
  }
  return {
    classification: classified.classification,
    recommendedAction: classified.recommendedAction,
    reason: classified.reason,
    allowlisted: false,
  };
}

export function scanLegacyOccurrences(
  root: string,
  files?: readonly string[],
): readonly NamingOccurrence[] {
  const targets = files ?? listTrackedScanFiles(root);
  const occurrences: NamingOccurrence[] = [];
  for (const rel of targets) {
    const full = join(root, rel);
    if (!existsSync(full)) {
      continue;
    }
    let source: string;
    try {
      source = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    if (!/solstice/i.test(source)) {
      continue;
    }
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const lineText = lines[i] ?? '';
      if (!/solstice/i.test(lineText)) {
        continue;
      }
      for (const match of extractLegacyTokens(lineText)) {
        const classified = classifyWithAllowlist(rel, lineText, match.token);
        const occurrence: NamingOccurrence = {
          path: rel,
          line: i + 1,
          column: match.index + 1,
          token: match.token,
          classification: classified.classification,
          recommendedAction: classified.recommendedAction,
          allowlisted: classified.allowlisted,
          ...(classified.allowlistId === undefined ? {} : { allowlistId: classified.allowlistId }),
          reason: classified.reason,
          lineText,
        };
        occurrences.push(occurrence);
      }
    }
  }
  occurrences.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path < b.path ? -1 : 1;
    }
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    if (a.column !== b.column) {
      return a.column - b.column;
    }
    return a.token < b.token ? -1 : a.token > b.token ? 1 : 0;
  });
  return occurrences;
}

export function summarizeOccurrences(occurrences: readonly NamingOccurrence[]): NamingInventorySummary {
  const byClassification = emptyClassificationCounts();
  const byAction = emptyActionCounts();
  let publicLegacyCount = 0;
  let allowlistedCount = 0;
  for (const item of occurrences) {
    byClassification[item.classification] += 1;
    byAction[item.recommendedAction] += 1;
    if (item.allowlisted) {
      allowlistedCount += 1;
    }
    if (isPublicNameClassification(item.classification) && item.recommendedAction === 'MUST_MIGRATE') {
      publicLegacyCount += 1;
    }
  }
  return {
    generatedAt: 'deterministic',
    masterBrand: PRODUCT_IDENTITY.masterBrand,
    tickerStatus: PRODUCT_IDENTITY.tickerStatus,
    occurrenceCount: occurrences.length,
    publicLegacyCount,
    allowlistedCount,
    mustMigrateCount: byAction.MUST_MIGRATE,
    migrateWithAliasCount: byAction.MIGRATE_WITH_ALIAS,
    preserveImmutableCount: byAction.PRESERVE_IMMUTABLE,
    historicalOnlyCount: byAction.HISTORICAL_ONLY,
    manualReviewCount: byAction.MANUAL_REVIEW,
    byClassification,
    byAction,
  };
}

export function buildNamingInventory(occurrences: readonly NamingOccurrence[]): NamingInventory {
  return {
    schemaVersion: 1,
    productIdentity: PRODUCT_IDENTITY,
    newPublicSolsticeBrandingForbidden: NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN,
    protocolIdsPreserved: PROTOCOL_IDENTIFIERS_MUST_NOT_CHANGE,
    environmentVariables: LEGACY_ENVIRONMENT_VARIABLES,
    summary: summarizeOccurrences(occurrences),
    occurrences,
  };
}

export function publicDebtKey(entry: Pick<PublicSurfaceDebtEntry, 'path' | 'token' | 'lineText'>): string {
  return `${entry.path}\n${entry.token}\n${entry.lineText}`;
}

export function collectPublicSurfaceDebt(
  occurrences: readonly NamingOccurrence[],
): readonly PublicSurfaceDebtEntry[] {
  const seen = new Set<string>();
  const entries: PublicSurfaceDebtEntry[] = [];
  for (const item of occurrences) {
    if (item.allowlisted) {
      continue;
    }
    if (!isPublicNameClassification(item.classification) || item.recommendedAction !== 'MUST_MIGRATE') {
      continue;
    }
    const entry = { path: item.path, token: item.token, lineText: item.lineText };
    const key = publicDebtKey(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push(entry);
  }
  entries.sort((a, b) => publicDebtKey(a).localeCompare(publicDebtKey(b)));
  return entries;
}

export function loadPublicSurfaceDebt(root: string): PublicSurfaceDebt {
  const full = join(root, NAMING_PUBLIC_DEBT_JSON);
  if (!existsSync(full)) {
    return {
      schemaVersion: 1,
      note: 'No frozen public-surface debt file yet.',
      entries: [],
    };
  }
  return JSON.parse(readFileSync(full, 'utf8')) as PublicSurfaceDebt;
}

export function evaluatePublicSurfaceGuard(
  occurrences: readonly NamingOccurrence[],
  debt: PublicSurfaceDebt,
): readonly PublicSurfaceGuardFinding[] {
  if (NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN !== true) {
    throw new Error('NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN must remain true');
  }
  const known = new Set(debt.entries.map((entry) => publicDebtKey(entry)));
  const findings: PublicSurfaceGuardFinding[] = [];
  for (const item of occurrences) {
    if (item.allowlisted) {
      continue;
    }
    if (!isPublicNameClassification(item.classification) || item.recommendedAction !== 'MUST_MIGRATE') {
      continue;
    }
    if (known.has(publicDebtKey(item))) {
      continue;
    }
    findings.push({
      path: item.path,
      line: item.line,
      token: item.token,
      lineText: item.lineText,
      reason: 'New non-allowlisted current-public-surface legacy brand occurrence. Use SunRey.',
    });
  }
  return findings;
}

export function runNamingAudit(root: string, files?: readonly string[]): NamingAuditResult {
  const occurrences = scanLegacyOccurrences(root, files);
  const inventory = buildNamingInventory(occurrences);
  const debt = loadPublicSurfaceDebt(root);
  const publicFindings = evaluatePublicSurfaceGuard(occurrences, debt);
  return {
    inventory,
    publicFindings,
    ok: publicFindings.length === 0,
  };
}

export function renderInventoryMarkdown(inventory: NamingInventory): string {
  const { summary } = inventory;
  const classificationRows = Object.entries(summary.byClassification)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `| ${name} | ${count} |`)
    .join('\n');
  const actionRows = Object.entries(summary.byAction)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `| ${name} | ${count} |`)
    .join('\n');
  return `# SunRey naming inventory

Generated by \`scripts/sunrey-naming-audit.mjs\`. Do not edit counts by hand.

Canonical master brand: **${summary.masterBrand}**.
Ticker status: **${summary.tickerStatus}**.
\`NEW_PUBLIC_SOLSTICE_BRANDING_FORBIDDEN=${inventory.newPublicSolsticeBrandingForbidden}\`.

Protocol asset IDs preserved: ${inventory.protocolIdsPreserved.join(', ')}.

## Counts

| Metric | Count |
| --- | ---: |
| Total legacy-token occurrences | ${summary.occurrenceCount} |
| Current public-surface MUST_MIGRATE | ${summary.publicLegacyCount} |
| Allowlisted | ${summary.allowlistedCount} |
| MUST_MIGRATE | ${summary.mustMigrateCount} |
| MIGRATE_WITH_ALIAS | ${summary.migrateWithAliasCount} |
| PRESERVE_IMMUTABLE | ${summary.preserveImmutableCount} |
| HISTORICAL_ONLY | ${summary.historicalOnlyCount} |
| MANUAL_REVIEW | ${summary.manualReviewCount} |

## By classification

| Classification | Count |
| --- | ---: |
${classificationRows}

## By recommended action

| Action | Count |
| --- | ---: |
${actionRows}

## Environment variables

Legacy \`SOLSTICE_*\` names remain. Canonical \`SUNREY_*\` replacements are inventoried only. Safe removal date is \`NOT_SELECTED\`.

| Legacy | Canonical | Alias required | Removal date |
| --- | --- | --- | --- |
${inventory.environmentVariables
  .map(
    (item) =>
      `| \`${item.legacyName}\` | \`${item.canonicalName}\` | ${item.legacyAliasRequired} | ${item.safeRemovalDate} |`,
  )
  .join('\n')}

## Policy

- Current public surfaces must use SunRey.
- Approved historical identifiers may remain.
- Do not rewrite commitment hashes, event discriminators, migration names, or protocol IDs.
- Chunk 142 performs safe migration. This inventory is the exact baseline.
`;
}

export function writeNamingInventory(root: string, inventory: NamingInventory): void {
  const jsonPath = join(root, NAMING_INVENTORY_JSON);
  const mdPath = join(root, NAMING_INVENTORY_MD);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(inventory, null, 2)}\n`);
  writeFileSync(mdPath, renderInventoryMarkdown(inventory));
}

export function writePublicSurfaceDebt(root: string, occurrences: readonly NamingOccurrence[]): PublicSurfaceDebt {
  const debt: PublicSurfaceDebt = {
    schemaVersion: 1,
    note: 'Frozen Chunk 141 baseline of existing current-public-surface Solstice copy. New entries fail CI. Do not add a public product name here to silence the guard.',
    entries: collectPublicSurfaceDebt(occurrences),
  };
  const full = join(root, NAMING_PUBLIC_DEBT_JSON);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, `${JSON.stringify(debt, null, 2)}\n`);
  return debt;
}

export function protocolIdentifiersUnchanged(root: string): boolean {
  const samples = [
    ['packages/sunrey-sdk/src/ids.ts', "export const PUBLIC_ASSET_IDS = ['SUNREY_COIN', 'MOONREY_COIN'] as const;"],
    ['packages/permissions/src/verified-seal.ts', "Symbol('solstice.VerifiedExecutionAuthority')"],
    ['packages/identity/src/actor-context.ts', "Symbol('solstice.VerifiedActorContext')"],
    ['packages/security/src/crypto-guard.ts', "Symbol.for('solstice.security.cryptoProviderPermit')"],
    ['packages/sunrey-sdk/src/builders.ts', "identitySystemRef: 'solstice.identity'"],
  ] as const;
  for (const [rel, needle] of samples) {
    const full = join(root, rel);
    if (!existsSync(full)) {
      return false;
    }
    if (!readFileSync(full, 'utf8').includes(needle)) {
      return false;
    }
  }
  return true;
}

export function inventoryIsDeterministic(root: string, files?: readonly string[]): boolean {
  const first = buildNamingInventory(scanLegacyOccurrences(root, files));
  const second = buildNamingInventory(scanLegacyOccurrences(root, files));
  return JSON.stringify(first) === JSON.stringify(second);
}
