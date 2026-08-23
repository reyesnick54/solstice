import type { AiRequestId } from './ids.ts';
import { redactSecrets } from './secrets.ts';
import type { AiFailureCode } from './taxonomy.ts';
import type { AiInferenceResponse, AiStructuredOutput, AiToolIntent } from './types.ts';

export const AI_STREAM_EVENT_TYPES = [
  'message.started',
  'message.delta',
  'tool.started',
  'tool.completed',
  'proposal.created',
  'message.completed',
  'error',
] as const;
export type AiStreamEventType = (typeof AI_STREAM_EVENT_TYPES)[number];

export type AiStreamEvent = {
  readonly type: AiStreamEventType;
  readonly requestId: AiRequestId;
  readonly sequence: number;
  readonly text?: string;
  readonly toolName?: string;
  readonly proposalKind?: AiStructuredOutput['kind'];
  readonly safeExplanation?: string;
  readonly errorCode?: AiFailureCode;
  readonly hiddenReasoning: false;
};

export function streamEventsFromResponse(
  requestId: AiRequestId,
  response: AiInferenceResponse,
): readonly AiStreamEvent[] {
  const events: AiStreamEvent[] = [];
  let sequence = 0;
  events.push(event(requestId, sequence++, 'message.started'));
  const visible = customerSafeText(response);
  if (visible) {
    for (const chunk of chunkText(visible, 24)) {
      events.push(event(requestId, sequence++, 'message.delta', { text: chunk }));
    }
  }
  for (const intent of response.toolIntents) {
    events.push(event(requestId, sequence++, 'tool.started', { toolName: intent.name }));
    events.push(
      event(requestId, sequence++, 'tool.completed', {
        toolName: intent.name,
        safeExplanation: customerSafeToolExplanation(intent),
      }),
    );
  }
  if (response.structured?.kind === 'FINANCIAL_PROPOSAL') {
    events.push(
      event(requestId, sequence++, 'proposal.created', {
        proposalKind: 'FINANCIAL_PROPOSAL',
        safeExplanation: response.structured.operationalRationale,
      }),
    );
  }
  events.push(event(requestId, sequence++, 'message.completed', { safeExplanation: visible }));
  return Object.freeze(events);
}

export function streamErrorEvent(
  requestId: AiRequestId,
  code: AiFailureCode,
  detail: string,
): AiStreamEvent {
  return event(requestId, 0, 'error', {
    errorCode: code,
    safeExplanation: redactSecrets(detail),
  });
}

export function encodeSse(events: readonly AiStreamEvent[]): string {
  return events
    .map((item) => `event: ${item.type}\ndata: ${JSON.stringify(publicStreamEvent(item))}\n\n`)
    .join('');
}

export function publicStreamEvent(event: AiStreamEvent): Readonly<Record<string, unknown>> {
  return Object.freeze({
    type: event.type,
    requestId: event.requestId,
    sequence: event.sequence,
    ...(event.text !== undefined ? { text: event.text } : {}),
    ...(event.toolName !== undefined ? { toolName: event.toolName } : {}),
    ...(event.proposalKind !== undefined ? { proposalKind: event.proposalKind } : {}),
    ...(event.safeExplanation !== undefined ? { safeExplanation: event.safeExplanation } : {}),
    ...(event.errorCode !== undefined ? { errorCode: event.errorCode } : {}),
    hiddenReasoning: false,
  });
}

function customerSafeText(response: AiInferenceResponse): string {
  if (response.structured?.kind === 'EXPLANATION') {
    return redactSecrets(response.structured.text);
  }
  if (typeof response.text === 'string' && response.text.length > 0) {
    return redactSecrets(response.text);
  }
  if (response.structured?.kind === 'FINANCIAL_PROPOSAL') {
    return redactSecrets(response.structured.operationalRationale);
  }
  return '';
}

function customerSafeToolExplanation(intent: AiToolIntent): string {
  return redactSecrets(intent.rationale);
}

function chunkText(text: string, size: number): readonly string[] {
  if (text.length === 0) {
    return Object.freeze([]);
  }
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return Object.freeze(chunks);
}

function event(
  requestId: AiRequestId,
  sequence: number,
  type: AiStreamEventType,
  extra: Partial<Omit<AiStreamEvent, 'type' | 'requestId' | 'sequence' | 'hiddenReasoning'>> = {},
): AiStreamEvent {
  return Object.freeze({
    type,
    requestId,
    sequence,
    hiddenReasoning: false,
    ...extra,
  });
}
