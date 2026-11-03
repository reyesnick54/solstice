import type { ModelCapability, ModelCostProfile } from './types.ts';

export const DEFAULT_SIMULATION_MODEL_CAPABILITIES: readonly ModelCapability[] = Object.freeze([
  capability('s3m', 's3m-finance-v1', '2026.09.01', ['TEXT_GENERATION', 'STRUCTURED_OUTPUT', 'TOOL_CALLING'], 128_000, true),
  capability('xai_grok', 'grok-research-v1', '2026.09.01', ['TEXT_GENERATION', 'REASONING', 'TOOL_CALLING'], 131_072, true),
  capability('local_test', 'local-test-v1', 'simulation', ['TEXT_GENERATION'], 32_000, false),
]);

export const DEFAULT_MODEL_COST_PROFILES: readonly ModelCostProfile[] = Object.freeze([
  cost('s3m', 's3m-finance-v1', 250n, 750n, 100n),
  cost('xai_grok', 'grok-research-v1', 300n, 900n, 120n),
  cost('local_test', 'local-test-v1', 0n, 0n, 0n),
]);

function capability(
  providerRef: string,
  modelId: string,
  modelVersion: string,
  kinds: ModelCapability['kinds'],
  contextWindowTokens: number,
  supportsToolCalling: boolean,
): ModelCapability {
  return Object.freeze({
    capabilityId: `${providerRef}:${modelId}:${modelVersion}`,
    providerRef,
    modelId,
    modelVersion,
    kinds: Object.freeze([...kinds]),
    contextWindowTokens,
    supportsToolCalling,
    simulationOnly: true,
    mayIssueExecutionAuthority: false,
  });
}

function cost(
  providerRef: string,
  modelId: string,
  inputMicrosPer1kTokens: bigint,
  outputMicrosPer1kTokens: bigint,
  toolCallMicros: bigint,
): ModelCostProfile {
  return Object.freeze({
    profileId: `${providerRef}:${modelId}:cost`,
    providerRef,
    modelId,
    inputMicrosPer1kTokens,
    outputMicrosPer1kTokens,
    toolCallMicros,
    currency: 'USD',
  });
}

export function resolveModelCapability(
  providerRef: string,
  modelId: string,
  modelVersion: string,
  catalog: readonly ModelCapability[] = DEFAULT_SIMULATION_MODEL_CAPABILITIES,
): ModelCapability | undefined {
  return catalog.find(
    (row) =>
      row.providerRef === providerRef &&
      row.modelId === modelId &&
      row.modelVersion === modelVersion,
  );
}

export function resolveModelCostProfile(
  providerRef: string,
  modelId: string,
  profiles: readonly ModelCostProfile[] = DEFAULT_MODEL_COST_PROFILES,
): ModelCostProfile | undefined {
  return profiles.find((row) => row.providerRef === providerRef && row.modelId === modelId);
}

export function estimateInferenceCostMicros(input: {
  readonly profile: ModelCostProfile;
  readonly promptTokens: number;
  readonly outputTokens: number;
  readonly toolCalls: number;
}): bigint {
  const promptK = BigInt(Math.max(0, input.promptTokens));
  const outputK = BigInt(Math.max(0, input.outputTokens));
  const tools = BigInt(Math.max(0, input.toolCalls));
  const inputCost = (promptK * input.profile.inputMicrosPer1kTokens) / 1000n;
  const outputCost = (outputK * input.profile.outputMicrosPer1kTokens) / 1000n;
  const toolCost = tools * input.profile.toolCallMicros;
  return inputCost + outputCost + toolCost;
}
