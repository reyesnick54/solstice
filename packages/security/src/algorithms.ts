/**
 * Algorithm registry. Solstice does not invent cryptography.
 *
 * Every operation uses a Node.js standard primitive or a well-reviewed
 * construction already provided by `node:crypto`.
 *
 * | Purpose                         | Algorithm      | Why                                      |
 * | ------------------------------- | -------------- | ---------------------------------------- |
 * | Execution Authority MAC         | HMAC-SHA256    | Existing EA contract; FIPS-approved MAC  |
 * | Evidence / integrity hashing    | SHA-256        | Deterministic, existing vault contract   |
 * | Authenticated data encryption   | AES-256-GCM    | NIST AEAD; confidentiality + integrity   |
 * | Data-encryption-key wrap        | AES-256-GCM    | Same AEAD; no custom wrap scheme         |
 * | Key / nonce / token generation  | CSPRNG         | `crypto.randomBytes` / `randomUUID`      |
 *
 * Forbidden: custom ciphers, custom MACs, homemade password hashes,
 * ad-hoc KDFs, or invented signature schemes.
 */

export const HMAC_SHA256 = 'HMAC-SHA256' as const;
export const SHA_256 = 'SHA-256' as const;
export const AES_256_GCM = 'AES-256-GCM' as const;

export const SIGNING_ALGORITHMS = [HMAC_SHA256] as const;
export const HASH_ALGORITHMS = [SHA_256] as const;
export const ENCRYPTION_ALGORITHMS = [AES_256_GCM] as const;

export type SigningAlgorithm = (typeof SIGNING_ALGORITHMS)[number];
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];
export type EncryptionAlgorithm = (typeof ENCRYPTION_ALGORITHMS)[number];

export const AES_GCM_IV_BYTES = 12;
export const AES_GCM_KEY_BYTES = 32;
export const HMAC_KEY_BYTES = 32;
export const ENVELOPE_SCHEMA_VERSION = 1;

export const ALGORITHM_NOTES = Object.freeze({
  signing: 'HMAC-SHA256 via node:crypto createHmac. Preserves Execution Authority hex MAC.',
  hashing: 'SHA-256 via node:crypto createHash. Preserves Evidence Vault determinism.',
  encryption: 'AES-256-GCM via node:crypto createCipheriv/createDecipheriv. Standard AEAD.',
  wrap: 'DEK is wrapped with AES-256-GCM under the purpose master key. No custom wrap.',
  random: 'crypto.randomBytes / randomUUID. Not Math.random.',
});
