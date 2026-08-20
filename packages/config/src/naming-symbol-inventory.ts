/**
 * Inventory of active public exported TypeScript symbols that still
 * carry a Solstice name. Chunk 141 does not rename them.
 *
 * Public consumer exports may receive a canonical SunRey alias later.
 * Private historical symbols are not renamed solely for aesthetics.
 */

export type SymbolVisibility = 'PUBLIC_EXPORT' | 'INTERNAL_HISTORICAL';

export type LegacyTypeScriptSymbol = {
  readonly symbol: string;
  readonly path: string;
  readonly visibility: SymbolVisibility;
  readonly futureCanonicalSymbol: string;
  readonly aliasPolicy: 'DEPRECATED_ALIAS' | 'DO_NOT_RENAME';
  readonly reason: string;
};

export const LEGACY_TYPESCRIPT_SYMBOLS: readonly LegacyTypeScriptSymbol[] = Object.freeze([
  {
    symbol: 'SolsticeIdentityId',
    path: 'packages/identity/src/ids.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SunReyIdentityId',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Exported identity primary key. A future alias may exist; the historical type remains for consumer compatibility.',
  },
  {
    symbol: 'asSolsticeIdentityId',
    path: 'packages/identity/src/ids.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'asSunReyIdentityId',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Constructor for SolsticeIdentityId. Alias later; do not break existing imports in Chunk 141.',
  },
  {
    symbol: 'SOLSTICE_UK',
    path: 'services/accounts/src/catalog.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SUNREY_UK',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Simulation legal entity used by tests and demos. Entity id le_solstice_uk_ltd stays immutable.',
  },
  {
    symbol: 'SOLSTICE_US',
    path: 'services/accounts/src/catalog.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SUNREY_US',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Simulation legal entity. Historical id remains.',
  },
  {
    symbol: 'SOLSTICE_EU',
    path: 'services/accounts/src/catalog.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SUNREY_EU',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Simulation legal entity. Historical id remains.',
  },
  {
    symbol: 'SOLSTICE_SA',
    path: 'services/accounts/src/catalog.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SUNREY_SA',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Simulation legal entity. Historical id remains.',
  },
  {
    symbol: 'SOLSTICE_AE',
    path: 'services/accounts/src/catalog.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SUNREY_AE',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Simulation legal entity. Historical id remains.',
  },
  {
    symbol: 'SIMULATION_SOLSTICE_UK',
    path: 'packages/sunrey-coin/src/simulation-catalog.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SIMULATION_SUNREY_UK',
    aliasPolicy: 'DEPRECATED_ALIAS',
    reason: 'Shared simulation catalog entity. Id is historical.',
  },
  {
    symbol: 'SOLSTICE_HOLDING',
    path: 'packages/personal-economic-graph/src/taxonomy.ts',
    visibility: 'INTERNAL_HISTORICAL',
    futureCanonicalSymbol: 'SUNREY_HOLDING',
    aliasPolicy: 'DO_NOT_RENAME',
    reason: 'Stored PEG holding kind. Rename would alter graph replay.',
  },
  {
    symbol: 'SOLSTICE_PAYMENT',
    path: 'packages/personal-economic-graph/src/provenance.ts',
    visibility: 'INTERNAL_HISTORICAL',
    futureCanonicalSymbol: 'SUNREY_PAYMENT',
    aliasPolicy: 'DO_NOT_RENAME',
    reason: 'Stored PEG provenance source type.',
  },
  {
    symbol: 'SOLSTICE_CARD',
    path: 'packages/personal-economic-graph/src/provenance.ts',
    visibility: 'INTERNAL_HISTORICAL',
    futureCanonicalSymbol: 'SUNREY_CARD',
    aliasPolicy: 'DO_NOT_RENAME',
    reason: 'Stored PEG provenance source type.',
  },
  {
    symbol: 'SOLSTICE_SERVICE',
    path: 'packages/consent/src/taxonomy.ts',
    visibility: 'INTERNAL_HISTORICAL',
    futureCanonicalSymbol: 'SUNREY_SERVICE',
    aliasPolicy: 'DO_NOT_RENAME',
    reason: 'Persisted consent recipient kind.',
  },
  {
    symbol: 'SOLSTICE_GENERATED',
    path: 'packages/personal-data-vault/src/taxonomy.ts',
    visibility: 'INTERNAL_HISTORICAL',
    futureCanonicalSymbol: 'SUNREY_GENERATED',
    aliasPolicy: 'DO_NOT_RENAME',
    reason: 'PDV provenance enumeration stored with records.',
  },
  {
    symbol: 'SolsticePersonalDataExportV1',
    path: 'packages/personal-data-vault/src/taxonomy.ts',
    visibility: 'PUBLIC_EXPORT',
    futureCanonicalSymbol: 'SunReyPersonalDataExportV1',
    aliasPolicy: 'DO_NOT_RENAME',
    reason: 'Versioned export format string. A V2 format would be a new identifier, not a rename of V1.',
  },
]);

export const PROTOCOL_IDENTIFIERS_MUST_NOT_CHANGE = Object.freeze([
  'SUNREY_COIN',
  'MOONREY_COIN',
  'solstice.identity',
  'solstice.VerifiedExecutionAuthority',
  'solstice.VerifiedActorContext',
  'solstice.security.cryptoProviderPermit',
] as const);
