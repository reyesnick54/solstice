/**
 * Chunk 142 legacy-brand compatibility report.
 *
 * Lists remaining aliases and immutable historical identifiers.
 * Public current-product Solstice display names must be zero unless a
 * documented exception exists.
 */

import { PERSISTENCE_ENV_ALIASES } from './env.ts';
import { CANONICAL_PRODUCT_IDENTITY } from './product-identity.ts';

export type LegacyCompatibilityEntry = {
  readonly id: string;
  readonly kind: 'ENV_ALIAS' | 'EXPORTED_ALIAS' | 'HISTORICAL_IMMUTABLE' | 'MANUAL_REVIEW' | 'PUBLIC_DISPLAY' | 'NEW_PUBLIC_VIOLATION';
  readonly legacyName: string;
  readonly canonicalName: string;
  readonly path: string;
  readonly notes: string;
};

export type SunReyLegacyCompatibilityReport = {
  readonly currentMasterBrand: 'SunRey';
  readonly legacyMasterBrandActive: false;
  readonly legacyEnvAliasesRemaining: readonly LegacyCompatibilityEntry[];
  readonly legacyExportedAliasesRemaining: readonly LegacyCompatibilityEntry[];
  readonly historicalImmutableIdentifiers: readonly LegacyCompatibilityEntry[];
  readonly manualReviewIdentifiers: readonly LegacyCompatibilityEntry[];
  readonly publicLegacyDisplayNamesRemaining: readonly LegacyCompatibilityEntry[];
  readonly newPublicViolations: readonly LegacyCompatibilityEntry[];
  readonly githubRepositoryRenamed: false;
  readonly protocolIdsChanged: false;
  readonly historicalHashDomainsChanged: false;
};

const LEGACY_EXPORTED_ALIASES: readonly LegacyCompatibilityEntry[] = [
  {
    id: 'solstice-identity-id-alias',
    kind: 'EXPORTED_ALIAS',
    legacyName: 'SolsticeIdentityId',
    canonicalName: 'SunReyIdentityId',
    path: 'packages/identity/src/ids.ts',
    notes: 'Deprecated type alias. Same implementation as SunReyIdentityId.',
  },
  {
    id: 'as-solstice-identity-id-alias',
    kind: 'EXPORTED_ALIAS',
    legacyName: 'asSolsticeIdentityId',
    canonicalName: 'asSunReyIdentityId',
    path: 'packages/identity/src/ids.ts',
    notes: 'Deprecated function alias. Delegates to asSunReyIdentityId.',
  },
];

const HISTORICAL_IMMUTABLE: readonly LegacyCompatibilityEntry[] = [
  {
    id: 'event-schema-prefix',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: 'solstice.<namespace>.<event>/1',
    canonicalName: 'unchanged stored schemaRef',
    path: 'packages/events/src/taxonomy.ts',
    notes: 'Persisted historical event type IDs. Replay depends on them.',
  },
  {
    id: 'github-repository-path',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: CANONICAL_PRODUCT_IDENTITY.githubRepositoryPath,
    canonicalName: CANONICAL_PRODUCT_IDENTITY.githubRepositoryPath,
    path: 'https://github.com/reyesnick54/solstice',
    notes: 'Git repository path is not renamed from code.',
  },
  {
    id: 'npm-scope',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: '@solstice/*',
    canonicalName: '@solstice/*',
    path: 'packages/*/package.json',
    notes: 'Workspace package scope is protocol/package identity, not display branding.',
  },
  {
    id: 'legal-entity-ids',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: 'le_solstice_* / SOLSTICE_UK',
    canonicalName: 'unchanged catalog IDs',
    path: 'services/accounts/src/catalog.ts',
    notes: 'Simulation legal-entity identifiers are catalog IDs.',
  },
  {
    id: 'database-names',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: 'solstice_customer / solstice_ledger / solstice_evidence / solstice_security',
    canonicalName: 'unchanged database names',
    path: 'packages/persistence/src/env.ts',
    notes: 'Already-applied database names. Migrations are not rewritten.',
  },
  {
    id: 'hash-domains',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: 'SUNREY_* hash domains',
    canonicalName: 'unchanged',
    path: 'packages/sunrey-chain/src/protocol/constants.ts',
    notes: 'Hash domains are not renamed. Changing a domain changes hashes.',
  },
  {
    id: 'protocol-asset-ids',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: 'SUNREY_COIN / MOONREY_COIN',
    canonicalName: 'SUNREY_COIN / MOONREY_COIN',
    path: 'packages/sunrey-sdk/src/ids.ts',
    notes: 'Protocol asset IDs are not display metadata.',
  },
  {
    id: 'network-chain-ids',
    kind: 'HISTORICAL_IMMUTABLE',
    legacyName: 'net_sunrey_simulation / chn_sunrey_simulation',
    canonicalName: 'unchanged',
    path: 'packages/sunrey-explorer/src/taxonomy.ts',
    notes: 'Stable networkId and chainId.',
  },
];

const MANUAL_REVIEW: readonly LegacyCompatibilityEntry[] = [
  {
    id: 'legal-entity-display-names',
    kind: 'MANUAL_REVIEW',
    legacyName: 'Solstice UK Ltd (simulation)',
    canonicalName: 'not migrated',
    path: 'services/accounts/src/catalog.ts',
    notes: 'Simulation legal-entity names may be historical catalog copy. Left unchanged.',
  },
  {
    id: 'webauthn-rpid',
    kind: 'MANUAL_REVIEW',
    legacyName: 'simulation.solstice.local',
    canonicalName: 'not migrated',
    path: 'packages/identity/src/service.ts',
    notes: 'Relying-party identifier can affect stored credentials. Left unchanged.',
  },
  {
    id: 'pdv-export-format',
    kind: 'MANUAL_REVIEW',
    legacyName: 'SolsticePersonalDataExportV1',
    canonicalName: 'not migrated',
    path: 'packages/personal-data-vault/src/taxonomy.ts',
    notes: 'Persisted export format identifier.',
  },
];

export function buildSunReyLegacyCompatibilityReport(
  extraViolations: readonly LegacyCompatibilityEntry[] = [],
): SunReyLegacyCompatibilityReport {
  const legacyEnvAliasesRemaining = PERSISTENCE_ENV_ALIASES.map((alias) => ({
    id: alias.canonicalName,
    kind: 'ENV_ALIAS' as const,
    legacyName: alias.legacyName,
    canonicalName: alias.canonicalName,
    path: 'packages/config/src/env.ts',
    notes: alias.secret
      ? 'Secret alias. Diagnostics expose names only, never values.'
      : 'Temporary compatibility alias. Canonical SUNREY_* wins when both match; conflict fails.',
  }));

  return Object.freeze({
    currentMasterBrand: 'SunRey',
    legacyMasterBrandActive: false,
    legacyEnvAliasesRemaining,
    legacyExportedAliasesRemaining: LEGACY_EXPORTED_ALIASES,
    historicalImmutableIdentifiers: HISTORICAL_IMMUTABLE,
    manualReviewIdentifiers: MANUAL_REVIEW,
    publicLegacyDisplayNamesRemaining: [],
    newPublicViolations: extraViolations,
    githubRepositoryRenamed: false,
    protocolIdsChanged: false,
    historicalHashDomainsChanged: false,
  });
}
