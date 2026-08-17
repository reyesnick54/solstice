/**
 * Consensus / P2P / storage bounds for hybrid and standardized PQ messages.
 *
 * PQC signatures are larger. These constants document the audit.
 * Bounds are raised only where the existing envelope already fits
 * the selected ML-DSA-65 hybrid size.
 */

import {
  MAX_HYBRID_ENVELOPE_BYTES,
  MAX_P2P_PQ_MESSAGE_BYTES,
  MAX_PQ_PUBLIC_KEY_BYTES,
  MAX_PQ_SIGNATURE_BYTES,
  MAX_REMOTE_SIGNER_SIGNATURE_BYTES,
  ML_DSA_65_V1_PUBLIC_KEY_BYTES,
  ML_DSA_65_V1_SIGNATURE_BYTES,
  SLH_DSA_SHA2_128S_V1_SIGNATURE_BYTES,
} from '../../../security/src/index.ts';

export const CONSENSUS_SIZE_AUDIT = Object.freeze({
  classicalSignatureBytes: 64,
  classicalPublicKeyBytes: 32,
  mlDsa65PublicKeyBytes: ML_DSA_65_V1_PUBLIC_KEY_BYTES,
  mlDsa65SignatureBytes: ML_DSA_65_V1_SIGNATURE_BYTES,
  slhDsaSha2128sSignatureBytes: SLH_DSA_SHA2_128S_V1_SIGNATURE_BYTES,
  hybridEnvelopeMaxBytes: MAX_HYBRID_ENVELOPE_BYTES,
  pqSignatureMaxBytes: MAX_PQ_SIGNATURE_BYTES,
  pqPublicKeyMaxBytes: MAX_PQ_PUBLIC_KEY_BYTES,
  remoteSignerSignatureMaxBytes: MAX_REMOTE_SIGNER_SIGNATURE_BYTES,
  p2pPqMessageMaxBytes: MAX_P2P_PQ_MESSAGE_BYTES,
  proposalBudgetBytes: 16_384,
  voteBudgetBytes: 16_384,
  commitCertificateBudgetBytes: 262_144,
  maxTxBytes: 16_384,
  maxBlockBytes: 512_000,
  maxFrameBytes: 1_048_576,
  maxStringBytes: 4_096,
  rustNodeVoteSignatureBytes: 64,
  note:
    'TypeScript testnet control plane carries hybrid/PQ signatures up to the remote-signer bound. The Rust local node vote codec remains 64-byte Ed25519 and fail-closes unknown suites. SLH-DSA is diversification only and is not the default consensus algorithm.',
});

export function assertP2pMessageBound(encoded: string | Uint8Array): { readonly ok: true } | { readonly ok: false; readonly detail: string } {
  const bytes = typeof encoded === 'string' ? Buffer.byteLength(encoded, 'utf8') : encoded.byteLength;
  if (bytes > MAX_P2P_PQ_MESSAGE_BYTES) {
    return { ok: false, detail: `P2P message ${bytes} exceeds ${MAX_P2P_PQ_MESSAGE_BYTES}; rejected without unbounded allocation` };
  }
  return { ok: true };
}

export function hybridVoteSizeBytes(signatureEncoding: string): number {
  return 128 + Buffer.byteLength(signatureEncoding, 'utf8');
}

export function hybridCommitCertificateSizeBytes(
  signatureEncoding: string,
  validatorCount: number,
): number {
  return validatorCount * hybridVoteSizeBytes(signatureEncoding);
}
