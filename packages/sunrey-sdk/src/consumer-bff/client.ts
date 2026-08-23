/**
 * Lovable-safe Consumer BFF client for `/api/v1` payments and recipients.
 * Distinct from `/v1/consumer` platform routes. Does not import Ledger,
 * Kernel, or Execution Authority.
 */

import type {
  AgentConversationResource,
  AgentMemoryResource,
  AgentMessageResponse,
  AgentResource,
  GrowPlan,
  GrowPlanCreateInput,
  GrowProposal,
  GrowAllocation,
  GrowHoldings,
  GrowPerformance,
  GrowPortfolio,
  ActionCard,
  ActionCenterList,
  ActionCenterView,
  ConversationTurn,
  DataConsentGrant,
  DataConsentList,
  DataPermissionCatalog,
  DataRightsRequestResource,
  HinParticipation,
  NativeEconomyOverview,
  NativeEconomySupply,
  ProductiveEconomyOverview,
  VaultCategories,
  VaultExportJob,
  VaultHome,
  VaultRecord,
  VaultRecords,
  ExchangeMarkets,
  ExchangeOrderPreview,
  ExchangeOrderSubmit,
  GrowRisk,
  GrowGoal,
  GrowGoalCreateInput,
  GrowInsight,
  GrowProfile,
  GrowSnapshot,
  GrowSuitability,
  Payment,
  PaymentApproval,
  PaymentCreateInput,
  PaymentQuote,
  PaymentQuoteInput,
  Recipient,
  RecipientCreateInput,
  AssetDetail,
  ConsumerWallet,
  DepositAddress,
  WalletTransaction,
  WithdrawalCreateInput,
  WithdrawalQuote,
  WithdrawalQuoteInput,
  WithdrawalResource,
} from './types.ts';

export type BffAuthProvider = {
  getAccessToken(): string | undefined | Promise<string | undefined>;
};

export type ConsumerBffClientOptions = {
  readonly baseUrl: string;
  readonly auth?: BffAuthProvider;
  readonly getAccessToken?: () => string | undefined | Promise<string | undefined>;
  readonly generateRequestId?: () => string;
  readonly fetchImpl?: typeof fetch;
};

export type BffRequestOptions = {
  readonly requestId?: string;
  readonly idempotencyKey?: string;
};

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

export class SunReyConsumerBffClient {
  readonly baseUrl: string;
  private readonly auth: BffAuthProvider | undefined;
  private readonly generateRequestId: () => string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ConsumerBffClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.auth =
      options.auth ??
      (options.getAccessToken ? { getAccessToken: options.getAccessToken } : undefined);
    this.generateRequestId = options.generateRequestId ?? newRequestId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async listHinRights(options?: BffRequestOptions): Promise<import('./types.ts').HinRights> {
    return this.request('GET', '/api/v1/hin/rights', undefined, options);
  }

  async listHinLicenses(options?: BffRequestOptions): Promise<import('./types.ts').HinLicenses> {
    return this.request('GET', '/api/v1/hin/licenses', undefined, options);
  }

  async getHinEarnings(options?: BffRequestOptions): Promise<import('./types.ts').HinEarnings> {
    return this.request('GET', '/api/v1/hin/earnings', undefined, options);
  }

  async getHinEarningsActivity(options?: BffRequestOptions): Promise<import('./types.ts').HinEarningsActivity> {
    return this.request('GET', '/api/v1/hin/earnings/activity', undefined, options);
  }

  async listWallets(
    options?: BffRequestOptions,
  ): Promise<{ readonly items?: readonly ConsumerWallet[]; readonly schema?: string } & Record<string, unknown>> {
    return this.request('GET', '/api/v1/wallets', undefined, options);
  }

  async getWallet(walletId: string, options?: BffRequestOptions): Promise<ConsumerWallet> {
    return this.request('GET', `/api/v1/wallets/${encodeURIComponent(walletId)}`, undefined, options);
  }

  async getDepositAddress(walletId: string, options?: BffRequestOptions): Promise<DepositAddress> {
    return this.request('GET', `/api/v1/wallets/${encodeURIComponent(walletId)}/deposit-address`, undefined, options);
  }

  async listWalletTransactions(
    walletId: string,
    options?: BffRequestOptions,
  ): Promise<{ readonly items: readonly WalletTransaction[] }> {
    return this.request('GET', `/api/v1/wallets/${encodeURIComponent(walletId)}/transactions`, undefined, options);
  }

  async quoteWithdrawal(
    walletId: string,
    input: WithdrawalQuoteInput,
    options?: BffRequestOptions,
  ): Promise<WithdrawalQuote> {
    return this.request('POST', `/api/v1/wallets/${encodeURIComponent(walletId)}/withdrawal-quote`, input, options);
  }

  async createWithdrawal(
    walletId: string,
    input: WithdrawalCreateInput,
    options?: BffRequestOptions,
  ): Promise<WithdrawalResource> {
    return this.request('POST', `/api/v1/wallets/${encodeURIComponent(walletId)}/withdrawals`, input, options);
  }

  async getWithdrawal(walletId: string, withdrawalId: string, options?: BffRequestOptions): Promise<WithdrawalResource> {
    return this.request(
      'GET',
      `/api/v1/wallets/${encodeURIComponent(walletId)}/withdrawals/${encodeURIComponent(withdrawalId)}`,
      undefined,
      options,
    );
  }

  async getAssetDetail(assetId: string, options?: BffRequestOptions): Promise<AssetDetail> {
    return this.request('GET', `/api/v1/assets/${encodeURIComponent(assetId)}`, undefined, options);
  }

  async getDataPermissions(options?: BffRequestOptions): Promise<DataPermissionCatalog> {
    return this.request('GET', '/api/v1/data/permissions', undefined, options);
  }

  async listDataConsents(options?: BffRequestOptions): Promise<DataConsentList> {
    return this.request('GET', '/api/v1/data/consents', undefined, options);
  }

  async grantDataConsent(
    input: {
      readonly purposeId?: string;
      readonly bundleId?: string;
      readonly expiresAt: string;
      readonly dataCategories?: readonly string[];
      readonly economicUseClass?: string;
    },
    options?: BffRequestOptions,
  ): Promise<DataConsentGrant> {
    return this.request('POST', '/api/v1/data/consents', input, options);
  }

  async revokeDataConsent(consentId: string, reason?: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('POST', `/api/v1/data/consents/${encodeURIComponent(consentId)}/revoke`, { reason }, options);
  }

  async getDataAccessHistory(options?: BffRequestOptions): Promise<{ readonly items: readonly unknown[] }> {
    return this.request('GET', '/api/v1/data/access-history', undefined, options);
  }

  async submitDataRightsRequest(
    input: { readonly type: string; readonly jurisdiction?: string },
    options?: BffRequestOptions,
  ): Promise<DataRightsRequestResource> {
    return this.request('POST', '/api/v1/data/rights/requests', input, options);
  }

  async listDataRightsRequests(options?: BffRequestOptions): Promise<{ readonly items: readonly DataRightsRequestResource[] }> {
    return this.request('GET', '/api/v1/data/rights/requests', undefined, options);
  }

  async getHinParticipation(options?: BffRequestOptions): Promise<HinParticipation> {
    return this.request('GET', '/api/v1/hin/participation', undefined, options);
  }

  async enrollHinParticipation(expiresAt: string, options?: BffRequestOptions): Promise<HinParticipation> {
    return this.request('POST', '/api/v1/hin/participation/enroll', { expiresAt }, options);
  }

  async pauseHinParticipation(options?: BffRequestOptions): Promise<HinParticipation> {
    return this.request('POST', '/api/v1/hin/participation/pause', {}, options);
  }

  async withdrawHinParticipation(options?: BffRequestOptions): Promise<HinParticipation> {
    return this.request('POST', '/api/v1/hin/participation/withdraw', {}, options);
  }

  async listRecipients(options?: BffRequestOptions): Promise<{ readonly items: readonly Recipient[] }> {
    return this.request('GET', '/api/v1/recipients', undefined, options);
  }

  async createRecipient(input: RecipientCreateInput, options?: BffRequestOptions): Promise<Recipient> {
    return this.request('POST', '/api/v1/recipients', input, options);
  }

  async getRecipient(id: string, options?: BffRequestOptions): Promise<Recipient> {
    return this.request('GET', `/api/v1/recipients/${encodeURIComponent(id)}`, undefined, options);
  }

  async quotePayment(input: PaymentQuoteInput, options?: BffRequestOptions): Promise<PaymentQuote> {
    return this.request('POST', '/api/v1/payments/quote', input, options);
  }

  async createPayment(input: PaymentCreateInput, options?: BffRequestOptions): Promise<Payment> {
    return this.request('POST', '/api/v1/payments', input, options);
  }

  async listPayments(options?: BffRequestOptions): Promise<{ readonly items: readonly Payment[] }> {
    return this.request('GET', '/api/v1/payments', undefined, options);
  }

  async getPayment(id: string, options?: BffRequestOptions): Promise<Payment> {
    return this.request('GET', `/api/v1/payments/${encodeURIComponent(id)}`, undefined, options);
  }

  async listAgents(options?: BffRequestOptions): Promise<{ readonly items: readonly AgentResource[] }> {
    return this.request('GET', '/api/v1/agents', undefined, options);
  }

  async getAgent(id: string, options?: BffRequestOptions): Promise<AgentResource> {
    return this.request('GET', `/api/v1/agents/${encodeURIComponent(id)}`, undefined, options);
  }

  async listConversations(
    agentId: string,
    options?: BffRequestOptions,
  ): Promise<{ readonly items: readonly AgentConversationResource[] }> {
    return this.request('GET', `/api/v1/agents/${encodeURIComponent(agentId)}/conversations`, undefined, options);
  }

  async createConversation(
    agentId: string,
    input: { readonly title?: string } = {},
    options?: BffRequestOptions,
  ): Promise<AgentConversationResource> {
    return this.request('POST', `/api/v1/agents/${encodeURIComponent(agentId)}/conversations`, input, options);
  }

  async getConversation(
    agentId: string,
    conversationId: string,
    options?: BffRequestOptions,
  ): Promise<AgentConversationResource> {
    return this.request(
      'GET',
      `/api/v1/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(conversationId)}`,
      undefined,
      options,
    );
  }

  async postMessage(
    agentId: string,
    conversationId: string,
    input: { readonly text: string },
    options?: BffRequestOptions,
  ): Promise<AgentMessageResponse> {
    return this.request(
      'POST',
      `/api/v1/agents/${encodeURIComponent(agentId)}/conversations/${encodeURIComponent(conversationId)}/messages`,
      input,
      options,
    );
  }

  async pauseAgent(id: string, options?: BffRequestOptions): Promise<AgentResource> {
    return this.request('POST', `/api/v1/agents/${encodeURIComponent(id)}/pause`, {}, options);
  }

  async revokeAgent(id: string, options?: BffRequestOptions): Promise<AgentResource> {
    return this.request('POST', `/api/v1/agents/${encodeURIComponent(id)}/revoke`, {}, options);
  }

  async listMemories(
    agentId: string,
    options?: BffRequestOptions,
  ): Promise<{ readonly items: readonly AgentMemoryResource[] }> {
    return this.request('GET', `/api/v1/agents/${encodeURIComponent(agentId)}/memories`, undefined, options);
  }

  async getGrowHome(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/grow', undefined, options);
  }

  async getGoals(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/grow/goals', undefined, options);
  }

  async createGoal(
    input: { readonly label: string; readonly targetMinorUnits: string; readonly currency?: string },
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/grow/goals', input, options);
  }

  async getOpportunities(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/grow/opportunities', undefined, options);
  }

  async getGrowthPlan(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/grow/plan', undefined, options);
  }

  async getGrowScenarios(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/grow/scenarios', undefined, options);
  }

  async createGrowthProposal(
    input: { readonly actionId?: string } = {},
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/grow/proposals', input, options);
  }

  async getGrowthProposal(id: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/grow/proposals/${encodeURIComponent(id)}`, undefined, options);
  }

  async modifyGrowthProposal(
    id: string,
    input: { readonly amountMinorUnits: string },
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/grow/proposals/${encodeURIComponent(id)}/modify`, input, options);
  }

  async approveGrowthProposal(
    id: string,
    input: { readonly stepUpSatisfied?: boolean } = {},
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/grow/proposals/${encodeURIComponent(id)}/approve`, input, options);
  }

  async executeGrowthProposal(
    id: string,
    input: { readonly idempotencyKey?: string } = {},
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request(
      'POST',
      `/api/v1/grow/proposals/${encodeURIComponent(id)}/execute`,
      input,
      { ...options, ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}) },
    );
  }

  async getGrowExecution(id: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/grow/executions/${encodeURIComponent(id)}`, undefined, options);
  }

  async getGrowPlanPerformance(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/grow/performance', undefined, options);
  }

  async getPlanProgress(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/grow/plan/progress', undefined, options);
  }

  async runGrowMonitor(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/grow/monitor', {}, options);
  }

  async pauseGrowthPlan(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/grow/plan/pause', {}, options);
  }

  async resumeGrowthPlan(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/grow/plan/resume', {}, options);
  }

  async createRecurringContribution(
    input: {
      readonly amountMinorUnits: string;
      readonly currency?: string;
      readonly frequency?: string;
      readonly sourceAccountId: string;
      readonly destinationAccountId: string;
      readonly maxAmountMinorUnits?: string;
    },
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/grow/recurring', input, options);
  }

  async cancelRecurringContribution(id: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/grow/recurring/${encodeURIComponent(id)}/cancel`, {}, options);
  }

  async listGrowOpportunities(options?: BffRequestOptions): Promise<import('./types.ts').GrowOpportunityFeed> {
    return this.request('GET', '/api/v1/grow/opportunities', undefined, options);
  }

  async getGrowOpportunity(id: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', `/api/v1/grow/opportunities/${encodeURIComponent(id)}`, undefined, options);
  }

  async dismissGrowOpportunity(id: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('POST', `/api/v1/grow/opportunities/${encodeURIComponent(id)}/dismiss`, {}, options);
  }

  async startGrowProposal(id: string, options?: BffRequestOptions): Promise<import('./types.ts').GrowProposalReceipt> {
    return this.request('POST', `/api/v1/grow/opportunities/${encodeURIComponent(id)}/start-proposal`, {}, options);
  }

  async getGrowProfile(options?: BffRequestOptions): Promise<GrowProfile> {
    return this.request('GET', '/api/v1/grow/profile', undefined, options);
  }

  async getGrowSnapshot(options?: BffRequestOptions): Promise<GrowSnapshot> {
    return this.request('GET', '/api/v1/grow/snapshot', undefined, options);
  }

  async listGrowGoals(options?: BffRequestOptions): Promise<{ readonly items: readonly GrowGoal[] }> {
    return this.request('GET', '/api/v1/grow/goals', undefined, options);
  }

  async createGrowGoal(input: GrowGoalCreateInput, options?: BffRequestOptions): Promise<unknown> {
    return this.request('POST', '/api/v1/grow/goals', input, options);
  }

  async patchGrowGoal(
    id: string,
    input: { readonly name?: string; readonly status?: GrowGoal['status']; readonly priority?: number },
    options?: BffRequestOptions,
  ): Promise<unknown> {
    return this.request('PATCH', `/api/v1/grow/goals/${encodeURIComponent(id)}`, input, options);
  }

  async listGrowInsights(options?: BffRequestOptions): Promise<{ readonly items: readonly GrowInsight[] }> {
    return this.request('GET', '/api/v1/grow/insights', undefined, options);
  }

  async getGrowSuitability(options?: BffRequestOptions): Promise<GrowSuitability | null> {
    return this.request('GET', '/api/v1/grow/suitability', undefined, options);
  }

  async submitGrowSuitability(input: Record<string, unknown>, options?: BffRequestOptions): Promise<GrowSuitability> {
    return this.request('POST', '/api/v1/grow/suitability', input, options);
  }

  async approvePayment(
    id: string,
    input: { readonly approvalId?: string } = {},
    options?: BffRequestOptions,
  ): Promise<Payment> {
    return this.request('POST', `/api/v1/payments/${encodeURIComponent(id)}/approve`, input, options);
  }

  async createGrowPlan(input: GrowPlanCreateInput, options?: BffRequestOptions): Promise<GrowPlan> {
    return this.request('POST', '/api/v1/grow/plans', input, options);
  }

  async getGrowPlan(id: string, options?: BffRequestOptions): Promise<GrowPlan> {
    return this.request('GET', `/api/v1/grow/plans/${encodeURIComponent(id)}`, undefined, options);
  }

  async listGrowProposals(options?: BffRequestOptions): Promise<{ readonly items: readonly GrowProposal[] }> {
    return this.request('GET', '/api/v1/grow/proposals', undefined, options);
  }

  async getGrowProposal(id: string, options?: BffRequestOptions): Promise<GrowProposal> {
    return this.request('GET', `/api/v1/grow/proposals/${encodeURIComponent(id)}`, undefined, options);
  }

  async modifyGrowProposal(
    id: string,
    input: { readonly amountMinorUnits?: string; readonly riskProfile?: string },
    options?: BffRequestOptions,
  ): Promise<GrowProposal> {
    return this.request('POST', `/api/v1/grow/proposals/${encodeURIComponent(id)}/modify`, input, options);
  }

  async approveGrowProposal(
    id: string,
    input: { readonly stepUpSatisfied?: boolean } = {},
    options?: BffRequestOptions,
  ): Promise<GrowProposal> {
    return this.request('POST', `/api/v1/grow/proposals/${encodeURIComponent(id)}/approve`, input, options);
  }

  async rejectGrowProposal(id: string, options?: BffRequestOptions): Promise<GrowProposal> {
    return this.request('POST', `/api/v1/grow/proposals/${encodeURIComponent(id)}/reject`, {}, options);
  }

  async startAgentConversation(options?: BffRequestOptions): Promise<{ readonly conversationId: string }> {
    return this.request('POST', '/api/v1/agent/conversations', {}, options);
  }

  async sendAgentMessage(conversationId: string, text: string, options?: BffRequestOptions): Promise<ConversationTurn> {
    return this.request('POST', `/api/v1/agent/conversations/${encodeURIComponent(conversationId)}/messages`, { text }, options);
  }

  async getAgentConversation(conversationId: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', `/api/v1/agent/conversations/${encodeURIComponent(conversationId)}`, undefined, options);
  }

  async streamAgentEvents(conversationId: string, after = 0, options?: BffRequestOptions): Promise<{ readonly events: readonly unknown[] }> {
    return this.request('GET', `/api/v1/agent/conversations/${encodeURIComponent(conversationId)}/events?after=${String(after)}`, undefined, options);
  }

  async listAgentActions(view?: ActionCenterView, options?: BffRequestOptions): Promise<ActionCenterList> {
    const suffix = view ? `?view=${encodeURIComponent(view)}` : '';
    return this.request('GET', `/api/v1/agent/actions${suffix}`, undefined, options);
  }

  async getAgentAction(actionId: string, options?: BffRequestOptions): Promise<{ readonly card: ActionCard }> {
    return this.request('GET', `/api/v1/agent/actions/${encodeURIComponent(actionId)}`, undefined, options);
  }

  async approveAgentAction(
    actionId: string,
    input: { readonly stepUpSatisfied?: boolean; readonly acknowledgements?: readonly string[] } = {},
    options?: BffRequestOptions,
  ): Promise<ConversationTurn> {
    return this.request('POST', `/api/v1/agent/actions/${encodeURIComponent(actionId)}/approve`, input, options);
  }

  async modifyAgentAction(actionId: string, amount: string, options?: BffRequestOptions): Promise<ConversationTurn> {
    return this.request('POST', `/api/v1/agent/actions/${encodeURIComponent(actionId)}/modify`, { amount }, options);
  }

  async rejectAgentAction(actionId: string, options?: BffRequestOptions): Promise<ConversationTurn> {
    return this.request('POST', `/api/v1/agent/actions/${encodeURIComponent(actionId)}/reject`, {}, options);
  }

  async getGrowPortfolio(options?: BffRequestOptions): Promise<GrowPortfolio> {
    return this.request('GET', '/api/v1/grow/portfolio', undefined, options);
  }

  async getGrowHoldings(options?: BffRequestOptions): Promise<GrowHoldings> {
    return this.request('GET', '/api/v1/grow/portfolio/holdings', undefined, options);
  }

  async getGrowPerformance(options?: BffRequestOptions): Promise<GrowPerformance> {
    return this.request('GET', '/api/v1/grow/portfolio/performance', undefined, options);
  }

  async getGrowAllocation(options?: BffRequestOptions): Promise<GrowAllocation> {
    return this.request('GET', '/api/v1/grow/portfolio/allocation', undefined, options);
  }

  async getGrowRisk(options?: BffRequestOptions): Promise<GrowRisk> {
    return this.request('GET', '/api/v1/grow/portfolio/risk', undefined, options);
  }

  async getExchangeHome(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/exchange', undefined, options);
  }

  async listExchangeMarkets(options?: BffRequestOptions): Promise<ExchangeMarkets> {
    return this.request('GET', '/api/v1/exchange/markets', undefined, options);
  }

  async getExchangeMarket(marketId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(marketId)}`, undefined, options);
  }

  async getExchangeTicker(marketId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(marketId)}/ticker`, undefined, options);
  }

  async getExchangeOrderBook(marketId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(marketId)}/order-book`, undefined, options);
  }

  async getExchangeChart(marketId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(marketId)}/chart`, undefined, options);
  }

  async getExchangeEligibility(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/exchange/eligibility', undefined, options);
  }

  async getExchangeHoldings(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/exchange/holdings', undefined, options);
  }

  async fundExchangeSandbox(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/exchange/fund', {}, options);
  }

  async previewExchangeOrder(
    input: {
      readonly side: 'BUY' | 'SELL';
      readonly quantity: string;
      readonly notionalUsdMinor?: string;
      readonly marketId?: string;
      readonly instrument?: string;
    },
    options?: BffRequestOptions,
  ): Promise<ExchangeOrderPreview> {
    return this.request('POST', '/api/v1/exchange/preview', input, options);
  }

  async createExchangeProposal(
    input: { readonly side: 'BUY' | 'SELL'; readonly quantity: string; readonly notionalUsdMinor?: string },
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/exchange/proposals', input, options);
  }

  async approveExchangeProposal(
    proposalId: string,
    input: { readonly stepUpSatisfied?: boolean; readonly actor?: 'HUMAN' | 'AGENT' } = {},
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/exchange/proposals/${encodeURIComponent(proposalId)}/approve`, input, options);
  }

  async submitExchangeProposal(
    proposalId: string,
    input: { readonly clientOrderId?: string } = {},
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/exchange/proposals/${encodeURIComponent(proposalId)}/submit`, input, options);
  }

  async listExchangeOrders(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/exchange/orders', undefined, options);
  }

  async listExchangeFills(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/exchange/fills', undefined, options);
  }

  async getExchangeStream(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/exchange/stream', undefined, options);
  }

  async getWalletHome(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/wallets', undefined, options);
  }

  async getWalletDepositAddress(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/wallets/deposit-address', undefined, options);
  }

  async simulateWalletDeposit(
    input: { readonly quantity?: string } = {},
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/wallets/deposits/simulate', input, options);
  }

  async quoteWalletWithdrawal(
    input: { readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN'; readonly quantity: string; readonly destination: string },
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/wallets/withdrawals/quote', input, options);
  }

  async createWithdrawalQuote(
    input: { readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN'; readonly quantity: string; readonly destination: string },
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.quoteWalletWithdrawal(input, options);
  }

  async submitWalletWithdrawal(
    input: {
      readonly assetId: 'SUNREY_COIN' | 'MOONREY_COIN';
      readonly quantity: string;
      readonly destination: string;
      readonly approved?: boolean;
      readonly actor?: 'HUMAN' | 'AGENT';
    },
    options?: BffRequestOptions,
  ): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/wallets/withdrawals', input, options);
  }

  async listWalletHomeTransactions(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/wallets/transactions', undefined, options);
  }

  async getEconomy(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy', undefined, options);
  }

  async getEconomyHome(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.getEconomy(options);
  }

  async getSunreyCoinEconomy(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy/sunrey-coin', undefined, options);
  }

  async getMoonreyCoinEconomy(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy/moonrey-coin', undefined, options);
  }

  async getEconomyStatus(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy/status', undefined, options);
  }

  async getNativeEconomy(options?: BffRequestOptions): Promise<NativeEconomyOverview> {
    return this.request('GET', '/api/v1/economy', undefined, options);
  }

  async getNativeSupply(options?: BffRequestOptions): Promise<NativeEconomySupply> {
    return this.request('GET', '/api/v1/economy/supply', undefined, options);
  }

  async getNativeAsset(assetId: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', `/api/v1/economy/assets/${encodeURIComponent(assetId)}`, undefined, options);
  }

  async getDataVault(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data', undefined, options);
  }

  async getDataCategories(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/categories', undefined, options);
  }

  async getDataSources(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/sources', undefined, options);
  }

  async listDataRecords(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/records', undefined, options);
  }

  async createVaultRecord(input: Record<string, unknown>, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/records', input, options);
  }

  async ingestVaultRecord(input: Record<string, unknown>, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/records/ingest', input, options);
  }

  async getDataRecord(recordId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/data/records/${encodeURIComponent(recordId)}`, undefined, options);
  }

  async deriveVaultRecord(recordId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/data/records/${encodeURIComponent(recordId)}/derive`, {}, options);
  }

  async getDataRecordHistory(recordId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/data/records/${encodeURIComponent(recordId)}/history`, undefined, options);
  }

  async correctVaultRecord(recordId: string, input: Record<string, unknown>, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/data/records/${encodeURIComponent(recordId)}/correct`, input, options);
  }

  async disputeVaultRecord(recordId: string, reason: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/data/records/${encodeURIComponent(recordId)}/dispute`, { reason }, options);
  }

  async getAccessHistory(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/access-history', undefined, options);
  }

  async grantDataPermission(input: Record<string, unknown>, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/permissions', input, options);
  }

  async revokeDataPermission(permissionId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/data/permissions/${encodeURIComponent(permissionId)}/revoke`, {}, options);
  }

  async getConsentReceipt(consentId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/data/consent/${encodeURIComponent(consentId)}/receipt`, undefined, options);
  }

  async getAgentAccess(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/agent-access', undefined, options);
  }

  async agentReadVault(input: Record<string, unknown>, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/agent-access/read', input, options);
  }

  async getDataHinParticipation(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/hin', undefined, options);
  }

  async participateHin(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/hin/participate', {}, options);
  }

  async requestHinStop(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/hin/stop/request', {}, options);
  }

  async confirmHinStop(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/hin/stop', {}, options);
  }

  async listContributions(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/contributions', undefined, options);
  }

  async createContribution(input: Record<string, unknown> = {}, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/contributions', input, options);
  }

  async getEarnings(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/earnings', undefined, options);
  }

  async listLicenses(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/data/licenses', undefined, options);
  }

  async requestLicense(input: Record<string, unknown> = {}, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/licenses', input, options);
  }

  async approveLicense(licenseId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/data/licenses/${encodeURIComponent(licenseId)}/approve`, {}, options);
  }

  async payLicense(licenseId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/data/licenses/${encodeURIComponent(licenseId)}/pay`, {}, options);
  }

  async revokeLicense(licenseId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', `/api/v1/data/licenses/${encodeURIComponent(licenseId)}/revoke`, {}, options);
  }

  async createRightsRequest(input: Record<string, unknown>, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/data/rights', input, options);
  }

  async getSunreyEconomy(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy/sunrey', undefined, options);
  }

  async getMoonreyEconomy(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy/moonrey', undefined, options);
  }

  async getHinAggregateMetrics(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy/hin', undefined, options);
  }

  async getProductiveEconomy(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/economy/productive', undefined, options);
  }

  async observeProductive(kind: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/economy/productive/observe', { kind }, options);
  }

  async createIssuanceBasis(kind: 'HIN' | 'MOONREY', options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('POST', '/api/v1/economy/basis-proposal', { kind }, options);
  }

  async getProductiveCategories(options?: BffRequestOptions): Promise<{ readonly items: ProductiveEconomyOverview['categories'] }> {
    return this.request('GET', '/api/v1/economy/productive/categories', undefined, options);
  }

  async getProductiveHistory(category?: string, options?: BffRequestOptions): Promise<{ readonly items: readonly unknown[] }> {
    const suffix = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request('GET', `/api/v1/economy/productive/history${suffix}`, undefined, options);
  }

  async getProductiveSources(options?: BffRequestOptions): Promise<{ readonly items: readonly unknown[] }> {
    return this.request('GET', '/api/v1/economy/productive/sources', undefined, options);
  }

  async getMoonReyEconomicInput(options?: BffRequestOptions): Promise<ProductiveEconomyOverview['moonreyInput']> {
    return this.request('GET', '/api/v1/economy/productive/moonrey-input', undefined, options);
  }

  async getVaultHome(options?: BffRequestOptions): Promise<VaultHome> {
    return this.request('GET', '/api/v1/data/vault', undefined, options);
  }

  async listVaultCategories(options?: BffRequestOptions): Promise<VaultCategories> {
    return this.request('GET', '/api/v1/data/vault/categories', undefined, options);
  }

  async listVaultRecords(options?: BffRequestOptions): Promise<VaultRecords> {
    return this.request('GET', '/api/v1/data/vault/records', undefined, options);
  }

  async getVaultRecord(recordId: string, options?: BffRequestOptions): Promise<VaultRecord> {
    return this.request('GET', `/api/v1/data/vault/records/${encodeURIComponent(recordId)}`, undefined, options);
  }

  async getVaultRecordHistory(recordId: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', `/api/v1/data/vault/records/${encodeURIComponent(recordId)}/history`, undefined, options);
  }

  async requestVaultCorrection(
    recordId: string,
    input: { readonly reason: string; readonly proposedPayload?: unknown },
    options?: BffRequestOptions,
  ): Promise<unknown> {
    return this.request(
      'POST',
      `/api/v1/data/vault/records/${encodeURIComponent(recordId)}/corrections`,
      input,
      options,
    );
  }

  async listVaultSources(options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', '/api/v1/data/vault/sources', undefined, options);
  }

  async listVaultAccess(options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', '/api/v1/data/vault/access', undefined, options);
  }

  async requestVaultExport(options?: BffRequestOptions): Promise<VaultExportJob> {
    return this.request('POST', '/api/v1/data/vault/export', {}, options);
  }

  async getVaultExportStatus(options?: BffRequestOptions): Promise<readonly VaultExportJob[]> {
    return this.request('GET', '/api/v1/data/vault/export/status', undefined, options);
  }

  async getExchangeTrades(instrument: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(instrument)}/trades`, undefined, options);
  }

  async submitExchangeOrder(
    input: {
      readonly marketId: string;
      readonly side: 'BUY' | 'SELL';
      readonly quantity: string;
      readonly proposalId?: string;
    },
    options?: BffRequestOptions,
  ): Promise<ExchangeOrderSubmit> {
    return this.request('POST', '/api/v1/exchange/orders', input, options);
  }

  async cancelExchangeOrder(orderId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('DELETE', `/api/v1/exchange/orders/${encodeURIComponent(orderId)}`, undefined, options);
  }

  async listExchangeHoldings(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.getExchangeHoldings(options);
  }

  async listHinContributions(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/hin/contributions', undefined, options);
  }

  async getHinContribution(contributionId: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/hin/contributions/${encodeURIComponent(contributionId)}`, undefined, options);
  }

  async getHinMetrics(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/hin/metrics', undefined, options);
  }

  async getHinMySummary(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/hin/me/summary', undefined, options);
  }

  async listHinValuationMethodologies(options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', '/api/v1/hin/valuation-methodologies', undefined, options);
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: BffRequestOptions,
  ): Promise<T> {
    const requestId = options?.requestId ?? this.generateRequestId();
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-request-id': requestId,
      'x-sunrey-api-version': 'v1',
    };
    const token = await this.auth?.getAccessToken();
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (options?.idempotencyKey) {
      headers['idempotency-key'] = options.idempotencyKey;
    }
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    const parsed = text.length === 0 ? {} : (JSON.parse(text) as unknown);
    if (!response.ok) {
      const message =
        parsed && typeof parsed === 'object' && 'message' in parsed
          ? String((parsed as { message: unknown }).message)
          : response.statusText;
      throw new Error(`Consumer BFF ${method} ${path} failed (${response.status}): ${message}`);
    }
    return parsed as T;
  }
}

export function createSunReyConsumerBffClient(options: ConsumerBffClientOptions): SunReyConsumerBffClient {
  return new SunReyConsumerBffClient(options);
}

export type { PaymentApproval };
