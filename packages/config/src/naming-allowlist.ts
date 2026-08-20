/**
 * Reviewed allowlist for legacy identifiers that must remain.
 *
 * Do not allowlist an active public-facing Solstice product name just
 * to make CI green. Those stay MUST_MIGRATE public-surface debt.
 */

import {
  type MigrationPolicy,
  type NameClassification,
} from './naming-classification.ts';

export type NamingAllowlistEntry = {
  readonly id: string;
  readonly pathPattern: string;
  readonly tokenPattern: string;
  readonly linePattern?: string;
  readonly classification: NameClassification;
  readonly reason: string;
  readonly removalPolicy: MigrationPolicy;
};

export const NAMING_ALLOWLIST: readonly NamingAllowlistEntry[] = Object.freeze([
  {
    id: 'repo-root-package-name',
    pathPattern: 'package.json',
    tokenPattern: '^solstice$',
    linePattern: '"name"\\s*:\\s*"solstice"',
    classification: 'REPOSITORY_NAME',
    reason: 'Root npm/package name is the GitHub repository identifier. Repository rename is an administration change, not a code rewrite.',
    removalPolicy: 'HISTORICAL_ONLY',
  },
  {
    id: 'workspace-npm-scope',
    pathPattern: '**/*',
    tokenPattern: '^@solstice(/|$)',
    classification: 'PACKAGE_METADATA',
    reason: 'Existing workspace package names stay under @solstice/* until a coordinated publish rename. Not current public product copy.',
    removalPolicy: 'MANUAL_REVIEW',
  },
  {
    id: 'historical-sql-migrations',
    pathPattern: 'db/**/migrations/**',
    tokenPattern: 'solstice',
    classification: 'MIGRATION_IDENTIFIER',
    reason: 'Applied migration filenames and SQL identifiers are immutable. Changing them would reorder or invalidate history.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'persisted-event-types',
    pathPattern: 'packages/events/**',
    tokenPattern: '^solstice\\.',
    classification: 'EVENT_TYPE_IDENTIFIER',
    reason: 'Persisted event discriminators are replay keys. Versioned aliases only; no in-place rename.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'hash-and-seal-domains',
    pathPattern: 'packages/{security,permissions,identity,evidence,kernel}/**',
    tokenPattern: 'solstice\\.',
    classification: 'HASH_DOMAIN',
    reason: 'Symbol and hash domains are commitment strings. Changing them alters existing seals unless a protocol upgrade is issued.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'sdk-identity-system-ref',
    pathPattern: 'packages/sunrey-sdk/**',
    tokenPattern: '^solstice\\.identity',
    classification: 'PROTOCOL_IDENTIFIER',
    reason: 'identitySystemRef solstice.identity is a protocol compatibility string, not Explorer/SDK product copy.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'simulation-database-names',
    pathPattern: 'packages/persistence/**',
    tokenPattern: 'solstice_',
    classification: 'DATABASE_IDENTIFIER',
    reason: 'Local simulation database and role names are persisted identifiers. Alias later; do not rewrite history.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'legal-entity-simulation-ids',
    pathPattern: '**/*.{ts,sql}',
    tokenPattern: 'le_solstice_|SOLSTICE_(UK|US|EU|SA|AE)|SIMULATION_SOLSTICE_',
    classification: 'INTERNAL_RUNTIME_SYMBOL',
    reason: 'Simulation legal-entity catalog IDs are fixtures consumed by tests and journals. Rename only with a compensating migration.',
    removalPolicy: 'MANUAL_REVIEW',
  },
  {
    id: 'solstice-identity-types',
    pathPattern: 'packages/identity/**',
    tokenPattern: 'SolsticeIdentity',
    classification: 'INTERNAL_RUNTIME_SYMBOL',
    reason: 'SolsticeIdentityId is a published internal type. Chunk 142 may add a SunRey alias; the historical symbol stays for compatibility.',
    removalPolicy: 'MIGRATE_WITH_ALIAS',
  },
  {
    id: 'peg-provenance-enums',
    pathPattern: 'packages/personal-economic-graph/**',
    tokenPattern: '^SOLSTICE_(HOLDING|PAYMENT|CARD)$',
    classification: 'PROTOCOL_IDENTIFIER',
    reason: 'PEG provenance enumerations are stored graph facts. In-place rename would break replay.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'consent-recipient-kind',
    pathPattern: 'packages/consent/**',
    tokenPattern: '^SOLSTICE_SERVICE$',
    classification: 'PROTOCOL_IDENTIFIER',
    reason: 'Consent recipient kind is a persisted taxonomy value.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'pdv-export-format',
    pathPattern: 'packages/personal-data-vault/**',
    tokenPattern: 'SolsticePersonalDataExportV1|SOLSTICE_GENERATED',
    classification: 'PROTOCOL_IDENTIFIER',
    reason: 'Personal Data Vault export format and generated-source markers are versioned protocol strings.',
    removalPolicy: 'PRESERVE_IMMUTABLE',
  },
  {
    id: 'legacy-env-names',
    pathPattern: '**/*',
    tokenPattern: '^SOLSTICE_[A-Z0-9_]+$',
    classification: 'ENVIRONMENT_VARIABLE',
    reason: 'SOLSTICE_* environment names remain as required aliases. Canonical SUNREY_* names are inventoried; removal date is NOT_SELECTED.',
    removalPolicy: 'MIGRATE_WITH_ALIAS',
  },
  {
    id: 'historical-identity-chunk',
    pathPattern: 'docs/architecture/chunks/chunk-5-solstice-identity.json',
    tokenPattern: 'solstice',
    classification: 'HISTORICAL_DOCUMENTATION',
    reason: 'Chunk 5 declaration title records the historical Solstice Identity capability name.',
    removalPolicy: 'HISTORICAL_ONLY',
  },
  {
    id: 'historical-architecture-guidance',
    pathPattern: 'docs/architecture/historical-implementation.md',
    tokenPattern: 'solstice',
    classification: 'HISTORICAL_DOCUMENTATION',
    reason: 'Historical implementation guidance must keep the prior name so old PRs remain locatable.',
    removalPolicy: 'HISTORICAL_ONLY',
  },
  {
    id: 'naming-constitution-files',
    pathPattern: '{packages/config/src/product-identity.ts,packages/config/src/naming-*.ts,packages/config/src/demo.ts,scripts/sunrey-naming-audit.mjs,docs/architecture/sunrey-naming-*,docs/architecture/chunks/chunk-141.json,tools/architectural-linter/src/chunk-141-constitution.test.ts}',
    tokenPattern: 'solstice',
    classification: 'NAMING_CONSTITUTION',
    reason: 'The naming constitution and inventory must mention legacy markers to classify them. That is not current product branding.',
    removalPolicy: 'HISTORICAL_ONLY',
  },
  {
    id: 'github-repo-references',
    pathPattern: '**/*.{md,yml,yaml,json}',
    tokenPattern: '^solstice$',
    linePattern: 'github\\.com/[^\\s]+/solstice|reyesnick54/solstice',
    classification: 'REPOSITORY_NAME',
    reason: 'github.com/reyesnick54/solstice and checkout paths name the repository, not the current product.',
    removalPolicy: 'HISTORICAL_ONLY',
  },
]);

function expandBraces(pattern: string): readonly string[] {
  const match = /\{([^}]+)\}/.exec(pattern);
  const options = match?.[1];
  if (!match || match.index === undefined || options === undefined) {
    return [pattern];
  }
  const out: string[] = [];
  for (const option of options.split(',')) {
    const next = `${pattern.slice(0, match.index)}${option}${pattern.slice(match.index + match[0].length)}`;
    out.push(...expandBraces(next));
  }
  return out;
}

function globToRegExp(pattern: string): RegExp {
  const body = expandBraces(pattern)
    .map((item) =>
      item
        .replace(/[.+^$()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '::DOUBLE::')
        .replace(/\*/g, '[^/]*')
        .replace(/::DOUBLE::/g, '.*'),
    )
    .join('|');
  return new RegExp(`^(?:${body})$`);
}

const compiled = NAMING_ALLOWLIST.map((entry) => ({
  entry,
  pathRe: globToRegExp(entry.pathPattern),
  tokenRe: new RegExp(entry.tokenPattern, 'i'),
  lineRe: entry.linePattern === undefined ? undefined : new RegExp(entry.linePattern, 'i'),
}));

export type AllowlistMatch = {
  readonly allowlisted: true;
  readonly entry: NamingAllowlistEntry;
};

export type AllowlistMiss = {
  readonly allowlisted: false;
  readonly entry: undefined;
};

export function matchNamingAllowlist(
  path: string,
  token: string,
  lineText = '',
): AllowlistMatch | AllowlistMiss {
  const posix = path.replaceAll('\\', '/');
  for (const item of compiled) {
    if (item.pathRe.test(posix) && item.tokenRe.test(token) && (item.lineRe === undefined || item.lineRe.test(lineText))) {
      return { allowlisted: true, entry: item.entry };
    }
  }
  return { allowlisted: false, entry: undefined };
}

export function allowlistFingerprint(): string {
  return NAMING_ALLOWLIST.map((entry) =>
    [entry.id, entry.pathPattern, entry.tokenPattern, entry.classification, entry.removalPolicy].join('\t'),
  ).join('\n');
}
