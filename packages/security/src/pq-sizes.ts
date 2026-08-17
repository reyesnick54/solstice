/**
 * FIPS 203/204/205 encoding lengths for the selected parameter sets.
 * Encoding version V1 is the raw NIST byte strings (no extra wrapper).
 */

export const ML_DSA_65_V1_PUBLIC_KEY_BYTES = 1952;
export const ML_DSA_65_V1_SECRET_KEY_BYTES = 4032;
export const ML_DSA_65_V1_SIGNATURE_BYTES = 3309;
export const ML_DSA_65_V1_SEED_BYTES = 32;

export const ML_KEM_768_V1_PUBLIC_KEY_BYTES = 1184;
export const ML_KEM_768_V1_SECRET_KEY_BYTES = 2400;
export const ML_KEM_768_V1_CIPHERTEXT_BYTES = 1088;
export const ML_KEM_768_V1_SEED_BYTES = 64;
export const ML_KEM_768_V1_SHARED_SECRET_BYTES = 32;

export const SLH_DSA_SHA2_128S_V1_PUBLIC_KEY_BYTES = 32;
export const SLH_DSA_SHA2_128S_V1_SECRET_KEY_BYTES = 64;
export const SLH_DSA_SHA2_128S_V1_SIGNATURE_BYTES = 7856;
export const SLH_DSA_SHA2_128S_V1_SEED_BYTES = 48;

/** Strict remote-signer / P2P upper bound. SLH-DSA-SHA2-128s is 7856. */
export const MAX_PQ_SIGNATURE_BYTES = 8_192;
export const MAX_HYBRID_ENVELOPE_BYTES = 16_384;
export const MAX_PQ_PUBLIC_KEY_BYTES = 4_096;
export const MAX_REMOTE_SIGNER_SIGNATURE_BYTES = 16_384;
export const MAX_P2P_PQ_MESSAGE_BYTES = 1_048_576;
