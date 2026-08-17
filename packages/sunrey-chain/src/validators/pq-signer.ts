/**
 * Development-network validator signer backed by CryptoSuite / SignatureProvider.
 *
 * Application code does not import the PQ library. Provider failure
 * is fail-closed: no silent classical-only fallback.
 */

import { createHash } from 'node:crypto';

import {
  MAX_REMOTE_SIGNER_SIGNATURE_BYTES,
  SUITE_SUNREY_ED25519_V1,
  SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
  SUITE_SUNREY_MLDSA_65_V1,
  createSecurityProviderCatalog,
  decodeHybridComponent,
  encodeHybridComponent,
  type ProviderCatalog,
} from '../../../security/src/index.ts';
import {
  CANONICAL_VALIDATOR_SUITE_ID,
  HYBRID_VALIDATOR_SUITE_ID,
  PQ_VALIDATOR_SUITE_ID,
  type ConsensusSignRequest,
  type ConsensusSigner,
  type ValidatorResult,
  validatorErr,
  validatorOk,
} from './types.ts';
import { consensusSignBytesHash, encodeConsensusSignBytes } from './signer.ts';

function pqSeedHex(seedHex: string): string {
  return createHash('sha256').update('SUNREY-VALIDATOR-PQ-SEED-v1').update(Buffer.from(seedHex, 'hex')).digest('hex');
}

export function createDevelopmentValidatorSigner(input: {
  readonly seedHex: string;
  readonly suiteId: string;
  readonly catalog?: ProviderCatalog;
  readonly pqEnabled?: boolean;
}): ConsensusSigner {
  const catalog = input.catalog ?? createSecurityProviderCatalog();
  const suiteId = input.suiteId;
  return {
    kind: suiteId === CANONICAL_VALIDATOR_SUITE_ID ? 'LOCAL_DEVELOPMENT_SIGNER' : 'PQ_HYBRID_SIGNER',
    sign(request: ConsensusSignRequest): ValidatorResult<{
      readonly signatureHex: string;
      readonly signBytesHash: string;
    }> {
      if (request.cryptoSuiteId !== suiteId) {
        return validatorErr(
          'SIGNER_PROVIDER_UNAVAILABLE',
          `signer is bound to ${suiteId}; requested ${request.cryptoSuiteId}; no silent downgrade`,
        );
      }
      if (input.pqEnabled === false && suiteId !== CANONICAL_VALIDATOR_SUITE_ID) {
        return validatorErr(
          'SIGNER_PROVIDER_UNAVAILABLE',
          'standardized PQ provider unavailable; fail-closed; no classical-only fallback',
        );
      }
      const bytes = encodeConsensusSignBytes(request);
      const signed = signConsensusBytes(catalog, suiteId, input.seedHex, bytes);
      if (!signed.ok) {
        return signed;
      }
      if (signed.value.length / 2 > MAX_REMOTE_SIGNER_SIGNATURE_BYTES) {
        return validatorErr(
          'SIGNER_PROVIDER_UNAVAILABLE',
          `signature exceeds remote-signer bound of ${MAX_REMOTE_SIGNER_SIGNATURE_BYTES} bytes; no truncation`,
        );
      }
      return validatorOk({
        signatureHex: signed.value,
        signBytesHash: consensusSignBytesHash(request),
      });
    },
  };
}

export function signConsensusBytes(
  catalog: ProviderCatalog,
  suiteId: string,
  seedHex: string,
  bytes: Buffer,
): ValidatorResult<string> {
  if (suiteId === SUITE_SUNREY_MLDSA_65_V1 || suiteId === PQ_VALIDATOR_SUITE_ID) {
    const pq = catalog.signature('ML_DSA_65_V1');
    if (!pq.ok) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `${pq.error.message}; fail-closed`);
    }
    const key = pq.value.fromSeed(seedHex, 'VALIDATOR_CONSENSUS_SIGNING', suiteId, 'validator-pq');
    if (!key.ok) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', key.error.message);
    }
    const signed = pq.value.signRaw(key.value.privateKey.reveal().toString('hex'), key.value.publicKey.publicKeyHex, bytes);
    if (!signed.ok) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', signed.error.message);
    }
    return validatorOk(signed.value.toString('hex'));
  }
  const ed = catalog.signature('Ed25519');
  if (!ed.ok) {
    return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `${ed.error.message}; fail-closed`);
  }
  const classical = ed.value.fromSeed(seedHex, 'VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_ED25519_V1, 'validator-ed');
  if (!classical.ok) {
    return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', classical.error.message);
  }
  const classicalSig = ed.value.signRaw(
    classical.value.privateKey.reveal().toString('hex'),
    classical.value.publicKey.publicKeyHex,
    bytes,
  );
  if (!classicalSig.ok) {
    return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', classicalSig.error.message);
  }
  if (suiteId === SUITE_SUNREY_ED25519_V1 || suiteId === CANONICAL_VALIDATOR_SUITE_ID) {
    return validatorOk(classicalSig.value.toString('hex'));
  }
  if (suiteId === SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1 || suiteId === HYBRID_VALIDATOR_SUITE_ID) {
    const pq = catalog.signature('ML_DSA_65_V1');
    if (!pq.ok) {
      return validatorErr(
        'SIGNER_PROVIDER_UNAVAILABLE',
        `${pq.error.message}; hybrid required; fail-closed; no classical-only fallback`,
      );
    }
    const pqKey = pq.value.fromSeed(
      pqSeedHex(seedHex),
      'VALIDATOR_CONSENSUS_SIGNING',
      SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
      'validator-hybrid-pq',
    );
    if (!pqKey.ok) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', pqKey.error.message);
    }
    const pqSig = pq.value.signRaw(
      pqKey.value.privateKey.reveal().toString('hex'),
      pqKey.value.publicKey.publicKeyHex,
      bytes,
    );
    if (!pqSig.ok) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', pqSig.error.message);
    }
    return validatorOk(encodeHybridComponent(classicalSig.value.toString('hex'), pqSig.value.toString('hex')));
  }
  return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `unknown crypto suite ${suiteId}; no silent fallback`);
}

export function verifyConsensusBytes(
  catalog: ProviderCatalog,
  suiteId: string,
  publicKeyHex: string,
  bytes: Buffer,
  signatureHex: string,
): boolean {
  if (suiteId === SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1 || suiteId === HYBRID_VALIDATOR_SUITE_ID) {
    const pub = decodeHybridComponent(publicKeyHex);
    const sig = decodeHybridComponent(signatureHex);
    if (!pub.ok || !sig.ok) {
      return false;
    }
    const ed = catalog.signature('Ed25519');
    const pq = catalog.signature('ML_DSA_65_V1');
    if (!ed.ok || !pq.ok) {
      return false;
    }
    return (
      ed.value.verifyRaw(pub.value.classicalHex, bytes, sig.value.classicalHex).ok &&
      pq.value.verifyRaw(pub.value.postQuantumHex, bytes, sig.value.postQuantumHex).ok
    );
  }
  if (suiteId === SUITE_SUNREY_MLDSA_65_V1 || suiteId === PQ_VALIDATOR_SUITE_ID) {
    const pq = catalog.signature('ML_DSA_65_V1');
    return pq.ok && pq.value.verifyRaw(publicKeyHex, bytes, signatureHex).ok;
  }
  const ed = catalog.signature('Ed25519');
  return ed.ok && ed.value.verifyRaw(publicKeyHex, bytes, signatureHex).ok;
}

export function validatorPublicKeyHex(catalog: ProviderCatalog, suiteId: string, seedHex: string): string {
  if (suiteId === SUITE_SUNREY_MLDSA_65_V1 || suiteId === PQ_VALIDATOR_SUITE_ID) {
    const pq = catalog.signature('ML_DSA_65_V1');
    if (!pq.ok) {
      throw new Error(pq.error.message);
    }
    const key = pq.value.fromSeed(seedHex, 'VALIDATOR_CONSENSUS_SIGNING', suiteId, 'validator-pq');
    if (!key.ok) {
      throw new Error(key.error.message);
    }
    return key.value.publicKey.publicKeyHex;
  }
  const ed = catalog.signature('Ed25519');
  if (!ed.ok) {
    throw new Error(ed.error.message);
  }
  const classical = ed.value.fromSeed(seedHex, 'VALIDATOR_CONSENSUS_SIGNING', SUITE_SUNREY_ED25519_V1, 'validator-ed');
  if (!classical.ok) {
    throw new Error(classical.error.message);
  }
  if (suiteId === SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1 || suiteId === HYBRID_VALIDATOR_SUITE_ID) {
    const pq = catalog.signature('ML_DSA_65_V1');
    if (!pq.ok) {
      throw new Error(pq.error.message);
    }
    const pqKey = pq.value.fromSeed(
      pqSeedHex(seedHex),
      'VALIDATOR_CONSENSUS_SIGNING',
      SUITE_SUNREY_HYBRID_ED25519_MLDSA_V1,
      'validator-hybrid-pq',
    );
    if (!pqKey.ok) {
      throw new Error(pqKey.error.message);
    }
    return encodeHybridComponent(classical.value.publicKey.publicKeyHex, pqKey.value.publicKey.publicKeyHex);
  }
  return classical.value.publicKey.publicKeyHex;
}
