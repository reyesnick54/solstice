import type { Clock } from '../../../../config/src/clock.ts';
import type { UtcInstant } from '../../../../domain/src/time.ts';
import {
  estimateInferenceCostMicros,
  resolveModelCapability,
  resolveModelCostProfile,
} from './model-profiles.ts';
import type {
  ModelGatewayInferRequest,
  ModelGatewayInferResult,
  ModelInferencePort,
  ModelInferenceTelemetry,
} from './types.ts';
import type { AgentResearchSessionId } from './ids.ts';
import type { EconomicWorkOrderId } from '../ids.ts';

export type ModelProviderGatewayOptions = {
  readonly clock: Clock;
  readonly inference: ModelInferencePort;
};

/**
 * Provider-neutral research model gateway. Composition roots wire inference from
 * @solstice/ai-runtime — no provider may become an Execution Authority.
 */
export class ModelProviderGateway {
  private readonly clock: Clock;
  private readonly inference: ModelInferencePort;

  constructor(options: ModelProviderGatewayOptions) {
    this.clock = options.clock;
    this.inference = options.inference;
  }

  infer(request: ModelGatewayInferRequest, workOrderId: EconomicWorkOrderId | null): ModelGatewayInferResult {
    const now = this.clock.now();
    const capability = resolveModelCapability(
      request.providerRef,
      request.modelId,
      request.modelVersion,
    );
    if (!capability) {
      return failure(request, workOrderId, now, {
        latencyMs: 0,
        costMicros: 0n,
        contextTokens: request.promptTokens,
        toolCalls: 0,
        failures: 1,
        retries: 0,
        code: 'MODEL_NOT_REGISTERED',
        message: 'model capability is not registered for simulation research',
      });
    }

    if (capability.mayIssueExecutionAuthority) {
      return failure(request, workOrderId, now, {
        latencyMs: 0,
        costMicros: 0n,
        contextTokens: request.promptTokens,
        toolCalls: 0,
        failures: 1,
        retries: 0,
        code: 'EXECUTION_AUTHORITY_FORBIDDEN',
        message: 'models cannot issue Execution Authority',
      });
    }

    const profile = resolveModelCostProfile(request.providerRef, request.modelId);
    const response = this.inference.infer({
      providerRef: request.providerRef,
      modelId: request.modelId,
      modelVersion: request.modelVersion,
      promptTokens: request.promptTokens,
      maxOutputTokens: request.maxOutputTokens,
    });

    const toolCalls = request.toolCallsRequested;
    const retries = 0;
    if (!response.ok) {
      const costMicros =
        profile !== undefined
          ? estimateInferenceCostMicros({
              profile,
              promptTokens: request.promptTokens,
              outputTokens: 0,
              toolCalls,
            })
          : 0n;
      const telemetry = telemetryRow(request, workOrderId, now, {
        latencyMs: response.latencyMs,
        costMicros,
        contextTokens: request.promptTokens,
        toolCalls,
        failures: 1,
        retries,
        outcome: 'FAILURE',
      });
      return Object.freeze({
        ok: false,
        telemetry,
        code: response.code,
        message: response.message,
      });
    }

    const costMicros =
      profile !== undefined
        ? estimateInferenceCostMicros({
            profile,
            promptTokens: request.promptTokens,
            outputTokens: response.outputTokens,
            toolCalls,
          })
        : 0n;

    const telemetry = telemetryRow(request, workOrderId, now, {
      latencyMs: response.latencyMs,
      costMicros,
      contextTokens: request.promptTokens + response.outputTokens,
      toolCalls,
      failures: 0,
      retries,
      outcome: 'SUCCESS',
    });

    return Object.freeze({
      ok: true,
      telemetry,
      outputText: response.outputText,
    });
  }
}

function telemetryRow(
  request: ModelGatewayInferRequest,
  workOrderId: EconomicWorkOrderId | null,
  recordedAt: UtcInstant,
  input: {
    readonly latencyMs: number;
    readonly costMicros: bigint;
    readonly contextTokens: number;
    readonly toolCalls: number;
    readonly failures: number;
    readonly retries: number;
    readonly outcome: ModelInferenceTelemetry['outcome'];
  },
): ModelInferenceTelemetry {
  return Object.freeze({
    model: request.modelId,
    modelVersion: request.modelVersion,
    latencyMs: input.latencyMs,
    costMicros: input.costMicros,
    contextTokens: input.contextTokens,
    toolCalls: input.toolCalls,
    failures: input.failures,
    retries: input.retries,
    outcome: input.outcome,
    researchSessionId: request.sessionId,
    workOrderId,
    researchOutcomeRef: request.researchOutcomeRef,
    recordedAt,
    providerGrantsExecutionAuthority: false,
  });
}

function failure(
  request: ModelGatewayInferRequest,
  workOrderId: EconomicWorkOrderId | null,
  recordedAt: UtcInstant,
  input: {
    readonly latencyMs: number;
    readonly costMicros: bigint;
    readonly contextTokens: number;
    readonly toolCalls: number;
    readonly failures: number;
    readonly retries: number;
    readonly code: string;
    readonly message: string;
  },
): ModelGatewayInferResult {
  const telemetry = telemetryRow(request, workOrderId, recordedAt, {
    latencyMs: input.latencyMs,
    costMicros: input.costMicros,
    contextTokens: input.contextTokens,
    toolCalls: input.toolCalls,
    failures: input.failures,
    retries: input.retries,
    outcome: 'FAILURE',
  });
  return Object.freeze({
    ok: false,
    telemetry,
    code: input.code,
    message: input.message,
  });
}

export function attachResearchOutcomeAttribution(input: {
  readonly sessionId: AgentResearchSessionId;
  readonly researchOutcomeRef: string;
}): Readonly<{ readonly sessionId: AgentResearchSessionId; readonly researchOutcomeRef: string }> {
  return Object.freeze({
    sessionId: input.sessionId,
    researchOutcomeRef: input.researchOutcomeRef,
  });
}
