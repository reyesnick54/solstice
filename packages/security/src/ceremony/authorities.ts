/**
 * Cryptographic authority registry and separation policy.
 *
 * A key authorized for one high-risk role does not authorize another.
 * AI cannot possess a human governance authorization role.
 */

import {
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  type CryptoSuiteId,
} from '../crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from '../errors.ts';
import type { KeyPurpose } from '../purposes.ts';
import {
  HUMAN_GOVERNANCE_AUTHORITIES,
  ROOT_OF_TRUST_AUTHORITIES,
  type CeremonyActorKind,
  type KeyPurposeMatrixRow,
  type ProductionEligibilityState,
  type RootOfTrustAuthority,
} from './types.ts';

export const AUTHORITY_PURPOSE: Readonly<Record<RootOfTrustAuthority, KeyPurpose>> = Object.freeze({
  GENESIS_AUTHORITY: 'GENESIS_SIGNING',
  PROTOCOL_GOVERNANCE_AUTHORITY: 'GOVERNANCE_SIGNING',
  SECURITY_GOVERNANCE_AUTHORITY: 'GOVERNANCE_SIGNING',
  RELEASE_AUTHORITY: 'RELEASE_SIGNING',
  VALIDATOR_CONSENSUS_AUTHORITY: 'VALIDATOR_CONSENSUS_SIGNING',
  VALIDATOR_GOVERNANCE_AUTHORITY: 'GOVERNANCE_SIGNING',
  VALIDATOR_P2P_IDENTITY: 'P2P_IDENTITY',
  RECOVERY_AUTHORITY: 'RECOVERY_SIGNING',
  CUSTODY_SIGNING_AUTHORITY: 'WALLET_SIGNING',
  ORACLE_SIGNING_AUTHORITY: 'ORACLE_SIGNING',
});

const CLASSICAL = [SUITE_SUNREY_ED25519_V1] as const;
const CLASSICAL_AND_SOFTWARE_PQ = [
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
] as const;

function row(
  purpose: KeyPurpose,
  allowedAuthority: RootOfTrustAuthority,
  suites: readonly CryptoSuiteId[],
  onlineOffline: KeyPurposeMatrixRow['onlineOffline'],
  extras: Partial<Pick<KeyPurposeMatrixRow, 'rotationPolicy' | 'backupPolicy' | 'recoveryPolicy'>> = {},
): KeyPurposeMatrixRow {
  return Object.freeze({
    purpose,
    allowedAuthority,
    allowedCryptoSuites: suites,
    providerRequirements: Object.freeze(['ED25519', 'NON_EXPORTABLE', 'ATTESTATION'] as const),
    rotationPolicy: extras.rotationPolicy ?? 'planned dual-control rotation; historical verify retained',
    backupPolicy: extras.backupPolicy ?? 'provider backup-reference metadata only; no plaintext key bytes',
    recoveryPolicy: extras.recoveryPolicy ?? 'replacement ceremony; recovery key cannot become protocol governance',
    onlineOffline,
    attestationRequired: true,
    productionEligibility: 'SIMULATION_ONLY' satisfies ProductionEligibilityState,
  });
}

export const KEY_PURPOSE_MATRIX: readonly KeyPurposeMatrixRow[] = Object.freeze([
  row('GENESIS_SIGNING', 'GENESIS_AUTHORITY', CLASSICAL, 'OFFLINE'),
  row('GOVERNANCE_SIGNING', 'PROTOCOL_GOVERNANCE_AUTHORITY', CLASSICAL_AND_SOFTWARE_PQ, 'OFFLINE'),
  row('GOVERNANCE_SIGNING', 'SECURITY_GOVERNANCE_AUTHORITY', CLASSICAL_AND_SOFTWARE_PQ, 'OFFLINE'),
  row('RELEASE_SIGNING', 'RELEASE_AUTHORITY', CLASSICAL, 'CEREMONY_ONLY'),
  row('VALIDATOR_CONSENSUS_SIGNING', 'VALIDATOR_CONSENSUS_AUTHORITY', CLASSICAL, 'ONLINE'),
  row('GOVERNANCE_SIGNING', 'VALIDATOR_GOVERNANCE_AUTHORITY', CLASSICAL_AND_SOFTWARE_PQ, 'OFFLINE'),
  row('P2P_IDENTITY', 'VALIDATOR_P2P_IDENTITY', CLASSICAL, 'ONLINE'),
  row(
    'RECOVERY_SIGNING',
    'RECOVERY_AUTHORITY',
    CLASSICAL,
    'OFFLINE',
    { recoveryPolicy: 'tightly constrained; cannot become PROTOCOL_GOVERNANCE_AUTHORITY' },
  ),
  row('WALLET_SIGNING', 'CUSTODY_SIGNING_AUTHORITY', CLASSICAL_AND_SOFTWARE_PQ, 'ONLINE'),
  row('ORACLE_SIGNING', 'ORACLE_SIGNING_AUTHORITY', CLASSICAL, 'ONLINE'),
  row(
    'BACKUP_ENCRYPTION',
    'SECURITY_GOVERNANCE_AUTHORITY',
    CLASSICAL,
    'OFFLINE',
    { backupPolicy: 'BACKUP_ENCRYPTION wraps provider recovery material references only' },
  ),
]);

export function isRootOfTrustAuthority(value: unknown): value is RootOfTrustAuthority {
  return typeof value === 'string' && (ROOT_OF_TRUST_AUTHORITIES as readonly string[]).includes(value);
}

export function purposeForAuthority(authority: RootOfTrustAuthority): KeyPurpose {
  return AUTHORITY_PURPOSE[authority];
}

export function matrixRowFor(
  authority: RootOfTrustAuthority,
  purpose: KeyPurpose,
): KeyPurposeMatrixRow | undefined {
  return KEY_PURPOSE_MATRIX.find((item) => item.allowedAuthority === authority && item.purpose === purpose);
}

export function authoritiesShareFingerprintAllowed(
  left: RootOfTrustAuthority,
  right: RootOfTrustAuthority,
): boolean {
  return left === right;
}

export function assertAuthorityPurpose(
  authority: RootOfTrustAuthority,
  purpose: KeyPurpose,
): SecurityResult<true> {
  if (AUTHORITY_PURPOSE[authority] !== purpose) {
    return securityErr(
      'PURPOSE_MISMATCH',
      `${authority} is bound to ${AUTHORITY_PURPOSE[authority]}, not ${purpose}`,
    );
  }
  return securityOk(true);
}

export function assertHumanGovernanceRole(
  authority: RootOfTrustAuthority,
  actorKind: CeremonyActorKind,
): SecurityResult<true> {
  if (
    (HUMAN_GOVERNANCE_AUTHORITIES as readonly RootOfTrustAuthority[]).includes(authority) &&
    actorKind !== 'HUMAN'
  ) {
    return securityErr(
      'AI_ROLE_FORBIDDEN',
      `AI or service cannot possess human governance authorization ${authority}`,
    );
  }
  return securityOk(true);
}

export function assertAuthoritySeparation(
  fingerprint: string,
  authority: RootOfTrustAuthority,
  existing: readonly { readonly fingerprint: string; readonly authority: RootOfTrustAuthority }[],
): SecurityResult<true> {
  const conflict = existing.find(
    (item) => item.fingerprint === fingerprint && !authoritiesShareFingerprintAllowed(item.authority, authority),
  );
  if (conflict) {
    return securityErr(
      'AUTHORITY_SEPARATION',
      `fingerprint already bound to ${conflict.authority}; cannot also authorize ${authority}`,
    );
  }
  return securityOk(true);
}

export function recoveryCannotBecomeGovernance(from: RootOfTrustAuthority, to: RootOfTrustAuthority): boolean {
  return from === 'RECOVERY_AUTHORITY' && to === 'PROTOCOL_GOVERNANCE_AUTHORITY';
}

export function releaseCannotVoteConsensus(authority: RootOfTrustAuthority): boolean {
  return authority === 'RELEASE_AUTHORITY';
}

export function consensusCannotSignCustody(authority: RootOfTrustAuthority): boolean {
  return authority === 'VALIDATOR_CONSENSUS_AUTHORITY';
}

export function governanceCannotSignWallet(authority: RootOfTrustAuthority): boolean {
  return (
    authority === 'PROTOCOL_GOVERNANCE_AUTHORITY' ||
    authority === 'SECURITY_GOVERNANCE_AUTHORITY' ||
    authority === 'VALIDATOR_GOVERNANCE_AUTHORITY'
  );
}
