/**
 * Governable cryptographic migration states.
 *
 * No production dates are assigned. Transitions are reserved for later
 * protocol-upgrade machinery. AI cannot flip these states.
 */

export const CRYPTO_MIGRATION_STATES = [
  'CLASSICAL_ONLY',
  'HYBRID_AVAILABLE',
  'HYBRID_REQUIRED_SELECTED_ROLES',
  'PQ_PRIMARY',
  'LEGACY_VERIFY_ONLY',
  'LEGACY_RETIRED',
] as const;

export type CryptoMigrationState = (typeof CRYPTO_MIGRATION_STATES)[number];

export function isCryptoMigrationState(value: unknown): value is CryptoMigrationState {
  return typeof value === 'string' && (CRYPTO_MIGRATION_STATES as readonly string[]).includes(value);
}

export const INITIAL_CRYPTO_MIGRATION_STATE = 'CLASSICAL_ONLY' as const satisfies CryptoMigrationState;

export const HYBRID_REQUIRED_ROLES = Object.freeze([
  'VALIDATOR_CONSENSUS_SIGNING',
  'BLOCK_PROPOSAL_SIGNING',
  'GOVERNANCE_SIGNING',
] as const);

export const MIGRATION_TRANSITION_OWNER = 'protocol-upgrade-machinery' as const;
