import type { UtcInstant } from '../../domain/src/time.ts';
import { runtimeEventIdFor } from './ids.ts';
import type { AgentRuntimeEventKind } from './taxonomy.ts';
import type { AgentRuntimeEvent } from './types.ts';

export function recordAgentRuntimeEvent(input: {
  readonly kind: AgentRuntimeEventKind;
  readonly at: UtcInstant;
  readonly agentId?: AgentRuntimeEvent['agentId'];
  readonly ownerId?: string | null;
  readonly conversationId?: AgentRuntimeEvent['conversationId'];
  readonly memoryId?: AgentRuntimeEvent['memoryId'];
  readonly mandateId?: AgentRuntimeEvent['mandateId'];
  readonly detail: string;
}): AgentRuntimeEvent {
  return Object.freeze({
    eventId: runtimeEventIdFor(input.kind, input.agentId ?? input.conversationId ?? input.memoryId ?? 'none', input.at),
    kind: input.kind,
    agentId: input.agentId ?? null,
    ownerId: input.ownerId ?? null,
    conversationId: input.conversationId ?? null,
    memoryId: input.memoryId ?? null,
    mandateId: input.mandateId ?? null,
    at: input.at,
    detail: input.detail,
    containsConversationContent: false,
  });
}
