import { asUtcInstant, type UtcInstant } from '../../../domain/src/time.ts';
import { contentHash } from '../ids.ts';
import { actionIdFor, buildActionCard } from './action-card.ts';
import { listActionCenter } from './action-center.ts';
import { recordHumanApproval } from './approval.ts';
import { explainActionCard } from './explain.ts';
import { resolveRequiredEntities } from './entities.ts';
import { classifyConversationIntent, conversationalInjection } from './intent.ts';
import { sanitizeAgentLanguage } from './language.ts';
import { extractSlotsFromText, mergeSlots, missingSlotQuestions, parseAmountToMinorUnits } from './slots.ts';
import { notificationForStatus } from './notifications.ts';
import type { ConversationDomainPorts } from './sandbox.ts';
import { InMemoryConversationStore } from './store.ts';
import { cardTypeForIntent, isFinancialIntent, type ActionCardStatus, type ActionCenterView, type ConversationIntent } from './taxonomy.ts';
import type {
  ActionCard,
  ActionHistoryEntry,
  ConversationalAction,
  ConversationActor,
  ConversationEvent,
  ConversationMessage,
  ConversationRefusal,
  ConversationSession,
  ConversationTurnResult,
  DomainProposalRef,
  SlotQuestion,
  SlotValue,
} from './types.ts';

export class ConversationalActionRuntime {
  private readonly store: InMemoryConversationStore;
  private readonly ports: ConversationDomainPorts;

  constructor(store: InMemoryConversationStore, ports: ConversationDomainPorts) {
    this.store = store;
    this.ports = ports;
  }

  start(input: { readonly subjectId: string; readonly now: UtcInstant }): ConversationSession {
    const conversationId = `cnv_${contentHash({ subjectId: input.subjectId, now: input.now }).slice(0, 20)}`;
    const session: ConversationSession = Object.freeze({
      conversationId,
      subjectId: input.subjectId,
      createdAt: input.now,
      intent: null,
      slots: Object.freeze({}),
      activeActionId: null,
      messages: Object.freeze([]),
    });
    this.store.putSession(session);
    return session;
  }

  getSession(id: string): ConversationSession | undefined {
    return this.store.getSession(id);
  }

  getAction(id: string): ConversationalAction | undefined {
    return this.store.getAction(id);
  }

  listActions(subjectId: string, view?: ActionCenterView) {
    return listActionCenter(this.store.listActions(subjectId), view);
  }

  eventsAfter(conversationId: string, after: number): readonly ConversationEvent[] {
    return this.store.eventsAfter(conversationId, after);
  }

  handleTurn(input: {
    readonly conversationId: string;
    readonly actor: ConversationActor;
    readonly text: string;
    readonly now: UtcInstant;
  }): ConversationTurnResult | ConversationRefusal {
    const session = this.store.getSession(input.conversationId);
    if (!session || session.subjectId !== input.actor.subjectId) {
      return refuse('RESOURCE_NOT_OWNED', 'Conversation is not on this customer.');
    }
    const injection = conversationalInjection(input.text);
    if (injection) {
      this.speak(session, input.now, injection.message, 'REFUSED');
      this.event(session.conversationId, null, input.now, 'MESSAGE', { role: 'AGENT', text: injection.message, code: injection.code });
      return refuse(injection.code, injection.message);
    }
    if (input.actor.kind === 'AGENT' && /\bapprove\b/i.test(input.text)) {
      return refuse('AGENT_CANNOT_SELF_APPROVE', 'The Agent cannot approve a proposal.');
    }

    const extracted = extractSlotsFromText(input.text);
    const slots = mergeSlots(session.slots, extracted);
    const classified = classifyConversationIntent(input.text);
    if (!classified.ok) {
      return refuse(classified.code, classified.message);
    }
    const intent = classified.intent === 'PROPOSAL_MODIFICATION' && session.intent ? session.intent : classified.intent;
    const userMessage = message('USER', input.text, input.now, 'UNDERSTANDING');
    let next: ConversationSession = Object.freeze({
      ...session,
      intent,
      slots,
      messages: Object.freeze([...session.messages, userMessage]),
    });
    this.store.putSession(next);
    this.event(next.conversationId, next.activeActionId, input.now, 'MESSAGE', { role: 'USER', text: input.text, intent });

    if (classified.intent === 'PROPOSAL_MODIFICATION') {
      return this.modifyFromChat(next, input.actor, input.text, input.now);
    }

    if (usesAnotherCustomer(input.text)) {
      return refuse('RESOURCE_NOT_OWNED', 'I will not use another customer\'s account.');
    }

    if (ineligibleBuy(input.text)) {
      return refuse('ELIGIBILITY_REFUSED', 'You are not eligible for that instrument.');
    }

    if (!isFinancialIntent(intent) && intent !== 'CARD_MANAGEMENT') {
      return this.informationalTurn(next, intent, input.now);
    }

    const catalog = this.ports.catalog(next.subjectId);
    next = Object.freeze({ ...next, slots: defaultSourceAccount(next.slots, catalog) });
    this.store.putSession(next);
    if (intent === 'GROWTH_REQUEST' || intent === 'INVESTMENT_REQUEST') {
      this.ports.invokeTool('getFinancialSnapshot', next.subjectId, {});
      this.ports.invokeTool('getGrowthOpportunities', next.subjectId, {});
      this.ports.invokeTool('getGrowthPlan', next.subjectId, {});
      this.ports.invokeTool('getGrowthScenarios', next.subjectId, {});
      this.event(next.conversationId, null, input.now, 'TOOL_PROGRESS', {
        tools: ['getFinancialSnapshot', 'getGrowthOpportunities', 'getGrowthPlan', 'getGrowthScenarios'],
      });
    }
    if (intent === 'FX_REQUEST') {
      this.ports.invokeTool('getFxQuote', next.subjectId, slotRecord(next.slots));
    }
    if (intent === 'EXCHANGE_REQUEST') {
      const eligibility = this.ports.invokeTool('checkExchangeEligibility', next.subjectId, slotRecord(next.slots));
      this.ports.invokeTool('getMarketData', next.subjectId, slotRecord(next.slots));
      if (!eligibility.ok) {
        return refuse('ELIGIBILITY_REFUSED', 'You are not eligible for that exchange instrument.');
      }
    }
    const questions = missingSlotQuestions(intent, next.slots);
    if (questions.length > 0) {
      return this.ask(next, questions, input.now);
    }
    const entitySlots = entitySlotsFor(intent);
    const resolved = resolveRequiredEntities(catalog, next.subjectId, next.slots, entitySlots);
    if (!resolved.ok) {
      return this.ask(
        next,
        resolved.questions.flatMap((item) => (item.ok ? [] : [item.question])),
        input.now,
      );
    }
    next = Object.freeze({ ...next, slots: resolved.slots });
    this.store.putSession(next);

    const type = cardTypeForIntent(intent);
    if (!type) {
      return this.informationalTurn(next, intent, input.now);
    }

    this.event(next.conversationId, null, input.now, 'TOOL_PROGRESS', { tool: proposalTool(type), status: 'STARTED' });
    const created = this.ports.createProposal({
      subjectId: next.subjectId,
      kind: type,
      slots: slotRecord(next.slots),
      now: input.now,
    });
    if ('ok' in created && created.ok === false) {
      return refuse(created.code === 'ELIGIBILITY_REFUSED' ? 'ELIGIBILITY_REFUSED' : 'RESOURCE_NOT_OWNED', created.message);
    }
    const proposal = created as DomainProposalRef;
    const action = this.materializeAction({
      session: next,
      intent,
      type,
      proposal,
      status: proposal.requiresStepUp ? 'AWAITING_STEP_UP' : 'AWAITING_APPROVAL',
      now: input.now,
      historyKind: 'PROPOSAL_CREATED',
    });
    const spoken = sanitizeAgentLanguage(
      `I created a ${type.toLowerCase()} proposal. It is not approved or completed.`,
      action.status,
    );
    const withSpeech = this.speak(this.store.getSession(next.conversationId) ?? next, input.now, spoken, 'PROPOSAL_CREATED');
    this.event(next.conversationId, action.actionId, input.now, 'ACTION_CARD', { card: action.card });
    this.event(next.conversationId, action.actionId, input.now, 'EXPLANATION', { explanation: action.explanation });
    const notification = notificationForStatus({ actionId: action.actionId, status: action.status });
    if (notification) {
      this.event(next.conversationId, action.actionId, input.now, 'NOTIFICATION', { notification });
    }
    return ok(withSpeech, action, action.card, [], this.store.eventsAfter(next.conversationId, 0), notification, 'PROPOSAL_CREATED');
  }

  approve(input: {
    readonly actionId: string;
    readonly actor: ConversationActor;
    readonly now: UtcInstant;
    readonly acknowledgements?: readonly string[];
    readonly conversationalYes?: boolean;
  }): ConversationTurnResult | ConversationRefusal {
    const action = this.store.getAction(input.actionId);
    if (!action) {
      return refuse('RESOURCE_NOT_OWNED', 'Action not found.');
    }
    const recorded = recordHumanApproval({
      action,
      actor: input.actor,
      now: input.now,
      acknowledgements: input.acknowledgements ?? [],
      ...(input.conversationalYes !== undefined ? { conversationalYes: input.conversationalYes } : {}),
    });
    if (!recorded.ok) {
      if (recorded.code === 'STEP_UP_REQUIRED') {
        const stepped = this.setStatus(action, 'AWAITING_STEP_UP', input.now, 'STEP_UP_REQUIRED', 'Additional verification is required.');
        return ok(mustSession(this.store, action.conversationId), stepped, stepped.card, [], this.store.eventsAfter(action.conversationId, 0), null, 'STEP_UP');
      }
      return recorded;
    }
    const approved = this.setStatus(action, 'APPROVED', input.now, 'APPROVED', 'Human approved the proposal.', recorded.approval);
    const executed = this.ports.execute({
      subjectId: action.subjectId,
      proposalId: action.proposal?.proposalId ?? '',
      approvalId: recorded.approval.approvalId,
    });
    if (!executed.ok) {
      const failed = this.setStatus(approved, 'FAILED', input.now, 'FAILED', executed.message);
      return ok(mustSession(this.store, action.conversationId), failed, failed.card, [], this.store.eventsAfter(action.conversationId, 0), notificationForStatus({ actionId: failed.actionId, status: 'FAILED' }), 'FAILED');
    }
    const nextStatus = executed.status as ActionCardStatus;
    const finished = this.setStatus(approved, nextStatus, input.now, nextStatus === 'COMPLETED' ? 'COMPLETED' : 'STATUS', languageForPhase(nextStatus));
    const notification = notificationForStatus({ actionId: finished.actionId, status: finished.status });
    return ok(
      mustSession(this.store, action.conversationId),
      finished,
      finished.card,
      [],
      this.store.eventsAfter(action.conversationId, 0),
      notification,
      nextStatus === 'COMPLETED' ? 'COMPLETED' : 'SUBMITTED',
    );
  }

  reject(input: { readonly actionId: string; readonly actor: ConversationActor; readonly now: UtcInstant }): ConversationTurnResult | ConversationRefusal {
    return this.terminal(input, 'REJECTED', 'REJECTED', 'The proposal was rejected.');
  }

  cancel(input: { readonly actionId: string; readonly actor: ConversationActor; readonly now: UtcInstant }): ConversationTurnResult | ConversationRefusal {
    return this.terminal(input, 'CANCELLED', 'REJECTED', 'The proposal was cancelled.');
  }

  modify(input: {
    readonly actionId: string;
    readonly actor: ConversationActor;
    readonly amountRaw: string;
    readonly now: UtcInstant;
  }): ConversationTurnResult | ConversationRefusal {
    const action = this.store.getAction(input.actionId);
    if (!action || action.subjectId !== input.actor.subjectId) {
      return refuse('RESOURCE_NOT_OWNED', 'Action not found.');
    }
    if (!action.proposal) {
      return refuse('SLOT_REQUIRED', 'There is no proposal to modify.');
    }
    if (action.status === 'APPROVED' || action.status === 'PROCESSING' || action.status === 'SUBMITTED' || action.status === 'COMPLETED') {
      return refuse('PROPOSAL_ALREADY_APPROVED', 'Approved terms cannot be mutated.');
    }
    if (!parseAmountToMinorUnits(input.amountRaw)) {
      return refuse('FINANCIAL_TERM_NOT_GUESSED', 'I will not guess a replacement amount.');
    }
    const revised = this.ports.modifyProposal({
      subjectId: action.subjectId,
      proposalId: action.proposal.proposalId,
      amountRaw: input.amountRaw,
      now: input.now,
    });
    if ('ok' in revised && revised.ok === false) {
      return refuse('PROPOSAL_ALREADY_APPROVED', revised.message);
    }
    const superseded = this.setStatus(action, 'SUPERSEDED', input.now, 'PROPOSAL_SUPERSEDED', 'Previous proposal superseded.');
    const next = this.materializeAction({
      session: mustSession(this.store, action.conversationId),
      intent: action.intent,
      type: action.type,
      proposal: revised as DomainProposalRef,
      status: (revised as DomainProposalRef).requiresStepUp ? 'AWAITING_STEP_UP' : 'AWAITING_APPROVAL',
      now: input.now,
      historyKind: 'PROPOSAL_MODIFIED',
    });
    void superseded;
    return ok(mustSession(this.store, action.conversationId), next, next.card, [], this.store.eventsAfter(action.conversationId, 0), notificationForStatus({ actionId: next.actionId, status: next.status }), 'PROPOSAL_CREATED');
  }

  private modifyFromChat(
    session: ConversationSession,
    actor: ConversationActor,
    text: string,
    now: UtcInstant,
  ): ConversationTurnResult | ConversationRefusal {
    if (!session.activeActionId) {
      return refuse('SLOT_REQUIRED', 'There is no active proposal to modify.');
    }
    const amount = extractSlotsFromText(text).amount?.raw;
    if (!amount) {
      return refuse('FINANCIAL_TERM_NOT_GUESSED', 'I will not guess a replacement amount.');
    }
    return this.modify({ actionId: session.activeActionId, actor, amountRaw: amount, now });
  }

  private informationalTurn(session: ConversationSession, intent: ConversationIntent, now: UtcInstant): ConversationTurnResult {
    if (intent === 'GROWTH_REQUEST' || intent === 'FINANCIAL_ANALYSIS' || intent === 'INFORMATION_REQUEST') {
      this.ports.invokeTool('getFinancialSnapshot', session.subjectId, {});
      this.ports.invokeTool('getGrowthOpportunities', session.subjectId, {});
      this.ports.invokeTool('getGrowthPlan', session.subjectId, {});
      this.ports.invokeTool('getGrowthScenarios', session.subjectId, {});
      this.event(session.conversationId, null, now, 'TOOL_PROGRESS', { tools: ['getFinancialSnapshot', 'getGrowthOpportunities', 'getGrowthPlan'] });
    }
    const text =
      intent === 'GROWTH_REQUEST'
        ? 'I read your snapshot, opportunities, and a growth plan. Scenario bands are projections, not promises. I can create a growth proposal when you want one.'
        : 'I can answer from authorized tools. I will not invent balances or rates.';
    const spoken = this.speak(session, now, text, 'EXPLAINING');
    return ok(spoken, null, null, [], this.store.eventsAfter(session.conversationId, 0), null, 'EXPLAINING');
  }

  private ask(session: ConversationSession, questions: readonly SlotQuestion[], now: UtcInstant): ConversationTurnResult {
    const text = questions.map((item) => item.prompt).join(' ');
    const spoken = this.speak(session, now, text, 'COLLECTING');
    this.event(session.conversationId, session.activeActionId, now, 'MESSAGE', { role: 'AGENT', questions });
    return ok(spoken, session.activeActionId ? this.store.getAction(session.activeActionId) ?? null : null, null, questions, this.store.eventsAfter(session.conversationId, 0), null, 'COLLECTING');
  }

  private materializeAction(input: {
    readonly session: ConversationSession;
    readonly intent: ConversationIntent;
    readonly type: NonNullable<ReturnType<typeof cardTypeForIntent>>;
    readonly proposal: DomainProposalRef;
    readonly status: ActionCardStatus;
    readonly now: UtcInstant;
    readonly historyKind: ActionHistoryEntry['kind'];
  }): ConversationalAction {
    const actionId = actionIdFor(input.session.subjectId, `${input.proposal.proposalId}:${input.now}`);
    const card = buildActionCard({
      actionId,
      type: input.type,
      title: titleFor(input.type),
      summary: `${input.type} proposal v${String(input.proposal.version)}`,
      status: input.status,
      proposal: input.proposal,
      now: input.now,
    });
    const snapshot = this.ports.invokeTool('getFinancialSnapshot', input.session.subjectId, {});
    const explanation = explainActionCard({
      actionId,
      card,
      proposal: input.proposal,
      ...(snapshot.ok
        ? {
            snapshotBalance: {
              currency: String(snapshot.value.currency ?? 'USD'),
              minorUnits: String(snapshot.value.minorUnits ?? '0'),
              uncertainty: snapshot.uncertainty,
              source: snapshot.source,
            },
          }
        : {}),
    });
    const action: ConversationalAction = Object.freeze({
      actionId,
      conversationId: input.session.conversationId,
      subjectId: input.session.subjectId,
      intent: input.intent,
      type: input.type,
      status: input.status,
      proposal: input.proposal,
      card,
      explanation,
      history: Object.freeze([
        history(input.now, input.historyKind, `Proposal ${input.proposal.proposalId} version ${String(input.proposal.version)}`, input.status, [
          input.proposal.proposalId,
        ]),
      ]),
      approval: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.store.putAction(action);
    this.store.putSession(
      Object.freeze({
        ...input.session,
        activeActionId: actionId,
      }),
    );
    return action;
  }

  private setStatus(
    action: ConversationalAction,
    status: ActionCardStatus,
    now: UtcInstant,
    kind: ActionHistoryEntry['kind'],
    summary: string,
    approval: ConversationalAction['approval'] = action.approval,
  ): ConversationalAction {
    const card = buildActionCard({
      actionId: action.actionId,
      type: action.type,
      title: action.card.title,
      summary: action.card.summary,
      status,
      proposal: action.proposal,
      now,
    });
    const next: ConversationalAction = Object.freeze({
      ...action,
      status,
      card,
      explanation: explainActionCard({ actionId: action.actionId, card, proposal: action.proposal }),
      approval,
      history: Object.freeze([...action.history, history(now, kind, summary, status, [action.actionId])]),
      updatedAt: now,
    });
    this.store.putAction(next);
    this.event(action.conversationId, action.actionId, now, 'STATUS', { status, summary });
    return next;
  }

  private terminal(
    input: { readonly actionId: string; readonly actor: ConversationActor; readonly now: UtcInstant },
    status: ActionCardStatus,
    kind: ActionHistoryEntry['kind'],
    summary: string,
  ): ConversationTurnResult | ConversationRefusal {
    const action = this.store.getAction(input.actionId);
    if (!action || action.subjectId !== input.actor.subjectId) {
      return refuse('RESOURCE_NOT_OWNED', 'Action not found.');
    }
    if (input.actor.kind !== 'HUMAN') {
      return refuse('APPROVAL_REQUIRES_HUMAN', 'Only a human can reject or cancel.');
    }
    const next = this.setStatus(action, status, input.now, kind, summary);
    return ok(mustSession(this.store, action.conversationId), next, next.card, [], this.store.eventsAfter(action.conversationId, 0), null, 'REFUSED');
  }

  private speak(
    session: ConversationSession,
    now: UtcInstant,
    text: string,
    phase: ConversationMessage['languagePhase'],
  ): ConversationSession {
    const next = Object.freeze({
      ...session,
      messages: Object.freeze([...session.messages, message('AGENT', text, now, phase)]),
    });
    this.store.putSession(next);
    this.event(session.conversationId, session.activeActionId, now, 'MESSAGE', { role: 'AGENT', text, phase });
    return next;
  }

  private event(
    conversationId: string,
    actionId: string | null,
    at: UtcInstant,
    kind: ConversationEvent['kind'],
    payload: Readonly<Record<string, unknown>>,
  ): ConversationEvent {
    return this.store.appendEvent({ conversationId, actionId, at, kind, payload });
  }
}

export function conversationNow(value = '2026-08-23T06:00:00.000Z'): UtcInstant {
  return asUtcInstant(value);
}

function ok(
  conversation: ConversationSession,
  action: ConversationalAction | null,
  card: ActionCard | null,
  questions: readonly SlotQuestion[],
  events: readonly ConversationEvent[],
  notification: ConversationTurnResult['notification'],
  languagePhase: ConversationMessage['languagePhase'],
): ConversationTurnResult {
  return Object.freeze({
    ok: true,
    conversation,
    action,
    card,
    questions,
    events,
    notification,
    languagePhase,
    agentIsApprover: false,
    productionMoneyMovement: false,
  });
}

function refuse(code: ConversationRefusal['code'], message: string): ConversationRefusal {
  return Object.freeze({
    ok: false,
    code,
    message,
    agentIsApprover: false,
    productionMoneyMovement: false,
  });
}

function message(
  role: ConversationMessage['role'],
  text: string,
  at: UtcInstant,
  languagePhase: ConversationMessage['languagePhase'],
): ConversationMessage {
  return Object.freeze({
    messageId: `msg_${contentHash({ role, text, at }).slice(0, 16)}`,
    role,
    text,
    at,
    languagePhase,
    claimsCompletion: false,
  });
}

function history(
  at: UtcInstant,
  kind: ActionHistoryEntry['kind'],
  summary: string,
  status: ActionCardStatus,
  refs: readonly string[],
): ActionHistoryEntry {
  return Object.freeze({ at, kind, summary, status, refs });
}

function mustSession(store: InMemoryConversationStore, id: string): ConversationSession {
  const session = store.getSession(id);
  if (!session) {
    throw new Error('conversation session missing');
  }
  return session;
}

function slotRecord(slots: Readonly<Record<string, SlotValue>>): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(slots)) {
    out[key] = value.resolvedId ?? value.raw;
  }
  return Object.freeze(out);
}

function entitySlotsFor(intent: ConversationIntent): readonly ('recipient' | 'sourceAccount' | 'asset' | 'destination' | 'card' | 'goal')[] {
  if (intent === 'PAYMENT_REQUEST') {
    return ['recipient', 'sourceAccount'];
  }
  if (intent === 'FX_REQUEST' || intent === 'INVESTMENT_REQUEST') {
    return ['sourceAccount'];
  }
  if (intent === 'EXCHANGE_REQUEST') {
    return ['asset', 'sourceAccount'];
  }
  if (intent === 'WITHDRAWAL_REQUEST') {
    return ['destination', 'sourceAccount'];
  }
  return [];
}

function proposalTool(type: NonNullable<ReturnType<typeof cardTypeForIntent>>): string {
  switch (type) {
    case 'PAYMENT':
      return 'createPaymentProposal';
    case 'FX':
      return 'createFxProposal';
    case 'GROWTH':
    case 'INVESTMENT':
      return 'createGrowthProposal';
    case 'EXCHANGE':
      return 'createExchangeProposal';
    default:
      return 'createPaymentProposal';
  }
}

function titleFor(type: NonNullable<ReturnType<typeof cardTypeForIntent>>): string {
  switch (type) {
    case 'PAYMENT':
      return 'Send money';
    case 'FX':
      return 'Convert currency';
    case 'GROWTH':
      return 'Grow proposal';
    case 'INVESTMENT':
      return 'Investment proposal';
    case 'EXCHANGE':
      return 'Exchange order';
    case 'WITHDRAWAL':
      return 'Withdrawal';
    case 'CARD_CONTROL':
      return 'Card control';
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

function languageForPhase(status: ActionCardStatus): string {
  if (status === 'COMPLETED') {
    return 'Domain execution reported completion.';
  }
  return 'The approved proposal was submitted. Submitted is not completed.';
}

function usesAnotherCustomer(text: string): boolean {
  return /another user's account|someone else's account|other customer/i.test(text);
}

function ineligibleBuy(text: string): boolean {
  return /restricted_coin|something i'm not eligible/i.test(text);
}

function defaultSourceAccount(
  slots: ConversationSession['slots'],
  catalog: ReturnType<ConversationDomainPorts['catalog']>,
): ConversationSession['slots'] {
  if (slots.sourceAccount) {
    return slots;
  }
  const currency = slots.currency?.raw ?? slots.sourceCurrency?.raw;
  if (!currency) {
    return slots;
  }
  const matches = catalog.accounts.filter((item) => item.currency === currency);
  const account =
    matches.length === 1
      ? matches[0]
      : matches.find((item) => item.labels.some((label) => /checking|current/i.test(label)));
  if (!account) {
    return slots;
  }
  return Object.freeze({
    ...slots,
    sourceAccount: Object.freeze({
      name: 'sourceAccount' as const,
      raw: account.labels[0] ?? account.id,
      resolvedId: account.id,
      displayLabel: account.labels[0] ?? account.id,
      uncertainty: 'FACT' as const,
      guessed: false,
    }),
  });
}
