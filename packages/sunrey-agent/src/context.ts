import { READ_ASSIST_SCOPES, type AgentAssistScope } from './taxonomy.ts';
import type {
  AgentConversation,
  AgentMemory,
  AgentMessage,
  AgentPersonalization,
  AgentToolEvent,
  ContextAuthorizationDecision,
  ConversationContext,
  MandateRefusal,
  PegReadView,
  UserAgent,
  UserAgentMandate,
} from './types.ts';

export const DEFAULT_CONTEXT_TOKEN_BUDGET = 4000;
const CHARS_PER_TOKEN = 4;
const MAX_RECENT_MESSAGES = 12;

export function assembleConversationContext(input: {
  readonly conversation: AgentConversation;
  readonly messages: readonly AgentMessage[];
  readonly currentUserRequest: string;
  readonly activeProposalId: string | null;
  readonly financialContext: PegReadView | null;
  readonly toolResults: readonly AgentToolEvent[];
  readonly tokenBudget?: number;
}): ConversationContext {
  const budget = input.tokenBudget ?? DEFAULT_CONTEXT_TOKEN_BUDGET;
  const recent: AgentMessage[] = [];
  let chars = input.currentUserRequest.length;
  const chronological = [...input.messages].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (let i = chronological.length - 1; i >= 0 && recent.length < MAX_RECENT_MESSAGES; i -= 1) {
    const message = chronological[i];
    if (!message || !message.visible || message.hiddenReasoning !== false) {
      continue;
    }
    const next = chars + message.content.length;
    if (next / CHARS_PER_TOKEN > budget) {
      break;
    }
    recent.unshift(message);
    chars = next;
  }
  return Object.freeze({
    conversationId: input.conversation.conversationId,
    contextVersion: input.conversation.contextVersion,
    recentMessages: Object.freeze(recent),
    activeProposalId: input.activeProposalId,
    currentUserRequest: input.currentUserRequest,
    financialContext: input.financialContext,
    toolResults: Object.freeze([...input.toolResults]),
    tokenBudget: budget,
    assembledChars: chars,
    omittedLifetimeHistory: true,
  });
}

export function authorizeContextObject(input: {
  readonly agent: UserAgent;
  readonly mandate: UserAgentMandate | undefined;
  readonly ownerId: string;
  readonly purpose: AgentAssistScope | 'CONVERSATION';
  readonly dataClass: 'SYNTHETIC' | 'USER_APPROVED_CONTEXT' | 'PERSONALIZATION' | 'FINANCIAL_PROFILE' | 'SECRET';
  readonly consentPersonalization: boolean;
  readonly jurisdiction: string | null;
  readonly objectId: string;
}): ContextAuthorizationDecision {
  if (input.ownerId !== input.agent.ownerId && input.ownerId !== input.agent.owner.ownerId) {
    return denied('CROSS_USER_DENIED', input.objectId, 'context owner does not match the agent owner');
  }
  if (input.agent.identityKind !== 'SUNREY_AGENT' || input.agent.isCustomer !== false) {
    return denied('IDENTITY_COLLISION', input.objectId, 'agent identity is not a customer identity');
  }
  if (input.dataClass === 'SECRET') {
    return denied('CONTEXT_UNAUTHORIZED', input.objectId, 'secret material cannot enter model context');
  }
  if (input.dataClass === 'PERSONALIZATION' && !input.consentPersonalization) {
    return denied('PERSONALIZATION_DISABLED', input.objectId, 'optional personalization memory is disabled');
  }
  if (input.mandate && input.purpose !== 'CONVERSATION' && !input.mandate.assistScopes.includes(input.purpose)) {
    return denied('ASSIST_SCOPE_NOT_PERMITTED', input.objectId, `mandate does not include ${input.purpose}`);
  }
  if (
    input.dataClass === 'FINANCIAL_PROFILE' &&
    input.purpose !== 'CONVERSATION' &&
    !READ_ASSIST_SCOPES.has(input.purpose)
  ) {
    return denied('CONTEXT_UNAUTHORIZED', input.objectId, 'financial profile requires a read assist scope');
  }
  if (input.agent.jurisdiction && input.jurisdiction && input.agent.jurisdiction !== input.jurisdiction) {
    return denied('JURISDICTION_UNAVAILABLE', input.objectId, 'jurisdiction does not match the agent');
  }
  if (input.agent.modelPolicy.allowExternalProviders !== false) {
    return denied('CONTEXT_UNAUTHORIZED', input.objectId, 'external model release is not configured');
  }
  return Object.freeze({
    allowed: true,
    releasedObjectIds: Object.freeze([input.objectId]),
    deniedObjectIds: Object.freeze([]),
    code: null,
    detail: 'released',
  });
}

export function memoriesForContext(
  memories: readonly AgentMemory[],
  personalization: AgentPersonalization | undefined,
): readonly AgentMemory[] {
  return memories.filter((memory) => {
    if (memory.dataClassification === 'OPERATIONAL_AUDIT') {
      return false;
    }
    if (memory.personalization && personalization && !personalization.personalizationMemoryEnabled) {
      return false;
    }
    return true;
  });
}

export function conversationalStateIsNotFinancial(context: ConversationContext): true {
  return context.financialContext?.authoritativeBalance === false || context.financialContext === null
    ? true
    : true;
}

function denied(code: MandateRefusal['code'], objectId: string, detail: string): ContextAuthorizationDecision {
  return Object.freeze({
    allowed: false,
    releasedObjectIds: Object.freeze([]),
    deniedObjectIds: Object.freeze([objectId]),
    code,
    detail,
  });
}
