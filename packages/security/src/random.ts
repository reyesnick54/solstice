import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Cryptographic randomness vs other identifiers.
 *
 * - Business / domain identifiers: assigned by the domain (accountId, customerId).
 *   Do not replace them with random tokens.
 * - Idempotency keys: caller-supplied business uniqueness. Not security tokens.
 * - Correlation IDs: tracing. randomUUID is fine; they are not capabilities.
 * - Security tokens / nonces / IVs / DEKs: MUST use this module (CSPRNG).
 */

export type IdentifierKind =
  | 'DOMAIN_ID'
  | 'IDEMPOTENCY_KEY'
  | 'CORRELATION_ID'
  | 'SECURITY_TOKEN'
  | 'NONCE';

export function secureRandomBytes(length: number): Buffer {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('secureRandomBytes length must be a positive integer');
  }
  return randomBytes(length);
}

export function secureRandomHex(lengthBytes: number): string {
  return secureRandomBytes(lengthBytes).toString('hex');
}

export function newSecurityToken(): string {
  return randomUUID();
}

export function newCorrelationId(): string {
  return randomUUID();
}

export function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    return safeEqual(left, right);
  } catch {
    return false;
  }
}
