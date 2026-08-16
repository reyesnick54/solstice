/**
 * Explicit algorithm identifiers. Unknown IDs fail closed.
 * Providers must not silently fall back to another algorithm.
 *
 * Ed25519 (RFC 8032 via node:crypto) is the first chain signature
 * algorithm. It is not secp256k1 and is not HMAC-SHA256.
 *
 * NIST PQC family IDs are registered for agility. A production
 * provider is not selected in this chunk. See pqc-library-selection.ts.
 */

export const ALGORITHM_IDS = [
  'HMAC-SHA256',
  'SHA-256',
  'AES-256-GCM',
  'HKDF-SHA-256',
  'Ed25519',
  'ML-DSA-65',
  'ML-KEM-768',
  'SLH-DSA-SHA2-128S',
  'SIMULATION-ML-DSA-65',
  'SIMULATION-ML-KEM-768',
  'SIMULATION-SLH-DSA-SHA2-128S',
] as const;

export type AlgorithmId = (typeof ALGORITHM_IDS)[number];

export const CLASSICAL_SIGNATURE_ALGORITHM_ID = 'Ed25519' as const;
export const APPLICATION_MAC_ALGORITHM_ID = 'HMAC-SHA256' as const;

export function isAlgorithmId(value: unknown): value is AlgorithmId {
  return typeof value === 'string' && (ALGORITHM_IDS as readonly string[]).includes(value);
}

export function assertAlgorithmId(value: string): AlgorithmId {
  if (!isAlgorithmId(value)) {
    throw new TypeError(`unknown algorithm identifier: ${value}`);
  }
  return value;
}

export const ALGORITHM_FAMILIES = Object.freeze({
  'HMAC-SHA256': 'CLASSICAL_MAC',
  'SHA-256': 'CLASSICAL_HASH',
  'AES-256-GCM': 'CLASSICAL_AEAD',
  'HKDF-SHA-256': 'CLASSICAL_KDF',
  Ed25519: 'CLASSICAL_SIGNATURE',
  'ML-DSA-65': 'PQ_SIGNATURE',
  'ML-KEM-768': 'PQ_KEM',
  'SLH-DSA-SHA2-128S': 'PQ_SIGNATURE',
  'SIMULATION-ML-DSA-65': 'SIMULATION_PQ_SIGNATURE',
  'SIMULATION-ML-KEM-768': 'SIMULATION_PQ_KEM',
  'SIMULATION-SLH-DSA-SHA2-128S': 'SIMULATION_PQ_SIGNATURE',
} as const satisfies Record<AlgorithmId, string>);

export const SECP256K1_NOT_AN_ALIAS =
  'secp256k1 is not registered and is not interchangeable with Ed25519';
