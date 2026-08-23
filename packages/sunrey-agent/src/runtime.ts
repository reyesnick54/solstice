import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import {
  asAiProviderId,
  asAiRequestId,
  type AiInferenceRequest,
  type AiInferenceResponse,
  type AiRuntime,
} from '../../ai-runtime/src/index.ts';
import { authorizeContextObject, assembleConversationContext, memoriesForContext } from './context.ts';
import { conversationIdFor, contentHash, messageIdFor } from './ids.ts';
import { evaluateProposalLimits } from './limits.ts';
import { correctAgentMemory, createAgentMemory, memoryIsPegDuplicate } from './memory.ts';
import { applyPersonalizationStyle, createPersonalization } from './personalization.ts';
import type { PegReadPort } from './peg.ts';
import { emptyPegView } from './peg.ts';
import { recordAgentRuntimeEvent } from './runtime-events.ts';
import { detectPromptInjection } from './policy.ts';
import type { UserAgentMandateEngine } from './engine.ts';
import type { AgentAssistScope, MemoryCategory, MemorySource } from './taxonomy.ts';
import { isForbiddenAssistScope, READ_ASSIST_SCOPES } from './taxonomy.ts';
import type {
  AgentConversation,
  AgentMemory,
  AgentMessage,
  AgentPersonalization,
  AgentToolEvent,
  ConversationContext,
  MandateRefusal,
  PegReadView,
  UserAgent,
} from './types.ts';

export type AgentStreamChunk = {
  readonly kind: 'token' | 'tool' | 'proposal' | 'done' | 'refused';
  readonly text: string;
  readonly proposalId: string | null;
  readonly toolEventId: string | null;
  readonly conversationalOnly: true;
  readonly financialStateChanged: false;
  readonly executionCompleted: false;
};

export type PostMessageResult = {
  readonly userMessage: AgentMessage;
  readonly agentMessage: AgentMessage | null;
  readonly context: ConversationContext;
  readonly chunks: readonly AgentStreamChunk[];
  readonly proposalId: string | null;
  readonly financialStateChanged: false;
  readonly executionCompleted: false;
};

export class AgentConversationRuntime {
  readonly engine: UserAgentMandateEngine;
  private readonly clock: Clock;
  private readonly inference: AiRuntime | null;
  private readonly peg: PegReadPort;

  constructor(input: {
    readonly engine: UserAgentMandateEngine;
    readonly clock: Clock;
    readonly inference?: AiRuntime | null;
    readonly peg?: PegReadPort;
  }) {
    this.engine = input.engine;
    this.clock = input.clock;
    this.inference = input.inference ?? null;
    this.peg = input.peg ?? { snapshot: emptyPegView };
  }

  listAgents(ownerId: string): readonly UserAgent[] {
    return Object.freeze(this.engine.store.agentsForOwner(ownerId));
  }

  getOwnedAgent(ownerId: string, agentId: string): Result<UserAgent, MandateRefusal> {
    const agent = this.engine.getAgent(agentId);
    if (!agent || (agent.ownerId !== ownerId && agent.owner.ownerId !== ownerId)) {
      return err({ ok: false, code: 'CROSS_USER_DENIED', detail: 'agent is not owned by this customer' });
    }
    return ok(agent);
  }

  createConversation(input: {
    readonly ownerId: string;
    readonly agentId: string;
    readonly title?: string;
  }): Result<AgentConversation, MandateRefusal> {
    const owned = this.getOwnedAgent(input.ownerId, input.agentId);
    if (!owned.ok) {
      return owned;
    }
    const may = this.engine.assertAgentMayConverse(owned.value.agentId);
    if (!may.ok) {
      return may;
    }
    const now = this.clock.now();
    const title = input.title ?? 'Conversation';
    const conversation: AgentConversation = Object.freeze({
      conversationId: conversationIdFor(input.ownerId, owned.value.agentId, title, now),
      ownerId: input.ownerId,
      agentId: owned.value.agentId,
      createdAt: now,
      updatedAt: now,
      status: 'ACTIVE',
      title,
      contextVersion: 1,
      proposalRefs: Object.freeze([]),
      isFinancialRecord: false,
    });
    this.engine.store.putConversation(conversation);
    this.engine.store.putRuntimeEvent(
      recordAgentRuntimeEvent({
        kind: 'conversation.created',
        at: now,
        agentId: owned.value.agentId,
        ownerId: input.ownerId,
        conversationId: conversation.conversationId,
        detail: 'conversation created; not a financial record',
      }),
    );
    return ok(conversation);
  }

  listConversations(ownerId: string, agentId: string): Result<readonly AgentConversation[], MandateRefusal> {
    const owned = this.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return owned;
    }
    return ok(Object.freeze(this.engine.store.conversationsForAgent(agentId, ownerId)));
  }

  getConversation(ownerId: string, agentId: string, conversationId: string): Result<AgentConversation, MandateRefusal> {
    const owned = this.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return owned;
    }
    const conversation = this.engine.store.conversations.get(conversationId);
    if (!conversation || conversation.agentId !== owned.value.agentId) {
      return err({ ok: false, code: 'CONVERSATION_NOT_OWNED', detail: 'conversation not found' });
    }
    if (conversation.ownerId !== ownerId) {
      return err({ ok: false, code: 'CROSS_USER_DENIED', detail: 'conversation belongs to another customer' });
    }
    return ok(conversation);
  }

  archiveConversation(ownerId: string, agentId: string, conversationId: string): Result<AgentConversation, MandateRefusal> {
    const found = this.getConversation(ownerId, agentId, conversationId);
    if (!found.ok) {
      return found;
    }
    const next = Object.freeze({ ...found.value, status: 'ARCHIVED' as const, updatedAt: this.clock.now() });
    this.engine.store.putConversation(next);
    return ok(next);
  }

  *streamMessage(input: {
    readonly ownerId: string;
    readonly agentId: string;
    readonly conversationId: string;
    readonly text: string;
    readonly actorId: string;
  }): Generator<AgentStreamChunk, Result<PostMessageResult, MandateRefusal>, void> {
    const posted = this.postMessage(input);
    if (!posted.ok) {
      yield {
        kind: 'refused',
        text: posted.error.detail,
        proposalId: null,
        toolEventId: null,
        conversationalOnly: true,
        financialStateChanged: false,
        executionCompleted: false,
      };
      return posted;
    }
    for (const chunk of posted.value.chunks) {
      yield chunk;
    }
    return posted;
  }

  postMessage(input: {
    readonly ownerId: string;
    readonly agentId: string;
    readonly conversationId: string;
    readonly text: string;
    readonly actorId: string;
  }): Result<PostMessageResult, MandateRefusal> {
    if (input.actorId.startsWith('agent:')) {
      return err({ ok: false, code: 'IDENTITY_COLLISION', detail: 'an agent cannot submit a user message as the customer' });
    }
    const conversation = this.getConversation(input.ownerId, input.agentId, input.conversationId);
    if (!conversation.ok) {
      return conversation;
    }
    if (conversation.value.status !== 'ACTIVE') {
      return err({ ok: false, code: 'CONVERSATION_CLOSED', detail: 'archived or redacted conversations do not accept messages' });
    }
    const may = this.engine.assertAgentMayConverse(input.agentId);
    if (!may.ok) {
      return may;
    }
    if (detectPromptInjection(input.text)) {
      return err({ ok: false, code: 'PROMPT_INJECTION', detail: 'prompt-injection content cannot enter the conversation' });
    }
    const now = this.clock.now();
    const userMessage: AgentMessage = Object.freeze({
      messageId: messageIdFor(conversation.value.conversationId, 'USER', now, input.text),
      conversationId: conversation.value.conversationId,
      role: 'USER',
      content: input.text,
      createdAt: now,
      visible: true,
      proposalRef: null,
      toolEventId: null,
      hiddenReasoning: false,
    });
    this.engine.store.putMessage(userMessage);
    this.engine.store.putRuntimeEvent(
      recordAgentRuntimeEvent({
        kind: 'message.received',
        at: now,
        agentId: may.value.agentId,
        ownerId: input.ownerId,
        conversationId: conversation.value.conversationId,
        detail: `user message ${userMessage.messageId}`,
      }),
    );

    const mandate = may.value.mandateId ? this.engine.getMandate(may.value.mandateId) : undefined;
    const prefs = this.personalizationOf(input.ownerId, may.value);
    const pegPurpose: AgentAssistScope = 'READ_PEG';
    const financialAuth = authorizeContextObject({
      agent: may.value,
      mandate,
      ownerId: input.ownerId,
      purpose: mandate && READ_ASSIST_SCOPES.has(pegPurpose) && mandate.assistScopes.includes(pegPurpose) ? pegPurpose : 'CONVERSATION',
      dataClass: 'FINANCIAL_PROFILE',
      consentPersonalization: prefs.personalizationMemoryEnabled,
      jurisdiction: may.value.jurisdiction,
      objectId: 'peg-snapshot',
    });
    const financialContext: PegReadView | null = financialAuth.allowed
      ? this.peg.snapshot(input.ownerId)
      : null;

    const prior = this.engine.store.messagesForConversation(conversation.value.conversationId);
    const toolResults = [...this.engine.store.toolEvents.values()].filter(
      (item) => item.conversationId === conversation.value.conversationId,
    );
    const context = assembleConversationContext({
      conversation: conversation.value,
      messages: prior,
      currentUserRequest: input.text,
      activeProposalId: conversation.value.proposalRefs.at(-1) ?? null,
      financialContext,
      toolResults,
    });

    const inferred = this.infer(may.value, context, input.text);
    const toolHandled = this.handleToolIntents(may.value, mandate, conversation.value, inferred, now);
    const explanation = inferred?.structured?.kind === 'EXPLANATION' ? inferred.structured.text : null;
    const rawText = inferred?.text ?? explanation ?? 'I can help within your mandate.';
    const visibleText = applyPersonalizationStyle(ensureUnicodeSafe(rawText ?? 'I can help within your mandate.'), prefs);
    const chunks = chunkText(visibleText);
    if (toolHandled.proposalId) {
      chunks.push({
        kind: 'proposal',
        text: `proposal ${toolHandled.proposalId} is ready for human review`,
        proposalId: toolHandled.proposalId,
        toolEventId: toolHandled.toolEventId,
        conversationalOnly: true,
        financialStateChanged: false,
        executionCompleted: false,
      });
    }
    chunks.push({
      kind: 'done',
      text: '',
      proposalId: toolHandled.proposalId,
      toolEventId: toolHandled.toolEventId,
      conversationalOnly: true,
      financialStateChanged: false,
      executionCompleted: false,
    });

    const completedAt = this.clock.now();
    const agentMessage: AgentMessage = Object.freeze({
      messageId: messageIdFor(conversation.value.conversationId, 'AGENT', completedAt, visibleText),
      conversationId: conversation.value.conversationId,
      role: 'AGENT',
      content: visibleText,
      createdAt: completedAt,
      visible: true,
      proposalRef: toolHandled.proposalId,
      toolEventId: toolHandled.toolEventId,
      hiddenReasoning: false,
    });
    this.engine.store.putMessage(agentMessage);
    const proposalRefs = toolHandled.proposalId
      ? Object.freeze([...conversation.value.proposalRefs, toolHandled.proposalId])
      : conversation.value.proposalRefs;
    this.engine.store.putConversation(
      Object.freeze({
        ...conversation.value,
        updatedAt: completedAt,
        contextVersion: conversation.value.contextVersion + 1,
        proposalRefs,
      }),
    );
    this.engine.store.putRuntimeEvent(
      recordAgentRuntimeEvent({
        kind: 'message.completed',
        at: completedAt,
        agentId: may.value.agentId,
        ownerId: input.ownerId,
        conversationId: conversation.value.conversationId,
        detail: `agent message ${agentMessage.messageId}`,
      }),
    );
    return ok(
      Object.freeze({
        userMessage,
        agentMessage,
        context,
        chunks: Object.freeze(chunks),
        proposalId: toolHandled.proposalId,
        financialStateChanged: false,
        executionCompleted: false,
      }),
    );
  }

  createMemory(input: {
    readonly ownerId: string;
    readonly agentId: string;
    readonly actorId: string;
    readonly category: MemoryCategory;
    readonly content: string;
    readonly source: MemorySource;
    readonly personalization?: boolean;
  }): Result<AgentMemory, MandateRefusal> {
    const owned = this.getOwnedAgent(input.ownerId, input.agentId);
    if (!owned.ok) {
      return owned;
    }
    const prefs = this.personalizationOf(input.ownerId, owned.value);
    if (input.personalization !== false && !prefs.personalizationMemoryEnabled && (input.category === 'USER_PREFERENCE' || input.category === 'COMMUNICATION_PREFERENCE')) {
      return err({ ok: false, code: 'PERSONALIZATION_DISABLED', detail: 'optional personalization memory is disabled' });
    }
    if (memoryIsPegDuplicate(input.content) && input.category !== 'FINANCIAL_GOAL_REFERENCE') {
      return err({
        ok: false,
        code: 'MEMORY_SPECULATION_FORBIDDEN',
        detail: 'do not store PEG/ledger financial state as agent memory',
      });
    }
    const created = createAgentMemory(this.clock, {
      agent: owned.value,
      ownerId: input.ownerId,
      category: input.category,
      content: input.content,
      source: input.source,
      confidence: input.source === 'USER_DECLARED' || input.source === 'USER_CORRECTED' ? 'USER_DECLARED' : 'CONFIRMED',
      userEditable: input.category !== 'CONFIRMED_FACT_REFERENCE',
      dataClassification: input.personalization === false ? 'OPERATIONAL_AUDIT' : 'PERSONALIZATION',
      personalization: input.personalization !== false,
      actorId: input.actorId,
    });
    if (!created.ok) {
      return created;
    }
    this.engine.store.putMemory(created.value);
    this.engine.store.putRuntimeEvent(
      recordAgentRuntimeEvent({
        kind: 'memory.created',
        at: created.value.createdAt,
        agentId: owned.value.agentId,
        ownerId: input.ownerId,
        memoryId: created.value.memoryId,
        detail: `${created.value.category} memory created`,
      }),
    );
    return created;
  }

  listMemories(ownerId: string, agentId: string): Result<readonly AgentMemory[], MandateRefusal> {
    const owned = this.getOwnedAgent(ownerId, agentId);
    if (!owned.ok) {
      return owned;
    }
    const prefs = this.personalizationOf(ownerId, owned.value);
    return ok(Object.freeze(memoriesForContext(this.engine.store.memoriesForAgent(agentId, ownerId), prefs)));
  }

  correctMemory(input: {
    readonly ownerId: string;
    readonly agentId: string;
    readonly memoryId: string;
    readonly content: string;
    readonly actorId: string;
  }): Result<AgentMemory, MandateRefusal> {
    const owned = this.getOwnedAgent(input.ownerId, input.agentId);
    if (!owned.ok) {
      return owned;
    }
    const memory = this.engine.store.memories.get(input.memoryId);
    if (!memory || memory.ownerId !== input.ownerId || memory.agentId !== owned.value.agentId) {
      return err({ ok: false, code: 'CROSS_USER_DENIED', detail: 'memory is not owned by this customer' });
    }
    const corrected = correctAgentMemory(memory, input.content, input.actorId, this.clock.now());
    if (!corrected.ok) {
      return corrected;
    }
    this.engine.store.putMemory(corrected.value);
    this.engine.store.putRuntimeEvent(
      recordAgentRuntimeEvent({
        kind: 'memory.changed',
        at: corrected.value.updatedAt,
        agentId: owned.value.agentId,
        ownerId: input.ownerId,
        memoryId: corrected.value.memoryId,
        detail: 'memory corrected by owner',
      }),
    );
    return corrected;
  }

  deleteMemory(input: {
    readonly ownerId: string;
    readonly agentId: string;
    readonly memoryId: string;
    readonly actorId: string;
  }): Result<true, MandateRefusal> {
    if (input.actorId.startsWith('agent:')) {
      return err({ ok: false, code: 'SELF_EXPANSION_FORBIDDEN', detail: 'an agent cannot delete memory' });
    }
    const owned = this.getOwnedAgent(input.ownerId, input.agentId);
    if (!owned.ok) {
      return owned;
    }
    const memory = this.engine.store.memories.get(input.memoryId);
    if (!memory || memory.ownerId !== input.ownerId) {
      return err({ ok: false, code: 'CROSS_USER_DENIED', detail: 'memory is not owned by this customer' });
    }
    if (!memory.userEditable && memory.dataClassification === 'OPERATIONAL_AUDIT') {
      return err({
        ok: false,
        code: 'MEMORY_NOT_USER_EDITABLE',
        detail: 'operational audit memory has separate retention treatment',
      });
    }
    this.engine.store.deleteMemory(input.memoryId);
    this.engine.store.putRuntimeEvent(
      recordAgentRuntimeEvent({
        kind: 'memory.changed',
        at: this.clock.now(),
        agentId: owned.value.agentId,
        ownerId: input.ownerId,
        memoryId: memory.memoryId,
        detail: 'memory deleted by owner',
      }),
    );
    return ok(true);
  }

  setPersonalization(input: {
    readonly ownerId: string;
    readonly agentId: string;
    readonly verbosity?: AgentPersonalization['verbosity'];
    readonly displayCurrency?: string;
    readonly language?: string;
    readonly explanationComplexity?: AgentPersonalization['explanationComplexity'];
    readonly personalizationMemoryEnabled?: boolean;
  }): Result<AgentPersonalization, MandateRefusal> {
    const owned = this.getOwnedAgent(input.ownerId, input.agentId);
    if (!owned.ok) {
      return owned;
    }
    const prefs = createPersonalization({
      agent: owned.value,
      ownerId: input.ownerId,
      ...(input.verbosity ? { verbosity: input.verbosity } : {}),
      ...(input.displayCurrency ? { displayCurrency: input.displayCurrency } : {}),
      ...(input.language ? { language: input.language } : {}),
      ...(input.explanationComplexity ? { explanationComplexity: input.explanationComplexity } : {}),
      ...(input.personalizationMemoryEnabled !== undefined
        ? { personalizationMemoryEnabled: input.personalizationMemoryEnabled }
        : {}),
    });
    this.engine.store.putPersonalization(prefs);
    return ok(prefs);
  }

  personalizationOf(ownerId: string, agent: UserAgent): AgentPersonalization {
    return (
      this.engine.store.personalization.get(`${ownerId}:${agent.agentId}`) ??
      createPersonalization({ agent, ownerId })
    );
  }

  rejectForbiddenScope(scope: string): MandateRefusal | null {
    if (isForbiddenAssistScope(scope)) {
      return {
        ok: false,
        code: 'FORBIDDEN_ASSIST_SCOPE',
        detail: `${scope} is never a mandate privilege`,
      };
    }
    return null;
  }

  agentCannotAssumeUserAuthority(agent: UserAgent): true {
    if (agent.isCustomer !== false || agent.riskPolicy.mayAssumeUserAuthority !== false) {
      throw new Error('agent must not assume user authority');
    }
    return true;
  }

  agentCannotBecomeExecutionAuthority(agent: UserAgent): true {
    if (agent.isExecutionAuthority !== false || agent.riskPolicy.mayBecomeExecutionAuthority !== false) {
      throw new Error('agent must not become Execution Authority');
    }
    return true;
  }

  private infer(agent: UserAgent, context: ConversationContext, prompt: string): AiInferenceResponse | null {
    if (!this.inference) {
      return {
        requestId: asAiRequestId(`air_${contentHash(prompt).slice(0, 24)}`),
        providerId: asAiProviderId('aip_local_test'),
        providerKind: 'LOCAL_TEST',
        modelRef: { modelId: 'local-test' as never, version: '1' as never },
        text: deterministicReply(prompt, context),
        structured: { kind: 'EXPLANATION', text: deterministicReply(prompt, context), guaranteedReturn: false },
        toolIntents: Object.freeze([]),
        usage: Object.freeze({ promptTokens: 8, completionTokens: 16, totalTokens: 24 }),
        grantsExecutionAuthority: false,
      };
    }
    const request: AiInferenceRequest = {
      requestId: asAiRequestId(`air_${contentHash(prompt).slice(0, 24)}`),
      taskClass: 'FINANCIAL_EXPLANATION',
      mode: 'S3M_PRIMARY',
      modelRef: { modelId: 'sunrey.s3m.primary' as never, version: 'sim-1' as never },
      dataClass: 'SYNTHETIC',
      jurisdictionRef: agent.jurisdiction,
      authorization: {
        actorId: agent.ownerId,
        subjectId: agent.ownerId,
        userApprovedExternal: false,
        mandateId: agent.mandateId,
        agentId: agent.agentId,
      },
      prompt,
      context: Object.freeze([
        {
          objectId: 'conversation',
          dataClass: 'USER_APPROVED_CONTEXT',
          authorizedProviders: Object.freeze(['LOCAL_TEST', 'S3M'] as const),
          userApproved: true,
          payload: {
            recent: context.recentMessages.map((item) => ({ role: item.role, content: item.content })),
            request: context.currentUserRequest,
            peg: context.financialContext,
          },
        },
      ]),
      fixture: 'normal',
    };
    const result = this.inference.infer(request);
    return result.ok ? result.value.response : null;
  }

  private handleToolIntents(
    agent: UserAgent,
    mandate: ReturnType<UserAgentMandateEngine['getMandate']>,
    conversation: AgentConversation,
    response: AiInferenceResponse | null,
    at: AgentConversation['createdAt'],
  ): { readonly proposalId: string | null; readonly toolEventId: string | null } {
    if (!response) {
      return { proposalId: null, toolEventId: null };
    }
    if (response.grantsExecutionAuthority !== false) {
      return { proposalId: null, toolEventId: null };
    }
    let proposalId: string | null = null;
    let toolEventId: string | null = null;
    for (const intent of response.toolIntents) {
      if (intent.executes || intent.name.startsWith('EXECUTE_') || (intent.name as string) === 'DIRECT_LEDGER_WRITE') {
        continue;
      }
      toolEventId = `ate_${contentHash(`${conversation.conversationId}:${intent.name}:${at}`).slice(0, 24)}`;
      const event: AgentToolEvent = Object.freeze({
        toolEventId,
        conversationId: conversation.conversationId,
        messageId: null,
        toolName: intent.name,
        ok: true,
        summary: intent.name.startsWith('READ_') ? 'read tool accepted; PEG/ledger not mutated' : 'prepare intent deferred to ProposalGate',
        proposalRef: null,
        executedFinancialMutation: false,
        createdAt: at,
      });
      this.engine.store.putToolEvent(event);
      if (mandate && (intent.name === 'PREPARE_PAYMENT' || intent.name === 'PREPARE_EXCHANGE_ORDER') && intent.quantity && intent.assetId) {
        const limit = evaluateProposalLimits({
          budget: mandate.budget,
          usage: this.engine.store.usage.get(mandate.mandateId) ?? {
            mandateId: mandate.mandateId,
            spentThisPeriod: 0n,
            spentTotal: 0n,
            transactionsThisPeriod: 0,
            periodStartedAt: at,
            byAsset: {},
            byMarket: {},
            byActionClass: {},
          },
          proposal: {
            quantity: BigInt(intent.quantity.minorUnits),
            fees: intent.fees ? BigInt(intent.fees.minorUnits) : 0n,
            assetId: intent.assetId,
            destinationOrMarket: intent.destinationOrMarket ?? '',
            intent: intent.name,
          },
          now: at,
          currency: intent.quantity.currency,
          toolName: intent.name,
          jurisdiction: mandate.policy.jurisdictionPackId,
        });
        if (!limit.ok) {
          continue;
        }
      }
    }
    return { proposalId, toolEventId };
  }
}

function deterministicReply(prompt: string, context: ConversationContext): string {
  if (context.financialContext) {
    const goals = context.financialContext.goalLabels.join(', ') || 'none recorded in PEG';
    return `I can explain your profile. Goals come from PEG (${goals}). Saying "done" does not move money.`;
  }
  if (/[\u0600-\u06FF]/.test(prompt)) {
    return 'يمكنني المساعدة ضمن التفويض. هذا رد محادثة وليس تنفيذًا ماليًا.';
  }
  return 'I can help within your mandate. This is conversational state only and is not a completed financial action.';
}

function ensureUnicodeSafe(text: string): string {
  return [...text].join('');
}

function chunkText(text: string): AgentStreamChunk[] {
  const words = text.split(/(\s+)/);
  const chunks: AgentStreamChunk[] = [];
  for (const word of words) {
    if (word.length === 0) {
      continue;
    }
    chunks.push({
      kind: 'token',
      text: word,
      proposalId: null,
      toolEventId: null,
      conversationalOnly: true,
      financialStateChanged: false,
      executionCompleted: false,
    });
  }
  return chunks;
}
