import { createSignedBinding, type SignedBinding } from './crypto-binding.ts';
import {
  freezeHybridSignatureDescriptor,
  type HybridSignatureDescriptor,
  type HybridVerificationPolicy,
  type PublicKeyDescriptor,
} from './crypto-descriptors.ts';
import type { SignatureProvider } from './crypto-providers.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from './errors.ts';
import type { PrivateKeyMaterial } from './redaction.ts';

export type HybridSignInput = {
  readonly suiteId: CryptoSuiteId;
  readonly protocolVersion: string;
  readonly domain: string;
  readonly networkId: string;
  readonly chainId: string;
  readonly payload: string | Buffer;
  readonly verificationPolicy: HybridVerificationPolicy;
  readonly classical: {
    readonly provider: SignatureProvider;
    readonly publicKey: PublicKeyDescriptor;
    readonly privateKey: PrivateKeyMaterial;
  };
  readonly postQuantum: {
    readonly provider: SignatureProvider;
    readonly publicKey: PublicKeyDescriptor;
    readonly privateKey: PrivateKeyMaterial;
  };
};

function componentBinding(
  input: HybridSignInput,
  algorithmId: PublicKeyDescriptor['algorithmId'],
  purpose: PublicKeyDescriptor['purpose'],
): SignedBinding {
  return createSignedBinding({
    networkId: input.networkId,
    chainId: input.chainId,
    protocolVersion: input.protocolVersion,
    algorithmId,
    suiteId: input.suiteId,
    keyPurpose: purpose,
    messageDomain: input.domain,
    payload: input.payload,
  });
}

/**
 * CLASSICAL_AND_PQ: both signatures independently verify the same
 * canonical signing payload. Bytes are structured descriptors, not
 * concatenated blobs. There is no OR verification.
 */
export function signHybrid(input: HybridSignInput): SecurityResult<HybridSignatureDescriptor> {
  if (input.verificationPolicy === 'VERIFY_LEGACY_ONLY') {
    return securityErr(
      'SUITE_VERIFY_ONLY',
      'VERIFY_LEGACY_ONLY cannot originate a new hybrid signature',
    );
  }
  if (input.classical.publicKey.purpose !== input.postQuantum.publicKey.purpose) {
    return securityErr('PURPOSE_MISMATCH', 'hybrid components must share a key purpose');
  }
  const classicalBinding = componentBinding(
    input,
    input.classical.publicKey.algorithmId,
    input.classical.publicKey.purpose,
  );
  const pqBinding = componentBinding(
    input,
    input.postQuantum.publicKey.algorithmId,
    input.postQuantum.publicKey.purpose,
  );
  const classical = input.classical.provider.sign(
    input.classical.privateKey,
    input.classical.publicKey,
    classicalBinding,
  );
  if (!classical.ok) {
    return classical;
  }
  const postQuantum = input.postQuantum.provider.sign(
    input.postQuantum.privateKey,
    input.postQuantum.publicKey,
    pqBinding,
  );
  if (!postQuantum.ok) {
    return postQuantum;
  }
  return securityOk(
    freezeHybridSignatureDescriptor({
      suiteId: input.suiteId,
      combiner: 'CLASSICAL_AND_PQ',
      verificationPolicy: input.verificationPolicy,
      classicalAlgorithmId: input.classical.publicKey.algorithmId,
      postQuantumAlgorithmId: input.postQuantum.publicKey.algorithmId,
      classicalPublicKey: input.classical.publicKey,
      postQuantumPublicKey: input.postQuantum.publicKey,
      classicalSignature: classical.value,
      postQuantumSignature: postQuantum.value,
      domain: input.domain,
      protocolVersion: input.protocolVersion,
    }),
  );
}

export function verifyHybrid(
  input: Omit<HybridSignInput, 'classical' | 'postQuantum' | 'verificationPolicy'> & {
    readonly envelope: HybridSignatureDescriptor;
    readonly classicalProvider: SignatureProvider;
    readonly postQuantumProvider: SignatureProvider;
    readonly verificationPolicy?: HybridVerificationPolicy;
  },
): SecurityResult<true> {
  const policy = input.verificationPolicy ?? input.envelope.verificationPolicy;
  if (input.envelope.combiner !== 'CLASSICAL_AND_PQ') {
    return securityErr('HYBRID_COMPONENT_INVALID', 'unsupported hybrid combiner');
  }
  if (input.envelope.suiteId !== input.suiteId) {
    return securityErr('BINDING_MISMATCH', 'hybrid suite id does not match');
  }
  if (input.envelope.domain !== input.domain) {
    return securityErr('BINDING_MISMATCH', 'hybrid domain does not match');
  }

  const classicalBinding = componentBinding(
    { ...input, verificationPolicy: policy, classical: null as never, postQuantum: null as never },
    input.envelope.classicalAlgorithmId,
    input.envelope.classicalPublicKey.purpose,
  );
  const pqBinding = componentBinding(
    { ...input, verificationPolicy: policy, classical: null as never, postQuantum: null as never },
    input.envelope.postQuantumAlgorithmId,
    input.envelope.postQuantumPublicKey.purpose,
  );

  const classical = input.classicalProvider.verify(
    input.envelope.classicalPublicKey,
    classicalBinding,
    input.envelope.classicalSignature,
  );
  const postQuantum = input.postQuantumProvider.verify(
    input.envelope.postQuantumPublicKey,
    pqBinding,
    input.envelope.postQuantumSignature,
  );

  if (policy === 'REQUIRE_ALL') {
    if (!classical.ok) {
      return securityErr('HYBRID_COMPONENT_INVALID', 'REQUIRE_ALL: classical signature failed');
    }
    if (!postQuantum.ok) {
      return securityErr('HYBRID_COMPONENT_INVALID', 'REQUIRE_ALL: post-quantum signature failed');
    }
    return securityOk(true);
  }
  if (policy === 'REQUIRE_CLASSICAL') {
    if (!classical.ok) {
      return securityErr('HYBRID_COMPONENT_INVALID', 'REQUIRE_CLASSICAL: classical signature failed');
    }
    return securityOk(true);
  }
  if (policy === 'REQUIRE_PQ') {
    if (!postQuantum.ok) {
      return securityErr('HYBRID_COMPONENT_INVALID', 'REQUIRE_PQ: post-quantum signature failed');
    }
    return securityOk(true);
  }
  if (policy === 'VERIFY_LEGACY_ONLY') {
    if (!classical.ok) {
      return securityErr('HYBRID_COMPONENT_INVALID', 'VERIFY_LEGACY_ONLY: legacy signature failed');
    }
    return securityOk(true);
  }
  return securityErr('HYBRID_COMPONENT_INVALID', `unknown hybrid verification policy ${String(policy)}`);
}
