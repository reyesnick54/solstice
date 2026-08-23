/**
 * Consumer BFF for Agent conversation, Action Cards, and Action Center.
 * Orchestration only. The Agent never becomes the approver.
 */

import {
  ConversationalActionRuntime,
  createConversationSandbox,
  InMemoryConversationStore,
  type ConversationActor,
  type ConversationRefusal,
  type ConversationTurnResult,
} from '../../../../packages/sunrey-agent/src/conversation/index.ts';
import { asUtcInstant } from '../../../../packages/domain/src/time.ts';
import { bffError, isBffError, type BffErrorEnvelope } from './errors.ts';
import type { BffPrincipal } from './ports.ts';

export class AgentConversationSurface {
  private readonly runtimes = new Map<string, ConversationalActionRuntime>();
  private readonly shared: ConversationalActionRuntime | undefined;

  constructor(shared?: ConversationalActionRuntime) {
    this.shared = shared;
  }

  private runtimeFor(subjectId: string): ConversationalActionRuntime {
    if (this.shared) {
      return this.shared;
    }
    const existing = this.runtimes.get(subjectId);
    if (existing) {
      return existing;
    }
    const created = new ConversationalActionRuntime(
      new InMemoryConversationStore(),
      createConversationSandbox({ subjectId }),
    );
    this.runtimes.set(subjectId, created);
    return created;
  }

  start(principal: BffPrincipal, requestId: string) {
    const session = this.runtimeFor(principal.customerId).start({
      subjectId: principal.customerId,
      now: nowOf(),
    });
    return Object.freeze({
      schema: 'sunrey.consumer.conversation.v1',
      conversationId: session.conversationId,
      subjectId: session.subjectId,
      productionMoneyMovement: false,
      agentIsApprover: false,
      requestId,
    });
  }

  message(principal: BffPrincipal, conversationId: string, text: string, requestId: string) {
    const result = this.runtimeFor(principal.customerId).handleTurn({
      conversationId,
      actor: actorFrom(principal),
      text,
      now: nowOf(),
    });
    return mapTurn(result, requestId);
  }

  getConversation(principal: BffPrincipal, conversationId: string, requestId: string) {
    const runtime = this.runtimeFor(principal.customerId);
    const session = runtime.getSession(conversationId);
    if (!session || session.subjectId !== principal.customerId) {
      return ownedError(requestId);
    }
    return Object.freeze({
      schema: 'sunrey.consumer.conversation.v1',
      conversation: session,
      events: runtime.eventsAfter(conversationId, 0),
      requestId,
      productionMoneyMovement: false,
    });
  }

  stream(principal: BffPrincipal, conversationId: string, after: number, requestId: string) {
    const runtime = this.runtimeFor(principal.customerId);
    const session = runtime.getSession(conversationId);
    if (!session || session.subjectId !== principal.customerId) {
      return ownedError(requestId);
    }
    return Object.freeze({
      schema: 'sunrey.consumer.conversation-stream.v1',
      conversationId,
      after,
      events: runtime.eventsAfter(conversationId, after),
      requestId,
    });
  }

  listActions(principal: BffPrincipal, view: string | undefined, requestId: string) {
    const items = this.runtimeFor(principal.customerId).listActions(
      principal.customerId,
      isView(view) ? view : undefined,
    );
    return Object.freeze({
      schema: 'sunrey.consumer.action-center.v1',
      view: view ?? 'ALL',
      items,
      requestId,
      productionMoneyMovement: false,
    });
  }

  getAction(principal: BffPrincipal, actionId: string, requestId: string) {
    const action = this.runtimeFor(principal.customerId).getAction(actionId);
    if (!action || action.subjectId !== principal.customerId) {
      return ownedError(requestId);
    }
    return Object.freeze({
      schema: 'sunrey.consumer.action-detail.v1',
      action,
      card: action.card,
      explanation: action.explanation,
      history: action.history,
      requestId,
      productionMoneyMovement: false,
      agentIsApprover: false,
    });
  }

  approve(
    principal: BffPrincipal,
    actionId: string,
    body: Readonly<Record<string, unknown>>,
    requestId: string,
  ) {
    if (principal.restricted) {
      return bffError({
        errorCode: 'KERNEL_REFUSED',
        category: 'POLICY',
        message: 'Restricted customers cannot approve financial actions.',
        retryable: false,
        requestId,
      });
    }
    const acknowledgements = Array.isArray(body.acknowledgements)
      ? body.acknowledgements.filter((item): item is string => typeof item === 'string')
      : [];
    const result = this.runtimeFor(principal.customerId).approve({
      actionId,
      actor: actorFrom(principal, body.stepUpSatisfied === true),
      now: nowOf(),
      acknowledgements,
      conversationalYes: body.conversationalYes === true,
    });
    return mapTurn(result, requestId);
  }

  modify(
    principal: BffPrincipal,
    actionId: string,
    body: Readonly<Record<string, unknown>>,
    requestId: string,
  ) {
    const amountRaw = typeof body.amount === 'string' ? body.amount : typeof body.amountMinorUnits === 'string' ? body.amountMinorUnits : '';
    const result = this.runtimeFor(principal.customerId).modify({
      actionId,
      actor: actorFrom(principal),
      amountRaw,
      now: nowOf(),
    });
    return mapTurn(result, requestId);
  }

  reject(principal: BffPrincipal, actionId: string, requestId: string) {
    return mapTurn(this.runtimeFor(principal.customerId).reject({ actionId, actor: actorFrom(principal), now: nowOf() }), requestId);
  }

  cancel(principal: BffPrincipal, actionId: string, requestId: string) {
    return mapTurn(this.runtimeFor(principal.customerId).cancel({ actionId, actor: actorFrom(principal), now: nowOf() }), requestId);
  }
}

export function createAgentConversationSurface(): AgentConversationSurface {
  return new AgentConversationSurface();
}

export function createAgentConversationSurfaceFor(subjectId: string): AgentConversationSurface {
  return new AgentConversationSurface(
    new ConversationalActionRuntime(new InMemoryConversationStore(), createConversationSandbox({ subjectId })),
  );
}

function actorFrom(principal: BffPrincipal, stepUp = false): ConversationActor {
  return Object.freeze({
    actorId: principal.actorId,
    subjectId: principal.customerId,
    kind: 'HUMAN',
    sessionId: principal.sessionId,
    deviceId: principal.deviceSummary.deviceId,
    authenticationAssurance: stepUp || principal.restricted === false ? (stepUp ? 'STEP_UP_SATISFIED' : 'AAL1') : 'AAL1',
  });
}

function nowOf() {
  return asUtcInstant(new Date().toISOString());
}

function mapTurn(result: ConversationTurnResult | ConversationRefusal, requestId: string) {
  if (!result.ok) {
    return conversationError(result, requestId);
  }
  return Object.freeze({
    schema: 'sunrey.consumer.conversation-turn.v1',
    conversationId: result.conversation.conversationId,
    languagePhase: result.languagePhase,
    questions: result.questions,
    card: result.card,
    action: result.action
      ? {
          actionId: result.action.actionId,
          status: result.action.status,
          proposalId: result.action.proposal?.proposalId ?? null,
          proposalVersion: result.action.proposal?.version ?? null,
          history: result.action.history,
        }
      : null,
    explanation: result.action?.explanation ?? null,
    notification: result.notification,
    agentIsApprover: false,
    productionMoneyMovement: false,
    requestId,
  });
}

function conversationError(result: ConversationRefusal, requestId: string): BffErrorEnvelope {
  if (result.code === 'STEP_UP_REQUIRED') {
    return bffError({
      errorCode: 'STEP_UP_REQUIRED',
      category: 'AUTHENTICATION',
      message: result.message,
      retryable: false,
      requestId,
    });
  }
  if (result.code === 'RESOURCE_NOT_OWNED') {
    return ownedError(requestId);
  }
  return bffError({
    errorCode: 'VALIDATION',
    category: 'POLICY',
    message: result.message,
    retryable: false,
    requestId,
    detailsSafeForClient: { code: result.code },
  });
}

function ownedError(requestId: string): BffErrorEnvelope {
  return bffError({
    errorCode: 'RESOURCE_NOT_OWNED',
    category: 'AUTHORIZATION',
    message: 'This Agent action is not on the authenticated customer.',
    retryable: false,
    requestId,
  });
}

function isView(value: string | undefined): value is 'AWAITING_APPROVAL' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED' | 'REQUIRES_ATTENTION' {
  return (
    value === 'AWAITING_APPROVAL' ||
    value === 'PROCESSING' ||
    value === 'COMPLETED' ||
    value === 'REJECTED' ||
    value === 'EXPIRED' ||
    value === 'REQUIRES_ATTENTION'
  );
}

export { isBffError };
