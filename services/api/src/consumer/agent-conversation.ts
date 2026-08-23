/**
 * Agent conversation surface for Lovable.
 * This is not a raw LLM endpoint. The BFF never imports a model vendor.
 * Financial execution remains Kernel-gated outside this module.
 */

export const AGENT_STREAM_EVENT_TYPES = [
  'message.started',
  'message.delta',
  'tool.started',
  'tool.completed',
  'proposal.created',
  'message.completed',
  'error',
] as const;
export type AgentStreamEventType = (typeof AGENT_STREAM_EVENT_TYPES)[number];

export type AgentStreamEvent = {
  readonly type: AgentStreamEventType;
  readonly sequence: number;
  readonly text?: string;
  readonly toolName?: string;
  readonly safeExplanation?: string;
  readonly errorCode?: string;
  readonly hiddenReasoning: false;
  readonly financialExecuted: false;
};

export type AgentConversationResponse = {
  readonly conversationId: string;
  readonly requestId: string;
  readonly protocol: 'server_sent_events';
  readonly events: readonly AgentStreamEvent[];
  readonly sse: string;
  readonly financialExecuted: false;
  readonly rawLlm: false;
  readonly productionActive: false;
};

export function encodeAgentSse(events: readonly AgentStreamEvent[]): string {
  return events
    .map((event) => `event: ${event.type}\ndata: ${JSON.stringify({ ...event, hiddenReasoning: false })}\n\n`)
    .join('');
}

export function agentConversationReply(input: {
  readonly conversationId: string;
  readonly requestId: string;
  readonly text: string;
}): AgentConversationResponse {
  const explanation = customerSafe(input.text);
  const events: AgentStreamEvent[] = [
    event('message.started', 0),
    event('message.delta', 1, { text: explanation.slice(0, 32) || 'SunRey Agent' }),
    event('tool.started', 2, { toolName: 'READ_FINANCIAL_STATE' }),
    event('tool.completed', 3, {
      toolName: 'READ_FINANCIAL_STATE',
      safeExplanation: 'Read-only context lookup. No financial mutation.',
    }),
    event('message.completed', 4, { safeExplanation: explanation }),
  ];
  return Object.freeze({
    conversationId: input.conversationId,
    requestId: input.requestId,
    protocol: 'server_sent_events',
    events: Object.freeze(events),
    sse: encodeAgentSse(events),
    financialExecuted: false,
    rawLlm: false,
    productionActive: false,
  });
}

function customerSafe(text: string): string {
  if (/ignore (all|any|previous)|reveal the master key|jailbreak/i.test(text)) {
    return 'I can explain approved account context. I cannot execute payments or bypass controls.';
  }
  return 'This is a customer-safe Agent explanation. It is not an executable financial command.';
}

function event(
  type: AgentStreamEventType,
  sequence: number,
  extra: Partial<Omit<AgentStreamEvent, 'type' | 'sequence' | 'hiddenReasoning' | 'financialExecuted'>> = {},
): AgentStreamEvent {
  return Object.freeze({
    type,
    sequence,
    hiddenReasoning: false,
    financialExecuted: false,
    ...extra,
  });
}

export const FORBIDDEN_PUBLIC_LLM_PATHS = Object.freeze([
  '/api/v1/llm',
  '/api/v1/completions',
  '/api/v1/openai',
  '/api/v1/models/infer',
  '/v1/chat/completions',
]);
