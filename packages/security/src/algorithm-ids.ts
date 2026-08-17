/**
 * Explicit algorithm identifiers. Unknown IDs fail closed.
 * Providers must not silently fall back to another algorithm.
 *
 * Ed25519 (RFC 8032 via node:crypto) is the first chain signature
 * algorithm. It is not secp256k1 and is not HMAC-SHA256.
 *
 * Standardized PQC IDs name family, parameter set, and encoding
 * version. Legacy NIST-style IDs remain aliases of the V1 encodings.
 * See pqc-library-selection.ts.
 */

export const ALGORITHM_IDS = [
  'HMAC-SHA256',
  'SHA-256',
  'AES-256-GCM',
  'HKDF-SHA-256',
  'Ed25519',
  'ML-DSA-65',
  'ML_DSA_65_V1',
  'ML-KEM-768',
  'ML_KEM_768_V1',
  'SLH-DSA-SHA2-128S',
  'SLH_DSA_SHA2_128S_V1',
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
  ML_DSA_65_V1: 'PQ_SIGNATURE',
  'ML-KEM-768': 'PQ_KEM',
  ML_KEM_768_V1: 'PQ_KEM',
  'SLH-DSA-SHA2-128S': 'PQ_SIGNATURE',
  SLH_DSA_SHA2_128S_V1: 'PQ_SIGNATURE',
  'SIMULATION-ML-DSA-65': 'SIMULATION_PQ_SIGNATURE',
  'SIMULATION-ML-KEM-768': 'SIMULATION_PQ_KEM',
  'SIMULATION-SLH-DSA-SHA2-128S': 'SIMULATION_PQ_SIGNATURE',
} as const satisfies Record<AlgorithmId, string>);

export const STANDARDIZED_PQ_SIGNATURE_IDS = Object.freeze([
  'ML_DSA_65_V1',
  'ML-DSA-65',
  'SLH_DSA_SHA2_128S_V1',
  'SLH-DSA-SHA2-128S',
] as const);

export const STANDARDIZED_PQ_KEM_IDS = Object.freeze(['ML_KEM_768_V1', 'ML-KEM-768'] as const);

export function canonicalPqAlgorithmId(id: AlgorithmId): AlgorithmId {
  if (id === 'ML-DSA-65') {
    return 'ML_DSA_65_V1';
  }
  if (id === 'ML-KEM-768') {
    return 'ML_KEM_768_V1';
  }
  if (id === 'SLH-DSA-SHA2-128S') {
    return 'SLH_DSA_SHA2_128S_V1';
  }
  return id;
}

export const SECP256K1_NOT_AN_ALIAS =
  'secp256k1 is not registered and is not interchangeable with Ed25519';
