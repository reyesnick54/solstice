/**
 * Height-activated CryptoPolicy derivation.
 *
 * Every validator derives the same migration state from finalized
 * height. Local configuration cannot invent a weaker policy.
 */

import {
  HYBRID_REQUIRED_ROLES,
  INITIAL_CRYPTO_MIGRATION_STATE,
  type CryptoMigrationState,
} from './crypto-migration.ts';

export type HeightActivatedCryptoSchedule = {
  readonly networkId: string;
  readonly chainId: string;
  readonly h1HybridAvailable: number;
  readonly h2HybridRequiredSelectedRoles: number;
  readonly h3PqPrimarySelectedRole: number;
  readonly selectedPqPrimaryRole: 'VALIDATOR_CONSENSUS_SIGNING' | 'ORACLE_SIGNING' | 'GOVERNANCE_SIGNING';
  readonly retireClassicalVerification: false;
};

export const TESTNET_HYBRID_MIGRATION_SCHEDULE: HeightActivatedCryptoSchedule = Object.freeze({
  networkId: 'net_sunrey_testnet_1',
  chainId: 'chn_sunrey_testnet_1',
  h1HybridAvailable: 20,
  h2HybridRequiredSelectedRoles: 40,
  h3PqPrimarySelectedRole: 60,
  selectedPqPrimaryRole: 'VALIDATOR_CONSENSUS_SIGNING',
  retireClassicalVerification: false,
});

export function migrationStateAtHeight(
  height: number,
  schedule: HeightActivatedCryptoSchedule = TESTNET_HYBRID_MIGRATION_SCHEDULE,
): CryptoMigrationState {
  if (!Number.isInteger(height) || height < 0) {
    return INITIAL_CRYPTO_MIGRATION_STATE;
  }
  if (height >= schedule.h3PqPrimarySelectedRole) {
    return 'PQ_PRIMARY';
  }
  if (height >= schedule.h2HybridRequiredSelectedRoles) {
    return 'HYBRID_REQUIRED_SELECTED_ROLES';
  }
  if (height >= schedule.h1HybridAvailable) {
    return 'HYBRID_AVAILABLE';
  }
  return 'CLASSICAL_ONLY';
}

export function policyAcceptedSuites(state: CryptoMigrationState): readonly string[] {
  if (state === 'CLASSICAL_ONLY') {
    return Object.freeze(['sunrey-ed25519-v1']);
  }
  if (state === 'HYBRID_AVAILABLE') {
    return Object.freeze([
      'sunrey-ed25519-v1',
      'sunrey-hybrid-ed25519-mldsa-v1',
      'sunrey-mldsa-65-v1',
    ]);
  }
  if (state === 'HYBRID_REQUIRED_SELECTED_ROLES') {
    return Object.freeze(['sunrey-hybrid-ed25519-mldsa-v1', 'sunrey-ed25519-v1']);
  }
  if (state === 'PQ_PRIMARY') {
    return Object.freeze(['sunrey-mldsa-65-v1', 'sunrey-hybrid-ed25519-mldsa-v1', 'sunrey-ed25519-v1']);
  }
  return Object.freeze(['sunrey-ed25519-v1', 'sunrey-hybrid-ed25519-mldsa-v1']);
}

const CLASSICAL = 'sunrey-ed25519-v1';
const HYBRID = 'sunrey-hybrid-ed25519-mldsa-v1';
const PQ = 'sunrey-mldsa-65-v1';

export function historicalVerifyAllowed(suiteId: string): boolean {
  return suiteId === CLASSICAL || suiteId === HYBRID || suiteId === PQ || suiteId === 'sunrey-hybrid-ed25519-mldsa-sim-v1';
}

/**
 * Signing acceptance for a role at a derived migration state.
 * Verification of historical classical signatures remains available.
 */
export function roleAcceptsSuiteForSign(
  state: CryptoMigrationState,
  purpose: string,
  suiteId: string,
  schedule: HeightActivatedCryptoSchedule = TESTNET_HYBRID_MIGRATION_SCHEDULE,
): boolean {
  if (state === 'CLASSICAL_ONLY') {
    return suiteId === CLASSICAL;
  }
  if (state === 'HYBRID_AVAILABLE') {
    return suiteId === CLASSICAL || suiteId === HYBRID || suiteId === PQ;
  }
  if (state === 'HYBRID_REQUIRED_SELECTED_ROLES') {
    if ((HYBRID_REQUIRED_ROLES as readonly string[]).includes(purpose)) {
      return suiteId === HYBRID;
    }
    return suiteId === CLASSICAL || suiteId === HYBRID;
  }
  if (state === 'PQ_PRIMARY') {
    if (purpose === schedule.selectedPqPrimaryRole) {
      return suiteId === PQ || suiteId === HYBRID;
    }
    return suiteId === CLASSICAL || suiteId === HYBRID || suiteId === PQ;
  }
  if (state === 'LEGACY_VERIFY_ONLY') {
    return suiteId === HYBRID || suiteId === PQ;
  }
  return false;
}
