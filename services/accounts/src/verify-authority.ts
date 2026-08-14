import { err, ok, type Result } from '@solstice/domain';
import {
  ActionType,
  type AuthorityIssuer,
  type Clock,
  type ExecutionAuthority,
} from '@solstice/permissions';

declare const validatedAuthorityBrand: unique symbol;

/**
 * An Execution Authority that has been verified as signed, unexpired, and
 * scoped to this exact action and account. Only verifyExecutionAuthority
 * can produce this type. Account construction requires it.
 */
export type ValidatedExecutionAuthority = ExecutionAuthority & {
  readonly [validatedAuthorityBrand]: true;
};

export type AuthorityRejection = {
  readonly code:
    | 'AUTHORITY_INVALID_SIGNATURE'
    | 'AUTHORITY_EXPIRED'
    | 'AUTHORITY_SCOPE_MISMATCH'
    | 'AUTHORITY_MISSING';
  readonly message: string;
};

export type AuthorityScope = {
  readonly actionType: string;
  readonly accountId: string;
  readonly intentId: string;
};

export function verifyExecutionAuthority(
  authority: ExecutionAuthority | undefined,
  scope: AuthorityScope,
  issuer: AuthorityIssuer,
  clock: Clock,
): Result<ValidatedExecutionAuthority, AuthorityRejection> {
  if (!authority) {
    return err(
      Object.freeze({
        code: 'AUTHORITY_MISSING' as const,
        message: 'Execution Authority is required to open an account',
      }),
    );
  }
  if (!issuer.signatureMatches(authority)) {
    return err(
      Object.freeze({
        code: 'AUTHORITY_INVALID_SIGNATURE' as const,
        message: 'Execution Authority signature is invalid',
      }),
    );
  }
  if (issuer.isExpired(authority, clock)) {
    return err(
      Object.freeze({
        code: 'AUTHORITY_EXPIRED' as const,
        message: 'Execution Authority has expired',
      }),
    );
  }
  if (
    authority.actionType !== scope.actionType ||
    authority.actionType !== ActionType.OPEN_ACCOUNT ||
    authority.accountId !== scope.accountId ||
    authority.intentId !== scope.intentId
  ) {
    return err(
      Object.freeze({
        code: 'AUTHORITY_SCOPE_MISMATCH' as const,
        message:
          'Execution Authority is not scoped to this exact OPEN_ACCOUNT action and account',
      }),
    );
  }
  return ok(authority as ValidatedExecutionAuthority);
}
