/**
 * Hash and identifier validation for external chain observations.
 */

const BITCOIN_TX_HASH = /^[a-f0-9]{64}$/i;
const BITCOIN_BLOCK_HASH = /^[0]{8}[a-f0-9]{56}$/i;
const ETHEREUM_HASH = /^0x[a-f0-9]{64}$/i;
const BITCOIN_ADDRESS = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;

export type HashValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

export function validateBitcoinTxHash(txHash: string): HashValidationResult {
  const normalized = txHash.trim().toLowerCase();
  if (!BITCOIN_TX_HASH.test(normalized)) {
    return { ok: false, code: 'INVALID_TX_HASH', message: 'Bitcoin transaction hash must be 64 hex characters' };
  }
  return { ok: true };
}

export function validateBitcoinBlockHash(blockHash: string): HashValidationResult {
  const normalized = blockHash.trim().toLowerCase();
  if (!BITCOIN_BLOCK_HASH.test(normalized) && !BITCOIN_TX_HASH.test(normalized)) {
    return { ok: false, code: 'INVALID_BLOCK_HASH', message: 'Bitcoin block hash must be 64 hex characters' };
  }
  return { ok: true };
}

export function validateEthereumTxHash(txHash: string): HashValidationResult {
  const normalized = txHash.trim().toLowerCase();
  if (!ETHEREUM_HASH.test(normalized)) {
    return { ok: false, code: 'INVALID_TX_HASH', message: 'Ethereum transaction hash must be 0x-prefixed 64 hex characters' };
  }
  return { ok: true };
}

export function validateTransactionHash(chainFamily: 'bitcoin' | 'ethereum', txHash: string): HashValidationResult {
  return chainFamily === 'bitcoin' ? validateBitcoinTxHash(txHash) : validateEthereumTxHash(txHash);
}

export function validateBitcoinAddress(address: string): HashValidationResult {
  if (!BITCOIN_ADDRESS.test(address.trim())) {
    return { ok: false, code: 'INVALID_ADDRESS', message: 'invalid Bitcoin address format' };
  }
  return { ok: true };
}

export function privacySafeAddressLogRef(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 8) {
    return 'addr:redacted';
  }
  return `addr:${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
