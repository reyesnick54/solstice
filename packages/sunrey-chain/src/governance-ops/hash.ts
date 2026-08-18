import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

import { GOVERNANCE_OPS_DOMAIN } from './types.ts';

const PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

export function stable(value: unknown): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stable(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${key}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export function commitGovernance(value: unknown): string {
  return sha256Hex(`${GOVERNANCE_OPS_DOMAIN}|${stable(value)}`);
}

export function seedFromLabel(label: string): Uint8Array {
  return createHash('sha256').update(`sunrey-govops-seed|${label}`).digest();
}

export function ed25519FromSeed(seed: Uint8Array): { readonly privateKey: Buffer; readonly publicKeyHex: string } {
  const pkcs8 = Buffer.concat([PKCS8_PREFIX, Buffer.from(seed)]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  return {
    privateKey: pkcs8,
    publicKeyHex: Buffer.from(spki.subarray(spki.length - 32)).toString('hex'),
  };
}

export function signHex(seed: Uint8Array, messageHex: string): string {
  const keys = ed25519FromSeed(seed);
  const privateKey = createPrivateKey({ key: keys.privateKey, format: 'der', type: 'pkcs8' });
  return sign(null, Buffer.from(messageHex, 'hex'), privateKey).toString('hex');
}

export function verifyHex(publicKeyHex: string, messageHex: string, signatureHex: string): boolean {
  const raw = Buffer.from(publicKeyHex, 'hex');
  if (raw.length !== 32) {
    return false;
  }
  const spki = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    raw,
  ]);
  try {
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return verify(null, Buffer.from(messageHex, 'hex'), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}

export function containsPrivateKeyMaterial(value: unknown): boolean {
  const encoded = stable(value).toLowerCase();
  return /privatekey|secretkey|mnemonic|seedphrase|seed_phrase/.test(encoded);
}
