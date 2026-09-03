// @ts-nocheck
/**
 * Validator signed envelope.
 *
 * Communicates signer identity, key identifier, algorithm, and signature
 * version without exposing secret data.
 */

import type { AlgorithmId } from '../../../security/src/algorithm-ids.ts';
import {
  type HybridSignatureDescriptor,
  type KeyId,
  type KeyVersion,
} from '../../../security/src/crypto-descriptors.ts';
import type { CryptoSuiteId } from '../../../security/src/crypto-suite.ts';
import { securityErr, securityOk, type SecurityResult } from '../../../security/src/errors.ts';
import { isSignatureDomain, type SignatureDomain } from '../../../security/src/signature-domains.ts';
import type { ConsensusMessageType } from './types.ts';

export const VALIDATOR_SIGNATURE_ENVELOPE_VERSION = 1 as const;

export type ValidatorSignedEnvelope = {
  readonly envelopeVersion: typeof VALIDATOR_SIGNATURE_ENVELOPE_VERSION;
  readonly signerId: string;
  readonly keyId: KeyId;
  readonly keyVersion: KeyVersion;
  readonly algorithmId: AlgorithmId;
  readonly suiteId: CryptoSuiteId;
  readonly signatureVersion: number;
  readonly domain: SignatureDomain;
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly messageType: ConsensusMessageType;
  readonly height: bigint;
  readonly round: bigint;
  readonly blockId: string;
  readonly validatorSetVersion: bigint;
  readonly signBytesHash: string;
  readonly signatureHex: string;
  readonly hybrid?: HybridSignatureDescriptor;
  readonly createdAtUtc: string;
};

export type ReplayProtectionFields = {
  readonly networkId: string;
  readonly chainId: string;
  readonly height: bigint;
  readonly round: bigint;
  readonly validatorSetVersion: bigint;
  readonly domain: SignatureDomain;
  readonly signerId: string;
};

export function freezeValidatorSignedEnvelope(value: ValidatorSignedEnvelope): ValidatorSignedEnvelope {
  return Object.freeze({ ...value });
}

export function replayProtectionFields(envelope: ValidatorSignedEnvelope): ReplayProtectionFields {
  return Object.freeze({
    networkId: envelope.networkId,
    chainId: envelope.chainId,
    height: envelope.height,
    round: envelope.round,
    validatorSetVersion: envelope.validatorSetVersion,
    domain: envelope.domain,
    signerId: envelope.signerId,
  });
}

export function assertReplayProtection(
  observed: ReplayProtectionFields,
  expected: ReplayProtectionFields,
): SecurityResult<true> {
  if (observed.networkId !== expected.networkId) {
    return securityErr('BINDING_MISMATCH', 'replay rejected: networkId mismatch');
  }
  if (observed.chainId !== expected.chainId) {
    return securityErr('BINDING_MISMATCH', 'replay rejected: chainId mismatch');
  }
  if (observed.domain !== expected.domain) {
    return securityErr('BINDING_MISMATCH', 'replay rejected: domain mismatch');
  }
  if (observed.signerId !== expected.signerId) {
    return securityErr('BINDING_MISMATCH', 'replay rejected: signerId mismatch');
  }
  if (observed.height !== expected.height || observed.round !== expected.round) {
    return securityErr('BINDING_MISMATCH', 'replay rejected: height/round mismatch');
  }
  if (observed.validatorSetVersion !== expected.validatorSetVersion) {
    return securityErr('BINDING_MISMATCH', 'replay rejected: validatorSetVersion mismatch');
  }
  return securityOk(true);
}

export function parseValidatorSignedEnvelope(value: unknown): SecurityResult<ValidatorSignedEnvelope> {
  if (typeof value !== 'object' || value === null) {
    return securityErr('BINDING_MISMATCH', 'envelope must be an object');
  }
  const row = value as Record<string, unknown>;
  if (row.envelopeVersion !== VALIDATOR_SIGNATURE_ENVELOPE_VERSION) {
    return securityErr('BINDING_MISMATCH', 'unsupported envelope version');
  }
  if (typeof row.domain !== 'string' || !isSignatureDomain(row.domain)) {
    return securityErr('BINDING_MISMATCH', 'invalid signature domain');
  }
  if (typeof row.signerId !== 'string' || row.signerId.length === 0) {
    return securityErr('BINDING_MISMATCH', 'signerId is required');
  }
  if (typeof row.keyId !== 'string' || row.keyId.length === 0) {
    return securityErr('BINDING_MISMATCH', 'keyId is required');
  }
  if (typeof row.signatureHex !== 'string' || row.signatureHex.length === 0) {
    return securityErr('BINDING_MISMATCH', 'signatureHex is required');
  }
  if (typeof row.signBytesHash !== 'string' || row.signBytesHash.length !== 64) {
    return securityErr('BINDING_MISMATCH', 'signBytesHash must be a 32-byte hex digest');
  }
  const height = parseBigIntField(row.height, 'height');
  if (!height.ok) {
    return height;
  }
  const round = parseBigIntField(row.round, 'round');
  if (!round.ok) {
    return round;
  }
  const validatorSetVersion = parseBigIntField(row.validatorSetVersion, 'validatorSetVersion');
  if (!validatorSetVersion.ok) {
    return validatorSetVersion;
  }
  return securityOk(
    freezeValidatorSignedEnvelope({
      envelopeVersion: VALIDATOR_SIGNATURE_ENVELOPE_VERSION,
      signerId: row.signerId,
      keyId: row.keyId as KeyId,
      keyVersion: Number(row.keyVersion) as KeyVersion,
      algorithmId: row.algorithmId as AlgorithmId,
      suiteId: row.suiteId as CryptoSuiteId,
      signatureVersion: Number(row.signatureVersion),
      domain: row.domain,
      networkId: String(row.networkId),
      chainId: String(row.chainId),
      protocolVersion: String(row.protocolVersion),
      messageType: row.messageType as ConsensusMessageType,
      height: height.value,
      round: round.value,
      blockId: String(row.blockId),
      validatorSetVersion: validatorSetVersion.value,
      signBytesHash: row.signBytesHash,
      signatureHex: row.signatureHex,
      hybrid: row.hybrid as HybridSignatureDescriptor | undefined,
      createdAtUtc: String(row.createdAtUtc),
    }),
  );
}

function parseBigIntField(value: unknown, label: string): SecurityResult<bigint> {
  if (typeof value === 'bigint') {
    return securityOk(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return securityOk(BigInt(value));
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return securityOk(BigInt(value));
  }
  return securityErr('BINDING_MISMATCH', `${label} must be an integer`);
}

export function serializeValidatorSignedEnvelope(envelope: ValidatorSignedEnvelope): string {
  return JSON.stringify({
    ...envelope,
    height: envelope.height.toString(),
    round: envelope.round.toString(),
    validatorSetVersion: envelope.validatorSetVersion.toString(),
  });
}

export function deserializeValidatorSignedEnvelope(serialized: string): SecurityResult<ValidatorSignedEnvelope> {
  try {
    return parseValidatorSignedEnvelope(JSON.parse(serialized));
  } catch {
    return securityErr('BINDING_MISMATCH', 'envelope JSON is malformed');
  }
}
