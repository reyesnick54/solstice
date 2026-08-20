/**
 * Chunk 141 — name classification and migration policy.
 *
 * Classification decides whether a legacy Solstice token is safe to
 * migrate, must stay, or needs a human review. Chunk 142 performs
 * safe replacements. This file does not rewrite identifiers.
 */

export const NAME_CLASSIFICATIONS = [
  'PUBLIC_PRODUCT_NAME',
  'PUBLIC_API_METADATA',
  'PUBLIC_CLI_OUTPUT',
  'PUBLIC_SDK_METADATA',
  'PUBLIC_EXPLORER_METADATA',
  'PACKAGE_METADATA',
  'ENVIRONMENT_VARIABLE',
  'INTERNAL_RUNTIME_SYMBOL',
  'INTERNAL_PACKAGE_PATH',
  'DATABASE_IDENTIFIER',
  'MIGRATION_IDENTIFIER',
  'PROTOCOL_IDENTIFIER',
  'EVENT_TYPE_IDENTIFIER',
  'HASH_DOMAIN',
  'FIXTURE',
  'HISTORICAL_DOCUMENTATION',
  'REPOSITORY_NAME',
  'GIT_REFERENCE',
  'NAMING_CONSTITUTION',
] as const;

export type NameClassification = (typeof NAME_CLASSIFICATIONS)[number];

export const MIGRATION_POLICIES = [
  'MUST_MIGRATE',
  'MIGRATE_WITH_ALIAS',
  'PRESERVE_IMMUTABLE',
  'HISTORICAL_ONLY',
  'MANUAL_REVIEW',
] as const;

export type MigrationPolicy = (typeof MIGRATION_POLICIES)[number];

export const PUBLIC_NAME_CLASSIFICATIONS = [
  'PUBLIC_PRODUCT_NAME',
  'PUBLIC_API_METADATA',
  'PUBLIC_CLI_OUTPUT',
  'PUBLIC_SDK_METADATA',
  'PUBLIC_EXPLORER_METADATA',
] as const;

export type PublicNameClassification = (typeof PUBLIC_NAME_CLASSIFICATIONS)[number];

export function isPublicNameClassification(value: NameClassification): value is PublicNameClassification {
  return (PUBLIC_NAME_CLASSIFICATIONS as readonly NameClassification[]).includes(value);
}

export function defaultPolicyForClassification(classification: NameClassification): MigrationPolicy {
  switch (classification) {
    case 'PUBLIC_PRODUCT_NAME':
    case 'PUBLIC_API_METADATA':
    case 'PUBLIC_CLI_OUTPUT':
    case 'PUBLIC_SDK_METADATA':
    case 'PUBLIC_EXPLORER_METADATA':
      return 'MUST_MIGRATE';
    case 'ENVIRONMENT_VARIABLE':
      return 'MIGRATE_WITH_ALIAS';
    case 'PACKAGE_METADATA':
    case 'INTERNAL_RUNTIME_SYMBOL':
    case 'INTERNAL_PACKAGE_PATH':
      return 'MANUAL_REVIEW';
    case 'DATABASE_IDENTIFIER':
    case 'MIGRATION_IDENTIFIER':
    case 'PROTOCOL_IDENTIFIER':
    case 'EVENT_TYPE_IDENTIFIER':
    case 'HASH_DOMAIN':
      return 'PRESERVE_IMMUTABLE';
    case 'FIXTURE':
    case 'HISTORICAL_DOCUMENTATION':
    case 'REPOSITORY_NAME':
    case 'GIT_REFERENCE':
    case 'NAMING_CONSTITUTION':
      return 'HISTORICAL_ONLY';
  }
}

export type ClassificationInput = {
  readonly path: string;
  readonly lineText: string;
  readonly token: string;
};

export type ClassificationResult = {
  readonly classification: NameClassification;
  readonly recommendedAction: MigrationPolicy;
  readonly reason: string;
};

const IDENT_CHAR = /[A-Za-z0-9_@./-]/;

export type LegacyTokenMatch = {
  readonly token: string;
  readonly index: number;
};

function isBrandSegment(token: string): boolean {
  const normalized = token.replace(/^@/, '');
  const parts = normalized.split(/[._/-]+/).filter((part) => part.length > 0);
  if (parts.some((part) => part.toLowerCase() === 'solstice')) {
    return true;
  }
  return /(?:^|[^A-Za-z])Solstice(?:[^a-z]|$)/.test(token);
}

/**
 * Extract legacy brand tokens without counting accidental substrings.
 * `absolsticefoo` is ignored. `SOLSTICE_UK`, `@solstice/config`, and
 * `solstice.identity.created/1` are counted as whole tokens.
 */
export function extractLegacyTokens(line: string): readonly LegacyTokenMatch[] {
  const matches: LegacyTokenMatch[] = [];
  const needle = /solstice/gi;
  let found = needle.exec(line);
  while (found) {
    let start = found.index;
    let end = found.index + found[0].length;
    while (start > 0 && IDENT_CHAR.test(line[start - 1] ?? '')) {
      start -= 1;
    }
    while (end < line.length && IDENT_CHAR.test(line[end] ?? '')) {
      end += 1;
    }
    const token = line.slice(start, end);
    if (isBrandSegment(token) && !matches.some((item) => item.index === start && item.token === token)) {
      matches.push({ token, index: start });
    }
    found = needle.exec(line);
  }
  return matches;
}

function posixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

function fileName(path: string): string {
  const parts = posixPath(path).split('/');
  return parts[parts.length - 1] ?? path;
}

function isTestPath(path: string): boolean {
  const posix = posixPath(path);
  const name = fileName(posix);
  return (
    posix.includes('/tests/') ||
    posix.startsWith('tests/') ||
    name.endsWith('.test.ts') ||
    name.endsWith('.test.js') ||
    name.endsWith('.test.mjs') ||
    name.endsWith('.spec.ts') ||
    posix.includes('/__fixtures__/') ||
    posix.includes('/fixtures/')
  );
}

function isNamingConstitutionPath(path: string): boolean {
  const posix = posixPath(path);
  return (
    posix === 'packages/config/src/product-identity.ts' ||
    posix === 'packages/config/src/naming-classification.ts' ||
    posix === 'packages/config/src/naming-allowlist.ts' ||
    posix === 'packages/config/src/naming-env-inventory.ts' ||
    posix === 'packages/config/src/naming-symbol-inventory.ts' ||
    posix === 'packages/config/src/naming-audit.ts' ||
    posix === 'packages/config/src/demo.ts' ||
    posix === 'packages/config/src/product-identity.test.ts' ||
    posix === 'packages/config/src/naming-audit.test.ts' ||
    posix === 'packages/config/src/index.ts' ||
    posix === 'scripts/sunrey-naming-audit.mjs' ||
    posix === 'docs/architecture/sunrey-naming-constitution.md' ||
    posix === 'docs/architecture/sunrey-naming-inventory.md' ||
    posix === 'docs/architecture/sunrey-naming-inventory.json' ||
    posix === 'docs/architecture/sunrey-naming-public-debt.json' ||
    posix === 'docs/architecture/chunks/chunk-141.json' ||
    posix === 'tools/architectural-linter/src/chunk-141-constitution.test.ts'
  );
}

function isHistoricalDocPath(path: string): boolean {
  const posix = posixPath(path);
  return (
    posix.includes('/historical') ||
    posix.startsWith('docs/architecture/historical') ||
    posix === 'docs/architecture/historical-implementation.md' ||
    /docs\/architecture\/chunks\/chunk-\d+-solstice/.test(posix) ||
    posix === 'docs/architecture/chunks/chunk-5-solstice-identity.json'
  );
}

function isMigrationPath(path: string): boolean {
  const posix = posixPath(path);
  return posix.includes('/migrations/') || /\/V\d{3}__/.test(posix);
}

function isEventTaxonomyPath(path: string): boolean {
  const posix = posixPath(path);
  return posix.startsWith('packages/events/') && (posix.endsWith('taxonomy.ts') || posix.endsWith('events.ts'));
}

function isHashDomainLine(lineText: string, token: string): boolean {
  return (
    /Symbol(?:\.for)?\s*\(/.test(lineText) ||
    /hash[_ -]?domain/i.test(lineText) ||
    token.includes('solstice.') && /Permit|Verified|hash|domain/i.test(lineText)
  );
}

function isProtocolToken(token: string, lineText: string): boolean {
  if (token.startsWith('solstice.') || token.includes('solstice.')) {
    return true;
  }
  if (/identitySystemRef|protocol|fingerprint|genesis|commitment/i.test(lineText) && /solstice/i.test(token)) {
    return true;
  }
  return false;
}

function isEventTypeToken(token: string): boolean {
  return /^solstice\.[A-Za-z0-9._-]+\/\d+$/.test(token);
}

function isEnvToken(token: string, lineText: string): boolean {
  if (/^SOLSTICE_[A-Z0-9_]+$/.test(token)) {
    return true;
  }
  return /process\.env\.SOLSTICE_|env\.SOLSTICE_|SOLSTICE_[A-Z0-9_]+\s*=/.test(lineText);
}

function isDatabaseToken(token: string): boolean {
  return (
    /^solstice_(customer|ledger|evidence|security|bootstrap|migrator|dev_only)/i.test(token) ||
    /^le_solstice_/i.test(token) ||
    /solstice_(customer|ledger|evidence|security|bootstrap|migrator)/i.test(token)
  );
}

function isPackageNameToken(token: string, lineText: string, path: string): boolean {
  if (token.startsWith('@solstice/')) {
    return true;
  }
  const posix = posixPath(path);
  return posix.endsWith('package.json') && /"name"\s*:/.test(lineText) && token.startsWith('@solstice');
}

function isRepositoryName(path: string, token: string, lineText: string): boolean {
  const posix = posixPath(path);
  if (posix === 'package.json' && /"name"\s*:\s*"solstice"/.test(lineText) && token === 'solstice') {
    return true;
  }
  return /github\.com\/[^/\s]+\/solstice\b/.test(lineText) && token === 'solstice';
}

function isPublicProductPath(path: string): boolean {
  const posix = posixPath(path);
  return (
    posix === 'README.md' ||
    posix === 'package.json' ||
    posix === 'AGENTS.md' ||
    posix === 'docs/architecture/constitution.md' ||
    posix === 'docs/build-status.md'
  );
}

function isPublicApiPath(path: string): boolean {
  const posix = posixPath(path);
  return posix.startsWith('api/') || /openapi/i.test(fileName(posix));
}

function isPublicCliPath(path: string): boolean {
  const posix = posixPath(path);
  const name = fileName(posix);
  return (
    name === 'cli.ts' ||
    name === 'cli-main.ts' ||
    name === 'cli-dispatch.ts' ||
    posix.endsWith('/cli.ts') ||
    posix.endsWith('/cli-main.ts')
  );
}

function isPublicSdkPath(path: string): boolean {
  const posix = posixPath(path);
  return posix.startsWith('docs/developers/') || posix.startsWith('packages/sunrey-sdk/src/generate-reference');
}

function isPublicExplorerPath(path: string): boolean {
  const posix = posixPath(path);
  return posix.startsWith('apps/explorer/') || posix === 'packages/sunrey-explorer/src/cli.ts';
}

function classifyPathAndToken(input: ClassificationInput): ClassificationResult {
  const path = posixPath(input.path);
  const { token, lineText } = input;

  if (isNamingConstitutionPath(path)) {
    return {
      classification: 'NAMING_CONSTITUTION',
      recommendedAction: 'HISTORICAL_ONLY',
      reason: 'Chunk 141 naming constitution, inventory, or guardrail documents legacy markers without using them as current branding.',
    };
  }

  if (isRepositoryName(path, token, lineText)) {
    return {
      classification: 'REPOSITORY_NAME',
      recommendedAction: 'HISTORICAL_ONLY',
      reason: 'GitHub repository directory name solstice remains until repository administration changes it separately.',
    };
  }

  if (isMigrationPath(path)) {
    return {
      classification: 'MIGRATION_IDENTIFIER',
      recommendedAction: 'PRESERVE_IMMUTABLE',
      reason: 'Database migration filenames and SQL identifiers are immutable for ordering and replay.',
    };
  }

  if (isEventTypeToken(token) || (isEventTaxonomyPath(path) && token.startsWith('solstice.'))) {
    return {
      classification: 'EVENT_TYPE_IDENTIFIER',
      recommendedAction: 'PRESERVE_IMMUTABLE',
      reason: 'Persisted event discriminators must not change; replay depends on the historical type string.',
    };
  }

  if (isHashDomainLine(lineText, token)) {
    return {
      classification: 'HASH_DOMAIN',
      recommendedAction: 'PRESERVE_IMMUTABLE',
      reason: 'Hash and signature domains are protocol commitments. Changing them requires an explicit versioned upgrade.',
    };
  }

  if (isEnvToken(token, lineText)) {
    return {
      classification: 'ENVIRONMENT_VARIABLE',
      recommendedAction: 'MIGRATE_WITH_ALIAS',
      reason: 'SOLSTICE_* configuration names get a SunRey alias in Chunk 142; the legacy name stays until a selected removal date.',
    };
  }

  if (isDatabaseToken(token)) {
    return {
      classification: 'DATABASE_IDENTIFIER',
      recommendedAction: 'PRESERVE_IMMUTABLE',
      reason: 'Persisted database, role, and legal-entity identifiers must remain for compatibility.',
    };
  }

  if (isPackageNameToken(token, lineText, path)) {
    return {
      classification: 'PACKAGE_METADATA',
      recommendedAction: 'MANUAL_REVIEW',
      reason: 'npm package names under @solstice/* are workspace identifiers, not current public product copy. Do not rename directories in Chunk 141.',
    };
  }

  if (isProtocolToken(token, lineText)) {
    return {
      classification: 'PROTOCOL_IDENTIFIER',
      recommendedAction: 'PRESERVE_IMMUTABLE',
      reason: 'Protocol strings, system refs, and commitment domains stay until a versioned protocol upgrade.',
    };
  }

  if (/\bgit\b|origin\/|refs\/|branch/i.test(lineText) && token.toLowerCase() === 'solstice') {
    return {
      classification: 'GIT_REFERENCE',
      recommendedAction: 'HISTORICAL_ONLY',
      reason: 'Git refs and historical branch names are not product copy.',
    };
  }

  if (isHistoricalDocPath(path)) {
    return {
      classification: 'HISTORICAL_DOCUMENTATION',
      recommendedAction: 'HISTORICAL_ONLY',
      reason: 'Historical architecture documents may retain Solstice when they describe prior identity. They must stay labeled historical.',
    };
  }

  if (isTestPath(path)) {
    return {
      classification: 'FIXTURE',
      recommendedAction: 'HISTORICAL_ONLY',
      reason: 'Test fixtures may retain historical identifiers so replay and catalog assertions stay exact.',
    };
  }

  if (isPublicApiPath(path) && !token.startsWith('@solstice/')) {
    return {
      classification: 'PUBLIC_API_METADATA',
      recommendedAction: 'MUST_MIGRATE',
      reason: 'Current public API metadata must use SunRey.',
    };
  }

  if (isPublicCliPath(path) && !token.startsWith('@solstice/') && !/^SOLSTICE_/.test(token) && !token.startsWith('solstice.')) {
    return {
      classification: 'PUBLIC_CLI_OUTPUT',
      recommendedAction: 'MUST_MIGRATE',
      reason: 'Current CLI banners and user-facing output must use SunRey.',
    };
  }

  if (isPublicSdkPath(path) && !token.startsWith('@solstice/')) {
    return {
      classification: 'PUBLIC_SDK_METADATA',
      recommendedAction: 'MUST_MIGRATE',
      reason: 'Current SDK product metadata must use SunRey. Package names remain a separate class.',
    };
  }

  if (isPublicExplorerPath(path) && !token.startsWith('@solstice/')) {
    return {
      classification: 'PUBLIC_EXPLORER_METADATA',
      recommendedAction: 'MUST_MIGRATE',
      reason: 'Current Explorer product metadata must use SunRey.',
    };
  }

  if (isPublicProductPath(path) && !token.startsWith('@solstice/') && !isEnvToken(token, lineText) && !isPackageNameToken(token, lineText, path)) {
    if (path === 'package.json' && /"name"\s*:/.test(lineText)) {
      return {
        classification: 'REPOSITORY_NAME',
        recommendedAction: 'HISTORICAL_ONLY',
        reason: 'Root package name solstice is the repository identifier.',
      };
    }
    return {
      classification: 'PUBLIC_PRODUCT_NAME',
      recommendedAction: 'MUST_MIGRATE',
      reason: 'Current public product copy must use SunRey. Chunk 142 performs the safe rewrite.',
    };
  }

  if (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.mjs') || path.endsWith('.js')) {
    return {
      classification: 'INTERNAL_RUNTIME_SYMBOL',
      recommendedAction: 'MANUAL_REVIEW',
      reason: 'Internal TypeScript or runtime symbols are not renamed for aesthetics. Public exports may receive a deprecated alias in Chunk 142.',
    };
  }

  if (path.startsWith('docs/')) {
    return {
      classification: 'HISTORICAL_DOCUMENTATION',
      recommendedAction: 'MANUAL_REVIEW',
      reason: 'Documentation mentioning Solstice needs a human check: current product copy migrates; historical explanation stays labeled.',
    };
  }

  return {
    classification: 'INTERNAL_PACKAGE_PATH',
    recommendedAction: 'MANUAL_REVIEW',
    reason: 'Unclassified legacy token. Review before any rewrite.',
  };
}

export function classifyLegacyOccurrence(input: ClassificationInput): ClassificationResult {
  return classifyPathAndToken(input);
}
