import { createHmac, timingSafeEqual } from 'node:crypto';
import { Money } from '../../../contracts/src/money.ts';
import type { UtcInstant } from '../../../contracts/src/time.ts';

/**
 * HMAC-SHA256 Execution Authority.
 *
 * Only the Compliance Kernel (human/system execution path) may construct
 * one via AuthorityIssuer. Agent code cannot import this module — it lives
 * under packages/platform and is outside the agent package.
 *
 * Agent-originated proposals NEVER receive an ExecutionAuthority. Allowing
 * a proposal is a kernel decision, not a posting.
 */
export type ExecutionAuthority = {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly idempotencyKey: string;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly signature: string;
};

export type IssueAuthorityInput = Omit<ExecutionAuthority, 'signature'>;

export class AuthorityIssuer {
  #issuedCount = 0;
  readonly #secret: string;

  constructor(secret: string) {
    if (secret.length === 0) {
      throw new Error('AuthorityIssuer requires a non-empty signing secret');
    }
    this.#secret = secret;
  }

  issue(input: IssueAuthorityInput): ExecutionAuthority {
    this.#issuedCount += 1;
    return Object.freeze({
      ...input,
      signature: this.sign(input),
    });
  }

  issuedCount(): number {
    return this.#issuedCount;
  }

  verify(authority: ExecutionAuthority, now: UtcInstant): void {
    const expected = this.sign(authority);
    if (!safeEqualHex(expected, authority.signature)) {
      throw new Error('Execution Authority signature is invalid');
    }
    if (Date.parse(now) >= Date.parse(authority.expiresAt)) {
      throw new Error('Execution Authority has expired');
    }
  }

  private sign(input: IssueAuthorityInput): string {
    const canonical = [
      input.authorityId,
      input.actionType,
      input.accountId,
      input.amount.minorUnits.toString(),
      input.amount.currency,
      input.idempotencyKey,
      input.issuedAt,
      input.expiresAt,
    ].join('\n');
    return createHmac('sha256', this.#secret).update(canonical).digest('hex');
  }
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
