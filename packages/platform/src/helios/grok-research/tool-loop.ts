import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import { authorizeResearchToolRequest } from './tool-authorizer.ts';
import type { HeliosResearchToolRegistry } from './tool-registry.ts';
import type { ResearchReasoningEngine } from './reasoning.ts';
import type { SanitizedResearchContext } from './context-sanitizer.ts';
import {
  initialBudgetLedger,
  isBudgetExhausted,
  recordFailedAttempt,
  recordModelCall,
  recordToolCall,
  toResearchUsage,
} from './budget-accounting.ts';
import { DEFAULT_RESEARCH_LOOP_LIMITS } from './limits.ts';
import type {
  HeliosResearchTaskInput,
  ResearchLoopLimits,
  ResearchToolCallRecord,
  ResearchToolRequest,
} from './types.ts';
import type { ResearchCompletionStatus } from './taxonomy.ts';

export type ToolLoopOutcome = {
  readonly toolRecords: readonly ResearchToolCallRecord[];
  readonly synthesis: string | null;
  readonly completionStatus: ResearchCompletionStatus;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly usage: ReturnType<typeof toResearchUsage>;
  readonly iterations: number;
};

export type ToolLoopOptions = {
  readonly cancelled?: () => boolean;
  readonly limits?: ResearchLoopLimits;
};

export async function runBoundedResearchToolLoop(input: {
  readonly clock: Clock;
  readonly task: HeliosResearchTaskInput;
  readonly context: SanitizedResearchContext;
  readonly registry: HeliosResearchToolRegistry;
  readonly reasoning: ResearchReasoningEngine;
  readonly options?: ToolLoopOptions;
}): Promise<ToolLoopOutcome> {
  const limits = input.options?.limits ?? DEFAULT_RESEARCH_LOOP_LIMITS;
  const startedAtMs = Date.now();
  const startedAt = input.clock.now();
  let ledger = initialBudgetLedger(startedAtMs);
  const toolRecords: ResearchToolCallRecord[] = [];
  let synthesis: string | null = null;
  let provider = input.reasoning.providerId;
  let model = 'unknown';
  let modelVersion = '0.0.0';
  let iterations = 0;
  let completionStatus: ResearchCompletionStatus = 'COMPLETED';

  if (!input.reasoning.isAvailable()) {
    return {
      toolRecords: Object.freeze([]),
      synthesis: null,
      completionStatus: 'PROVIDER_UNAVAILABLE',
      provider: 'XAI_GROK',
      model: 'unavailable',
      modelVersion: '0.0.0',
      usage: toResearchUsage(ledger, input.task.budgetUnitKind, Date.now()),
      iterations: 0,
    };
  }

  for (let step = 0; step < limits.maxReasoningIterations; step += 1) {
    if (input.options?.cancelled?.()) {
      completionStatus = 'CANCELLED';
      break;
    }
    if (Date.now() - startedAtMs > limits.maxWallClockMs) {
      completionStatus = 'PROVIDER_TIMEOUT';
      break;
    }
    if (ledger.modelCalls >= limits.maxModelCalls) {
      completionStatus = 'LIMIT_REACHED';
      break;
    }
    if (ledger.toolCalls >= limits.maxToolCalls) {
      completionStatus = 'LIMIT_REACHED';
      break;
    }
    if (isBudgetExhausted(ledger, input.task.budgetCeiling)) {
      completionStatus = 'BUDGET_EXHAUSTED';
      break;
    }

    let reasoningOutput;
    try {
      reasoningOutput = await input.reasoning.reason({
        task: input.task,
        context: input.context,
        stepIndex: step,
        priorToolResults: Object.freeze([...toolRecords]),
        now: input.clock.now(),
      });
    } catch (error) {
      ledger = recordFailedAttempt(ledger);
      if (String(error).includes('GROK_UNAVAILABLE') || String(error).includes('TIMEOUT')) {
        completionStatus = 'PROVIDER_UNAVAILABLE';
      } else {
        completionStatus = 'FAILED';
      }
      break;
    }

    provider = reasoningOutput.provider;
    model = reasoningOutput.model;
    modelVersion = reasoningOutput.modelVersion;
    ledger = recordModelCall(ledger, {
      inputTokens: reasoningOutput.step.inputTokens,
      outputTokens: reasoningOutput.step.outputTokens,
      costMicros: '1000',
    });
    iterations += 1;

    if (ledger.inputTokens > limits.maxInputTokens || ledger.outputTokens > limits.maxOutputTokens) {
      completionStatus = 'LIMIT_REACHED';
      break;
    }

    for (const toolRequest of reasoningOutput.step.toolRequests) {
      if (ledger.toolCalls >= limits.maxToolCalls) {
        completionStatus = 'LIMIT_REACHED';
        break;
      }
      const auth = authorizeResearchToolRequest({
        request: toolRequest,
        task: input.task,
        registry: input.registry,
        budgetConsumed: ledger.consumed,
        toolCallsUsed: ledger.toolCalls,
        perToolLimit: limits.perToolCallLimit,
        now: input.clock.now(),
      });
      const completedAt = input.clock.now();
      if (auth.outcome !== 'ALLOWED' || !auth.tool) {
        toolRecords.push(Object.freeze({
          request: toolRequest,
          authorization: auth.outcome,
          capability: auth.tool?.category ?? null,
          budgetImpact: '0',
          resultEvidenceRef: null,
          resultPayload: null,
          error: auth.reason,
          completedAt,
        }));
        if (auth.outcome === 'DENIED_BUDGET') {
          completionStatus = 'BUDGET_EXHAUSTED';
        }
        continue;
      }
      const execResult = await auth.tool.execute(toolRequest.operation, toolRequest.input);
      if (!execResult.ok) {
        ledger = recordFailedAttempt(ledger);
        toolRecords.push(Object.freeze({
          request: toolRequest,
          authorization: 'ALLOWED',
          capability: auth.tool.category,
          budgetImpact: auth.budgetImpact,
          resultEvidenceRef: null,
          resultPayload: null,
          error: execResult.error,
          completedAt,
        }));
        continue;
      }
      ledger = recordToolCall(ledger, auth.budgetImpact);
      toolRecords.push(Object.freeze({
        request: toolRequest,
        authorization: 'ALLOWED',
        capability: auth.tool.category,
        budgetImpact: auth.budgetImpact,
        resultEvidenceRef: execResult.evidenceRef,
        resultPayload: execResult.payload,
        error: null,
        completedAt,
      }));
    }

    if (reasoningOutput.step.isFinal || reasoningOutput.step.synthesis) {
      synthesis = reasoningOutput.step.synthesis;
      if (completionStatus === 'COMPLETED') {
        break;
      }
    }
  }

  if (completionStatus === 'COMPLETED' && !synthesis && toolRecords.length === 0) {
    completionStatus = 'PARTIAL_DEGRADED';
  }

  return {
    toolRecords: Object.freeze(toolRecords),
    synthesis,
    completionStatus,
    provider,
    model,
    modelVersion,
    usage: toResearchUsage(ledger, input.task.budgetUnitKind, Date.now()),
    iterations,
  };
}

export function createToolRequest(
  task: HeliosResearchTaskInput,
  toolId: string,
  operation: string,
  toolInput: Readonly<Record<string, unknown>>,
  now: UtcInstant,
): ResearchToolRequest {
  return Object.freeze({
    requestId: `treq_${randomUUID()}`,
    taskId: task.taskId,
    workOrderId: task.workOrderId,
    toolId,
    operation,
    input: toolInput,
    requestedAt: now,
  });
}
