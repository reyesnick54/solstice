import type { LegacyPathway } from './types.ts';

/**
 * Legacy / Solstice naming inventory by classification.
 * Do not globally rewrite package names, protocol IDs, migration IDs,
 * hash domains, or event IDs.
 */
export const LEGACY_PATHWAYS: readonly LegacyPathway[] = Object.freeze([
  Object.freeze({
    id: 'current-product-identity',
    example: 'SunRey',
    classification: 'CURRENT_CANONICAL',
    notes: 'Current product-facing and runtime identity is SunRey.',
  }),
  Object.freeze({
    id: 'npm-scope-solstice',
    example: '@solstice/ledger',
    classification: 'COMPATIBILITY_ALIAS',
    notes: 'Historical npm package names. Do not globally rename; protocol consumers may depend on them.',
  }),
  Object.freeze({
    id: 'legacy-env-prefix',
    example: 'SOLSTICE_*',
    classification: 'COMPATIBILITY_ALIAS',
    notes: 'Official legacy env aliases remain readable. Canonical prefix is SUNREY_.',
  }),
  Object.freeze({
    id: 'github-repository-name',
    example: 'reyesnick54/solstice',
    classification: 'MANUAL_REVIEW',
    notes: 'Repository path is historical. Product identity is SunRey. Do not rewrite as a protocol change.',
  }),
  Object.freeze({
    id: 'protocol-ids',
    example: 'hash domains / event type IDs',
    classification: 'HISTORICAL_REPLAY_ONLY',
    notes: 'Persisted protocol, hash-domain, and event IDs must not be rewritten.',
  }),
  Object.freeze({
    id: 'sql-migration-ids',
    example: 'db/*/migrations',
    classification: 'HISTORICAL_REPLAY_ONLY',
    notes: 'Migration identities are durable. Historical branding inside them is not a rename target.',
  }),
  Object.freeze({
    id: 'simulation-flags',
    example: 'ENVIRONMENT=simulation LIVE_*=false',
    classification: 'SIMULATION_ONLY',
    notes: 'Current runtime posture. Not production authorization.',
  }),
  Object.freeze({
    id: 'rehearsal-networks',
    example: 'launch rehearsal / ceremony / post-genesis',
    classification: 'REHEARSAL_ONLY',
    notes: 'Isolated rehearsal identities cannot be reused as production inputs.',
  }),
  Object.freeze({
    id: 'moonrey-coin-placeholder',
    example: 'capability moonrey-coin',
    classification: 'DEPRECATED',
    notes: 'Obsolete public-product placeholder. SUPERSEDED by sunrey-native-assets + moonrey-issuance-engine.',
  }),
  Object.freeze({
    id: 'blockchain-node-placeholder',
    example: 'capability blockchain-node',
    classification: 'DEPRECATED',
    notes: 'Obsolete planned placeholder. SUPERSEDED by sunrey-local-node.',
  }),
  Object.freeze({
    id: 'blockchain-network-placeholder',
    example: 'capability blockchain-network',
    classification: 'DEPRECATED',
    notes: 'Obsolete planned placeholder. SUPERSEDED by sunrey-p2p.',
  }),
  Object.freeze({
    id: 'evm-wasm-runtime',
    example: 'capability blockchain-runtime PARTIAL',
    classification: 'MANUAL_REVIEW',
    notes: 'WASM/EVM remain unimplemented by design. Not an Ethereum dependency and not a core-architecture gap.',
  }),
  Object.freeze({
    id: 'historical-docs',
    example: 'docs/architecture/historical-implementation.md',
    classification: 'HISTORICAL_REPLAY_ONLY',
    notes: 'Older PRs are not automatically canonical.',
  }),
]);
