import type { AccountId } from '../../domain/src/account.ts';
import type { CurrencyCode } from '../../domain/src/currency.ts';
import type { CustomerId } from '../../domain/src/customer.ts';
import type { LegalEntityId } from '../../domain/src/legal-entity.ts';
import type { ProductId } from '../../domain/src/product.ts';
import type { UtcInstant } from '../../domain/src/time.ts';
import type { InvestmentAccountId } from './ids.ts';
import type { InvestmentProfileStatus } from './types.ts';

/**
 * Investment-specific metadata linked to canonical Account IDs.
 * There is no balance field. Cash is ledger-derived from BROKERAGE_CASH.
 * Security quantity lives on PortfolioPosition, not on this profile.
 */
export type InvestmentAccountProfile = {
  readonly investmentAccountId: InvestmentAccountId;
  readonly customerId: CustomerId;
  readonly brokerageCashAccountId: AccountId;
  readonly securitiesAccountId: AccountId;
  readonly pendingSettlementAccountId: AccountId;
  readonly productId: ProductId;
  readonly legalEntityId: LegalEntityId;
  readonly baseCurrency: CurrencyCode;
  readonly status: InvestmentProfileStatus;
  readonly createdAt: UtcInstant;
  readonly environment: 'simulation';
  readonly liveState: false;
};

export function freezeInvestmentAccountProfile(
  profile: InvestmentAccountProfile,
): InvestmentAccountProfile {
  if ('balance' in profile) {
    throw new Error('InvestmentAccountProfile must not store a balance');
  }
  if (profile.environment !== 'simulation' || profile.liveState !== false) {
    throw new Error('investment accounts are simulation-only');
  }
  return Object.freeze({ ...profile });
}
