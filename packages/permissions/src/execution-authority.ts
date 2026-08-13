import { createHmac, timingSafeEqual } from 'node:crypto';

import type { Clock } from './clock.ts';

export interface ExecutionAuthority {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly intentId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly signature: string;
}

export interface IssueAuthorityInput {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly intentId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export const AUTHORITY_TTL_MS = 15 * 60 * 1000;

/**
 * HMAC-SHA256 Execution Authority.
 *
 * An authority is valid only when the signature verifies, it is unexpired,
 * and it is scoped to the exact action and account the caller intends.
 */
export class AuthorityIssuer {
  constructor(private readonly secret: string) {
    if (secret.length === 0) {
      throw new Error('AuthorityIssuer requires a non-empty signing secret');
    }
  }

  issue(input: IssueAuthorityInput): ExecutionAuthority {
    return Object.freeze({
      ...input,
      signature: this.sign(input),
    });
  }

  sign(input: IssueAuthorityInput): string {
    return createHmac('sha256', this.secret)
      .update(canonicalAuthorityPayload(input))
      .digest('hex');
  }

  signatureMatches(authority: ExecutionAuthority): boolean {
    if (!authority || typeof authority.signature !== 'string') {
      return false;
    }
    return safeEqualHex(this.sign(authority), authority.signature);
  }

  isExpired(authority: ExecutionAuthority, clock: Clock): boolean {
    const expiresAt = Date.parse(authority.expiresAt);
    if (Number.isNaN(expiresAt)) {
      return true;
    }
    return clock.now().getTime() >= expiresAt;
  }
}

export function canonicalAuthorityPayload(input: IssueAuthorityInput): string {
  return [
    input.authorityId,
    input.actionType,
    input.accountId,
    input.intentId,
    input.issuedAt,
    input.expiresAt,
  ].join('\n');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    if (left.length === 0 || left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
