import type { Clock } from '../../config/src/clock.ts';
import { sha256Canonical, traceIdFor } from './ids.ts';
import { redactSecrets } from './secrets.ts';
import type { AiDataClass, AiFailureCode, AiProviderKind, AiTaskClass, AiToolIntentName } from './taxonomy.ts';
import type {
  AiInferenceRequest,
  AiInferenceResponse,
  AiInferenceTrace,
  AiModelReference,
  AiProviderUsage,
  AiRoutingDecision,
} from './types.ts';

export function buildInferenceTrace(input: {
  readonly request: AiInferenceRequest;
  readonly clock: Clock;
  readonly startedAt: AiInferenceTrace['startedAt'];
  readonly routing: AiRoutingDecision;
  readonly provider: AiProviderKind | null;
  readonly success: boolean;
  readonly failureCode: AiFailureCode | null;
  readonly response: AiInferenceResponse | null;
  readonly usage: AiProviderUsage;
}): AiInferenceTrace {
  const endedAt = input.clock.now();
  const promptHash = sha256Canonical(input.request.prompt);
  const responseHash = input.response ? sha256Canonical(JSON.stringify({
    text: input.response.text,
    structured: input.response.structured,
    tools: input.response.toolIntents.map((intent) => intent.name),
  })) : null;
  return Object.freeze({
    requestId: input.request.requestId,
    traceId: traceIdFor(input.request.requestId, input.startedAt),
    agentId: input.request.authorization.agentId,
    mandateId: input.request.authorization.mandateId,
    provider: input.provider,
    modelRef: input.request.modelRef,
    taskClass: input.request.taskClass,
    routingDecision: input.routing,
    startedAt: input.startedAt,
    endedAt,
    success: input.success,
    failureCode: input.failureCode,
    usage: input.usage,
    toolIntentsRequested: Object.freeze(
      input.response?.toolIntents.map((intent) => intent.name) ?? ([] as AiToolIntentName[]),
    ),
    dataClass: input.request.dataClass,
    redactionStatus:
      input.request.dataClass === 'PUBLIC' || input.request.dataClass === 'SYNTHETIC'
        ? 'PUBLIC_SYNTHETIC_ALLOWED'
        : 'REDACTED_DEFAULT',
    promptHash,
    responseHash,
    storedRawPrompt: false,
    storedSecrets: false,
  });
}

export function publicTraceView(trace: AiInferenceTrace): Record<string, unknown> {
  return Object.freeze({
    requestId: trace.requestId,
    traceId: trace.traceId,
    agentId: trace.agentId,
    mandateId: trace.mandateId,
    provider: trace.provider,
    model: `${trace.modelRef.modelId}@${trace.modelRef.version}`,
    taskClass: trace.taskClass,
    routing: {
      primary: trace.routingDecision.primary,
      shadow: trace.routingDecision.shadow,
      reason: redactSecrets(trace.routingDecision.reason),
    },
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
    success: trace.success,
    failureCode: trace.failureCode,
    usage: trace.usage,
    toolIntentsRequested: trace.toolIntentsRequested,
    dataClass: trace.dataClass,
    redactionStatus: trace.redactionStatus,
    promptHash: trace.promptHash,
    responseHash: trace.responseHash,
    storedRawPrompt: false,
    storedSecrets: false,
  });
}

export type { AiDataClass, AiTaskClass, AiModelReference };
