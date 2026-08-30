/**
 * Expedia Rapid signature authentication.
 *
 * Official format: Authorization: EAN APIKey=...,Signature=...,timestamp=...
 * Signature = unsalted SHA-512(apiKey + sharedSecret + unixTimestampSeconds)
 *
 * @see developers.expediagroup.com/rapid/lodging/reference/signature-authentication
 */

import { createHash } from 'node:crypto';

export type ExpediaAuthMaterial = {
  readonly apiKey: string;
  readonly sharedSecret: string;
  readonly timestampSeconds: number;
};

export function buildExpediaSignature(material: ExpediaAuthMaterial): string {
  const payload = `${material.apiKey}${material.sharedSecret}${material.timestampSeconds}`;
  return createHash('sha512').update(payload, 'utf8').digest('hex');
}

export function buildExpediaAuthorizationHeader(material: ExpediaAuthMaterial): string {
  const signature = buildExpediaSignature(material);
  return `EAN APIKey=${material.apiKey},Signature=${signature},timestamp=${material.timestampSeconds}`;
}

export function verifyExpediaSignature(material: ExpediaAuthMaterial, expectedSignature: string): boolean {
  const actual = buildExpediaSignature(material);
  return timingSafeEqual(actual, expectedSignature);
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export type ExpediaTokenRefreshPort = {
  readonly refreshIfNeeded: (input: {
    readonly credentialRef: string;
    readonly nowMs: number;
  }) => Promise<{ readonly apiKey: string; readonly sharedSecret: string } | null>;
};

export class NoOpExpediaTokenRefreshPort implements ExpediaTokenRefreshPort {
  async refreshIfNeeded(): Promise<null> {
    return null;
  }
}
