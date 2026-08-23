import { randomUUID } from 'node:crypto';

import {
  ACCOUNT_RESTRICTION_CODES,
  APPROVAL_REQUIREMENTS,
  CLIENT_RESOURCE_STATES,
  CONSUMER_ACCOUNT_TYPES,
  CONSUMER_ACTION_STATUSES,
  CONSUMER_ASSET_TYPES,
  CARD_STATUSES,
  CARD_WALLET_STATUSES,
  CONSUMER_TRANSACTION_STATUSES,
  FINANCIAL_ACCOUNT_LIFECYCLES,
  FINANCIAL_PRODUCT_TYPES,
  PRODUCT_AVAILABILITIES,
  PROVIDER_AVAILABILITIES,
  GROW_OPPORTUNITY_STATUSES,
  GROW_OPPORTUNITY_CATEGORIES,
  RISK_DISPLAY_LEVELS,
  IDENTITY_VERIFICATION_CLIENT_STATES,
  VERIFICATION_DISPLAY_STATES,
} from './types.ts';
import { PAYMENT_LIFECYCLE_STATUSES } from '../../../../packages/payments/src/platform/lifecycle.ts';
import { bffError, isBffError, statusForError, type BffErrorEnvelope } from './errors.ts';
import { pageSizeOf } from './pagination.ts';
import { cachePolicyForPath } from './cache.ts';
import { CONSUMER_RESOURCE_CATALOG } from './resources.ts';
import type { ConsumerBff } from './orchestrator.ts';
import { resolvePrincipal, type SessionDirectory } from './session.ts';
import { listSandboxPersonas } from './fixtures.ts';
import type { IdentityService } from '../../../../packages/identity/src/service.ts';
import type { PaymentPlatform } from '../../../../packages/payments/src/platform/orchestrator.ts';
import { listPayments, listRecipients, mapPaymentOutcome } from './payments.ts';
import { dispatchAgent, type AgentBffFacade } from './agent-dispatch.ts';
import { createCanonicalToolRegistry } from '../../../../packages/sunrey-agent/src/tools/catalog.ts';
import {
  agentError,
  clientAgent,
  clientConversation,
  clientMemory,
  formatAgentSse,
} from './agent.ts';
import type { AgentConversationRuntime } from '../../../../packages/sunrey-agent/src/runtime.ts';
import { agentConversationReply, FORBIDDEN_PUBLIC_LLM_PATHS } from './agent-conversation.ts';
import type { GrowBffSurface } from './grow.ts';
import {
  actorFromPrincipal,
  growCatalog,
  mapGrowFailure,
  parseCreatePlan,
  toLovableExperience,
} from './grow.ts';
import type { ProductGrowthService } from '../../../../packages/platform/src/growth/product/index.ts';
import { AgentConversationSurface } from './conversation.ts';
import { CONVERSATION_INTENTS, ACTION_CARD_STATUSES, ACTION_CARD_TYPES, ACTION_CENTER_VIEWS, AVAILABLE_ACTION_CONTROLS } from '../../../../packages/sunrey-agent/src/conversation/taxonomy.ts';

export type BffRequest = {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly authorization: string | undefined;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly accept?: string;
};

export type BffResponse = {
  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;
  readonly eventStream?: string;
};

export type ConsumerBffRuntime = {
  readonly bff: ConsumerBff;
  readonly sessions: SessionDirectory;
  readonly identity?: IdentityService;
  readonly ingestCardWebhook?: (body: unknown, requestId: string) => unknown;
  readonly payments?: PaymentPlatform;
  readonly agent?: AgentBffFacade;
  readonly agentRuntime?: AgentConversationRuntime;
  readonly grow?: ProductGrowthService;
  readonly growSurface?: GrowBffSurface;
  readonly conversation?: AgentConversationSurface;
};

const STUB_GROUPS = [
  'payments',
  'recipients',
  'fx',
  'cards',
  'grow',
  'goals',
  'portfolio',
  'agent',
  'exchange',
  'wallets',
  'data',
  'security',
  'notifications',
] as const;

export function handleConsumerBff(runtime: ConsumerBffRuntime, request: BffRequest): BffResponse {
  const requestId = request.requestId ?? `req_${randomUUID()}`;
  const headers = {
    'cache-control': cachePolicyForPath(request.path).cacheControl,
    vary: 'Authorization',
    'x-sunrey-api-version': 'v1',
    'x-sunrey-surface': 'CONSUMER_BFF',
    'x-sunrey-environment': 'simulation',
  };

  if (request.path === '/api/v1/webhooks/cards' && request.method === 'POST') {
    if (!runtime.ingestCardWebhook) {
      return json(
        503,
        bffError({
          errorCode: 'FEATURE_UNAVAILABLE',
          category: 'TEMPORARY_UNAVAILABLE',
          message: 'card webhook ingestion is not connected',
          retryable: true,
          requestId,
        }),
        headers,
      );
    }
    return json(200, runtime.ingestCardWebhook(request.body, requestId), headers);
  }
  if (request.path === '/api/v1/sandbox/personas' && request.method === 'GET') {
    return json(200, { label: 'SANDBOX_FIXTURE_NON_PRODUCTION', production: false, items: listSandboxPersonas() }, headers);
  }

  if (request.path === '/api/v1/catalog/resources' && request.method === 'GET') {
    return json(200, { items: CONSUMER_RESOURCE_CATALOG }, headers);
  }
  if (request.path === '/api/v1/catalog/enums' && request.method === 'GET') {
    return json(
      200,
      {
        cardStatus: CARD_STATUSES,
        cardWalletStatus: CARD_WALLET_STATUSES,
        transactionStatus: CONSUMER_TRANSACTION_STATUSES,
        actionStatus: CONSUMER_ACTION_STATUSES,
        accountLifecycle: FINANCIAL_ACCOUNT_LIFECYCLES,
        accountProductType: FINANCIAL_PRODUCT_TYPES,
        accountRestriction: ACCOUNT_RESTRICTION_CODES,
        accountType: CONSUMER_ACCOUNT_TYPES,
        assetType: CONSUMER_ASSET_TYPES,
        riskDisplay: RISK_DISPLAY_LEVELS,
        approvalRequirement: APPROVAL_REQUIREMENTS,
        verificationState: VERIFICATION_DISPLAY_STATES,
        identityVerification: IDENTITY_VERIFICATION_CLIENT_STATES,
        providerAvailability: PROVIDER_AVAILABILITIES,
        productAvailability: PRODUCT_AVAILABILITIES,
        clientResourceState: CLIENT_RESOURCE_STATES,
        paymentStatus: PAYMENT_LIFECYCLE_STATUSES,
        growPlanStatus: [
          'DRAFT',
          'PROPOSED',
          'ACTIVE',
          'PAUSED',
          'SUPERSEDED',
          'COMPLETED',
          'CANCELLED',
        ],
        growProposalStatus: [
          'DRAFT',
          'READY',
          'PRESENTED',
          'AWAITING_APPROVAL',
          'AWAITING_STEP_UP',
          'AWAITING_COMPLIANCE',
          'APPROVED',
          'EXECUTING',
          'EXECUTED',
          'REJECTED',
          'EXPIRED',
          'FAILED',
          'CANCELLED',
          'SUPERSEDED',
        ],
        growRiskProfile: ['CONSERVATIVE', 'BALANCED', 'GROWTH'],
        growScenario: ['CONSERVATIVE', 'BASE', 'UPSIDE'],
        growOpportunityStatus: GROW_OPPORTUNITY_STATUSES,
        growOpportunityCategory: GROW_OPPORTUNITY_CATEGORIES,
        conversationIntent: CONVERSATION_INTENTS,
        actionCardType: ACTION_CARD_TYPES,
        actionCardStatus: ACTION_CARD_STATUSES,
        actionCenterView: ACTION_CENTER_VIEWS,
        availableActionControl: AVAILABLE_ACTION_CONTROLS,
      },
      headers,
    );
  }

  const principal = resolvePrincipal({
    authorization: request.authorization,
    requestId,
    directory: runtime.sessions,
    ...(runtime.identity ? { identity: runtime.identity } : {}),
  });
  if (isBffError(principal)) {
    return json(statusForError(principal), principal, headers);
  }

  try {
    return dispatchAuthenticated(runtime, request, principal, requestId, headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'request failed';
    return json(
      500,
      bffError({
        errorCode: 'MALFORMED',
        category: 'INTERNAL',
        message,
        retryable: true,
        requestId,
      }),
      headers,
    );
  }
}

function dispatchAuthenticated(
  runtime: ConsumerBffRuntime,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse {
  const { method, path, query, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};

  if (path === '/api/v1/me' && method === 'GET') {
    return json(200, runtime.bff.profile(principal), headers);
  }
  if (path === '/api/v1/me' && method === 'PATCH') {
    return result(runtime.bff.patchProfile(principal, rec, requestId), headers);
  }
  if (path === '/api/v1/me/home' && method === 'GET') {
    return result(runtime.bff.home(principal, requestId, query.valuationCurrency ?? query.valuation_currency ?? 'USD'), headers);
  }
  if (path === '/api/v1/me/bootstrap' && method === 'GET') {
    return json(200, runtime.bff.bootstrap(principal), headers);
  }
  if (path === '/api/v1/me/capabilities' && method === 'GET') {
    return json(200, runtime.bff.capabilities(principal), headers);
  }
  if (path === '/api/v1/accounts' && method === 'GET') {
    return json(200, runtime.bff.listAccounts(principal), headers);
  }
  if (path.startsWith('/api/v1/accounts/') && path.endsWith('/activity') && method === 'GET') {
    const id = path.slice('/api/v1/accounts/'.length, -'/activity'.length);
    return result(runtime.bff.accountActivity(principal, id, requestId, query.cursor, pageSizeOf(query.pageSize ?? query.page_size), query), headers);
  }
  if (path.startsWith('/api/v1/accounts/') && path.endsWith('/statement') && method === 'GET') {
    const id = path.slice('/api/v1/accounts/'.length, -'/statement'.length);
    return result(runtime.bff.accountStatement(principal, id, requestId, query.periodStart ?? query.from, query.periodEnd ?? query.to), headers);
  }
  if (path.startsWith('/api/v1/accounts/') && method === 'GET') {
    const id = path.slice('/api/v1/accounts/'.length);
    return result(runtime.bff.getAccount(principal, id, requestId), headers);
  }
  if (path === '/api/v1/cards' && method === 'POST') {
    return result(runtime.bff.issueCard(principal, rec, requestId), headers, 201);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/freeze') && method === 'POST') {
    const id = path.slice('/api/v1/cards/'.length, -'/freeze'.length);
    return result(runtime.bff.freezeCard(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/unfreeze') && method === 'POST') {
    const id = path.slice('/api/v1/cards/'.length, -'/unfreeze'.length);
    return result(runtime.bff.unfreezeCard(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/controls') && method === 'PATCH') {
    const id = path.slice('/api/v1/cards/'.length, -'/controls'.length);
    return result(runtime.bff.patchCardControls(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && path.endsWith('/wallet') && method === 'GET') {
    const id = path.slice('/api/v1/cards/'.length, -'/wallet'.length);
    return result(runtime.bff.cardWallet(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/cards/') && method === 'GET') {
    const id = path.slice('/api/v1/cards/'.length);
    return result(runtime.bff.getCard(principal, id, requestId), headers);
  }
  if (path === '/api/v1/fx/currencies' && method === 'GET') {
    return json(200, runtime.bff.listFxCurrencies(), headers);
  }
  if (path === '/api/v1/fx/valuation' && method === 'GET') {
    return json(200, runtime.bff.valuation(principal, query.targetCurrency ?? query.target ?? 'USD'), headers);
  }
  if (path === '/api/v1/fx/quotes' && method === 'POST') {
    return result(runtime.bff.createFxQuote(principal, rec, requestId), headers, 201);
  }
  if (path.startsWith('/api/v1/fx/quotes/') && path.endsWith('/accept') && method === 'POST') {
    const id = path.slice('/api/v1/fx/quotes/'.length, -'/accept'.length);
    return result(runtime.bff.acceptFxQuote(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/fx/quotes/') && path.endsWith('/execute') && method === 'POST') {
    const id = path.slice('/api/v1/fx/quotes/'.length, -'/execute'.length);
    return result(runtime.bff.executeFxQuote(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/fx/quotes/') && method === 'GET') {
    const id = path.slice('/api/v1/fx/quotes/'.length);
    return result(runtime.bff.getFxQuote(principal, id, requestId), headers);
  }
  if (runtime.agentRuntime) {
    const agents = dispatchAgents(runtime.agentRuntime, request, principal, requestId, headers);
    if (agents) {
      return agents;
    }
  }
  if (runtime.payments) {
    const payments = dispatchPayments(runtime.payments, request, principal, requestId, headers);
    if (payments) {
      return payments;
    }
  } else if (
    (path === '/api/v1/payments' || path === '/api/v1/recipients') &&
    method !== 'GET'
  ) {
    return json(
      405,
      bffError({
        errorCode: 'METHOD_NOT_ALLOWED',
        category: 'VALIDATION',
        message: 'payment platform is not attached to this runtime',
        retryable: false,
        requestId,
      }),
      headers,
    );
  }

  if (runtime.conversation) {
    const conversation = dispatchConversation(runtime.conversation, request, principal, requestId, headers);
    if (conversation) {
      return conversation;
    }
  }
  if (runtime.agent) {
    const agent = dispatchAgent(runtime.agent, request, principal, requestId, headers);
    if (agent) {
      return agent;
    }
  }
  if ((FORBIDDEN_PUBLIC_LLM_PATHS as readonly string[]).includes(path)) {
    return json(
      404,
      bffError({
        errorCode: 'NOT_FOUND',
        category: 'NOT_FOUND',
        message: 'raw LLM inference is not a public consumer endpoint; use Agent conversation routes',
        retryable: false,
        requestId,
      }),
      headers,
    );
  }

  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/messages') && method === 'POST') {
    const conversationId = path.slice('/api/v1/agent/conversations/'.length, -'/messages'.length);
    const text = typeof rec.text === 'string' ? rec.text : typeof rec.message === 'string' ? rec.message : '';
    const reply = agentConversationReply({ conversationId, requestId, text });
    if ((request.accept ?? '').includes('text/event-stream')) {
      return Object.freeze({
        status: 200,
        body: reply.sse,
        headers: Object.freeze({
          ...headers,
          'cache-control': 'no-store, no-cache, private',
          'content-type': 'text/event-stream; charset=utf-8',
        }),
      });
    }
    return json(200, reply, { ...headers, 'cache-control': 'no-store, no-cache, private' });
  }
  if (runtime.grow) {
    const grow = dispatchGrowProduct(runtime.grow, request, principal, requestId, headers);
    if (grow) {
      return grow;
    }
  }
  if (runtime.growSurface) {
    const grow = dispatchGrowSurface(runtime.growSurface, request, principal, requestId, headers);
    if (grow) {
      return grow;
    }
  }
  if (path === '/api/v1/grow/portfolio' && method === 'GET') {
    return result(runtime.bff.growPortfolio(principal, requestId), headers);
  }
  if (path === '/api/v1/grow/portfolio/holdings' && method === 'GET') {
    return result(runtime.bff.growHoldings(principal, requestId), headers);
  }
  if (path === '/api/v1/grow/portfolio/performance' && method === 'GET') {
    return result(runtime.bff.growPerformance(principal, requestId), headers);
  }
  if (path === '/api/v1/grow/portfolio/allocation' && method === 'GET') {
    return result(runtime.bff.growAllocation(principal, requestId), headers);
  }
  if (path === '/api/v1/grow/portfolio/risk' && method === 'GET') {
    return result(runtime.bff.growRisk(principal, requestId), headers);
  }
  if ((path === '/api/v1/grow' || path === '/api/v1/grow/opportunities') && method === 'GET') {
    return result(runtime.bff.listGrowOpportunities(principal), headers);
  }
  if (path.startsWith('/api/v1/grow/opportunities/') && path.endsWith('/dismiss') && method === 'POST') {
    const id = path.slice('/api/v1/grow/opportunities/'.length, -'/dismiss'.length);
    return result(runtime.bff.dismissGrowOpportunity(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/grow/opportunities/') && path.endsWith('/start-proposal') && method === 'POST') {
    const id = path.slice('/api/v1/grow/opportunities/'.length, -'/start-proposal'.length);
    return result(runtime.bff.startGrowProposal(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/grow/opportunities/') && method === 'GET') {
    const id = path.slice('/api/v1/grow/opportunities/'.length);
    return result(runtime.bff.getGrowOpportunity(principal, id, requestId), headers);
  }
  if (path === '/api/v1/grow/profile' && method === 'GET') {
    return result(runtime.bff.growProfile(principal, query.valuationCurrency ?? query.valuation_currency), headers);
  }
  if (path === '/api/v1/grow/snapshot' && method === 'GET') {
    return result(runtime.bff.growSnapshot(principal, query.valuationCurrency ?? query.valuation_currency), headers);
  }
  if (path === '/api/v1/grow/goals' && method === 'GET') {
    return result(runtime.bff.growGoals(principal), headers);
  }
  if (path === '/api/v1/grow/goals' && method === 'POST') {
    return result(runtime.bff.createGrowGoal(principal, rec, requestId), headers, 201);
  }
  if (path.startsWith('/api/v1/grow/goals/') && method === 'PATCH') {
    const id = path.slice('/api/v1/grow/goals/'.length);
    return result(runtime.bff.patchGrowGoal(principal, id, rec, requestId), headers);
  }
  if (path === '/api/v1/grow/insights' && method === 'GET') {
    return result(runtime.bff.growInsights(principal), headers);
  }
  if (path === '/api/v1/grow/suitability' && method === 'GET') {
    return result(runtime.bff.growSuitability(principal), headers);
  }
  if (path === '/api/v1/grow/suitability' && method === 'POST') {
    return result(runtime.bff.submitGrowSuitability(principal, rec, requestId), headers, 201);
  }
  if (path === '/api/v1/grow/assumptions' && method === 'POST') {
    return result(runtime.bff.declareGrowAssumption(principal, rec, requestId), headers, 201);
  }
  if (path === '/api/v1/grow/classifications' && method === 'POST') {
    return result(runtime.bff.correctGrowClassification(principal, rec, requestId), headers);
  }
  if (path === '/api/v1/grow/history' && method === 'GET') {
    return result(runtime.bff.growHistory(principal, query.series), headers);
  }
  if (path === '/api/v1/grow/agent' && method === 'GET') {
    return result(runtime.bff.growAgentProfile(principal), headers);
  }

  if (path === '/api/v1/agent/tools' && method === 'GET') {
    const tools = createCanonicalToolRegistry().list().map((tool) => ({
      toolId: tool.toolId,
      version: tool.version,
      description: tool.description,
      category: tool.category,
      riskClass: tool.riskClass,
      readOnly: tool.readOnly,
      createsProposal: tool.createsProposal,
      requiresUserApproval: tool.requiresUserApproval,
      requiredMandate: tool.requiredMandate,
      domainDependency: tool.domainDependency,
      frontendMayInvokeDirectly: false,
    }));
    return json(
      200,
      {
        tools,
        invocationPath: 'Lovable → Agent message API → Agent Runtime → Tool Runtime',
        privilegedInvokeForbidden: true,
        productionEnabled: false,
      },
      headers,
    );
  }

  if (path === '/api/v1/me/actions' && method === 'GET') {
    const home = runtime.bff.home(principal, requestId);
    if (isBffError(home)) {
      return json(statusForError(home), home, headers);
    }
    return json(200, home.pendingApprovals, headers);
  }

  for (const group of STUB_GROUPS) {
    if (path === `/api/v1/${group}` && method === 'GET') {
      return json(200, runtime.bff.featureStub(group, principal), headers);
    }
  }

  if (method !== 'GET' && method !== 'PATCH') {
    return json(
      405,
      bffError({
        errorCode: 'METHOD_NOT_ALLOWED',
        category: 'VALIDATION',
        message: 'method is not allowed on this consumer resource',
        retryable: false,
        requestId,
      }),
      headers,
    );
  }

  return json(
    404,
    bffError({
      errorCode: 'NOT_FOUND',
      category: 'NOT_FOUND',
      message: 'consumer resource not found',
      retryable: false,
      requestId,
    }),
    headers,
  );
}

function dispatchAgents(
  runtime: AgentConversationRuntime,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse | null {
  const { method, path, query, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const ownerId = principal.customerId;

  if (path === '/api/v1/agents' && method === 'GET') {
    return json(200, { items: runtime.listAgents(ownerId).map(clientAgent) }, headers);
  }
  const agentMatch = /^\/api\/v1\/agents\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (!agentMatch) {
    return null;
  }
  const agentId = decodeURIComponent(agentMatch[1] ?? '');
  const rest = agentMatch[2] ?? '';

  if (rest === '' && method === 'GET') {
    const owned = runtime.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return result(agentError(owned.error, requestId), headers);
    }
    return json(200, clientAgent(owned.value), headers);
  }
  if (rest === 'pause' && method === 'POST') {
    const owned = runtime.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return result(agentError(owned.error, requestId), headers);
    }
    const paused = runtime.engine.pauseAgent({ agentId, actorId: principal.actorId });
    return paused.ok ? json(200, clientAgent(paused.value), headers) : result(agentError(paused.error, requestId), headers);
  }
  if (rest === 'revoke' && method === 'POST') {
    const owned = runtime.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return result(agentError(owned.error, requestId), headers);
    }
    const revoked = runtime.engine.revokeAgent({ agentId, actorId: principal.actorId });
    return revoked.ok ? json(200, clientAgent(revoked.value), headers) : result(agentError(revoked.error, requestId), headers);
  }
  if (rest === 'settings' && method === 'GET') {
    const owned = runtime.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return result(agentError(owned.error, requestId), headers);
    }
    return json(200, runtime.personalizationOf(ownerId, owned.value), headers);
  }
  if (rest === 'settings' && method === 'PATCH') {
    const patched = runtime.setPersonalization({
      ownerId,
      agentId,
      ...(typeof rec.verbosity === 'string' ? { verbosity: rec.verbosity as never } : {}),
      ...(typeof rec.displayCurrency === 'string' ? { displayCurrency: rec.displayCurrency } : {}),
      ...(typeof rec.language === 'string' ? { language: rec.language } : {}),
      ...(typeof rec.explanationComplexity === 'string' ? { explanationComplexity: rec.explanationComplexity as never } : {}),
      ...(typeof rec.personalizationMemoryEnabled === 'boolean'
        ? { personalizationMemoryEnabled: rec.personalizationMemoryEnabled }
        : {}),
    });
    return patched.ok ? json(200, patched.value, headers) : result(agentError(patched.error, requestId), headers);
  }
  if (rest === 'permissions' && method === 'GET') {
    const owned = runtime.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return result(agentError(owned.error, requestId), headers);
    }
    const mandate = owned.value.mandateId ? runtime.engine.getMandate(owned.value.mandateId) : undefined;
    return json(
      200,
      {
        agentId,
        assistScopes: mandate?.assistScopes ?? [],
        actionClasses: mandate?.permissions.actionClasses ?? [],
        budget: mandate
          ? {
              perTransaction: mandate.budget.perTransaction.toString(),
              perPeriod: mandate.budget.perPeriod.toString(),
              maxProposalAmount: mandate.budget.maxProposalAmount?.toString() ?? null,
            }
          : null,
        executionPrivileges: Object.freeze([]),
      },
      headers,
    );
  }
  if (rest === 'memories' && method === 'GET') {
    const listed = runtime.listMemories(ownerId, agentId);
    return listed.ok ? json(200, { items: listed.value.map(clientMemory) }, headers) : result(agentError(listed.error, requestId), headers);
  }
  if (rest === 'memories' && method === 'POST') {
    const created = runtime.createMemory({
      ownerId,
      agentId,
      actorId: principal.actorId,
      category: (typeof rec.category === 'string' ? rec.category : 'USER_PREFERENCE') as never,
      content: typeof rec.content === 'string' ? rec.content : '',
      source: (typeof rec.source === 'string' ? rec.source : 'USER_DECLARED') as never,
    });
    return created.ok ? json(201, clientMemory(created.value), headers) : result(agentError(created.error, requestId), headers);
  }
  const memoryMatch = /^memories\/([^/]+)$/.exec(rest);
  if (memoryMatch && method === 'PATCH') {
    const corrected = runtime.correctMemory({
      ownerId,
      agentId,
      memoryId: decodeURIComponent(memoryMatch[1] ?? ''),
      content: typeof rec.content === 'string' ? rec.content : '',
      actorId: principal.actorId,
    });
    return corrected.ok ? json(200, clientMemory(corrected.value), headers) : result(agentError(corrected.error, requestId), headers);
  }
  if (memoryMatch && method === 'DELETE') {
    const deleted = runtime.deleteMemory({
      ownerId,
      agentId,
      memoryId: decodeURIComponent(memoryMatch[1] ?? ''),
      actorId: principal.actorId,
    });
    return deleted.ok ? json(200, { deleted: true }, headers) : result(agentError(deleted.error, requestId), headers);
  }
  if (rest === 'conversations' && method === 'GET') {
    const listed = runtime.listConversations(ownerId, agentId);
    return listed.ok ? json(200, { items: listed.value.map(clientConversation) }, headers) : result(agentError(listed.error, requestId), headers);
  }
  if (rest === 'conversations' && method === 'POST') {
    const created = runtime.createConversation({
      ownerId,
      agentId,
      ...(typeof rec.title === 'string' ? { title: rec.title } : {}),
    });
    return created.ok ? json(201, clientConversation(created.value), headers) : result(agentError(created.error, requestId), headers);
  }
  const conversationMatch = /^conversations\/([^/]+)(?:\/(.*))?$/.exec(rest);
  if (!conversationMatch) {
    return null;
  }
  const conversationId = decodeURIComponent(conversationMatch[1] ?? '');
  const conversationRest = conversationMatch[2] ?? '';
  if (conversationRest === '' && method === 'GET') {
    const found = runtime.getConversation(ownerId, agentId, conversationId);
    if (!found.ok) {
      return result(agentError(found.error, requestId), headers);
    }
    const messages = runtime.engine.store.messagesForConversation(conversationId);
    return json(200, { ...clientConversation(found.value), messages }, headers);
  }
  if (conversationRest === 'messages' && method === 'POST') {
    const text = typeof rec.text === 'string' ? rec.text : typeof rec.content === 'string' ? rec.content : '';
    const posted = runtime.postMessage({
      ownerId,
      agentId,
      conversationId,
      text,
      actorId: principal.actorId,
    });
    if (!posted.ok) {
      return result(agentError(posted.error, requestId), headers);
    }
    const stream = query.stream === '1' || query.stream === 'true';
    const payload = {
      conversationId,
      userMessage: posted.value.userMessage,
      agentMessage: posted.value.agentMessage,
      stream: posted.value.chunks,
      financialStateChanged: false,
      executionCompleted: false,
    };
    if (stream) {
      return Object.freeze({
        status: 200,
        body: payload,
        headers: Object.freeze({
          ...headers,
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        }),
        eventStream: formatAgentSse(posted.value.chunks),
      });
    }
    return json(200, payload, headers);
  }
  return null;
}

function dispatchPayments(
  platform: PaymentPlatform,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse | null {
  const { method, path, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const idempotencyKey =
    request.idempotencyKey ??
    (typeof rec.idempotencyKey === 'string' ? rec.idempotencyKey : `idem_${requestId}`);

  if (path === '/api/v1/recipients' && method === 'GET') {
    return json(200, listRecipients(platform, principal), headers);
  }
  if (path === '/api/v1/recipients' && method === 'POST') {
    const created = platform.createRecipient({
      actorId: principal.actorId,
      ownerId: principal.customerId,
      accountId: str(rec.accountId) ?? str(rec.sourceAccountId) ?? '',
      kind: rec.kind === 'BUSINESS' ? 'BUSINESS' : 'PERSON',
      destinationCountry: str(rec.country) ?? str(rec.destinationCountry) ?? principal.jurisdiction,
      currency: str(rec.currency) ?? 'USD',
      legalName: str(rec.displayName) ?? str(rec.legalName) ?? '',
      accountCoordinate: {
        scheme: str(rec.scheme) ?? (rec.destinationType === 'SUNREY_USER' ? 'SUNREY_ACCOUNT' : 'IBAN'),
        value: str(rec.destinationAccountId) ?? str(rec.accountNumber) ?? str(rec.value) ?? '',
      },
      ...(typeof rec.relationship === 'string' ? { relationship: rec.relationship } : {}),
      ...(typeof rec.purpose === 'string' ? { purpose: rec.purpose } : {}),
      clientBody: rec,
      idempotencyKey,
      ...(typeof rec.id === 'string' ? { beneficiaryId: rec.id } : {}),
    });
    const mapped = mapPaymentOutcome(created, requestId);
    return result(mapped, headers);
  }
  if (path.startsWith('/api/v1/recipients/') && method === 'GET') {
    const id = path.slice('/api/v1/recipients/'.length);
    return result(mapPaymentOutcome(platform.getRecipient(principal.customerId, id), requestId), headers);
  }
  if (path === '/api/v1/payments/quote' && method === 'POST') {
    const quoted = platform.quote({
      actorId: principal.actorId,
      ownerId: principal.customerId,
      sourceAccountId: str(rec.sourceAccountId) ?? str(rec.accountId) ?? '',
      ...(typeof rec.beneficiaryId === 'string' ? { beneficiaryId: rec.beneficiaryId } : {}),
      ...(typeof rec.destinationAccountId === 'string' ? { destinationAccountId: rec.destinationAccountId } : {}),
      amountMinorUnits: str(rec.amountMinorUnits) ?? '0',
      currency: str(rec.currency) ?? 'USD',
      ...(typeof rec.railPreference === 'string' ? { railPreference: rec.railPreference as never } : {}),
      ...(typeof rec.purpose === 'string' ? { purpose: rec.purpose } : {}),
    });
    return result(mapPaymentOutcome(quoted, requestId), headers);
  }
  if (path === '/api/v1/payments' && method === 'GET') {
    return json(200, listPayments(platform, principal), headers);
  }
  if (path === '/api/v1/payments' && method === 'POST') {
    const created = platform.createPayment({
      actorId: principal.actorId,
      ownerId: principal.customerId,
      sourceAccountId: str(rec.sourceAccountId) ?? str(rec.accountId) ?? '',
      ...(typeof rec.beneficiaryId === 'string' ? { beneficiaryId: rec.beneficiaryId } : {}),
      ...(typeof rec.destinationAccountId === 'string' ? { destinationAccountId: rec.destinationAccountId } : {}),
      amountMinorUnits: str(rec.amountMinorUnits) ?? '0',
      currency: str(rec.currency) ?? 'USD',
      ...(typeof rec.quoteId === 'string' ? { quoteId: rec.quoteId } : {}),
      ...(typeof rec.purpose === 'string' ? { purpose: rec.purpose } : {}),
      ...(typeof rec.reference === 'string' ? { reference: rec.reference } : {}),
      idempotencyKey,
      ...(typeof rec.paymentId === 'string' ? { paymentId: rec.paymentId } : {}),
      ...(rec.approveNow === true ? { approveNow: true } : {}),
      ...(rec.stepUpSatisfied === true ? { stepUpSatisfied: true } : {}),
    });
    return result(mapPaymentOutcome(created, requestId), headers);
  }
  if (path.startsWith('/api/v1/payments/') && path.endsWith('/approve') && method === 'POST') {
    const id = path.slice('/api/v1/payments/'.length, -'/approve'.length);
    return result(
      mapPaymentOutcome(
        platform.approvePayment({
          actorId: principal.actorId,
          ownerId: principal.customerId,
          paymentId: id,
          ...(typeof rec.approvalId === 'string' ? { approvalId: rec.approvalId } : {}),
        }),
        requestId,
      ),
      headers,
    );
  }
  if (path.startsWith('/api/v1/payments/') && method === 'GET') {
    const id = path.slice('/api/v1/payments/'.length);
    return result(mapPaymentOutcome(platform.getPayment(principal.customerId, id), requestId), headers);
  }
  return null;
}

function dispatchGrowSurface(
  grow: GrowBffSurface,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse | null {
  const { method, path, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (path === '/api/v1/grow' && method === 'GET') return result(grow.home(principal, requestId), headers);
  if (path === '/api/v1/grow/snapshot' && method === 'GET') return result(grow.snapshot(principal, requestId), headers);
  if (path === '/api/v1/grow/goals' && method === 'GET') return result(grow.goals(principal, requestId), headers);
  if (path === '/api/v1/grow/goals' && method === 'POST') return result(grow.createGoal(principal, rec, requestId), headers, 201);
  if (path === '/api/v1/goals' && method === 'GET') return result(grow.goals(principal, requestId), headers);
  if (path === '/api/v1/grow/opportunities' && method === 'GET') return result(grow.opportunities(principal, requestId), headers);
  if (path.startsWith('/api/v1/grow/opportunities/') && path.endsWith('/dismiss') && method === 'POST') {
    const id = path.slice('/api/v1/grow/opportunities/'.length, -'/dismiss'.length);
    return result(grow.dismissOpportunity(principal, id, requestId), headers);
  }
  if (path === '/api/v1/grow/plan' && method === 'GET') return result(grow.plan(principal, requestId), headers);
  if (path === '/api/v1/grow/plan/request' && method === 'POST') return result(grow.requestNewPlan(principal, requestId), headers);
  if (path === '/api/v1/grow/plan/pause' && method === 'POST') return result(grow.pause(principal, requestId), headers);
  if (path === '/api/v1/grow/plan/resume' && method === 'POST') return result(grow.resume(principal, requestId), headers);
  if (path === '/api/v1/grow/plan/progress' && method === 'GET') return result(grow.planProgress(principal, requestId), headers);
  if (path === '/api/v1/grow/scenarios' && method === 'GET') return result(grow.scenarios(principal, requestId), headers);
  if (path === '/api/v1/grow/proposals' && method === 'POST') return result(grow.createProposal(principal, rec, requestId), headers, 201);
  if (path.startsWith('/api/v1/grow/proposals/') && path.endsWith('/modify') && method === 'POST') {
    const id = path.slice('/api/v1/grow/proposals/'.length, -'/modify'.length);
    return result(grow.modifyProposal(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/grow/proposals/') && path.endsWith('/approve') && method === 'POST') {
    const id = path.slice('/api/v1/grow/proposals/'.length, -'/approve'.length);
    return result(grow.approveProposal(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/grow/proposals/') && path.endsWith('/execute') && method === 'POST') {
    const id = path.slice('/api/v1/grow/proposals/'.length, -'/execute'.length);
    return result(grow.executeProposal(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/grow/proposals/') && method === 'GET') {
    return result(grow.getProposal(principal, path.slice('/api/v1/grow/proposals/'.length), requestId), headers);
  }
  if (path.startsWith('/api/v1/grow/executions/') && method === 'GET') {
    return result(grow.executionStatus(principal, path.slice('/api/v1/grow/executions/'.length), requestId), headers);
  }
  if (path === '/api/v1/grow/portfolio' && method === 'GET') return result(grow.portfolio(principal, requestId), headers);
  if (path === '/api/v1/portfolio' && method === 'GET') return result(grow.portfolio(principal, requestId), headers);
  if (path === '/api/v1/grow/performance' && method === 'GET') return result(grow.performance(principal, requestId), headers);
  if (path === '/api/v1/grow/recurring' && method === 'POST') return result(grow.createRecurring(principal, rec, requestId), headers, 201);
  if (path.startsWith('/api/v1/grow/recurring/') && path.endsWith('/cancel') && method === 'POST') {
    const id = path.slice('/api/v1/grow/recurring/'.length, -'/cancel'.length);
    return result(grow.cancelRecurring(principal, id, requestId), headers);
  }
  if (path === '/api/v1/grow/monitor' && method === 'POST') return json(200, grow.monitor(principal), headers);
  if (path === '/api/v1/grow/agent-tools' && method === 'POST') return result(grow.invokeAgentTool(principal, rec, requestId), headers);
  return null;
}

function dispatchGrowProduct(
  grow: ProductGrowthService,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse | null {
  const { method, path, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const actor = actorFromPrincipal(principal);

  if (path === '/api/v1/grow' && method === 'GET') {
    return json(200, growCatalog(grow, principal, requestId), headers);
  }
  if (path === '/api/v1/grow/plans' && method === 'POST') {
    const parsed = parseCreatePlan(principal, rec);
    if (isBffError(parsed)) {
      return json(statusForError(parsed), { ...parsed, requestId }, headers);
    }
    const created = grow.createPlan(actor, parsed);
    if (!created.ok) {
      return json(statusForError(mapGrowFailure(created.error, requestId)), mapGrowFailure(created.error, requestId), headers);
    }
    const proposal = grow.createProposal(actor, { planId: created.value.planId });
    return json(
      201,
      {
        ...created.value,
        primaryProposal: proposal.ok ? proposal.value : null,
        experience: toLovableExperience(created.value),
      },
      headers,
    );
  }
  if (path === '/api/v1/grow/plans' && method === 'GET') {
    const listed = grow.listPlans(actor, principal.customerId);
    if (!listed.ok) {
      return json(statusForError(mapGrowFailure(listed.error, requestId)), mapGrowFailure(listed.error, requestId), headers);
    }
    return json(200, { items: listed.value, productionActive: false, guaranteedOutcome: false }, headers);
  }
  if (path.startsWith('/api/v1/grow/plans/') && method === 'GET') {
    const id = path.slice('/api/v1/grow/plans/'.length);
    const loaded = grow.getPlan(actor, id);
    if (!loaded.ok) {
      return json(statusForError(mapGrowFailure(loaded.error, requestId)), mapGrowFailure(loaded.error, requestId), headers);
    }
    return json(200, loaded.value, headers);
  }
  if (path === '/api/v1/grow/proposals' && method === 'POST') {
    const planId = typeof rec.planId === 'string' ? rec.planId : '';
    const created = grow.createProposal(actor, {
      planId,
      ...(typeof rec.componentKind === 'string' ? { componentKind: rec.componentKind as never } : {}),
      ...(typeof rec.opportunityId === 'string' ? { opportunityId: rec.opportunityId } : {}),
    });
    if (!created.ok) {
      return json(statusForError(mapGrowFailure(created.error, requestId)), mapGrowFailure(created.error, requestId), headers);
    }
    return json(201, created.value, headers);
  }
  if (path === '/api/v1/grow/proposals' && method === 'GET') {
    const listed = grow.listProposals(actor, principal.customerId, request.query.planId);
    if (!listed.ok) {
      return json(statusForError(mapGrowFailure(listed.error, requestId)), mapGrowFailure(listed.error, requestId), headers);
    }
    return json(200, { items: listed.value, productionActive: false }, headers);
  }
  if (path.startsWith('/api/v1/grow/proposals/') && path.endsWith('/modify') && method === 'POST') {
    const id = path.slice('/api/v1/grow/proposals/'.length, -'/modify'.length);
    const modified = grow.modifyProposal(
      actor,
      id,
      {
        ...(typeof rec.amountMinorUnits === 'string' ? { amountMinorUnits: rec.amountMinorUnits } : {}),
        ...(typeof rec.goalAllocationMinorUnits === 'string'
          ? { goalAllocationMinorUnits: rec.goalAllocationMinorUnits }
          : {}),
        ...(typeof rec.riskProfile === 'string' ? { riskProfile: rec.riskProfile as never } : {}),
      },
      rec,
    );
    if (!modified.ok) {
      return json(statusForError(mapGrowFailure(modified.error, requestId)), mapGrowFailure(modified.error, requestId), headers);
    }
    return json(200, modified.value, headers);
  }
  if (path.startsWith('/api/v1/grow/proposals/') && path.endsWith('/approve') && method === 'POST') {
    const id = path.slice('/api/v1/grow/proposals/'.length, -'/approve'.length);
    const approved = grow.approveProposal(actor, id, {
      ...(rec.stepUpSatisfied === true ? { stepUpSatisfied: true } : {}),
    });
    if (!approved.ok) {
      return json(statusForError(mapGrowFailure(approved.error, requestId)), mapGrowFailure(approved.error, requestId), headers);
    }
    return json(200, approved.value, headers);
  }
  if (path.startsWith('/api/v1/grow/proposals/') && path.endsWith('/reject') && method === 'POST') {
    const id = path.slice('/api/v1/grow/proposals/'.length, -'/reject'.length);
    const rejected = grow.rejectProposal(actor, id);
    if (!rejected.ok) {
      return json(statusForError(mapGrowFailure(rejected.error, requestId)), mapGrowFailure(rejected.error, requestId), headers);
    }
    return json(200, rejected.value, headers);
  }
  if (path.startsWith('/api/v1/grow/proposals/') && method === 'GET') {
    const id = path.slice('/api/v1/grow/proposals/'.length);
    const loaded = grow.getProposal(actor, id);
    if (!loaded.ok) {
      return json(statusForError(mapGrowFailure(loaded.error, requestId)), mapGrowFailure(loaded.error, requestId), headers);
    }
    return json(200, loaded.value, headers);
  }
  return null;
}

function dispatchConversation(
  surface: AgentConversationSurface,
  request: BffRequest,
  principal: import('./ports.ts').BffPrincipal,
  requestId: string,
  headers: Record<string, string>,
): BffResponse | null {
  const { method, path, query, body } = request;
  const rec = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (path === '/api/v1/agent/conversations' && method === 'POST') {
    return result(surface.start(principal, requestId), headers, 201);
  }
  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/messages') && method === 'POST') {
    const id = path.slice('/api/v1/agent/conversations/'.length, -'/messages'.length);
    return result(surface.message(principal, id, typeof rec.text === 'string' ? rec.text : '', requestId), headers);
  }
  if (path.startsWith('/api/v1/agent/conversations/') && path.endsWith('/events') && method === 'GET') {
    const id = path.slice('/api/v1/agent/conversations/'.length, -'/events'.length);
    const after = Number(query.after ?? '0');
    return result(surface.stream(principal, id, Number.isFinite(after) ? after : 0, requestId), headers);
  }
  if (path.startsWith('/api/v1/agent/conversations/') && method === 'GET') {
    const id = path.slice('/api/v1/agent/conversations/'.length);
    return result(surface.getConversation(principal, id, requestId), headers);
  }
  if (path === '/api/v1/agent/actions' && method === 'GET') {
    return result(surface.listActions(principal, query.view, requestId), headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/approve') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/approve'.length);
    return result(surface.approve(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/modify') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/modify'.length);
    return result(surface.modify(principal, id, rec, requestId), headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/reject') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/reject'.length);
    return result(surface.reject(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && path.endsWith('/cancel') && method === 'POST') {
    const id = path.slice('/api/v1/agent/actions/'.length, -'/cancel'.length);
    return result(surface.cancel(principal, id, requestId), headers);
  }
  if (path.startsWith('/api/v1/agent/actions/') && method === 'GET') {
    const id = path.slice('/api/v1/agent/actions/'.length);
    return result(surface.getAction(principal, id, requestId), headers);
  }
  return null;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function result(body: unknown, headers: Record<string, string>, okStatus = 200): BffResponse {
  if (isBffError(body)) {
    return json(statusForError(body as BffErrorEnvelope), body, headers);
  }
  return json(okStatus, body, headers);
}

function json(status: number, body: unknown, headers: Record<string, string>): BffResponse {
  return Object.freeze({
    status,
    body,
    headers: Object.freeze({
      ...headers,
      'content-type': 'application/json',
    }),
  });
}

export const CONSUMER_BFF_ROUTES = [
  'GET /api/v1/me',
  'PATCH /api/v1/me',
  'GET /api/v1/me/home',
  'GET /api/v1/me/bootstrap',
  'GET /api/v1/me/capabilities',
  'GET /api/v1/me/actions',
  'GET /api/v1/accounts',
  'GET /api/v1/accounts/{id}',
  'GET /api/v1/accounts/{id}/activity',
  'GET /api/v1/accounts/{id}/statement',
  'GET /api/v1/payments',
  'POST /api/v1/payments',
  'POST /api/v1/payments/quote',
  'GET /api/v1/payments/{id}',
  'POST /api/v1/payments/{id}/approve',
  'GET /api/v1/recipients',
  'POST /api/v1/recipients',
  'GET /api/v1/recipients/{id}',
  'GET /api/v1/fx',
  'GET /api/v1/fx/currencies',
  'GET /api/v1/fx/valuation',
  'POST /api/v1/fx/quotes',
  'GET /api/v1/fx/quotes/{id}',
  'POST /api/v1/fx/quotes/{id}/accept',
  'POST /api/v1/fx/quotes/{id}/execute',
  'GET /api/v1/cards',
  'POST /api/v1/cards',
  'GET /api/v1/cards/{id}',
  'POST /api/v1/cards/{id}/freeze',
  'POST /api/v1/cards/{id}/unfreeze',
  'PATCH /api/v1/cards/{id}/controls',
  'GET /api/v1/cards/{id}/wallet',
  'GET /api/v1/grow',
  'GET /api/v1/grow/snapshot',
  'GET /api/v1/grow/goals',
  'POST /api/v1/grow/goals',
  'GET /api/v1/grow/opportunities',
  'POST /api/v1/grow/opportunities/{id}/dismiss',
  'GET /api/v1/grow/plan',
  'POST /api/v1/grow/plan/request',
  'POST /api/v1/grow/plan/pause',
  'POST /api/v1/grow/plan/resume',
  'GET /api/v1/grow/plan/progress',
  'GET /api/v1/grow/scenarios',
  'POST /api/v1/grow/plans',
  'GET /api/v1/grow/plans',
  'GET /api/v1/grow/plans/{id}',
  'GET /api/v1/grow/proposals',
  'POST /api/v1/grow/proposals',
  'GET /api/v1/grow/proposals/{id}',
  'POST /api/v1/grow/proposals/{id}/modify',
  'POST /api/v1/grow/proposals/{id}/approve',
  'POST /api/v1/grow/proposals/{id}/execute',
  'GET /api/v1/grow/executions/{id}',
  'GET /api/v1/grow/portfolio',
  'GET /api/v1/grow/performance',
  'POST /api/v1/grow/recurring',
  'POST /api/v1/grow/recurring/{id}/cancel',
  'POST /api/v1/grow/monitor',
  'POST /api/v1/grow/agent-tools',
  'POST /api/v1/grow/proposals/{id}/reject',
  'GET /api/v1/grow/portfolio',
  'GET /api/v1/grow/portfolio/holdings',
  'GET /api/v1/grow/portfolio/performance',
  'GET /api/v1/grow/portfolio/allocation',
  'GET /api/v1/grow/portfolio/risk',
  'GET /api/v1/grow/opportunities',
  'GET /api/v1/grow/opportunities/{id}',
  'POST /api/v1/grow/opportunities/{id}/dismiss',
  'POST /api/v1/grow/opportunities/{id}/start-proposal',
  'GET /api/v1/grow/profile',
  'GET /api/v1/grow/snapshot',
  'GET /api/v1/grow/goals',
  'POST /api/v1/grow/goals',
  'PATCH /api/v1/grow/goals/{id}',
  'GET /api/v1/grow/insights',
  'GET /api/v1/grow/suitability',
  'POST /api/v1/grow/suitability',
  'POST /api/v1/grow/assumptions',
  'POST /api/v1/grow/classifications',
  'GET /api/v1/grow/history',
  'GET /api/v1/grow/agent',
  'GET /api/v1/goals',
  'GET /api/v1/portfolio',
  'GET /api/v1/agent',
  'POST /api/v1/agent/conversations',
  'POST /api/v1/agent/conversations/{id}/messages',
  'GET /api/v1/agent/conversations/{id}/stream',
  'POST /api/v1/agent/conversations/{id}/close',
  'GET /api/v1/agent/actions',
  'GET /api/v1/agent/actions/{id}',
  'POST /api/v1/agent/actions/{id}/revise',
  'POST /api/v1/agent/actions/{id}/approve',
  'POST /api/v1/agent/actions/{id}/step-up',
  'POST /api/v1/agent/actions/{id}/execute',
  'POST /api/v1/agent/actions/{id}/outcome',
  'GET /api/v1/agent/memory',
  'POST /api/v1/agent/memory',
  'GET /api/v1/agent/settings',
  'PATCH /api/v1/agent/settings',
  'POST /api/v1/agent/pause',
  'POST /api/v1/agent/revoke',
  'POST /api/v1/agent/escalations',
  'GET /api/v1/agent/audit/{actionId}',
  'GET /api/v1/agent/conversations/{id}',
  'POST /api/v1/agent/conversations/{id}/messages',
  'GET /api/v1/agent/conversations/{id}/events',
  'GET /api/v1/agent/actions',
  'GET /api/v1/agent/actions/{id}',
  'POST /api/v1/agent/actions/{id}/approve',
  'POST /api/v1/agent/actions/{id}/modify',
  'POST /api/v1/agent/actions/{id}/reject',
  'POST /api/v1/agent/actions/{id}/cancel',
  'GET /api/v1/agent/tools',
  'GET /api/v1/agents',
  'GET /api/v1/agents/{id}',
  'POST /api/v1/agents/{id}/pause',
  'POST /api/v1/agents/{id}/revoke',
  'GET /api/v1/agents/{id}/settings',
  'PATCH /api/v1/agents/{id}/settings',
  'GET /api/v1/agents/{id}/permissions',
  'GET /api/v1/agents/{id}/memories',
  'POST /api/v1/agents/{id}/memories',
  'PATCH /api/v1/agents/{id}/memories/{memoryId}',
  'DELETE /api/v1/agents/{id}/memories/{memoryId}',
  'GET /api/v1/agents/{id}/conversations',
  'POST /api/v1/agents/{id}/conversations',
  'GET /api/v1/agents/{id}/conversations/{conversationId}',
  'POST /api/v1/agents/{id}/conversations/{conversationId}/messages',
  'POST /api/v1/agent/conversations/{id}/messages',
  'GET /api/v1/exchange',
  'GET /api/v1/wallets',
  'GET /api/v1/data',
  'GET /api/v1/security',
  'GET /api/v1/notifications',
  'GET /api/v1/catalog/resources',
  'GET /api/v1/catalog/enums',
  'GET /api/v1/sandbox/personas',
  'POST /api/v1/webhooks/cards',
] as const;
