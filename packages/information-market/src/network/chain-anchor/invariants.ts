/**
 * Chain finality is evidence of a privacy-safe HIN commitment.
 * It is never the legal source of consent validity.
 *
 * Consent remains valid according to HIN consent policy.
 * Revocation takes effect according to HIN policy immediately,
 * even when the chain is unavailable or a revocation anchor fails.
 */
export const CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY = true as const;
export const CONSENT_SOURCE_OF_TRUTH = 'HIN' as const;
export const CHAIN_ANCHOR_IS_EVIDENCE = true as const;
export const REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE = false as const;
export const RAW_PERSONAL_DATA_ON_CHAIN = false as const;
export const ANCHOR_MINTS_ASSET = false as const;
export const ANCHOR_ALTERS_LEDGER = false as const;
export const PRODUCTION_ACTIVE = false as const;

export const HIN_ANCHOR_INVARIANTS = Object.freeze({
  CHAIN_FINALITY_IS_NOT_LEGAL_CONSENT_AUTHORITY,
  CONSENT_SOURCE_OF_TRUTH,
  CHAIN_ANCHOR_IS_EVIDENCE,
  REVOCATION_REQUIRES_CHAIN_TO_BLOCK_FUTURE_USE,
  RAW_PERSONAL_DATA_ON_CHAIN,
  ANCHOR_MINTS_ASSET,
  ANCHOR_ALTERS_LEDGER,
  PRODUCTION_ACTIVE,
  autoFixed: false,
  hinIsNotABlockchainNode: true,
});
