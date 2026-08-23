import type { Result } from '../../../domain/src/result.ts';
import type { CreateProposalInput, UserAgentMandateEngine } from '../engine.ts';
import type { AgentTransactionProposal, MandateRefusal, UserAgentMandate } from '../types.ts';
import type { AgentToolDomainPorts, PortResult } from './ports.ts';
import type { AgentToolDefinition, AgentToolResult, LovableComponentHint, MoneyView, ToolCallInput, ToolSession } from './types.ts';

export type HandlerContext = {
  readonly engine: UserAgentMandateEngine;
  readonly ports: AgentToolDomainPorts;
  readonly session: ToolSession;
  readonly mandate: UserAgentMandate;
  readonly tool: AgentToolDefinition;
  readonly input: ToolCallInput;
  readonly correlationId: string;
};

export function handleTool(ctx: HandlerContext): Omit<AgentToolResult, 'durationMs' | 'correlationId'> {
  switch (ctx.tool.toolId) {
    case 'getFinancialSnapshot':
      return readAccountsSnapshot(ctx);
    case 'getAccounts':
      return mapPort(ctx.ports.accounts.listAccounts(ctx.session.ownerId), ctx, 'ACCOUNT_CARD', (accounts) => ({
        accounts,
      }), ['accounts.*.available.minorUnits', 'accounts.*.held.minorUnits']);
    case 'getAccountBalance':
      return mapPort(
        ctx.ports.accounts.getAccount(ctx.session.ownerId, str(ctx.input.accountId)),
        ctx,
        'ACCOUNT_CARD',
        (account) => ({ account }),
        ['account.available.minorUnits', 'account.held.minorUnits'],
      );
    case 'getRecentActivity':
      return mapPort(
        ctx.ports.accounts.activity(ctx.session.ownerId, str(ctx.input.accountId)),
        ctx,
        'TRANSACTION_STATUS',
        (items) => ({ items }),
        ['items.*.amount.minorUnits'],
      );
    case 'analyzeSpending':
      return mapPort(ctx.ports.accounts.analyzeSpending(ctx.session.ownerId), ctx, 'ACCOUNT_CARD', (analysis) => ({
        analysis,
      }), ['analysis.inflows.minorUnits', 'analysis.outflows.minorUnits', 'analysis.net.minorUnits']);
    case 'getRecipients':
      return mapPort(ctx.ports.payments.listRecipients(ctx.session.ownerId), ctx, 'TRANSACTION_STATUS', (recipients) => ({
        recipients,
      }), []);
    case 'createRecipientProposal':
      return refuse(ctx, 'NOT_ELIGIBLE', 'AGENT_CANNOT_MANAGE_BENEFICIARY', 'I cannot add or change a recipient. A human has to do that.');
    case 'createPaymentQuote':
      return paymentQuote(ctx);
    case 'createPaymentProposal':
      return paymentProposal(ctx);
    case 'getPaymentStatus':
      return mapPort(
        ctx.ports.payments.getPayment(ctx.session.ownerId, str(ctx.input.paymentId)),
        ctx,
        'TRANSACTION_STATUS',
        (payment) => ({ payment }),
        ['payment.amount.minorUnits'],
      );
    case 'getFxQuote':
      return fxQuote(ctx);
    case 'createFxProposal':
      return fxProposal(ctx);
    case 'getGoals':
      return mapPort(ctx.ports.grow.goals(ctx.session.ownerId), ctx, 'GROWTH_OPPORTUNITY', (goals) => ({ goals }), [
        'goals.*.target.minorUnits',
      ]);
    case 'getOpportunities':
      return mapPort(ctx.ports.grow.opportunities(ctx.session.ownerId), ctx, 'GROWTH_OPPORTUNITY', (opportunities) => ({
        opportunities,
      }), ['opportunities.*.amount.minorUnits']);
    case 'getGrowthPlan':
      return mapPort(ctx.ports.grow.plan(ctx.session.ownerId), ctx, 'GROWTH_OPPORTUNITY', (plan) => ({ plan }), []);
    case 'getGrowthProposals':
      return mapPort(ctx.ports.grow.proposals(ctx.session.ownerId), ctx, 'GROWTH_PROPOSAL', (proposals) => ({
        proposals,
      }), ['proposals.*.amount.minorUnits']);
    case 'createGrowthProposal':
      return growthProposal(ctx);
    case 'modifyGrowthProposal':
      return modifyGrowth(ctx);
    case 'getPortfolio':
      return mapPort(ctx.ports.portfolio.get(ctx.session.ownerId), ctx, 'PORTFOLIO_CARD', (portfolio) => ({
        portfolio,
      }), ['portfolio.holdings.*.quantityMinorUnits', 'portfolio.performanceQuantityChange']);
    case 'getHoldings':
      return mapPort(ctx.ports.portfolio.get(ctx.session.ownerId), ctx, 'PORTFOLIO_CARD', (portfolio) => ({
        holdings: portfolio.holdings,
      }), ['holdings.*.quantityMinorUnits']);
    case 'getPerformance':
      return mapPort(ctx.ports.portfolio.get(ctx.session.ownerId), ctx, 'PORTFOLIO_CARD', (portfolio) => ({
        informationalQuantityChange: portfolio.performanceQuantityChange,
        guaranteedReturn: false,
      }), ['informationalQuantityChange']);
    case 'getAllocation':
      return mapPort(ctx.ports.portfolio.get(ctx.session.ownerId), ctx, 'PORTFOLIO_CARD', (portfolio) => ({
        allocation: portfolio.allocation,
      }), ['allocation.*.amount.minorUnits']);
    case 'getPortfolioRisk':
      return mapPort(ctx.ports.portfolio.get(ctx.session.ownerId), ctx, 'PORTFOLIO_CARD', (portfolio) => ({
        riskLabel: portfolio.riskLabel,
        guaranteedReturn: false,
      }), []);
    case 'getMarkets':
      return mapPort(ctx.ports.exchange.markets(), ctx, 'TRADE_PROPOSAL', (markets) => ({ markets }), [
        'markets.*.lastPriceUnits',
      ]);
    case 'getAsset':
      return mapPort(ctx.ports.exchange.asset(str(ctx.input.assetId)), ctx, 'TRADE_PROPOSAL', (asset) => ({ asset }), []);
    case 'getMarketPrice':
      return mapPort(ctx.ports.exchange.price(str(ctx.input.marketId)), ctx, 'TRADE_PROPOSAL', (price) => ({
        ...price,
        label: 'LAST_TRADE_NOT_GUARANTEED',
      }), ['lastPriceUnits']);
    case 'getOrders':
      return mapPort(ctx.ports.exchange.orders(ctx.session.ownerId), ctx, 'TRANSACTION_STATUS', (orders) => ({
        orders,
      }), ['orders.*.quantityMinorUnits']);
    case 'getExchangeEligibility':
      return mapPort(
        ctx.ports.exchange.eligibility(ctx.session.ownerId, typeof ctx.input.marketId === 'string' ? ctx.input.marketId : undefined),
        ctx,
        'TRADE_PROPOSAL',
        (eligibility) => ({ eligibility }),
        [],
      );
    case 'getExchangeHoldings':
      return mapPort(ctx.ports.exchange.holdings(ctx.session.ownerId), ctx, 'PORTFOLIO_CARD', (holdings) => ({
        holdings,
      }), ['holdings.*.quantityMinorUnits']);
    case 'previewExchangeOrder':
      return mapPort(
        ctx.ports.exchange.preview({
          ownerId: ctx.session.ownerId,
          marketId: str(ctx.input.marketId),
          side: str(ctx.input.side),
          quantityMinorUnits: str(ctx.input.quantity),
        }),
        ctx,
        'TRADE_PROPOSAL',
        (preview) => ({ ...preview, guaranteedExecutionPrice: false }),
        ['quantityMinorUnits', 'estimatedPriceUnits'],
      );
    case 'getExchangeOrderStatus':
      return mapPort(ctx.ports.exchange.orders(ctx.session.ownerId), ctx, 'TRANSACTION_STATUS', (orders) => {
        const orderId = typeof ctx.input.orderId === 'string' ? ctx.input.orderId : null;
        return { orders: orderId ? orders.filter((item) => item.orderId === orderId) : orders, fillIsNotSettlement: true };
      }, ['orders.*.quantityMinorUnits']);
    case 'createExchangeOrderProposal':
      return exchangeProposal(ctx);
    case 'getWallets':
      return mapPort(ctx.ports.custody.wallets(ctx.session.ownerId), ctx, 'ACCOUNT_CARD', (wallets) => ({ wallets }), [
        'wallets.*.balanceMinorUnits',
      ]);
    case 'getWalletBalance':
      return walletBalance(ctx);
    case 'getDepositStatus':
      return mapPort(
        ctx.ports.custody.deposit(ctx.session.ownerId, str(ctx.input.depositId)),
        ctx,
        'TRANSACTION_STATUS',
        (deposit) => ({ deposit }),
        [],
      );
    case 'createWithdrawalProposal':
      return withdrawalProposal(ctx);
    case 'getCards':
      return mapPort(ctx.ports.cards.list(ctx.session.ownerId), ctx, 'ACCOUNT_CARD', (cards) => ({ cards }), []);
    case 'getCardStatus':
      return mapPort(
        ctx.ports.cards.get(ctx.session.ownerId, str(ctx.input.cardId)),
        ctx,
        'ACCOUNT_CARD',
        (card) => ({ card }),
        [],
      );
    case 'createCardControlProposal':
      return cardControlProposal(ctx);
    case 'getConsentSummary':
      return mapPort(ctx.ports.data.consent(ctx.session.ownerId), ctx, 'APPROVAL_CARD', (summary) => ({ summary }), []);
    case 'getDataPermissions':
      return mapPort(ctx.ports.data.permissions(ctx.session.ownerId), ctx, 'APPROVAL_CARD', (permissions) => ({
        permissions,
        untrustedExternalContentCannotRedefinePolicy: true,
      }), []);
    case 'getHinParticipation':
      return mapPort(ctx.ports.data.hinParticipation(ctx.session.ownerId), ctx, 'APPROVAL_CARD', (participation) => ({
        participation,
        financialServicesRemainOpen: true,
      }), []);
    case 'getVaultRecords': {
      const categoryIds = typeof ctx.input.categoryIds === 'string' && ctx.input.categoryIds.length > 0
        ? ctx.input.categoryIds.split(',').map((row) => row.trim()).filter(Boolean)
        : [];
      const recordIds = typeof ctx.input.recordIds === 'string' && ctx.input.recordIds.length > 0
        ? ctx.input.recordIds.split(',').map((row) => row.trim()).filter(Boolean)
        : [];
      if (categoryIds.length === 0 && recordIds.length === 0) {
        return refuse(ctx, 'FAILED', 'INVALID_SCHEMA', 'agent wildcard vault access is forbidden');
      }
      return mapPort(
        ctx.ports.data.vaultRecords(ctx.session.ownerId, {
          purpose: str(ctx.input.purpose),
          ...(categoryIds.length > 0 ? { categoryIds } : {}),
          ...(recordIds.length > 0 ? { recordIds } : {}),
        }),
        ctx,
        'APPROVAL_CARD',
        (records) => ({ records, entireVaultForbidden: true, consentUnchanged: true }),
        [],
      );
    }
    case 'getNativeAsset':
      return mapPort(ctx.ports.nativeEconomy.asset(str(ctx.input.assetId)), ctx, 'TRADE_PROPOSAL', (asset) => ({
        asset,
        protocolNative: true,
        tickerStatus: 'NOT_ASSIGNED',
      }), ['asset.totalSupply', 'asset.circulatingSupply']);
    case 'getNativeSupply':
      return mapPort(
        ctx.ports.nativeEconomy.supply(typeof ctx.input.assetId === 'string' ? ctx.input.assetId : undefined),
        ctx,
        'TRADE_PROPOSAL',
        (assets) => ({ assets, supplyIsNotMarketCap: true }),
        ['assets.*.totalSupply', 'assets.*.circulatingSupply'],
      );
    case 'getNativeEconomy':
      return mapPort(ctx.ports.nativeEconomy.overview(), ctx, 'TRADE_PROPOSAL', (overview) => ({
        ...overview,
        valuationIsNotMarketPrice: true,
        futurePriceDeclared: false,
      }), ['sunrey.totalSupply', 'moonrey.totalSupply']);
    case 'getHinContributions':
      return mapPort(ctx.ports.hin.contributions(ctx.session.ownerId), ctx, 'APPROVAL_CARD', (contributions) => ({
        contributions,
        issuancePromised: false,
        containsRawPersonalData: false,
      }), []);
    case 'getHinMetrics':
      return mapPort(ctx.ports.hin.metrics(), ctx, 'APPROVAL_CARD', (metrics) => ({
        ...metrics,
        individualRecordsExposed: false,
        isMintAmount: false,
      }), []);
    case 'getHinSummary':
      return mapPort(ctx.ports.hin.summary(ctx.session.ownerId), ctx, 'APPROVAL_CARD', (summary) => ({
        ...summary,
        issuancePromised: false,
      }), []);
    case 'getHinValuationMethodologies':
      return mapPort(ctx.ports.hin.methodologies(), ctx, 'APPROVAL_CARD', (methodologies) => ({
        methodologies,
        isMintFormula: false,
      }), []);
    default:
      return refuse(ctx, 'FAILED', 'UNKNOWN_TOOL', 'That tool is not registered.');
  }
}

function readAccountsSnapshot(ctx: HandlerContext) {
  return mapPort(ctx.ports.accounts.listAccounts(ctx.session.ownerId), ctx, 'ACCOUNT_CARD', (accounts) => {
    const totals: Record<string, bigint> = {};
    for (const account of accounts) {
      const ccy = account.available.currency;
      totals[ccy] = (totals[ccy] ?? 0n) + BigInt(account.available.minorUnits);
    }
    return {
      accounts,
      totals: Object.entries(totals).map(([currency, minorUnits]) => ({
        currency,
        available: { minorUnits: minorUnits.toString(), currency },
      })),
      ledgerWins: true,
    };
  }, ['accounts.*.available.minorUnits', 'totals.*.available.minorUnits']);
}

function paymentQuote(ctx: HandlerContext) {
  const quoted = ctx.ports.payments.quote({
    ownerId: ctx.session.ownerId,
    sourceAccountId: str(ctx.input.sourceAccountId),
    recipientId: str(ctx.input.recipientId),
    amountMinorUnits: str(ctx.input.amount),
    currency: str(ctx.input.currency),
  });
  if (!quoted.ok) {
    return fromPortFailure(ctx, quoted);
  }
  if (quoted.value.expired) {
    return refuse(ctx, 'FAILED', 'QUOTE_EXPIRED', 'I could not use that payment quote because it expired.');
  }
  return success(ctx, 'PAYMENT_QUOTE', {
    quote: quoted.value,
  }, ['quote.amount.minorUnits', 'quote.fees.minorUnits', 'quote.destinationAmount.minorUnits', 'quote.rate.numerator', 'quote.rate.denominator']);
}

function paymentProposal(ctx: HandlerContext) {
  const quoted = paymentQuote(ctx);
  if (quoted.status !== 'SUCCESS') {
    return quoted;
  }
  const quote = (quoted.payload as { quote: { quoteId: string; amount: MoneyView; fees: MoneyView; recipientId: string } }).quote;
  return createProposal(ctx, {
    intent: 'PREPARE_PAYMENT',
    reasonCode: 'AGENT_PAYMENT_PROPOSAL',
    strategyRef: quote.quoteId,
    assetId: 'FIAT_ACCOUNT',
    quantity: BigInt(str(ctx.input.amount)),
    destinationOrMarket: str(ctx.input.recipientId),
    fees: BigInt(quote.fees.minorUnits),
    expectedOutcomeClass: 'PAYMENT_PREPARED',
    operationalRationale: typeof ctx.input.purpose === 'string' ? ctx.input.purpose : 'prepare payment for human review',
  }, 'PAYMENT_QUOTE', { quote, executed: false });
}

function fxQuote(ctx: HandlerContext) {
  const quoted = ctx.ports.fx.quote({
    ownerId: ctx.session.ownerId,
    sourceCurrency: str(ctx.input.sourceCurrency),
    destinationCurrency: str(ctx.input.destinationCurrency),
    sourceAmountMinorUnits: str(ctx.input.sourceAmount),
  });
  if (!quoted.ok) {
    return fromPortFailure(ctx, quoted);
  }
  if (quoted.value.expired) {
    return refuse(ctx, 'FAILED', 'QUOTE_EXPIRED', 'I could not retrieve the current FX quote because it expired.');
  }
  return success(ctx, 'FX_QUOTE', { quote: quoted.value }, [
    'quote.source.minorUnits',
    'quote.destination.minorUnits',
    'quote.fees.minorUnits',
    'quote.rate.numerator',
    'quote.rate.denominator',
  ]);
}

function fxProposal(ctx: HandlerContext) {
  const quoted = ctx.ports.fx.quote({
    ownerId: ctx.session.ownerId,
    sourceCurrency: str(ctx.input.sourceCurrency),
    destinationCurrency: str(ctx.input.destinationCurrency),
    sourceAmountMinorUnits: str(ctx.input.sourceAmount),
  });
  if (!quoted.ok) {
    return fromPortFailure(ctx, quoted);
  }
  if (quoted.value.expired) {
    return refuse(ctx, 'FAILED', 'QUOTE_EXPIRED', 'I could not retrieve the current FX quote.');
  }
  return createProposal(ctx, {
    intent: 'PREPARE_PAYMENT',
    reasonCode: 'AGENT_FX_PROPOSAL',
    strategyRef: str(ctx.input.quoteId),
    assetId: 'FIAT_ACCOUNT',
    quantity: BigInt(str(ctx.input.sourceAmount)),
    destinationOrMarket: `${str(ctx.input.sourceCurrency)}_${str(ctx.input.destinationCurrency)}`,
    fees: BigInt(quoted.value.fees.minorUnits),
    expectedOutcomeClass: 'PAYMENT_PREPARED',
    operationalRationale: 'prepare FX conversion for human review',
  }, 'FX_QUOTE', { quote: quoted.value, executed: false });
}

function growthProposal(ctx: HandlerContext) {
  const created = ctx.ports.grow.createProposal({
    ownerId: ctx.session.ownerId,
    opportunityId: str(ctx.input.opportunityId),
    amountMinorUnits: str(ctx.input.amount),
    currency: str(ctx.input.currency),
  });
  if (!created.ok) {
    return fromPortFailure(ctx, created);
  }
  return createProposal(ctx, {
    intent: 'REBALANCE_WITHIN_POLICY',
    reasonCode: 'AGENT_GROWTH_PROPOSAL',
    strategyRef: created.value.proposalId,
    assetId: 'FIAT_ACCOUNT',
    quantity: BigInt(str(ctx.input.amount)),
    destinationOrMarket: str(ctx.input.opportunityId),
    fees: 0n,
    expectedOutcomeClass: 'REBALANCE_PREPARED',
    operationalRationale: 'prepare growth proposal for human review',
  }, 'GROWTH_PROPOSAL', { growth: created.value, executed: false });
}

function modifyGrowth(ctx: HandlerContext) {
  const modified = ctx.ports.grow.modifyProposal({
    ownerId: ctx.session.ownerId,
    proposalId: str(ctx.input.proposalId),
    amountMinorUnits: str(ctx.input.amount),
  });
  if (!modified.ok) {
    return fromPortFailure(ctx, modified);
  }
  return createProposal(ctx, {
    intent: 'REBALANCE_WITHIN_POLICY',
    reasonCode: 'AGENT_GROWTH_PROPOSAL_SUPERSEDE',
    strategyRef: modified.value.proposalId,
    assetId: 'FIAT_ACCOUNT',
    quantity: BigInt(str(ctx.input.amount)),
    destinationOrMarket: modified.value.planId,
    fees: 0n,
    expectedOutcomeClass: 'REBALANCE_PREPARED',
    operationalRationale: 'supersede growth proposal; original is not edited',
  }, 'GROWTH_PROPOSAL', { growth: modified.value, superseded: true, executed: false });
}

function exchangeProposal(ctx: HandlerContext) {
  const market = ctx.ports.exchange.price(str(ctx.input.marketId));
  if (!market.ok) {
    return fromPortFailure(ctx, market);
  }
  if (!market.value.eligible) {
    return refuse(ctx, 'NOT_ELIGIBLE', 'PRODUCT_UNAVAILABLE', 'That market is not eligible for this owner.');
  }
  return createProposal(ctx, {
    intent: 'PREPARE_EXCHANGE_ORDER',
    reasonCode: 'AGENT_EXCHANGE_PROPOSAL',
    strategyRef: str(ctx.input.marketId),
    assetId: str(ctx.input.assetId),
    quantity: BigInt(str(ctx.input.quantity)),
    destinationOrMarket: str(ctx.input.marketId),
    fees: 0n,
    expectedOutcomeClass: 'EXCHANGE_ORDER_PREPARED',
    operationalRationale: `prepare ${str(ctx.input.side)} order for human review`,
  }, 'TRADE_PROPOSAL', { market: market.value, side: ctx.input.side, executed: false });
}

function withdrawalProposal(ctx: HandlerContext) {
  const destinationOk = ctx.mandate.permissions.destinations.some((item) => item.destinationId === ctx.input.destinationId);
  if (!destinationOk) {
    return refuse(ctx, 'NOT_ELIGIBLE', 'DESTINATION_NOT_PERMITTED', 'That withdrawal destination is not on the mandate.');
  }
  return createProposal(ctx, {
    intent: 'REQUEST_HUMAN_APPROVAL',
    reasonCode: 'AGENT_WITHDRAWAL_PROPOSAL',
    strategyRef: str(ctx.input.walletId),
    assetId: str(ctx.input.assetId),
    quantity: BigInt(str(ctx.input.amount)),
    destinationOrMarket: str(ctx.input.destinationId),
    fees: 0n,
    expectedOutcomeClass: 'HUMAN_APPROVAL_REQUESTED',
    operationalRationale: 'prepare withdrawal for human review',
  }, 'APPROVAL_CARD', { executed: false });
}

function cardControlProposal(ctx: HandlerContext) {
  const card = ctx.ports.cards.get(ctx.session.ownerId, str(ctx.input.cardId));
  if (!card.ok) {
    return fromPortFailure(ctx, card);
  }
  return createProposal(ctx, {
    intent: 'REQUEST_HUMAN_APPROVAL',
    reasonCode: 'AGENT_CARD_CONTROL_PROPOSAL',
    strategyRef: str(ctx.input.cardId),
    assetId: 'FIAT_ACCOUNT',
    quantity: BigInt(typeof ctx.input.limitMinorUnits === 'string' ? ctx.input.limitMinorUnits : '0'),
    destinationOrMarket: str(ctx.input.cardId),
    fees: 0n,
    expectedOutcomeClass: 'HUMAN_APPROVAL_REQUESTED',
    operationalRationale: `propose card control ${str(ctx.input.control)}`,
  }, 'APPROVAL_CARD', { card: card.value, control: ctx.input.control, executed: false });
}

function walletBalance(ctx: HandlerContext) {
  const wallets = ctx.ports.custody.wallets(ctx.session.ownerId);
  if (!wallets.ok) {
    return fromPortFailure(ctx, wallets);
  }
  const wallet = wallets.value.find((item) => item.walletId === ctx.input.walletId);
  if (!wallet) {
    return refuse(ctx, 'NOT_ELIGIBLE', 'NOT_OWNED', 'I could not find that wallet for this owner.');
  }
  return success(ctx, 'ACCOUNT_CARD', { wallet }, ['wallet.balanceMinorUnits']);
}

function createProposal(
  ctx: HandlerContext,
  draft: Omit<CreateProposalInput, 'mandateId' | 'modelRef' | 'networkId'>,
  component: LovableComponentHint,
  extra: Readonly<Record<string, unknown>>,
): Omit<AgentToolResult, 'durationMs' | 'correlationId'> {
  const compliance = ctx.ports.compliance.evaluate({
    toolId: ctx.tool.toolId,
    ownerId: ctx.session.ownerId,
    amountMinorUnits: draft.quantity.toString(),
  });
  if (compliance.status !== 'ALLOW') {
    return refuse(
      ctx,
      compliance.status === 'HOLD' || compliance.status === 'REQUIRE_MANUAL_REVIEW' ? 'APPROVAL_REQUIRED' : 'NOT_ELIGIBLE',
      compliance.status === 'BLOCK' ? 'KERNEL_DENIED' : 'COMPLIANCE_REFUSED',
      compliance.status === 'BLOCK'
        ? 'I could not create that proposal because compliance refused it.'
        : 'This proposal needs additional compliance review before I can present it as valid.',
    );
  }
  const created: Result<AgentTransactionProposal, MandateRefusal> = ctx.engine.createProposal({
    ...draft,
    mandateId: ctx.mandate.mandateId,
    modelRef: ctx.session.agentId,
    networkId: 'net_sunrey_simulation',
  });
  if (!created.ok) {
    if (created.error.code === 'BUDGET_EXCEEDED') {
      return refuse(ctx, 'NOT_ELIGIBLE', 'BUDGET_EXCEEDED', 'That amount is above the agent mandate limit, so I cannot present it as a valid proposal.');
    }
    return refuse(ctx, 'NOT_ELIGIBLE', created.error.code, created.error.detail);
  }
  return {
    status: ctx.tool.requiresUserApproval ? 'APPROVAL_REQUIRED' : 'ACTION_REQUIRED',
    toolId: ctx.tool.toolId,
    version: ctx.tool.version,
    executed: false as const,
    payload: Object.freeze({
      ...extra,
      proposalId: created.value.proposalId,
      proposalHash: created.value.proposalHash,
      quantity: created.value.quantity.toString(),
      fees: created.value.fees.toString(),
      executed: false,
    }),
    rendering: hint(component, ['quantity', 'fees']),
    error: null,
    proposalId: created.value.proposalId,
    workflowId: created.value.proposalId,
  };
}

function mapPort<T>(
  result: PortResult<T>,
  ctx: HandlerContext,
  component: LovableComponentHint,
  payload: (value: T) => Readonly<Record<string, unknown>>,
  numericPaths: readonly string[],
): Omit<AgentToolResult, 'durationMs' | 'correlationId'> {
  if (!result.ok) {
    return fromPortFailure(ctx, result);
  }
  return success(ctx, component, payload(result.value), numericPaths);
}

function fromPortFailure(ctx: HandlerContext, failure: Extract<PortResult<never>, { ok: false }>) {
  if (failure.code === 'PROVIDER_UNAVAILABLE') {
    return refuse(ctx, 'UNAVAILABLE', failure.code, failure.message);
  }
  if (failure.code === 'QUOTE_EXPIRED') {
    return refuse(ctx, 'FAILED', failure.code, failure.message);
  }
  if (failure.code === 'KERNEL_DENIED' || failure.code === 'COMPLIANCE_REFUSED') {
    return refuse(ctx, 'NOT_ELIGIBLE', failure.code, failure.message);
  }
  if (failure.code === 'PRODUCT_UNAVAILABLE') {
    return refuse(ctx, 'UNAVAILABLE', failure.code, failure.message);
  }
  return refuse(ctx, failure.code === 'NOT_OWNED' || failure.code === 'NOT_ELIGIBLE' ? 'NOT_ELIGIBLE' : 'FAILED', failure.code, failure.message);
}

function success(
  ctx: HandlerContext,
  component: LovableComponentHint,
  payload: Readonly<Record<string, unknown>>,
  numericPaths: readonly string[],
): Omit<AgentToolResult, 'durationMs' | 'correlationId'> {
  return {
    status: 'SUCCESS' as const,
    toolId: ctx.tool.toolId,
    version: ctx.tool.version,
    executed: false as const,
    payload: Object.freeze(payload),
    rendering: hint(component, numericPaths),
    error: null,
    proposalId: null,
    workflowId: null,
  };
}

function refuse(
  ctx: HandlerContext,
  status: AgentToolResult['status'],
  code: string,
  safeMessage: string,
): Omit<AgentToolResult, 'durationMs' | 'correlationId'> {
  return {
    status,
    toolId: ctx.tool.toolId,
    version: ctx.tool.version,
    executed: false as const,
    payload: Object.freeze({}),
    rendering: null,
    error: Object.freeze({ code, safeMessage, inventingNumbersForbidden: true as const }),
    proposalId: null,
    workflowId: null,
  };
}

function hint(component: LovableComponentHint, authoritativeNumericPaths: readonly string[]) {
  return Object.freeze({
    component,
    authoritativeNumericPaths,
    modelMaySummarize: true as const,
    modelMayAlterAuthoritativeNumbers: false as const,
  });
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
