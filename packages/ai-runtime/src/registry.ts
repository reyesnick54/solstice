import type { UtcInstant } from '../../domain/src/time.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import { asModelId, asModelValidationId, asModelVersion } from '../../model-registry/src/ids.ts';
import { ModelRegistry, type RegistryFailure } from '../../model-registry/src/registry.ts';
import type { RegisteredModelVersion } from '../../model-registry/src/types.ts';
import type { AiModelReference, AiProviderFailure } from './types.ts';

export const CANONICAL_LOCAL_TEST_MODEL_ID = asModelId('mdl_sunrey_local_test');
export const CANONICAL_LOCAL_TEST_MODEL_VERSION = asModelVersion('local-test-v1');
export const CANONICAL_S3M_MODEL_ID = asModelId('mdl_sunrey_s3m');
export const CANONICAL_S3M_MODEL_VERSION = asModelVersion('s3m-sim-v1');
export const CANONICAL_GROK_RESERVED_MODEL_ID = asModelId('mdl_sunrey_grok_reserved');
export const CANONICAL_GROK_RESERVED_MODEL_VERSION = asModelVersion('grok-reserved-v1');

export function resolveModelRef(
  registry: ModelRegistry,
  modelRef: AiModelReference,
): Result<RegisteredModelVersion, AiProviderFailure> {
  const model = registry.get(modelRef.modelId, modelRef.version);
  if (!model) {
    return err({
      ok: false,
      code: 'MODEL_REF_UNRESOLVED',
      detail: `model ${modelRef.modelId}@${modelRef.version} is not in the canonical model registry`,
      providerKind: null,
    });
  }
  if (model.liveApproved !== false || model.simulationOnly !== true) {
    return err({
      ok: false,
      code: 'MODEL_NOT_APPROVED_FOR_SIMULATION',
      detail: 'live model approval is forbidden; simulation-only registry safeguards remain intact',
      providerKind: null,
    });
  }
  if (model.lifecycle !== 'APPROVED_FOR_SIMULATION') {
    return err({
      ok: false,
      code: 'MODEL_NOT_APPROVED_FOR_SIMULATION',
      detail: `model ${model.modelId}@${model.version} is ${model.lifecycle}`,
      providerKind: null,
    });
  }
  return ok(model);
}

function seedAiModel(
  registry: ModelRegistry,
  actor: unknown,
  now: UtcInstant,
  input: {
    readonly modelId: ReturnType<typeof asModelId>;
    readonly version: ReturnType<typeof asModelVersion>;
    readonly description: string;
    readonly owner: string;
    readonly validationId: string;
    readonly inputSchema?: string;
    readonly outputSchema?: string;
    readonly limitations?: readonly string[];
    readonly applicableDomain?: string;
    readonly dataRequirements?: readonly string[];
    readonly provider?: string;
    readonly supportedTasks?: readonly string[];
  },
): Result<RegisteredModelVersion, RegistryFailure> {
  const configurationCanonical = JSON.stringify({
    modelId: input.modelId,
    version: input.version,
    type: 'AI_MODEL_REFERENCE',
    provider: input.provider ?? 'LOCAL_TEST',
    supportedTasks: input.supportedTasks ?? [],
    simulationOnly: true,
    liveApproved: false,
    inferencePlaneOnly: true,
    claimsRealWorldPerformance: false,
  });
  const registered = registry.register({
    modelId: input.modelId,
    version: input.version,
    type: 'AI_MODEL_REFERENCE',
    description: input.description,
    owner: input.owner,
    inputSchema: input.inputSchema ?? 'AiInferenceRequest',
    outputSchema: input.outputSchema ?? 'AiInferenceResponse',
    determinism: 'DETERMINISTIC',
    configurationCanonical,
    createdAt: now,
    limitations: Object.freeze([
      ...(input.limitations ?? [
        'Inference plane only',
        'Cannot execute payments, trades, mint, or sign',
        'Simulation approval only',
      ]),
    ]),
    applicableDomain: input.applicableDomain ?? 'SUNREY_AI_INFERENCE_SIMULATION',
    dataRequirements: Object.freeze([...(input.dataRequirements ?? ['task-class', 'released-context'])]),
    artifactKind: 'CONFIGURATION',
    artifactDescription: 'Canonical AI model binding for the inference runtime',
  });
  if (!registered.ok) {
    const existing = registry.get(input.modelId, input.version);
    if (existing?.lifecycle === 'APPROVED_FOR_SIMULATION') {
      return ok(existing);
    }
    return registered;
  }
  const queued = registry.requireValidation(input.modelId, input.version);
  if (!queued.ok) {
    return queued;
  }
  const validated = registry.recordValidation({
    validationId: asModelValidationId(input.validationId),
    modelId: input.modelId,
    version: input.version,
    testsExecuted: Object.freeze(['structured-output', 'tool-intent-boundary', 'no-execution']),
    testDatasetReference: 'fixture:ai-runtime-local',
    expectedBehavior: 'Return structured tool intents without executing financial actions',
    observedBehavior: 'Deterministic LocalTest fixtures stay on the inference plane',
    limitations: Object.freeze(['Simulation fixtures only']),
    status: 'PASSED_SIMULATION',
    reviewer: 'operator_1',
    reviewerKind: 'HUMAN_OPERATOR',
    timestamp: now,
    claimsRealWorldPerformance: false,
  });
  if (!validated.ok) {
    return validated;
  }
  return registry.approveForSimulation(actor, {
    modelId: input.modelId,
    version: input.version,
    reason: 'Human operator approved the simulation AI model binding after fixture validation',
    now,
  });
}

export function seedCanonicalAiModels(
  registry: ModelRegistry,
  actor: unknown,
  now: UtcInstant,
): Result<readonly RegisteredModelVersion[], RegistryFailure> {
  const local = seedAiModel(registry, actor, now, {
    modelId: CANONICAL_LOCAL_TEST_MODEL_ID,
    version: CANONICAL_LOCAL_TEST_MODEL_VERSION,
    description: 'Deterministic LocalTest AI provider binding. CI / simulation only.',
    owner: 'solstice-ai-runtime',
    validationId: 'mvn_local_test_ai_v1',
  });
  if (!local.ok) {
    return local;
  }
  const s3m = seedAiModel(registry, actor, now, {
    modelId: CANONICAL_S3M_MODEL_ID,
    version: CANONICAL_S3M_MODEL_VERSION,
    description:
      'S3M primary SunRey intelligence provider. Simulation registry binding only. Not a real-world performance claim.',
    owner: 'solstice-ai-runtime',
    validationId: 'mvn_s3m_ai_v1',
    provider: 'S3M',
    inputSchema: 'CanonicalProviderRequest',
    outputSchema: 'AiInferenceResponse',
    applicableDomain: 'SUNREY_AI_S3M_PRIMARY_SIMULATION',
    dataRequirements: Object.freeze(['task-class', 'released-context', 's3m-transport-contract']),
    supportedTasks: Object.freeze([
      'GENERAL_ASSISTANT',
      'FINANCIAL_EXPLANATION',
      'GROWTH_PLANNING',
      'PORTFOLIO_REASONING',
      'PAYMENT_PREPARATION',
      'EXCHANGE_ORDER_PREPARATION',
      'ECONOMIC_ANALYSIS',
      'SUNREY_INFORMATION_REASONING',
      'MOONREY_PRODUCTIVE_ANALYSIS',
      'REGULATORY_EXPLANATION',
      'USER_SUPPORT',
    ]),
    limitations: Object.freeze([
      'Inference plane only; advisory and proposal-generation only',
      'Cannot sign, approve, execute, mint, or change policy or mandates',
      'Cannot hold master keys or override risk, jurisdiction, or Compliance Kernel',
      'Simulation approval only; no real-world performance claim',
    ]),
  });
  if (!s3m.ok) {
    return s3m;
  }
  const grok = seedAiModel(registry, actor, now, {
    modelId: CANONICAL_GROK_RESERVED_MODEL_ID,
    version: CANONICAL_GROK_RESERVED_MODEL_VERSION,
    description: 'Reserved xAI/Grok binding. Networking is implemented in Chunk 103, not here.',
    owner: 'solstice-ai-runtime',
    validationId: 'mvn_grok_reserved_v1',
  });
  if (!grok.ok) {
    return grok;
  }
  return ok(Object.freeze([local.value, s3m.value, grok.value]));
}
