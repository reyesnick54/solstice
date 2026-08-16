import { createHash } from 'node:crypto';

import type { AlgorithmId } from './algorithm-ids.ts';
import type { CryptoSuiteId } from './crypto-suite.ts';
import { sha256Hex } from './hash.ts';
import type { KeyPurpose } from './purposes.ts';

export const SIGNED_BINDING_SCHEMA_VERSION = 'sunrey-signed-binding-v1';

export type SignedBinding = {
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly schemaVersion: string;
  readonly algorithmId: AlgorithmId;
  readonly suiteId: CryptoSuiteId;
  readonly keyPurpose: KeyPurpose;
  readonly messageDomain: string;
  readonly payloadHash: string;
};

export function payloadHash(payload: string | Buffer): string {
  return sha256Hex(payload);
}

export function encodeSignedBinding(binding: SignedBinding): Buffer {
  const lines = [
    'SUNREY-SIGNED-V1',
    `networkId=${binding.networkId}`,
    `chainId=${binding.chainId}`,
    `protocolVersion=${binding.protocolVersion}`,
    `schemaVersion=${binding.schemaVersion}`,
    `algorithmId=${binding.algorithmId}`,
    `suiteId=${binding.suiteId}`,
    `keyPurpose=${binding.keyPurpose}`,
    `messageDomain=${binding.messageDomain}`,
    `payloadHash=${binding.payloadHash}`,
  ];
  return Buffer.from(lines.join('\n'), 'utf8');
}

export function bindingDigest(binding: SignedBinding): string {
  return createHash('sha256').update(encodeSignedBinding(binding)).digest('hex');
}

export function createSignedBinding(input: {
  readonly networkId: string;
  readonly chainId: string;
  readonly protocolVersion: string;
  readonly algorithmId: AlgorithmId;
  readonly suiteId: CryptoSuiteId;
  readonly keyPurpose: KeyPurpose;
  readonly messageDomain: string;
  readonly payload: string | Buffer;
  readonly schemaVersion?: string;
}): SignedBinding {
  return Object.freeze({
    networkId: input.networkId,
    chainId: input.chainId,
    protocolVersion: input.protocolVersion,
    schemaVersion: input.schemaVersion ?? SIGNED_BINDING_SCHEMA_VERSION,
    algorithmId: input.algorithmId,
    suiteId: input.suiteId,
    keyPurpose: input.keyPurpose,
    messageDomain: input.messageDomain,
    payloadHash: payloadHash(input.payload),
  });
}
