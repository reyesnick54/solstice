import { createHmac, timingSafeEqual } from "node:crypto";
import type { Clock } from "../clock.ts";
import { LedgerInvariantError, type ExecutionAuthorityView } from "../ledger/types.ts";
import { Money } from "../money/Money.ts";

export type ExecutionAuthority = ExecutionAuthorityView;

export interface IssueAuthorityInput {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly idempotencyKey: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/**
 * HMAC-SHA256 Execution Authority.
 *
 * Any journal that touches a CUSTOMER account must carry a signature that
 * verifies against this issuer, is unexpired at post time, and binds the
 * action type, account, amount, and idempotency key.
 */
export class AuthorityIssuer {
  constructor(private readonly secret: string) {
    if (secret.length === 0) {
      throw new Error("AuthorityIssuer requires a non-empty signing secret");
    }
  }

  issue(input: IssueAuthorityInput): ExecutionAuthority {
    const authority: ExecutionAuthority = Object.freeze({
      ...input,
      amount: input.amount,
      signature: this.sign(input),
    });
    return authority;
  }

  verify(authority: ExecutionAuthority, clock: Clock): void {
    if (!authority || typeof authority.signature !== "string") {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "customer-touching journal requires a signed Execution Authority",
      );
    }
    const expected = this.sign(authority);
    const ok = safeEqualHex(expected, authority.signature);
    if (!ok) {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "Execution Authority signature is invalid",
      );
    }
    const now = clock.now();
    const expiresAt = Date.parse(authority.expiresAt);
    if (Number.isNaN(expiresAt)) {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "Execution Authority expiresAt is not a valid timestamp",
      );
    }
    if (now.getTime() >= expiresAt) {
      throw new LedgerInvariantError(
        "AUTHORITY",
        "Execution Authority has expired",
      );
    }
  }

  private sign(input: IssueAuthorityInput): string {
    const canonical = canonicalAuthorityPayload(input);
    return createHmac("sha256", this.secret).update(canonical).digest("hex");
  }
}

export function canonicalAuthorityPayload(input: IssueAuthorityInput): string {
  return [
    input.authorityId,
    input.actionType,
    input.accountId,
    input.amount.minorUnits.toString(),
    input.amount.currency,
    input.idempotencyKey,
    input.issuedAt,
    input.expiresAt,
  ].join("\n");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length === 0 || left.length !== right.length) {
      return false;
    }
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
