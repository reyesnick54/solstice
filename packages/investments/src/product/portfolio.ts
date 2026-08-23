import type { AccountId } from '../../../domain/src/account.ts';
import type { CurrencyCode } from '../../../domain/src/currency.ts';
import type { CustomerId } from '../../../domain/src/customer.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import type { InvestmentAccountId } from '../ids.ts';
import type { InvestmentAccountProfile } from '../profile.ts';
import { asPortfolioId, type PortfolioId } from './ids.ts';
import type { PortfolioStatus } from './types.ts';

/**
 * Customer portfolio overlay. Cash is ledger-derived. This object is not
 * a second financial authority.
 */
export type InvestmentPortfolio = {
  readonly portfolioId: PortfolioId;
  readonly ownerId: CustomerId;
  readonly investmentAccountId: InvestmentAccountId;
  readonly brokerageCashAccountId: AccountId;
  readonly securitiesAccountId: AccountId;
  readonly pendingSettlementAccountId: AccountId;
  readonly baseCurrency: CurrencyCode;
  readonly displayCurrency: CurrencyCode;
  readonly strategyRef: string | null;
  readonly riskProfileRef: string | null;
  readonly goalLinks: readonly string[];
  readonly restrictions: readonly string[];
  readonly status: PortfolioStatus;
  readonly createdAt: UtcInstant;
  readonly environment: 'simulation';
  readonly liveState: false;
  readonly securitiesBrokerageLive: false;
};

export function freezePortfolio(portfolio: InvestmentPortfolio): InvestmentPortfolio {
  if ('balance' in portfolio) {
    throw new Error('InvestmentPortfolio must not store a balance');
  }
  if (portfolio.environment !== 'simulation' || portfolio.liveState !== false) {
    throw new Error('portfolios are simulation-only');
  }
  return Object.freeze({
    ...portfolio,
    goalLinks: Object.freeze([...portfolio.goalLinks]),
    restrictions: Object.freeze([...portfolio.restrictions]),
    securitiesBrokerageLive: false,
  });
}

export function portfolioFromProfile(
  profile: InvestmentAccountProfile,
  extras: {
    readonly strategyRef?: string | null;
    readonly riskProfileRef?: string | null;
    readonly goalLinks?: readonly string[];
    readonly restrictions?: readonly string[];
    readonly displayCurrency?: CurrencyCode;
    readonly status?: PortfolioStatus;
  } = {},
): InvestmentPortfolio {
  return freezePortfolio({
    portfolioId: asPortfolioId(`pf_${profile.investmentAccountId}`),
    ownerId: profile.customerId,
    investmentAccountId: profile.investmentAccountId,
    brokerageCashAccountId: profile.brokerageCashAccountId,
    securitiesAccountId: profile.securitiesAccountId,
    pendingSettlementAccountId: profile.pendingSettlementAccountId,
    baseCurrency: profile.baseCurrency,
    displayCurrency: extras.displayCurrency ?? profile.baseCurrency,
    strategyRef: extras.strategyRef ?? null,
    riskProfileRef: extras.riskProfileRef ?? null,
    goalLinks: extras.goalLinks ?? [],
    restrictions: extras.restrictions ?? [],
    status: extras.status ?? profile.status,
    createdAt: profile.createdAt,
    environment: 'simulation',
    liveState: false,
    securitiesBrokerageLive: false,
  });
}
