/**
 * Typed cryptographic purposes. Arbitrary strings are not authority.
 *
 * Application purposes stay on the HMAC / AES KeyProvider.
 * Chain public-key purposes must use a versioned CryptoSuite and
 * SignatureProvider. HMAC is not validator consensus signing.
 * Execution Authority keys remain separate from validator keys.
 */

export const APPLICATION_KEY_PURPOSES = [
  'EXECUTION_AUTHORITY_SIGNING',
  'EVIDENCE_INTEGRITY',
  'SESSION_SIGNING',
  'DATA_ENCRYPTION',
  'BACKUP_ENCRYPTION',
  'SERVICE_AUTHENTICATION',
  'WEBHOOK_SIGNING',
  'DATA_USE_PERMIT_SIGNING',
  'CLEAN_ROOM_JOIN_TOKEN',
  'PYRAMID_CUSTODY_FUTURE',
  'CHAIN_OPERATION_SIGNING',
] as const;

export const CHAIN_KEY_PURPOSES = [
  'TRANSACTION_SIGNING',
  'VALIDATOR_CONSENSUS_SIGNING',
  'BLOCK_PROPOSAL_SIGNING',
  'P2P_IDENTITY',
  'ORACLE_SIGNING',
  'GOVERNANCE_SIGNING',
  'ATTESTATION_SIGNING',
  'EVIDENCE_SIGNING',
  'WALLET_SIGNING',
  'INTEROPERABILITY_SIGNING',
  'MACHINE_SIGNING',
] as const;

export const KEY_PURPOSES = [...APPLICATION_KEY_PURPOSES, ...CHAIN_KEY_PURPOSES] as const;

export type ApplicationKeyPurpose = (typeof APPLICATION_KEY_PURPOSES)[number];
export type ChainKeyPurpose = (typeof CHAIN_KEY_PURPOSES)[number];
export type KeyPurpose = (typeof KEY_PURPOSES)[number];

export function isApplicationKeyPurpose(value: unknown): value is ApplicationKeyPurpose {
  return (
    typeof value === 'string' && (APPLICATION_KEY_PURPOSES as readonly string[]).includes(value)
  );
}

export function isChainKeyPurpose(value: unknown): value is ChainKeyPurpose {
  return typeof value === 'string' && (CHAIN_KEY_PURPOSES as readonly string[]).includes(value);
}

export function isKeyPurpose(value: unknown): value is KeyPurpose {
  return typeof value === 'string' && (KEY_PURPOSES as readonly string[]).includes(value);
}

export function assertKeyPurpose(value: string): KeyPurpose {
  if (!isKeyPurpose(value)) {
    throw new TypeError(`unknown key purpose: ${value}`);
  }
  return value;
}

export const PURPOSE_ALGORITHMS = Object.freeze({
  EXECUTION_AUTHORITY_SIGNING: 'HMAC-SHA256',
  EVIDENCE_INTEGRITY: 'SHA-256',
  SESSION_SIGNING: 'HMAC-SHA256',
  DATA_ENCRYPTION: 'AES-256-GCM',
  BACKUP_ENCRYPTION: 'AES-256-GCM',
  SERVICE_AUTHENTICATION: 'HMAC-SHA256',
  WEBHOOK_SIGNING: 'HMAC-SHA256',
  DATA_USE_PERMIT_SIGNING: 'HMAC-SHA256',
  CLEAN_ROOM_JOIN_TOKEN: 'HMAC-SHA256',
  PYRAMID_CUSTODY_FUTURE: 'HMAC-SHA256',
  CHAIN_OPERATION_SIGNING: 'HMAC-SHA256',
} as const satisfies Record<ApplicationKeyPurpose, 'HMAC-SHA256' | 'SHA-256' | 'AES-256-GCM'>);

export const CHAIN_PURPOSE_DEFAULT_SUITE = Object.freeze({
  TRANSACTION_SIGNING: 'sunrey-ed25519-v1',
  VALIDATOR_CONSENSUS_SIGNING: 'sunrey-ed25519-v1',
  BLOCK_PROPOSAL_SIGNING: 'sunrey-ed25519-v1',
  P2P_IDENTITY: 'sunrey-ed25519-v1',
  ORACLE_SIGNING: 'sunrey-ed25519-v1',
  GOVERNANCE_SIGNING: 'sunrey-ed25519-v1',
  ATTESTATION_SIGNING: 'sunrey-ed25519-v1',
  EVIDENCE_SIGNING: 'sunrey-ed25519-v1',
  WALLET_SIGNING: 'sunrey-ed25519-v1',
  INTEROPERABILITY_SIGNING: 'sunrey-ed25519-v1',
  MACHINE_SIGNING: 'sunrey-ed25519-v1',
} as const satisfies Record<ChainKeyPurpose, string>);
