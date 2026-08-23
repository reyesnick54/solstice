/**
 * Canonical transaction view over SRCB v1 and the P2P development envelope.
 * Wire encodings stay in the Rust protocol crates.
 */

export const TRANSACTION_FIELDS = [
  'sender',
  'nonce',
  'action',
  'amountAsset',
  'fee',
  'networkId',
  'chainId',
  'expiration',
  'signature',
  'transactionHash',
] as const;

export type CanonicalTransactionView = {
  readonly sender: string;
  readonly nonce: bigint;
  readonly action: string;
  readonly amountAsset: string | null;
  readonly feeMinorUnits: bigint | null;
  readonly networkId: string;
  readonly chainId: string;
  readonly expiresAtMs: bigint | null;
  readonly signature: string;
  readonly publicKey: string;
  readonly transactionHash: string;
};

export type TransactionValidationFailure =
  | 'INVALID_SIGNATURE'
  | 'WRONG_NETWORK'
  | 'WRONG_CHAIN'
  | 'REPLAY'
  | 'NONCE'
  | 'EXPIRED'
  | 'INSUFFICIENT_FEE'
  | 'DECODE_FAILED';

export function requiredFieldsPresent(tx: CanonicalTransactionView): boolean {
  return (
    tx.sender.length > 0 &&
    tx.action.length > 0 &&
    tx.networkId.length > 0 &&
    tx.chainId.length > 0 &&
    tx.signature.length > 0 &&
    tx.publicKey.length > 0 &&
    tx.transactionHash.length > 0
  );
}

export function addressRelatesToPublicKey(address: string, publicKey: string): boolean {
  return address.length > 0 && publicKey.length > 0 && address !== publicKey;
}

export const DETERMINISTIC_CODEC = 'srcb.v1';
export const CRYPTO_SUITE = 'sunrey-ed25519-sha256-v1';
