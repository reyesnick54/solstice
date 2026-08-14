import { Money } from '../packages/contracts/src/money.ts';
import { asAccountId, asAgentId, asCustomerId, asTokenId } from '../packages/contracts/src/ids.ts';
import { asUtcInstant, type UtcInstant } from '../packages/contracts/src/time.ts';
import type { CapabilityTokenClaims } from '../packages/contracts/src/capability-claims.ts';
import type { FinancialContextSnapshot } from '../packages/contracts/src/financial-context.ts';
import type { ProductAccountClass } from '../packages/contracts/src/account-class.ts';
import { FORBIDDEN_ACTIONS, PROPOSAL_ACTION_TYPES } from '../packages/contracts/src/proposal-types.ts';
import { CapabilityTokenIssuer } from '../packages/platform/src/capability/AgentCapabilityToken.ts';

export const NOW = asUtcInstant('2026-08-13T15:00:00.000Z');
export const USD = (cents: bigint) => Money.fromMinorUnits(cents, 'USD');

export function claims(overrides: Partial<CapabilityTokenClaims> = {}): CapabilityTokenClaims {
  return {
    tokenId: asTokenId('tok_test'),
    agentId: asAgentId('agent_test'),
    customerId: asCustomerId('cust_test'),
    allowedProposalTypes: [...PROPOSAL_ACTION_TYPES],
    forbiddenActions: [...FORBIDDEN_ACTIONS],
    perTransactionLimit: USD(1_000_000_00n),
    dailyLimit: USD(5_000_000_00n),
    allowedAccountClasses: ['deposits', 'investments', 'digital_assets', 'rewards', 'pending'],
    forbiddenDataCategories: ['PII_FULL_NAME', 'TAX_ID'],
    maxRisk: 'MODERATE',
    issuedAt: NOW,
    expiresAt: asUtcInstant('2026-12-31T00:00:00.000Z'),
    revokedAt: null,
    ...overrides,
  };
}

export function issueToken(
  issuer: CapabilityTokenIssuer,
  overrides: Partial<CapabilityTokenClaims> = {},
) {
  const c = claims(overrides);
  return issuer.issue({
    tokenId: c.tokenId,
    agentId: c.agentId,
    customerId: c.customerId,
    allowedProposalTypes: c.allowedProposalTypes,
    forbiddenActions: c.forbiddenActions,
    perTransactionLimit: c.perTransactionLimit,
    dailyLimit: c.dailyLimit,
    allowedAccountClasses: c.allowedAccountClasses,
    forbiddenDataCategories: c.forbiddenDataCategories,
    maxRisk: c.maxRisk,
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
  });
}

export function account(
  id: string,
  accountClass: ProductAccountClass,
  balance: Money,
  agreement: boolean,
) {
  const accountId = asAccountId(id);
  return {
    id: accountId,
    accountClass,
    currency: 'USD',
    balance,
    depositInvestmentAgreement: agreement
      ? { accountId, present: true as const, authorizedSweep: true as const }
      : null,
  };
}

export function context(overrides: Partial<FinancialContextSnapshot> = {}): FinancialContextSnapshot {
  const snapshot: FinancialContextSnapshot = {
    customerId: asCustomerId('cust_test'),
    asOf: NOW,
    currency: 'USD',
    accounts: [
      account('acct_dep', 'deposits', USD(0n), false),
      account('acct_inv', 'investments', USD(0n), false),
    ],
    balancesByClass: {
      deposits: USD(0n),
      investments: USD(0n),
      digital_assets: USD(0n),
      rewards: USD(0n),
      pending: USD(0n),
    },
    recentTransactions: [],
    recurringPatterns: [],
    monthlyEssentialSpending: USD(410_000n),
    highCostDebt: [],
    nearTermObligations: [],
    userGoals: [],
    realizedGainsThisWeek: USD(0n),
    strippedDataCategories: ['PII_FULL_NAME', 'TAX_ID'],
    writePath: false,
    ...overrides,
  };
  return Object.freeze(snapshot);
}

export function freezeContext(snapshot: FinancialContextSnapshot): FinancialContextSnapshot {
  return Object.freeze(snapshot);
}
