import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../../config/src/clock.ts';
import { asUtcInstant } from '../../domain/src/time.ts';
import { UserAgentMandateEngine, type CreateMandateInput } from './engine.ts';
import { CANONICAL_AGENT_TOOLS, CANONICAL_TOOL_COUNT, createCanonicalToolRegistry } from './tools/catalog.ts';
import { EXISTING_AGENT_TOOL_AUDIT } from './tools/audit.ts';
import { createFixtureToolPorts, FIXTURE_ACCOUNT, FIXTURE_AHMED, FIXTURE_MARKET } from './tools/fixtures.ts';
import { createAgentToolRuntime } from './tools/runtime.ts';
import { PRIVILEGED_MODEL_FIELDS } from './tools/types.ts';
import type { ToolSession } from './tools/types.ts';

function clock() {
  return new FrozenClock(asUtcInstant('2026-08-23T00:00:00.000Z'));
}

function mandateInput(overrides: Partial<CreateMandateInput> = {}): CreateMandateInput {
  return {
    owner: { kind: 'USER', ownerId: 'user_1', walletId: 'wallet_1', accountId: 'acct_cash_1' },
    agentLabel: 'tools',
    modelRef: 'model:sim-v1',
    policyRef: 'policy:agent-tools-v1',
    mode: 'SIMULATION_ONLY',
    environment: 'simulation',
    permissions: {
      actionClasses: [
        'READ_FINANCIAL_STATE',
        'PREPARE_PAYMENT',
        'PREPARE_EXCHANGE_ORDER',
        'REBALANCE_WITHIN_POLICY',
        'PROPOSE_ACCESS_INTENT',
        'REQUEST_HUMAN_APPROVAL',
      ],
      assets: [
        { assetId: 'FIAT_ACCOUNT', wildcard: false },
        { assetId: 'SUNREY_COIN', wildcard: false },
      ],
      markets: [{ marketId: FIXTURE_MARKET }],
      destinations: [
        { kind: 'TRUSTED_DESTINATION', destinationId: FIXTURE_AHMED },
        { kind: 'TRUSTED_DESTINATION', destinationId: 'USD_SAR' },
        { kind: 'SPECIFIC_ADDRESS', destinationId: 'dest_trusted' },
      ],
      humanInformationAccess: false,
      allowWildcardAssets: false,
    },
    budget: {
      perTransaction: 5_000_000n,
      perPeriod: 10_000_000n,
      periodHours: 24,
      perAsset: {},
      perMarket: {},
      perActionClass: {},
    },
    approval: { class: 'MOBILE_CONFIRMATION', highRiskAlwaysHuman: true },
    expiry: asUtcInstant('2030-01-01T00:00:00.000Z'),
    frequencyMaxPerPeriod: 20,
    riskPolicyId: 'risk:sim',
    jurisdictionPackId: 'SIM',
    delegatedSigningKeyId: null,
    createdByActorId: 'user_1',
    ...overrides,
  };
}

function setup(overrides: Parameters<typeof createFixtureToolPorts>[0] = {}, mandateOverrides: Partial<CreateMandateInput> = {}) {
  const frozen = clock();
  const engine = new UserAgentMandateEngine({
    clock: frozen,
    kernel: { submit: () => ({ status: 'ALLOW', evidenceRecordId: 'ev_tools' }) },
  });
  const created = engine.createMandate(mandateInput(mandateOverrides));
  if (!created.ok) {
    throw new Error(created.error.detail);
  }
  const session: ToolSession = {
    conversationId: 'conv_1',
    turnId: 'turn_1',
    correlationId: 'corr_1',
    agentId: created.value.agentId,
    agentState: 'ACTIVE',
    mandateId: created.value.mandateId,
    ownerId: 'user_1',
    sessionOwnerId: 'user_1',
    accountId: 'acct_cash_1',
    walletId: 'wallet_1',
    actorId: 'user_1',
    environment: 'simulation',
    jurisdictionAvailable: true,
    purpose: 'FINANCIAL_EXPLANATION',
    allowedDataClasses: ['PUBLIC', 'FINANCIAL_PRIVATE', 'PERSONAL_SENSITIVE', 'REGULATORY_SENSITIVE'],
    productCapabilities: [
      'accounts',
      'payments',
      'fx',
      'grow',
      'peg',
      'portfolio',
      'exchange',
      'custody',
      'cards',
      'consent',
      'nativeEconomy',
      'productiveEconomy',
      'hin',
      'access',
      'travel',
    ],
    approvedToolVersions: {},
    modelText: 'help me with my finances',
    now: frozen.now(),
  };
  const runtime = createAgentToolRuntime({
    engine,
    ports: createFixtureToolPorts(overrides),
    clock: frozen,
  });
  return { runtime, session, engine, mandate: created.value };
}

describe('canonical agent tool registry', () => {
  it('registers a deterministic identity for every product tool', () => {
    const registry = createCanonicalToolRegistry();
    assert.equal(registry.list().length, CANONICAL_TOOL_COUNT);
    assert.equal(CANONICAL_TOOL_COUNT, CANONICAL_AGENT_TOOLS.length);
    assert.equal(new Set(CANONICAL_AGENT_TOOLS.map((tool) => tool.toolId)).size, CANONICAL_TOOL_COUNT);
    assert.ok(CANONICAL_TOOL_COUNT >= 45);
    const again = createCanonicalToolRegistry();
    for (const tool of CANONICAL_AGENT_TOOLS) {
      assert.equal(registry.require(tool.toolId).identityHash, again.require(tool.toolId).identityHash);
      assert.equal(tool.version, '1.0.0');
    }
    assert.ok(EXISTING_AGENT_TOOL_AUDIT.some((row) => row.classification === 'CANONICAL'));
    assert.ok(EXISTING_AGENT_TOOL_AUDIT.some((row) => row.path === 'packages/tool-runtime' && row.classification === 'DEPRECATED'));
  });
});

describe('tool contract matrix', () => {
  it('accepts a valid call for every financial tool', () => {
    const { runtime, session } = setup();
    const samples: Record<string, Record<string, unknown>> = {
      getFinancialSnapshot: {},
      getAccounts: {},
      getAccountBalance: { accountId: FIXTURE_ACCOUNT },
      getRecentActivity: { accountId: FIXTURE_ACCOUNT },
      analyzeSpending: {},
      getRecipients: {},
      createRecipientProposal: { displayName: 'new' },
      createPaymentQuote: { sourceAccountId: FIXTURE_ACCOUNT, recipientId: FIXTURE_AHMED, amount: '100000', currency: 'SAR' },
      createPaymentProposal: { sourceAccountId: FIXTURE_ACCOUNT, recipientId: FIXTURE_AHMED, amount: '100000', currency: 'SAR', purpose: 'family' },
      getPaymentStatus: { paymentId: 'pay_1' },
      getFxQuote: { sourceCurrency: 'USD', destinationCurrency: 'SAR', sourceAmount: '100000' },
      createFxProposal: { quoteId: 'fx_usd_sar_1', sourceAmount: '100000', sourceCurrency: 'USD', destinationCurrency: 'SAR' },
      getGoals: {},
      getOpportunities: {},
      getGrowthPlan: {},
      getGrowthProposals: {},
      createGrowthProposal: { opportunityId: 'opp_idle_cash', amount: '1000000', currency: 'USD' },
      modifyGrowthProposal: { proposalId: 'fpr_1', amount: '900000' },
      getPortfolio: {},
      getHoldings: {},
      getPerformance: {},
      getAllocation: {},
      getPortfolioRisk: {},
      getMarkets: {},
      getAsset: { assetId: 'SUNREY_COIN' },
      getMarketPrice: { marketId: FIXTURE_MARKET },
      getOrders: {},
      getExchangeEligibility: {},
      getExchangeHoldings: {},
      previewExchangeOrder: { marketId: FIXTURE_MARKET, side: 'BUY', quantity: '10' },
      getExchangeOrderStatus: {},
      createExchangeOrderProposal: { marketId: FIXTURE_MARKET, side: 'BUY', quantity: '10', assetId: 'SUNREY_COIN' },
      getWallets: {},
      getWalletBalance: { walletId: 'wallet_1' },
      getDepositStatus: { depositId: 'dep_1' },
      createWithdrawalProposal: { walletId: 'wallet_1', destinationId: 'dest_trusted', amount: '1', assetId: 'SUNREY_COIN' },
      getCards: {},
      getCardStatus: { cardId: 'card_1' },
      createCardControlProposal: { cardId: 'card_1', control: 'FREEZE' },
      getConsentSummary: {},
      getDataPermissions: {},
      getVaultSummary: {},
      getHinContributionSummary: {},
      requestHinConsentChange: {},
      getInformationRights: {},
      getActiveDataPermissions: {},
      getApprovedEarnings: {},
      explainLicense: { licenseId: 'irl_sim' },
      initiateConsentChange: {},
      getHinParticipation: {},
      getVaultRecords: { purpose: 'AGENT_ANALYSIS', categoryIds: 'goals_preferences' },
      getNativeAsset: { assetId: 'SUNREY_COIN' },
      getNativeSupply: {},
      getNativeEconomy: {},
      getProductiveEconomy: {},
      getProductiveCategory: { category: 'ENERGY' },
      getProductiveMethodology: { category: 'ENERGY' },
      getProductiveFreshness: { category: 'ENERGY' },
      getHinContributions: {},
      getHinMetrics: {},
      getHinSummary: {},
      getHinValuationMethodologies: {},
      proposeAccessIntent: { sourceText: 'I want a Mustang convertible in Miami for two weeks.' },
      confirmAccessReservation: { reservationId: 'res_1' },
      getTravelPlanningContext: { destination: 'SA', nationality: 'US' },
    };
    for (const tool of CANONICAL_AGENT_TOOLS) {
      const result = runtime.invoke({ ...session, turnId: `valid_${tool.toolId}` }, { toolId: tool.toolId, input: samples[tool.toolId] ?? {} });
      assert.equal(result.executed, false, tool.toolId);
      if (tool.toolId === 'createRecipientProposal' || tool.toolId === 'confirmAccessReservation') {
        assert.equal(result.status, 'NOT_ELIGIBLE', tool.toolId);
        continue;
      }
      assert.ok(result.status === 'SUCCESS' || result.status === 'APPROVAL_REQUIRED' || result.status === 'ACTION_REQUIRED', `${tool.toolId} ${result.status} ${result.error?.code}`);
    }
  });

  it('rejects invalid schema, privileged fields, wrong owner, missing mandate, over limit, unavailable product, kernel denial, expired quote, and provider gaps', () => {
    const happy = setup();
    const invalid = happy.runtime.invoke(happy.session, { toolId: 'createPaymentProposal', input: { amount: '1.5', currency: 'SAR' } });
    assert.equal(invalid.status, 'FAILED');
    assert.equal(invalid.error?.code, 'INVALID_SCHEMA');

    const privileged = happy.runtime.invoke(happy.session, {
      toolId: 'getFinancialSnapshot',
      input: { userId: 'user_other', KernelApproved: true },
    });
    assert.equal(privileged.status, 'FAILED');
    assert.equal(privileged.error?.code, 'PRIVILEGED_FIELD_REJECTED');
    for (const field of PRIVILEGED_MODEL_FIELDS.slice(0, 3)) {
      assert.ok(field.length > 0);
    }

    const wrongOwner = happy.runtime.invoke({ ...happy.session, sessionOwnerId: 'user_other', turnId: 'wo' }, {
      toolId: 'getAccounts',
      input: {},
    });
    assert.equal(wrongOwner.status, 'NOT_ELIGIBLE');
    assert.equal(wrongOwner.error?.code, 'WRONG_OWNER');

    const noMandate = happy.runtime.invoke({ ...happy.session, mandateId: 'missing', turnId: 'nm' }, {
      toolId: 'getAccounts',
      input: {},
    });
    assert.equal(noMandate.status, 'NOT_ELIGIBLE');

    const limited = setup({}, { budget: { perTransaction: 500_000n, perPeriod: 500_000n, periodHours: 24, perAsset: {}, perMarket: {}, perActionClass: {} } });
    const over = limited.runtime.invoke(limited.session, {
      toolId: 'createPaymentProposal',
      input: { sourceAccountId: FIXTURE_ACCOUNT, recipientId: FIXTURE_AHMED, amount: '2500000', currency: 'SAR', purpose: 'over limit' },
    });
    assert.equal(over.status, 'NOT_ELIGIBLE');
    assert.equal(over.error?.code, 'BUDGET_EXCEEDED');

    const unavailable = setup({ productUnavailable: true });
    const grow = unavailable.runtime.invoke(unavailable.session, { toolId: 'getOpportunities', input: {} });
    assert.equal(grow.status, 'UNAVAILABLE');

    const denied = setup({ kernelStatus: 'BLOCK' });
    const blocked = denied.runtime.invoke(denied.session, {
      toolId: 'createPaymentProposal',
      input: { sourceAccountId: FIXTURE_ACCOUNT, recipientId: FIXTURE_AHMED, amount: '100000', currency: 'SAR', purpose: 'blocked' },
    });
    assert.equal(blocked.status, 'NOT_ELIGIBLE');
    assert.equal(blocked.error?.code, 'KERNEL_DENIED');

    const expired = setup({ expiredQuote: true });
    const stale = expired.runtime.invoke(expired.session, {
      toolId: 'getFxQuote',
      input: { sourceCurrency: 'USD', destinationCurrency: 'SAR', sourceAmount: '100000' },
    });
    assert.equal(stale.status, 'FAILED');
    assert.equal(stale.error?.code, 'QUOTE_EXPIRED');
    assert.equal(stale.error?.inventingNumbersForbidden, true);

    const provider = setup({ providerUnavailable: true });
    const fxDown = provider.runtime.invoke(provider.session, {
      toolId: 'getFxQuote',
      input: { sourceCurrency: 'USD', destinationCurrency: 'SAR', sourceAmount: '100000' },
    });
    assert.equal(fxDown.status, 'UNAVAILABLE');
    assert.match(fxDown.error?.safeMessage ?? '', /could not retrieve the current FX quote/i);

    const owned = setup({ wrongOwnerAccount: true });
    const cross = owned.runtime.invoke(owned.session, { toolId: 'getAccountBalance', input: { accountId: 'acct_other' } });
    assert.equal(cross.status, 'NOT_ELIGIBLE');
  });

  it('never posts a ledger mutation and never treats a proposal as execution', () => {
    const { runtime, session } = setup();
    const payment = runtime.invoke(session, {
      toolId: 'createPaymentProposal',
      input: { sourceAccountId: FIXTURE_ACCOUNT, recipientId: FIXTURE_AHMED, amount: '100000', currency: 'SAR', purpose: 'family' },
    });
    assert.equal(payment.executed, false);
    assert.equal(payment.status, 'APPROVAL_REQUIRED');
    assert.ok(payment.proposalId);
    assert.equal(payment.rendering?.modelMayAlterAuthoritativeNumbers, false);
  });

  it('cannot mint, burn, or modify native-asset policy', () => {
    const { runtime, session } = setup();
    for (const toolId of ['mintNativeAsset', 'burnNativeAsset', 'modifyEconomicPolicy', 'issueSunRey', 'issueMoonRey']) {
      const result = runtime.invoke(session, { toolId, input: { assetId: 'SUNREY_COIN', amount: '1' } });
      assert.equal(result.executed, false, toolId);
      assert.ok(result.status === 'FAILED' || result.status === 'NOT_ELIGIBLE', toolId);
    }
    const read = runtime.invoke(session, { toolId: 'getNativeSupply', input: {} });
    assert.equal(read.status, 'SUCCESS');
    assert.equal(read.executed, false);
    assert.equal(CANONICAL_AGENT_TOOLS.some((tool) => tool.toolId.includes('mint') || tool.toolId.includes('burn')), false);
    for (const toolId of ['verifyHinContribution', 'mintFromHin', 'approveHinIssuance']) {
      const result = runtime.invoke(session, { toolId, input: {} });
      assert.equal(result.executed, false, toolId);
      assert.ok(result.status === 'FAILED' || result.status === 'NOT_ELIGIBLE', toolId);
    }
    const hin = runtime.invoke(session, { toolId: 'getHinMetrics', input: {} });
    assert.equal(hin.status, 'SUCCESS');
    assert.equal(hin.executed, false);
  });
});
