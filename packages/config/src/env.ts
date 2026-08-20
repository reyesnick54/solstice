/**
 * Canonical SUNREY_* environment resolution with temporary SOLSTICE_* aliases.
 *
 * Resolution order:
 * 1. SUNREY_* if provided
 * 2. legacy SOLSTICE_* if canonical is absent
 * 3. documented default
 *
 * Contradictory canonical + legacy values fail with LEGACY_ENV_CONFLICT.
 * Diagnostics never include secret values. This is the only env-name
 * authority — callers must not reimplement the policy.
 */

export const LEGACY_ENV_CONFLICT = 'LEGACY_ENV_CONFLICT' as const;

export type EnvValueSource = 'CANONICAL' | 'LEGACY_ALIAS' | 'DEFAULT' | 'ABSENT';

export type EnvResolution<T extends string = string> = {
  readonly value: T | undefined;
  readonly source: EnvValueSource;
  readonly legacyAliasUsed: boolean;
  readonly canonicalName: string;
  readonly legacyName: string;
};

export type LegacyEnvAlias = {
  readonly canonicalName: string;
  readonly legacyName: string;
  readonly secret: boolean;
  readonly defaultValue?: string;
};

export const PERSISTENCE_ENV_ALIASES = Object.freeze([
  { canonicalName: 'SUNREY_PERSISTENCE_TEST', legacyName: 'SOLSTICE_PERSISTENCE_TEST', secret: false },
  { canonicalName: 'SUNREY_PG_HOST', legacyName: 'SOLSTICE_PG_HOST', secret: false, defaultValue: '127.0.0.1' },
  { canonicalName: 'SUNREY_PG_PORT', legacyName: 'SOLSTICE_PG_PORT', secret: false, defaultValue: '5432' },
  { canonicalName: 'SUNREY_PG_BOOTSTRAP_USER', legacyName: 'SOLSTICE_PG_BOOTSTRAP_USER', secret: false, defaultValue: 'solstice_bootstrap' },
  {
    canonicalName: 'SUNREY_PG_BOOTSTRAP_PASSWORD',
    legacyName: 'SOLSTICE_PG_BOOTSTRAP_PASSWORD',
    secret: true,
    defaultValue: 'solstice_dev_only_not_for_production',
  },
  { canonicalName: 'SUNREY_PG_MIGRATOR_USER', legacyName: 'SOLSTICE_PG_MIGRATOR_USER', secret: false, defaultValue: 'solstice_migrator' },
  {
    canonicalName: 'SUNREY_PG_MIGRATOR_PASSWORD',
    legacyName: 'SOLSTICE_PG_MIGRATOR_PASSWORD',
    secret: true,
    defaultValue: 'solstice_dev_only_migrator',
  },
  { canonicalName: 'SUNREY_PG_CUSTOMER_USER', legacyName: 'SOLSTICE_PG_CUSTOMER_USER', secret: false, defaultValue: 'customer_app' },
  {
    canonicalName: 'SUNREY_PG_CUSTOMER_PASSWORD',
    legacyName: 'SOLSTICE_PG_CUSTOMER_PASSWORD',
    secret: true,
    defaultValue: 'solstice_dev_only_customer',
  },
  { canonicalName: 'SUNREY_PG_LEDGER_USER', legacyName: 'SOLSTICE_PG_LEDGER_USER', secret: false, defaultValue: 'ledger_writer' },
  {
    canonicalName: 'SUNREY_PG_LEDGER_PASSWORD',
    legacyName: 'SOLSTICE_PG_LEDGER_PASSWORD',
    secret: true,
    defaultValue: 'solstice_dev_only_ledger',
  },
  { canonicalName: 'SUNREY_PG_EVIDENCE_USER', legacyName: 'SOLSTICE_PG_EVIDENCE_USER', secret: false, defaultValue: 'evidence_app' },
  {
    canonicalName: 'SUNREY_PG_EVIDENCE_PASSWORD',
    legacyName: 'SOLSTICE_PG_EVIDENCE_PASSWORD',
    secret: true,
    defaultValue: 'solstice_dev_only_evidence',
  },
  { canonicalName: 'SUNREY_PG_SECURITY_USER', legacyName: 'SOLSTICE_PG_SECURITY_USER', secret: false, defaultValue: 'security_app' },
  {
    canonicalName: 'SUNREY_PG_SECURITY_PASSWORD',
    legacyName: 'SOLSTICE_PG_SECURITY_PASSWORD',
    secret: true,
    defaultValue: 'solstice_dev_only_security',
  },
] as const satisfies readonly LegacyEnvAlias[]);

export class LegacyEnvConflictError extends Error {
  readonly code = LEGACY_ENV_CONFLICT;
  readonly canonicalName: string;
  readonly legacyName: string;

  constructor(canonicalName: string, legacyName: string) {
    super(`${LEGACY_ENV_CONFLICT}: ${canonicalName} and ${legacyName} are both set with different values`);
    this.name = 'LegacyEnvConflictError';
    this.canonicalName = canonicalName;
    this.legacyName = legacyName;
  }
}

const SECRET_NAME_RE = /PASSWORD|SECRET|TOKEN|KEY|CREDENTIAL/i;

export function isSecretEnvName(name: string): boolean {
  return SECRET_NAME_RE.test(name);
}

export function formatEnvResolutionDiagnostic(resolution: EnvResolution): string {
  return [
    `canonicalName=${resolution.canonicalName}`,
    `legacyName=${resolution.legacyName}`,
    `legacyAliasUsed=${String(resolution.legacyAliasUsed)}`,
    `source=${resolution.source}`,
  ].join(' ');
}

export function resolveCanonicalEnv(
  alias: Pick<LegacyEnvAlias, 'canonicalName' | 'legacyName' | 'defaultValue'>,
  env: NodeJS.ProcessEnv = process.env,
): EnvResolution {
  const canonical = env[alias.canonicalName];
  const legacy = env[alias.legacyName];
  const canonicalPresent = canonical !== undefined;
  const legacyPresent = legacy !== undefined;

  if (canonicalPresent && legacyPresent && canonical !== legacy) {
    throw new LegacyEnvConflictError(alias.canonicalName, alias.legacyName);
  }

  if (canonicalPresent) {
    return Object.freeze({
      value: canonical,
      source: 'CANONICAL',
      legacyAliasUsed: false,
      canonicalName: alias.canonicalName,
      legacyName: alias.legacyName,
    });
  }

  if (legacyPresent) {
    return Object.freeze({
      value: legacy,
      source: 'LEGACY_ALIAS',
      legacyAliasUsed: true,
      canonicalName: alias.canonicalName,
      legacyName: alias.legacyName,
    });
  }

  if (alias.defaultValue !== undefined) {
    return Object.freeze({
      value: alias.defaultValue,
      source: 'DEFAULT',
      legacyAliasUsed: false,
      canonicalName: alias.canonicalName,
      legacyName: alias.legacyName,
    });
  }

  return Object.freeze({
    value: undefined,
    source: 'ABSENT',
    legacyAliasUsed: false,
    canonicalName: alias.canonicalName,
    legacyName: alias.legacyName,
  });
}

export function requireResolvedEnvValue(
  alias: Pick<LegacyEnvAlias, 'canonicalName' | 'legacyName' | 'defaultValue'>,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const resolved = resolveCanonicalEnv(alias, env);
  if (resolved.value === undefined) {
    throw new Error(`${alias.canonicalName} is required`);
  }
  return resolved.value;
}
