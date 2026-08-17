/**
 * Versioned hybrid public-key and signature encodings.
 *
 * Structured descriptors, not concatenated blobs. Missing or
 * ambiguous components fail closed.
 */

import { securityErr, securityOk, type SecurityResult } from './errors.ts';

export const HYBRID_ENCODING_VERSION = 'srhyb1' as const;

export type HybridComponentEncoding = {
  readonly version: typeof HYBRID_ENCODING_VERSION;
  readonly classicalHex: string;
  readonly postQuantumHex: string;
};

export function encodeHybridComponent(classicalHex: string, postQuantumHex: string): string {
  if (classicalHex.length === 0 || postQuantumHex.length === 0) {
    throw new TypeError('hybrid encoding refuses an empty component');
  }
  if (classicalHex.includes(':') || postQuantumHex.includes(':') || classicalHex.includes('|')) {
    throw new TypeError('hybrid encoding refuses delimiter characters in hex');
  }
  return `${HYBRID_ENCODING_VERSION}:${classicalHex}:${postQuantumHex}`;
}

export function decodeHybridComponent(value: string): SecurityResult<HybridComponentEncoding> {
  if (typeof value !== 'string' || value.length === 0) {
    return securityErr('HYBRID_COMPONENT_INVALID', 'hybrid encoding is missing');
  }
  if (value.length > 32_768) {
    return securityErr('HYBRID_COMPONENT_INVALID', 'hybrid encoding exceeds the strict bound');
  }
  const parts = value.split(':');
  if (parts.length !== 3 || parts[0] !== HYBRID_ENCODING_VERSION) {
    return securityErr('HYBRID_COMPONENT_INVALID', 'hybrid encoding version or arity is invalid');
  }
  const classicalHex = parts[1] ?? '';
  const postQuantumHex = parts[2] ?? '';
  if (classicalHex.length === 0 || postQuantumHex.length === 0) {
    return securityErr('HYBRID_COMPONENT_INVALID', 'hybrid encoding is missing a required component');
  }
  if (!/^[0-9a-f]+$/i.test(classicalHex) || !/^[0-9a-f]+$/i.test(postQuantumHex)) {
    return securityErr('HYBRID_COMPONENT_INVALID', 'hybrid encoding is not hex');
  }
  return securityOk(
    Object.freeze({
      version: HYBRID_ENCODING_VERSION,
      classicalHex,
      postQuantumHex,
    }),
  );
}

export function isHybridEncoded(value: string): boolean {
  return value.startsWith(`${HYBRID_ENCODING_VERSION}:`);
}
