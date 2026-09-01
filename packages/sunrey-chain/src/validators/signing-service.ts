/**
 * Validator signing service.
 *
 * Orchestrates: identity → key loading → sign-bytes → signing → envelope.
 * Integrates durable signer safety, key lifecycle, and migration policy.
 */

import {
  INITIAL_CRYPTO_MIGRATION_STATE,
  createSecurityProviderCatalog,
  migrationStateAtHeight,
  roleAcceptsSuiteForSign,
  type ProviderCatalog,
} from '../../../security/src/index.ts';
import { consensusDomainForMessageType } from '../../../security/src/signature-domains.ts';
import type { PublicKeyDescriptor } from '../../../security/src/crypto-descriptors.ts';
import {
  DurableSignerSafety,
  consensusSignBytesHash,
  encodeConsensusSignBytes,
  type ConsensusSigner,
} from './signer.ts';
import { ValidatorKeyLifecycleManager } from './key-lifecycle.ts';
import {
  freezeValidatorSignedEnvelope,
  type ValidatorSignedEnvelope,
} from './signed-envelope.ts';
import {
  CANONICAL_VALIDATOR_ALGORITHM_ID,
  CANONICAL_VALIDATOR_SUITE_ID,
  HYBRID_VALIDATOR_SUITE_ID,
  type ConsensusSignRequest,
  type ValidatorResult,
  validatorErr,
  validatorOk,
} from './types.ts';
import {
  createDevelopmentValidatorSigner,
  verifyConsensusBytes,
} from './pq-signer.ts';

export type ValidatorSigningServiceInput = {
  readonly validatorId: string;
  readonly keyId: string;
  readonly seedHex: string;
  readonly suiteId: string;
  readonly signerSafety: DurableSignerSafety;
  readonly keyLifecycle: ValidatorKeyLifecycleManager;
  readonly controllerKind: string;
  readonly nowUtc: string;
  readonly catalog?: ProviderCatalog;
  readonly migrationHeight?: number;
};

export type ValidatorVerifyInput = {
  readonly envelope: ValidatorSignedEnvelope;
  readonly publicKeyHex: string;
  readonly catalog?: ProviderCatalog;
};

export class ValidatorSigningService {
  readonly #input: ValidatorSigningServiceInput;
  readonly #catalog: ProviderCatalog;
  readonly #signer: ConsensusSigner;

  constructor(input: ValidatorSigningServiceInput) {
    this.#input = input;
    this.#catalog = input.catalog ?? createSecurityProviderCatalog();
    this.#signer = createDevelopmentValidatorSigner({
      seedHex: input.seedHex,
      suiteId: input.suiteId,
      catalog: this.#catalog,
    });
  }

  sign(request: ConsensusSignRequest): ValidatorResult<ValidatorSignedEnvelope> {
    if (request.validatorId !== this.#input.validatorId) {
      return validatorErr('KEY_ROLE_MISMATCH', 'sign request validatorId does not match service identity');
    }
    const migration = migrationStateAtHeight(this.#input.migrationHeight ?? 0);
    if (!roleAcceptsSuiteForSign(migration, 'VALIDATOR_CONSENSUS_SIGNING', request.cryptoSuiteId)) {
      return validatorErr(
        'SIGNER_PROVIDER_UNAVAILABLE',
        `suite ${request.cryptoSuiteId} not accepted at migration state ${migration}`,
      );
    }
    const key = this.#input.keyLifecycle.assertCanSign(this.#input.keyId);
    if (!key.ok) {
      return key;
    }
    const domain = consensusDomainForMessageType(request.messageType);
    const protectedSign = this.#input.signerSafety.protect(
      request,
      this.#signer,
      this.#input.controllerKind,
      this.#input.nowUtc,
    );
    if (!protectedSign.ok) {
      return protectedSign;
    }
    const signBytes = encodeConsensusSignBytes(request);
    const envelope = freezeValidatorSignedEnvelope({
      envelopeVersion: 1,
      signerId: request.validatorId,
      keyId: key.value.publicKey.keyId,
      keyVersion: key.value.publicKey.keyVersion,
      algorithmId: algorithmForSuite(request.cryptoSuiteId),
      suiteId: request.cryptoSuiteId as ValidatorSignedEnvelope['suiteId'],
      signatureVersion: 1,
      domain,
      networkId: request.networkId,
      chainId: request.chainId,
      protocolVersion: request.protocolVersion,
      messageType: request.messageType,
      height: request.height,
      round: request.round,
      blockId: request.blockId,
      validatorSetVersion: request.validatorSetVersion,
      signBytesHash: consensusSignBytesHash(request),
      signatureHex: protectedSign.value.signatureHex,
      createdAtUtc: this.#input.nowUtc,
    });
    if (!verifyConsensusBytes(this.#catalog, request.cryptoSuiteId, key.value.publicKey.publicKeyHex, signBytes, envelope.signatureHex)) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', 'self-verification failed after signing; fail-closed');
    }
    return validatorOk(envelope);
  }

  verify(input: ValidatorVerifyInput): ValidatorResult<true> {
    const key = this.#input.keyLifecycle.assertCanVerify(input.envelope.keyId, input.envelope.keyVersion);
    if (!key.ok) {
      return key;
    }
    if (key.value.publicKey.publicKeyHex !== input.publicKeyHex) {
      return validatorErr('KEY_ROLE_MISMATCH', 'public key does not match registered key record');
    }
    const request: ConsensusSignRequest = {
      validatorId: input.envelope.signerId,
      networkId: input.envelope.networkId,
      chainId: input.envelope.chainId,
      protocolVersion: input.envelope.protocolVersion,
      messageType: input.envelope.messageType,
      height: input.envelope.height,
      round: input.envelope.round,
      blockId: input.envelope.blockId,
      validatorSetVersion: input.envelope.validatorSetVersion,
      cryptoSuiteId: input.envelope.suiteId,
    };
    const signBytesHash = consensusSignBytesHash(request);
    if (signBytesHash !== input.envelope.signBytesHash) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', 'sign bytes hash mismatch');
    }
    const signBytes = encodeConsensusSignBytes(request);
    if (
      !verifyConsensusBytes(
        input.catalog ?? this.#catalog,
        input.envelope.suiteId,
        input.publicKeyHex,
        signBytes,
        input.envelope.signatureHex,
      )
    ) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', 'signature verification failed');
    }
    return validatorOk(true);
  }

  activePublicKey(): ValidatorResult<PublicKeyDescriptor> {
    const active = this.#input.keyLifecycle.activeKey(this.#input.keyId);
    if (!active.ok) {
      return active;
    }
    return validatorOk(active.value.publicKey);
  }
}

function algorithmForSuite(suiteId: string): ValidatorSignedEnvelope['algorithmId'] {
  if (suiteId === HYBRID_VALIDATOR_SUITE_ID) {
    return 'Ed25519';
  }
  if (suiteId === CANONICAL_VALIDATOR_SUITE_ID) {
    return CANONICAL_VALIDATOR_ALGORITHM_ID;
  }
  return 'ML_DSA_65_V1';
}

export const PRODUCTION_VALIDATOR_CRYPTO_DEFAULTS = Object.freeze({
  migrationState: INITIAL_CRYPTO_MIGRATION_STATE,
  acceptedSuiteForSign: CANONICAL_VALIDATOR_SUITE_ID,
  hybridEnabled: false,
  pqNativeEnabled: false,
  developmentSoftwareBackendAllowed: false,
});

export type NodeIdentitySeparationReport = {
  readonly consensusKeyPurpose: 'VALIDATOR_CONSENSUS_SIGNING';
  readonly nodeIdentityPurpose: 'P2P_IDENTITY';
  readonly conflated: false;
  readonly riskNote: string;
};

export function nodeIdentitySeparationReport(): NodeIdentitySeparationReport {
  return Object.freeze({
    consensusKeyPurpose: 'VALIDATOR_CONSENSUS_SIGNING',
    nodeIdentityPurpose: 'P2P_IDENTITY',
    conflated: false,
    riskNote:
      'ValidatorRecord requires distinct consensusPublicKey and p2pPublicKey. ' +
      'Networking identity and consensus authorization are separate keys by contract.',
  });
}
