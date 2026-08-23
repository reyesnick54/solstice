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
  NativeEconomyOverview,
  NativeEconomySupply,
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
    return this.request('GET', '/api/v1/grow/performance', undefined, options);
  }

  async getGrowPortfolioPerformance(options?: BffRequestOptions): Promise<GrowPerformance> {
    return this.request('GET', '/api/v1/grow/portfolio/performance', undefined, options);
  }

  async getGrowAllocation(options?: BffRequestOptions): Promise<GrowAllocation> {
    return this.request('GET', '/api/v1/grow/portfolio/allocation', undefined, options);
  }

  async getGrowRisk(options?: BffRequestOptions): Promise<GrowRisk> {
    return this.request('GET', '/api/v1/grow/portfolio/risk', undefined, options);
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

  async listExchangeMarkets(options?: BffRequestOptions): Promise<ExchangeMarkets> {
    return this.request('GET', '/api/v1/exchange/markets', undefined, options);
  }

  async getExchangeMarket(instrument: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(instrument)}`, undefined, options);
  }

  async getExchangeTicker(instrument: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(instrument)}/ticker`, undefined, options);
  }

  async getExchangeOrderBook(instrument: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request(
      'GET',
      `/api/v1/exchange/markets/${encodeURIComponent(instrument)}/orderbook`,
      undefined,
      options,
    );
  }

  async getExchangeTrades(instrument: string, options?: BffRequestOptions): Promise<Record<string, unknown>> {
    return this.request('GET', `/api/v1/exchange/markets/${encodeURIComponent(instrument)}/trades`, undefined, options);
  }

  async previewExchangeOrder(
    input: { readonly marketId: string; readonly instrument: string; readonly side: 'BUY' | 'SELL'; readonly quantity: string },
    options?: BffRequestOptions,
  ): Promise<ExchangeOrderPreview> {
    return this.request('POST', '/api/v1/exchange/preview', input, options);
  }

  async listExchangeOrders(options?: BffRequestOptions): Promise<{ readonly items: readonly unknown[] }> {
    return this.request('GET', '/api/v1/exchange/orders', undefined, options);
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

  async listExchangeFills(options?: BffRequestOptions): Promise<{ readonly items: readonly unknown[] }> {
    return this.request('GET', '/api/v1/exchange/fills', undefined, options);
  }

  async listExchangeHoldings(options?: BffRequestOptions): Promise<{ readonly items: readonly unknown[] }> {
    return this.request('GET', '/api/v1/exchange/holdings', undefined, options);
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
