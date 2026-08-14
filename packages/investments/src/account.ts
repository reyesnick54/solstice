import type { ExecutionAuthority } from '../../platform/src/authority/ExecutionAuthority.ts';
import type { AccountId, CustomerId } from '../../contracts/src/ids.ts';
import type { UtcInstant } from '../../contracts/src/time.ts';
import type {
  InvestmentAccountPreconditions,
  InvestmentLegalClass,
} from '../../contracts/src/investment-types.ts';
import { missingFromPartial } from './preconditions.ts';

export type InvestmentAccount = {
  readonly id: AccountId;
  readonly ownerId: CustomerId;
  readonly accountClass: InvestmentLegalClass;
  readonly cashAccountId: AccountId;
  readonly securitiesAccountId: AccountId;
  readonly preconditions: InvestmentAccountPreconditions;
  readonly openedAt: UtcInstant;
  readonly openedByAuthorityId: string;
};

export type OpenInvestmentAccountInput = {
  readonly id: AccountId;
  readonly ownerId: CustomerId;
  readonly cashAccountId: AccountId;
  readonly securitiesAccountId: AccountId;
  readonly openedAt: UtcInstant;
  readonly agreement?: InvestmentAccountPreconditions['agreement'];
  readonly riskProfile?: InvestmentAccountPreconditions['riskProfile'];
  readonly disclosure?: InvestmentAccountPreconditions['disclosure'];
  readonly transferAuthorization?: InvestmentAccountPreconditions['transferAuthorization'];
};

export type OpenInvestmentAccountResult =
  | { readonly ok: true; readonly account: InvestmentAccount }
  | {
      readonly ok: false;
      readonly missing: NonNullable<ReturnType<typeof missingFromPartial>>;
    };

/**
 * Opening an investment account requires every precondition. Absence of
 * any one is a Kernel refusal — the correct outcome, not a workaround.
 * Construction requires a signed Execution Authority.
 */
export function openInvestmentAccount(
  input: OpenInvestmentAccountInput,
  executionAuthority: ExecutionAuthority,
): OpenInvestmentAccountResult {
  if (!executionAuthority || typeof executionAuthority.signature !== 'string') {
    throw new Error('openInvestmentAccount requires a signed Execution Authority');
  }
  const missing = missingFromPartial(input);
  if (missing) {
    return { ok: false, missing };
  }
  const account: InvestmentAccount = Object.freeze({
    id: input.id,
    ownerId: input.ownerId,
    accountClass: 'INVESTMENT_ASSET',
    cashAccountId: input.cashAccountId,
    securitiesAccountId: input.securitiesAccountId,
    preconditions: Object.freeze({
      agreement: input.agreement!,
      riskProfile: input.riskProfile!,
      disclosure: input.disclosure!,
      transferAuthorization: input.transferAuthorization!,
    }),
    openedAt: input.openedAt,
    openedByAuthorityId: executionAuthority.authorityId,
  });
  return { ok: true, account };
}
