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
  GrowRisk,
  GrowGoal,
  GrowGoalCreateInput,
  GrowInsight,
  GrowProfile,
  GrowSnapshot,
  GrowSuitability,
  GrowOpportunityFeed,
  GrowProposalReceipt,
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

  async approvePayment(
    id: string,
    input: { readonly approvalId?: string } = {},
    options?: BffRequestOptions,
  ): Promise<Payment> {
    return this.request('POST', `/api/v1/payments/${encodeURIComponent(id)}/approve`, input, options);
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

  async getGrowSnapshot(options?: BffRequestOptions): Promise<GrowSnapshot> {
    return this.request('GET', '/api/v1/grow/snapshot', undefined, options);
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

  async listGrowOpportunities(options?: BffRequestOptions): Promise<GrowOpportunityFeed> {
    return this.request('GET', '/api/v1/grow/opportunities', undefined, options);
  }

  async getGrowOpportunity(id: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('GET', `/api/v1/grow/opportunities/${encodeURIComponent(id)}`, undefined, options);
  }

  async dismissGrowOpportunity(id: string, options?: BffRequestOptions): Promise<unknown> {
    return this.request('POST', `/api/v1/grow/opportunities/${encodeURIComponent(id)}/dismiss`, {}, options);
  }

  async startGrowProposal(id: string, options?: BffRequestOptions): Promise<GrowProposalReceipt> {
    return this.request('POST', `/api/v1/grow/opportunities/${encodeURIComponent(id)}/start-proposal`, {}, options);
  }

  async getGrowProfile(options?: BffRequestOptions): Promise<GrowProfile> {
    return this.request('GET', '/api/v1/grow/profile', undefined, options);
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
