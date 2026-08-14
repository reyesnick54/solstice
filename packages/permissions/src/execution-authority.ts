import type { Clock } from '../../config/src/clock.ts';
import { isExpired } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { Money } from '../../money/src/money.ts';
import type { KeyProvider } from '../../security/src/provider.ts';
import { SimulationKeyProvider } from '../../security/src/simulation.ts';
import { carriesVerifiedSeal, stampVerified, type VerifiedSeal } from './verified-seal.ts';

export type ExecutionAuthority = {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly amountMinorUnits: string | null;
  readonly amountCurrency: string | null;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
  readonly signature: string;
};

export type VerifiedExecutionAuthority = ExecutionAuthority & VerifiedSeal;

export type IssueAuthorityInput = {
  readonly authorityId: string;
  readonly actionType: string;
  readonly accountId: string;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly amount: Money | null;
  readonly issuedAt: UtcInstant;
  readonly expiresAt: UtcInstant;
};

export type AuthorityVerificationFailure = {
  readonly code:
    | 'AUTHORITY_INVALID'
    | 'AUTHORITY_EXPIRED'
    | 'AUTHORITY_SCOPE_MISMATCH'
    | 'AUTHORITY_NOT_VERIFIED';
  readonly message: string;
};

export type AuthorityScope = {
  readonly actionType: string;
  readonly accountId: string;
  readonly intentId: string;
};

export const AUTHORITY_TTL_MS = 15n * 60n * 1000n;

export type AuthorityIssuerSource = string | KeyProvider;

/**
 * HMAC-SHA256 Execution Authority issuer.
 *
 * The Kernel is the only production caller of issue(). A signed, short-lived,
 * scoped authority is the only token that may open an account or post a journal.
 *
 * Cryptographic material is obtained from the canonical KeyProvider.
 * A string argument is a test/simulation convenience that constructs a
 * labeled DEVELOPMENT provider for EXECUTION_AUTHORITY_SIGNING only.
 * Business services must not supply raw production signing keys.
 */
export class AuthorityIssuer {
  private readonly keys: KeyProvider;

  constructor(source: AuthorityIssuerSource) {
    if (typeof source === 'string') {
      if (source.length === 0) {
        throw new Error('AuthorityIssuer requires a non-empty signing secret');
      }
      this.keys = SimulationKeyProvider.fromHmacSecret(source);
      return;
    }
    this.keys = source;
  }

  issue(input: IssueAuthorityInput): ExecutionAuthority {
    const signature = this.sign(input);
    if (signature === null) {
      throw new Error('Execution Authority signing failed closed');
    }
    const authority: ExecutionAuthority = Object.freeze({
      authorityId: input.authorityId,
      actionType: input.actionType,
      accountId: input.accountId,
      intentId: input.intentId,
      idempotencyKey: input.idempotencyKey,
      amountMinorUnits: input.amount ? input.amount.minorUnits.toString() : null,
      amountCurrency: input.amount ? input.amount.currency : null,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      signature,
    });
    return authority;
  }

  /**
   * Verify signature, expiry, and exact action/account/intent scope.
   * The returned value carries the module-private verified seal. That seal
   * is the only way `openAccount` will accept an authority.
   */
  verify(
    authority: ExecutionAuthority,
    scope: AuthorityScope,
    clock: Clock,
  ): Result<VerifiedExecutionAuthority, AuthorityVerificationFailure> {
    if (!authority || typeof authority.signature !== 'string') {
      return err({
        code: 'AUTHORITY_INVALID',
        message: 'customer-touching action requires a signed Execution Authority',
      });
    }
    const verifiedMac = this.keys.verify(
      'EXECUTION_AUTHORITY_SIGNING',
      this.canonicalString(this.canonicalInput(authority)),
      authority.signature,
    );
    if (!verifiedMac.ok) {
      return err({
        code: 'AUTHORITY_INVALID',
        message: 'Execution Authority signature is invalid',
      });
    }
    if (isExpired(authority.expiresAt, clock.now())) {
      return err({
        code: 'AUTHORITY_EXPIRED',
        message: 'Execution Authority has expired',
      });
    }
    if (authority.actionType !== scope.actionType) {
      return err({
        code: 'AUTHORITY_SCOPE_MISMATCH',
        message: `Execution Authority actionType ${authority.actionType} does not bind ${scope.actionType}`,
      });
    }
    if (authority.accountId !== scope.accountId) {
      return err({
        code: 'AUTHORITY_SCOPE_MISMATCH',
        message: 'Execution Authority is scoped to a different account',
      });
    }
    if (authority.intentId !== scope.intentId) {
      return err({
        code: 'AUTHORITY_SCOPE_MISMATCH',
        message: 'Execution Authority is scoped to a different intent',
      });
    }
    return ok(stampVerified(authority));
  }

  private canonicalInput(authority: ExecutionAuthority): IssueAuthorityInput {
    return {
      authorityId: authority.authorityId,
      actionType: authority.actionType,
      accountId: authority.accountId,
      intentId: authority.intentId,
      idempotencyKey: authority.idempotencyKey,
      amount:
        authority.amountMinorUnits === null || authority.amountCurrency === null
          ? null
          : ({
              minorUnits: BigInt(authority.amountMinorUnits),
              currency: authority.amountCurrency,
            } as Money),
      issuedAt: authority.issuedAt,
      expiresAt: authority.expiresAt,
    };
  }

  private canonicalString(input: IssueAuthorityInput): string {
    const amount = input.amount
      ? `${input.amount.minorUnits.toString()}:${input.amount.currency}`
      : '';
    return [
      input.authorityId,
      input.actionType,
      input.accountId,
      input.intentId,
      input.idempotencyKey,
      amount,
      input.issuedAt,
      input.expiresAt,
    ].join('\n');
  }

  private sign(input: IssueAuthorityInput): string | null {
    const result = this.keys.sign('EXECUTION_AUTHORITY_SIGNING', this.canonicalString(input));
    if (!result.ok) {
      return null;
    }
    return result.value.hex;
  }
}

export function isVerifiedExecutionAuthority(
  value: unknown,
): value is VerifiedExecutionAuthority {
  return carriesVerifiedSeal(value);
}
