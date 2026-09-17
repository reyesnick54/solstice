import { randomUUID } from 'node:crypto';
import type { UtcInstant } from '@solstice/domain';
import type { SanitizedResearchContext } from './context-sanitizer.ts';
import type { HeliosResearchTaskInput, ResearchReasoningStep, ResearchToolRequest } from './types.ts';
import type { ResearchToolCallRecord } from './types.ts';

export type ReasoningEngineInput = {
  readonly task: HeliosResearchTaskInput;
  readonly context: SanitizedResearchContext;
  readonly stepIndex: number;
  readonly priorToolResults: readonly ResearchToolCallRecord[];
  readonly now: UtcInstant;
};

export type ReasoningEngineOutput = {
  readonly step: ResearchReasoningStep;
  readonly provider: string;
  readonly model: string;
  readonly modelVersion: string;
};

export type ResearchReasoningEngine = {
  readonly providerId: string;
  isAvailable(): boolean;
  reason(input: ReasoningEngineInput): Promise<ReasoningEngineOutput>;
};

/**
 * Deterministic simulation reasoning for CI. Labeled LOCAL_TEST, never XAI_GROK.
 */
export class SimulationResearchReasoningEngine implements ResearchReasoningEngine {
  readonly providerId = 'LOCAL_TEST';

  isAvailable(): boolean {
    return true;
  }

  async reason(input: ReasoningEngineInput): Promise<ReasoningEngineOutput> {
    const { stepIndex, priorToolResults, context, task, now } = input;
    const modelCallId = `mcall_${randomUUID()}`;

    if (stepIndex === 0) {
      const toolRequests: ResearchToolRequest[] = [];
      if (task.permittedTools.includes('tool_economic_data_search')) {
        toolRequests.push(Object.freeze({
          requestId: `treq_${randomUUID()}`,
          taskId: task.taskId,
          workOrderId: task.workOrderId,
          toolId: 'tool_economic_data_search',
          operation: 'search',
          input: Object.freeze({ query: context.question }),
          requestedAt: now,
        }));
      }
      if (task.permittedTools.includes('tool_market_observation')) {
        toolRequests.push(Object.freeze({
          requestId: `treq_${randomUUID()}`,
          taskId: task.taskId,
          workOrderId: task.workOrderId,
          toolId: 'tool_market_observation',
          operation: 'lookup_quote',
          input: Object.freeze({ symbol: 'USD' }),
          requestedAt: now,
        }));
      }
      return {
        step: Object.freeze({
          stepIndex,
          modelCallId,
          toolRequests: Object.freeze(toolRequests),
          synthesis: null,
          isFinal: false,
          inputTokens: 200,
          outputTokens: 80,
        }),
        provider: 'LOCAL_TEST',
        model: 'simulation-research-v1',
        modelVersion: '1.0.0',
      };
    }

    const successfulTools = priorToolResults.filter((r) => r.authorization === 'ALLOWED');
    const isFinal = stepIndex >= 1 || successfulTools.length > 0;
    return {
      step: Object.freeze({
        stepIndex,
        modelCallId,
        toolRequests: Object.freeze([]),
        synthesis: `Public research synthesis for: ${context.question}`,
        isFinal,
        inputTokens: 150 + successfulTools.length * 50,
        outputTokens: 120,
      }),
      provider: 'LOCAL_TEST',
      model: 'simulation-research-v1',
      modelVersion: '1.0.0',
    };
  }
}

export class UnavailableGrokReasoningEngine implements ResearchReasoningEngine {
  readonly providerId = 'XAI_GROK';

  isAvailable(): boolean {
    return false;
  }

  async reason(_input: ReasoningEngineInput): Promise<ReasoningEngineOutput> {
    throw new Error('GROK_UNAVAILABLE');
  }
}
