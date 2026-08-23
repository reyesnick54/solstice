import type { AiGatewayRequest, AiGatewayResult, AiModelGateway, AiStreamEvent } from '../../ai-runtime/src/index.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { AiProviderFailure } from '../../ai-runtime/src/index.ts';

/**
 * Agent-facing Model Gateway port. Lovable calls Agent endpoints.
 * Agent Runtime calls the canonical Model Gateway. This is not a raw
 * public LLM API and is not an Execution Authority.
 */
export type AgentModelGatewayPort = {
  infer(request: AiGatewayRequest): Result<AiGatewayResult, AiProviderFailure>;
  stream(request: AiGatewayRequest): Result<AiGatewayResult, AiProviderFailure>;
};

export function bindAgentModelGateway(gateway: AiModelGateway): AgentModelGatewayPort {
  return Object.freeze({
    infer: (request) => gateway.infer(request),
    stream: (request) => gateway.stream(request),
  });
}

export function agentSafeStream(result: AiGatewayResult): readonly AiStreamEvent[] {
  return result.events.filter((event) => event.hiddenReasoning === false);
}

export function agentModelOutageIsNotFinancial(result: Result<AiGatewayResult, AiProviderFailure>): true {
  if (!result.ok) {
    return true;
  }
  return result.value.financialExecuted === false;
}

export function refuseRawPublicLlm(): Result<never, AiProviderFailure> {
  return err({
    ok: false,
    code: 'MODEL_POLICY_BLOCKED',
    detail: 'raw public LLM inference is not exposed; call Agent endpoints',
    providerKind: null,
  });
}

export function acceptAgentGatewayResult(result: AiGatewayResult): Result<AiGatewayResult, AiProviderFailure> {
  if (result.financialExecuted !== false) {
    return err({
      ok: false,
      code: 'TASK_CLASS_IS_NOT_AUTHORITY',
      detail: 'agent model results cannot execute financial actions',
      providerKind: result.model?.provider ?? null,
    });
  }
  return ok(result);
}
