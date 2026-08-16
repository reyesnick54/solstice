import type { KeyProvider } from '../../security/src/provider.ts';
import type { ChainFailure, ChainSignatureMetadata, ChainWriteIntent } from './types.ts';

export function signChainIntent(
  keys: KeyProvider,
  intent: ChainWriteIntent,
): { readonly ok: true; readonly signature: ChainSignatureMetadata } | { readonly ok: false; readonly error: ChainFailure } {
  const signed = keys.sign('CHAIN_OPERATION_SIGNING', intent.payloadCommitment);
  if (!signed.ok) {
    return {
      ok: false,
      error: { code: 'SIGNER_UNAVAILABLE', message: signed.error.message },
    };
  }
  return {
    ok: true,
    signature: {
      keyId: signed.value.keyId,
      keyVersion: signed.value.keyVersion,
      algorithm: signed.value.algorithm,
      signatureHex: signed.value.hex,
    },
  };
}
