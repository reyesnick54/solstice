import type { AgentToolDomainPorts, PortResult } from './ports.ts';

function ok<T>(value: T): PortResult<T> {
  return { ok: true, value };
}

function fail<T>(code: Extract<PortResult<T>, { ok: false }>['code'], message: string): PortResult<T> {
  return { ok: false, code, message };
}

export const FIXTURE_OWNER = 'user_1';
export const FIXTURE_ACCOUNT = 'acct_cash_1';
export const FIXTURE_AHMED = 'rcpt_ahmed';
export const FIXTURE_MARKET = 'mkt_sunrey_usd';
export const FIXTURE_WALLET = 'wallet_1';
export const FIXTURE_OPPORTUNITY = 'opp_idle_cash';

export type FixtureOverrides = {
  readonly providerUnavailable?: boolean;
  readonly productUnavailable?: boolean;
  readonly kernelStatus?: 'ALLOW' | 'BLOCK' | 'HOLD' | 'REQUIRE_MANUAL_REVIEW';
  readonly expiredQuote?: boolean;
  readonly wrongOwnerAccount?: boolean;
};

export function createFixtureToolPorts(overrides: FixtureOverrides = {}): AgentToolDomainPorts {
  const owner = FIXTURE_OWNER;
  const expired = overrides.expiredQuote === true;
  return {
    accounts: {
      listAccounts(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'accounts are not visible for that owner');
        return ok([
          {
            accountId: FIXTURE_ACCOUNT,
            ownerId,
            label: 'Cash',
            currency: 'SAR',
            available: { minorUnits: '2500000', currency: 'SAR' },
            held: { minorUnits: '0', currency: 'SAR' },
            classes: { DEPOSIT: { minorUnits: '2500000', currency: 'SAR' } },
          },
          {
            accountId: 'acct_usd_1',
            ownerId,
            label: 'USD cash',
            currency: 'USD',
            available: { minorUnits: '1000000', currency: 'USD' },
            held: { minorUnits: '0', currency: 'USD' },
            classes: { DEPOSIT: { minorUnits: '1000000', currency: 'USD' } },
          },
        ]);
      },
      getAccount(ownerId, accountId) {
        if (overrides.wrongOwnerAccount) return fail('NOT_OWNED', 'that account is not owned by this customer');
        const listed = this.listAccounts(ownerId);
        if (!listed.ok) return listed;
        const found = listed.value.find((item) => item.accountId === accountId);
        return found ? ok(found) : fail('NOT_FOUND', 'account not found');
      },
      activity(ownerId, accountId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'activity is not visible for that owner');
        return ok([
          {
            activityId: 'act_1',
            accountId,
            description: 'Payroll',
            amount: { minorUnits: '500000', currency: 'SAR' },
            direction: 'IN',
            occurredAt: '2026-08-01T00:00:00.000Z',
          },
        ]);
      },
      analyzeSpending(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'spending analysis is not visible for that owner');
        return ok({
          window: '2026-08',
          inflows: { minorUnits: '500000', currency: 'SAR' },
          outflows: { minorUnits: '120000', currency: 'SAR' },
          net: { minorUnits: '380000', currency: 'SAR' },
          categories: [{ name: 'groceries', amount: { minorUnits: '80000', currency: 'SAR' } }],
        });
      },
    },
    payments: {
      listRecipients(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'recipients are not visible for that owner');
        return ok([{ recipientId: FIXTURE_AHMED, ownerId, displayName: 'Ahmed', currency: 'SAR' }]);
      },
      quote(input) {
        if (overrides.providerUnavailable) return fail('PROVIDER_UNAVAILABLE', 'I could not retrieve the current payment quote.');
        if (input.ownerId !== owner) return fail('NOT_OWNED', 'quote refused for another owner');
        if (input.recipientId !== FIXTURE_AHMED) return fail('NOT_FOUND', 'recipient not found');
        return ok({
          quoteId: 'pq_ahmed_1000',
          sourceAccountId: input.sourceAccountId,
          recipientId: input.recipientId,
          amount: { minorUnits: input.amountMinorUnits, currency: input.currency },
          fees: { minorUnits: '250', currency: input.currency },
          destinationAmount: { minorUnits: input.amountMinorUnits, currency: input.currency },
          rate: { numerator: '1', denominator: '1' },
          expiry: expired ? '2020-01-01T00:00:00.000Z' : '2026-08-23T01:00:00.000Z',
          expired,
        });
      },
      getPayment(ownerId, paymentId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'payment is not visible for that owner');
        if (paymentId !== 'pay_1') return fail('NOT_FOUND', 'payment not found');
        return ok({
          paymentId,
          ownerId,
          status: 'AWAITING_APPROVAL',
          amount: { minorUnits: '100000', currency: 'SAR' },
        });
      },
    },
    fx: {
      quote(input) {
        if (overrides.providerUnavailable) return fail('PROVIDER_UNAVAILABLE', 'I could not retrieve the current FX quote.');
        if (input.ownerId !== owner) return fail('NOT_OWNED', 'FX quote refused for another owner');
        return ok({
          quoteId: 'fx_usd_sar_1',
          source: { minorUnits: input.sourceAmountMinorUnits, currency: input.sourceCurrency },
          destination: { minorUnits: '3750000', currency: input.destinationCurrency },
          fees: { minorUnits: '100', currency: input.sourceCurrency },
          rate: { numerator: '375', denominator: '100' },
          expiry: expired ? '2020-01-01T00:00:00.000Z' : '2026-08-23T01:00:00.000Z',
          expired,
        });
      },
    },
    grow: {
      goals(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'goals are not visible for that owner');
        return ok([{ goalId: 'goal_reserve', name: 'Emergency reserve', target: { minorUnits: '500000', currency: 'USD' } }]);
      },
      opportunities(ownerId) {
        if (overrides.productUnavailable) return fail('PRODUCT_UNAVAILABLE', 'Grow opportunities are not available.');
        if (ownerId !== owner) return fail('NOT_OWNED', 'opportunities are not visible for that owner');
        return ok([
          {
            opportunityId: FIXTURE_OPPORTUNITY,
            title: 'Hold required liquidity before investing',
            amount: { minorUnits: '1000000', currency: 'USD' },
            kind: 'REQUIRED_LIQUIDITY',
          },
        ]);
      },
      plan(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'plan is not visible for that owner');
        return ok({ planId: 'gmp_1', ownerId, summary: 'Reserve first, then consider permitted allocation' });
      },
      proposals(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'proposals are not visible for that owner');
        return ok([{ proposalId: 'fpr_1', planId: 'gmp_1', amount: { minorUnits: '1000000', currency: 'USD' }, state: 'DRAFT' }]);
      },
      createProposal(input) {
        if (input.ownerId !== owner) return fail('NOT_OWNED', 'cannot create a growth proposal for another owner');
        return ok({
          proposalId: 'fpr_new',
          planId: 'gmp_1',
          amount: { minorUnits: input.amountMinorUnits, currency: input.currency },
          state: 'DRAFT',
        });
      },
      modifyProposal(input) {
        if (input.proposalId !== 'fpr_1' && input.proposalId !== 'fpr_new') {
          return fail('NOT_FOUND', 'agents cannot invent executable proposal ids');
        }
        return ok({
          proposalId: `${input.proposalId}_v2`,
          planId: 'gmp_1',
          amount: { minorUnits: input.amountMinorUnits, currency: 'USD' },
          state: 'DRAFT',
        });
      },
    },
    portfolio: {
      get(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'portfolio is not visible for that owner');
        return ok({
          ownerId,
          holdings: [{ assetId: 'SUNREY_COIN', quantityMinorUnits: '10', informationalValue: { minorUnits: '1000', currency: 'USD' } }],
          allocation: [{ sleeve: 'CASH', amount: { minorUnits: '1000000', currency: 'USD' } }],
          performanceQuantityChange: '0',
          riskLabel: 'INFORMATIONAL_ONLY',
        });
      },
    },
    exchange: {
      markets: () =>
        ok([
          {
            marketId: FIXTURE_MARKET,
            base: 'SUNREY_COIN',
            quote: 'USD',
            eligible: !overrides.productUnavailable,
            lastPriceUnits: '100',
          },
        ]),
      asset: (assetId) => ok({ assetId, listed: assetId === 'SUNREY_COIN' }),
      price: (marketId) =>
        ok({
          marketId,
          lastPriceUnits: '100',
          eligible: marketId === FIXTURE_MARKET && !overrides.productUnavailable,
        }),
      orders: (ownerId) => {
        if (ownerId !== owner) return fail('NOT_OWNED', 'orders are not visible for that owner');
        return ok([]);
      },
      eligibility: (ownerId) => {
        if (ownerId !== owner) return fail('NOT_OWNED', 'eligibility is not visible for that owner');
        return ok({
          ownerId,
          canTrade: !overrides.productUnavailable,
          canDeposit: true,
          canWithdraw: true,
          reasonCodes: [],
        });
      },
      holdings: (ownerId) => {
        if (ownerId !== owner) return fail('NOT_OWNED', 'holdings are not visible for that owner');
        return ok([{ assetId: 'SUNREY_COIN', quantityMinorUnits: '10', reservedMinorUnits: '0' }]);
      },
      preview: (input) => {
        if (input.ownerId !== owner) return fail('NOT_OWNED', 'preview is not visible for that owner');
        return ok({
          previewId: 'xprv_1',
          marketId: input.marketId,
          side: input.side,
          quantityMinorUnits: input.quantityMinorUnits,
          estimatedPriceUnits: '100',
          guaranteedExecutionPrice: false,
        });
      },
    },
    custody: {
      wallets(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'wallets are not visible for that owner');
        return ok([{ walletId: FIXTURE_WALLET, ownerId, assetId: 'SUNREY_COIN', balanceMinorUnits: '10' }]);
      },
      deposit(ownerId, depositId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'deposit is not visible for that owner');
        return ok({ depositId, ownerId, status: 'CREDITED' });
      },
    },
    cards: {
      list(ownerId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'cards are not visible for that owner');
        return ok([{ cardId: 'card_1', ownerId, last4: '4242', status: 'ACTIVE' }]);
      },
      get(ownerId, cardId) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'card is not visible for that owner');
        if (cardId !== 'card_1') return fail('NOT_FOUND', 'card not found');
        return ok({ cardId, ownerId, last4: '4242', status: 'ACTIVE' });
      },
    },
    data: {
      consent: (ownerId) => ok({ ownerId, activePermits: 1, purposes: ['FINANCIAL_EXPLANATION'] }),
      permissions: (ownerId) => ok({ ownerId, scopes: ['derived_income', 'vault_metadata'] }),
      hinRights: (ownerId) =>
        ok({
          ownerId,
          items: [{ rightId: 'irr_sim', category: 'FINANCIAL_ACTIVITY_METADATA', status: 'ACTIVE', ownershipTransferred: false }],
        }),
      hinPermissions: (ownerId) => ok({ ownerId, purposes: ['RESEARCH'] }),
      hinEarnings: (ownerId) => ok({ ownerId, settledMinorUnits: '0', guaranteed: false }),
      hinLicense: (_ownerId, licenseId) => ok({ licenseId, purpose: 'RESEARCH', status: 'ACTIVE' }),
      hinParticipation: (ownerId) =>
        ok({ ownerId, state: 'NOT_ENROLLED', financialServicesRemainOpen: true }),
      vaultRecords(ownerId, input) {
        if (ownerId !== owner) return fail('NOT_OWNED', 'vault records are not visible for that owner');
        if ((!input.categoryIds || input.categoryIds.length === 0) && (!input.recordIds || input.recordIds.length === 0)) {
          return fail('NOT_ELIGIBLE', 'agent wildcard vault access is forbidden');
        }
        return ok([
          { dataRecordId: 'pda_fixture_pref', categoryId: 'goals_preferences', label: 'USER_DECLARED_DATA:pdsch_preference' },
        ]);
      },
    },
    nativeEconomy: {
      asset(assetId) {
        if (assetId !== 'SUNREY_COIN' && assetId !== 'MOONREY_COIN') {
          return fail('NOT_FOUND', 'native asset not found');
        }
        return ok({
          assetId,
          canonicalName: assetId === 'SUNREY_COIN' ? 'SunRey Coin' : 'MoonRey Coin',
          tickerStatus: 'NOT_ASSIGNED',
          totalSupply: '0',
          circulatingSupply: '0',
          protocolNative: true,
          lastTradeMinorUnits: assetId === 'SUNREY_COIN' ? '100' : null,
          valuationIsNotMarketPrice: true,
        });
      },
      supply() {
        const sunrey = this.asset('SUNREY_COIN');
        const moonrey = this.asset('MOONREY_COIN');
        if (!sunrey.ok || !moonrey.ok) return fail('PRODUCT_UNAVAILABLE', 'native supply is unavailable');
        return ok([sunrey.value, moonrey.value]);
      },
      overview() {
        const sunrey = this.asset('SUNREY_COIN');
        const moonrey = this.asset('MOONREY_COIN');
        if (!sunrey.ok || !moonrey.ok) return fail('PRODUCT_UNAVAILABLE', 'native economy is unavailable');
        return ok({ sunrey: sunrey.value, moonrey: moonrey.value, productionActive: false });
      },
    },
    hin: {
      contributions: (ownerId) => ok([{ contributionId: 'hec_sim_1', category: 'RESEARCH_CONTRIBUTION', verification: 'SYSTEM_VERIFIED', ownerId }]),
      metrics: () => ok({ verifiedContributors: 1, individualRecordsExposed: false, isMintAmount: false }),
      summary: (ownerId) => ok({ ownerId, issuancePromised: false, compensation: { mintRequested: false } }),
      methodologies: () => ok([{ methodologyId: 'hin-evi-governed-schedule', isMintFormula: false }]),
    },
    compliance: {
      evaluate: () => ({ status: overrides.kernelStatus ?? 'ALLOW', detail: overrides.kernelStatus ?? 'ALLOW' }),
    },
  };
}
