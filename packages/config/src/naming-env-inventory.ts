/**
 * Inventory of SOLSTICE_* environment variables.
 *
 * Chunk 141 classifies them only. Chunk 142 may add SUNREY_* aliases.
 * Do not remove the legacy names here. Removal date is NOT_SELECTED.
 */

export const ENV_REMOVAL_DATE = 'NOT_SELECTED' as const;

export type LegacyEnvironmentVariable = {
  readonly legacyName: string;
  readonly canonicalName: string;
  readonly legacyAliasRequired: true;
  readonly safeRemovalDate: typeof ENV_REMOVAL_DATE;
  readonly compatibility: string;
  readonly definedIn: readonly string[];
};

export const LEGACY_ENVIRONMENT_VARIABLES: readonly LegacyEnvironmentVariable[] = Object.freeze([
  {
    legacyName: 'SOLSTICE_PG_HOST',
    canonicalName: 'SUNREY_PG_HOST',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Read the canonical name first, then the legacy name, then the local simulation default. Behavior must stay identical.',
    definedIn: ['packages/persistence/src/env.ts', '.github/workflows/ci.yml'],
  },
  {
    legacyName: 'SOLSTICE_PG_PORT',
    canonicalName: 'SUNREY_PG_PORT',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Positive integer port. Canonical then legacy then 5432.',
    definedIn: ['packages/persistence/src/env.ts', '.github/workflows/ci.yml'],
  },
  {
    legacyName: 'SOLSTICE_PG_BOOTSTRAP_USER',
    canonicalName: 'SUNREY_PG_BOOTSTRAP_USER',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Local simulation bootstrap role only. Never a live credential.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_BOOTSTRAP_PASSWORD',
    canonicalName: 'SUNREY_PG_BOOTSTRAP_PASSWORD',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Local simulation secret. Canonical then legacy then development default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_MIGRATOR_USER',
    canonicalName: 'SUNREY_PG_MIGRATOR_USER',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Migrator role name. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_MIGRATOR_PASSWORD',
    canonicalName: 'SUNREY_PG_MIGRATOR_PASSWORD',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Migrator password. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_CUSTOMER_USER',
    canonicalName: 'SUNREY_PG_CUSTOMER_USER',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Customer-app role. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_CUSTOMER_PASSWORD',
    canonicalName: 'SUNREY_PG_CUSTOMER_PASSWORD',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Customer-app password. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_LEDGER_USER',
    canonicalName: 'SUNREY_PG_LEDGER_USER',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Ledger writer role. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_LEDGER_PASSWORD',
    canonicalName: 'SUNREY_PG_LEDGER_PASSWORD',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Ledger writer password. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_EVIDENCE_USER',
    canonicalName: 'SUNREY_PG_EVIDENCE_USER',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Evidence-app role. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_EVIDENCE_PASSWORD',
    canonicalName: 'SUNREY_PG_EVIDENCE_PASSWORD',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Evidence-app password. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_SECURITY_USER',
    canonicalName: 'SUNREY_PG_SECURITY_USER',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Security-app role. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PG_SECURITY_PASSWORD',
    canonicalName: 'SUNREY_PG_SECURITY_PASSWORD',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Security-app password. Canonical then legacy then local default.',
    definedIn: ['packages/persistence/src/env.ts'],
  },
  {
    legacyName: 'SOLSTICE_PERSISTENCE_TEST',
    canonicalName: 'SUNREY_PERSISTENCE_TEST',
    legacyAliasRequired: true,
    safeRemovalDate: ENV_REMOVAL_DATE,
    compatibility: 'Set to 1 to enable persistence integration tests. Canonical then legacy.',
    definedIn: ['packages/persistence/src/env.ts', 'package.json', '.github/workflows/ci.yml', 'tests/persistence'],
  },
]);

export function findLegacyEnvironmentVariable(name: string): LegacyEnvironmentVariable | undefined {
  return LEGACY_ENVIRONMENT_VARIABLES.find((item) => item.legacyName === name);
}
