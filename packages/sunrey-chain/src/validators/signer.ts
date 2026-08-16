import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  CANONICAL_VALIDATOR_ALGORITHM_ID,
  CANONICAL_VALIDATOR_SUITE_ID,
  DOMAIN_CONSENSUS_PRECOMMIT,
  DOMAIN_CONSENSUS_PREVOTE,
  DOMAIN_CONSENSUS_PROPOSAL,
  NIL_BLOCK_ID,
  type ConsensusMessageType,
  type ConsensusSignRequest,
  type EquivocationEvidence,
  type SignerProviderKind,
  type SignerSafetyState,
  type ValidatorResult,
  validatorErr,
  validatorOk,
} from './types.ts';
import { domainHashHex, encodeString, encodeU64, sha256Hex } from './canonical.ts';
import { assertPermittedValidatorController } from './controller.ts';
import { assertConsensusKeyPurpose } from './keys.ts';

export function consensusDomain(type: ConsensusMessageType): string {
  if (type === 'PROPOSAL') {
    return DOMAIN_CONSENSUS_PROPOSAL;
  }
  if (type === 'PREVOTE') {
    return DOMAIN_CONSENSUS_PREVOTE;
  }
  return DOMAIN_CONSENSUS_PRECOMMIT;
}

export function encodeConsensusSignBytes(request: ConsensusSignRequest): Buffer {
  return Buffer.concat([
    encodeString(consensusDomain(request.messageType)),
    encodeString(request.networkId),
    encodeString(request.chainId),
    encodeString(request.protocolVersion),
    encodeString(request.messageType),
    encodeU64(request.height),
    encodeU64(request.round),
    encodeString(request.blockId),
    encodeString(request.validatorId),
    encodeU64(request.validatorSetVersion),
    encodeString(request.cryptoSuiteId),
  ]);
}

export function consensusSignBytesHash(request: ConsensusSignRequest): string {
  return domainHashHex(consensusDomain(request.messageType), encodeConsensusSignBytes(request));
}

export type ConsensusSigner = {
  readonly kind: SignerProviderKind;
  sign(request: ConsensusSignRequest): ValidatorResult<{ readonly signatureHex: string; readonly signBytesHash: string }>;
};

export class LocalDevelopmentSigner implements ConsensusSigner {
  readonly kind = 'LOCAL_DEVELOPMENT_SIGNER' as const;
  readonly #sign: (message: Buffer) => string;

  constructor(sign: (message: Buffer) => string) {
    this.#sign = sign;
  }

  sign(request: ConsensusSignRequest): ValidatorResult<{ readonly signatureHex: string; readonly signBytesHash: string }> {
    if (request.cryptoSuiteId !== CANONICAL_VALIDATOR_SUITE_ID) {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `unknown crypto suite ${request.cryptoSuiteId}; no silent fallback`);
    }
    const bytes = encodeConsensusSignBytes(request);
    return validatorOk({
      signatureHex: this.#sign(bytes),
      signBytesHash: consensusSignBytesHash(request),
    });
  }
}

export function unavailableSigner(kind: Exclude<SignerProviderKind, 'LOCAL_DEVELOPMENT_SIGNER'>): ConsensusSigner {
  return {
    kind,
    sign() {
      return validatorErr('SIGNER_PROVIDER_UNAVAILABLE', `${kind} is reserved; only LOCAL_DEVELOPMENT_SIGNER is implemented`);
    },
  };
}

function conflicts(existing: SignerSafetyState, request: ConsensusSignRequest, nextHash: string): boolean {
  if (existing.chainId !== request.chainId) {
    return false;
  }
  if (existing.lastSignedHeight !== request.height || existing.lastSignedRound !== request.round) {
    return false;
  }
  if (existing.lastSignedStep !== request.messageType) {
    return false;
  }
  if (existing.canonicalSignBytesHash === nextHash) {
    return false;
  }
  const existingNil = existing.canonicalSignBytesHash.length === 0;
  const nextNil = request.blockId === NIL_BLOCK_ID;
  if (request.messageType !== 'PROPOSAL' && existingNil && nextNil) {
    return false;
  }
  return true;
}

export class DurableSignerSafety {
  readonly #path: string;
  #metrics = { signerConflictRejected: 0n };

  constructor(path: string) {
    this.#path = path;
  }

  load(): SignerSafetyState | null {
    if (!existsSync(this.#path)) {
      return null;
    }
    const raw = JSON.parse(readFileSync(this.#path, 'utf8')) as SignerSafetyState & {
      lastSignedHeight: string;
      lastSignedRound: string;
    };
    return {
      ...raw,
      lastSignedHeight: BigInt(raw.lastSignedHeight),
      lastSignedRound: BigInt(raw.lastSignedRound),
    };
  }

  persist(state: SignerSafetyState): void {
    mkdirSync(dirname(this.#path), { recursive: true });
    const tmp = `${this.#path}.tmp`;
    const body = JSON.stringify({
      ...state,
      lastSignedHeight: state.lastSignedHeight.toString(),
      lastSignedRound: state.lastSignedRound.toString(),
    });
    writeFileSync(tmp, body, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmp, this.#path);
  }

  protect(
    request: ConsensusSignRequest,
    signer: ConsensusSigner,
    controllerKind: string,
    nowUtc: string,
  ): ValidatorResult<{ readonly signatureHex: string; readonly state: SignerSafetyState }> {
    const control = assertPermittedValidatorController(controllerKind, 'CAST_VOTE');
    if (!control.ok) {
      return control;
    }
    const purpose = assertConsensusKeyPurpose('VALIDATOR_CONSENSUS_SIGNING');
    if (!purpose.ok) {
      return purpose;
    }
    const nextHash = consensusSignBytesHash(request);
    const existing = this.load();
    if (existing && conflicts(existing, request, nextHash)) {
      this.#metrics.signerConflictRejected += 1n;
      return validatorErr(
        'SIGNER_CONFLICT',
        `conflicting ${request.messageType} at height ${request.height} round ${request.round}`,
      );
    }
    if (existing && existing.canonicalSignBytesHash === nextHash && existing.signatureReference.length > 0) {
      return validatorOk({
        signatureHex: existing.signatureReference,
        state: existing,
      });
    }
    const reserved: SignerSafetyState = {
      validatorId: request.validatorId,
      chainId: request.chainId,
      lastSignedHeight: request.height,
      lastSignedRound: request.round,
      lastSignedStep: request.messageType,
      canonicalSignBytesHash: nextHash,
      signatureReference: '',
      updatedAt: nowUtc,
    };
    this.persist(reserved);
    const signed = signer.sign(request);
    if (!signed.ok) {
      return signed;
    }
    const committed: SignerSafetyState = {
      ...reserved,
      signatureReference: signed.value.signatureHex,
    };
    this.persist(committed);
    return validatorOk({ signatureHex: signed.value.signatureHex, state: committed });
  }

  metrics(): { readonly signerConflictRejected: bigint; readonly signerLastHeight: bigint | null; readonly signerLastRound: bigint | null } {
    const state = this.load();
    return {
      signerConflictRejected: this.#metrics.signerConflictRejected,
      signerLastHeight: state?.lastSignedHeight ?? null,
      signerLastRound: state?.lastSignedRound ?? null,
    };
  }
}

export function safetyPath(dataDir: string, validatorId: string, chainId: string): string {
  const digest = createHash('sha256').update(`${validatorId}:${chainId}`).digest('hex').slice(0, 16);
  return join(dataDir, 'signer-safety', `${digest}.json`);
}

export function buildEquivocationEvidence(
  kind: EquivocationEvidence['kind'],
  requestA: ConsensusSignRequest,
  requestB: ConsensusSignRequest,
  signatureAHex: string,
  signatureBHex: string,
  publicKeyHex: string,
): EquivocationEvidence {
  return Object.freeze({
    kind,
    validatorId: requestA.validatorId,
    validatorSetVersion: requestA.validatorSetVersion,
    height: requestA.height,
    round: requestA.round,
    messageType: requestA.messageType,
    messageAHash: consensusSignBytesHash(requestA),
    messageBHash: consensusSignBytesHash(requestB),
    signatureAHex,
    signatureBHex,
    publicKeyHex,
    cryptoSuiteId: requestA.cryptoSuiteId,
    networkId: requestA.networkId,
    chainId: requestA.chainId,
  });
}

export function developmentHmacSign(message: Buffer, secretLabel: string): string {
  return sha256Hex(Buffer.concat([Buffer.from(secretLabel, 'utf8'), message]));
}

export { CANONICAL_VALIDATOR_ALGORITHM_ID };
