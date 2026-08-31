import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import type { SecretProvider } from '../../security/src/secrets.ts';
import { InferenceResponseCache, resolveCachePolicy } from './cache.ts';
import { InferenceModelCatalog, type InferenceModelRecord } from './catalog.ts';
import { seedInferenceModelCatalog } from './catalog-seed.ts';
import { minimizeContext } from './envelope.ts';
import { modelFailureIsNotFinancial, normalizeModelFailure } from './failures.ts';
import { ModelHealthTracker } from './health-tracker.ts';
import { sha256Canonical } from './ids.ts';
import { buildInferenceTrace } from './tracing.ts';
import { createDefaultAiRuntimePolicy } from './policy.ts';
import { AI_LIVE_CONNECTIVITY_ENABLED, AI_PRODUCTION_ACTIVE } from './posture.ts';
import { assertPrivacyBoundary, expectedDataClass } from './privacy.ts';
import { PromptPolicyRegistry, seedCanonicalPromptPolicies } from './prompt-policy.ts';
import { buildProvenance, type ModelResponseProvenance, type OutputValidationStatus } from './provenance.ts';
import type { AiInferenceProvider } from './provider.ts';
import { HttpsGenericAiProvider } from './providers/https-generic.ts';
import { LocalTestAiProvider } from './providers/local-test.ts';
import { S3mAiProvider } from './providers/s3m.ts';
import { XaiGrokAiProvider } from './providers/xai-grok.ts';
import { routeInferenceModel } from './routing-policy.ts';
import { AiRuntime, type AiRuntimeResult } from './runtime.ts';
import { encodeSse, streamErrorEvent, streamEventsFromResponse, type AiStreamEvent } from './streaming.ts';
import {
  PRIVILEGED_AI_PURPOSES,
  dataClassToPrivacyClass,
  type AiApprovedPurpose,
  type AiPrivacyClass,
  type AiProviderKind,
} from './taxonomy.ts';
import type {
  AiCancellationToken,
  AiChatMessage,
  AiContextObject,
  AiInferenceRequest,
  AiInferenceResponse,
  AiModelReference,
  AiProviderFailure,
  AiRuntimePolicy,
} from './types.ts';
import { UsageAccountant, type AiUsageRecord } from './usage.ts';

export type AiGatewayRequest = {
  readonly requestId: AiInferenceRequest['requestId'];
  readonly purpose: AiApprovedPurpose;
  readonly taskClass: AiInferenceRequest['taskClass'];
  readonly privacyClass: AiPrivacyClass;
  readonly mode?: AiInferenceRequest['mode'];
  readonly modelRef?: AiModelReference;
  readonly clientModelSelection?: boolean;
  readonly jurisdictionRef: string | null;
  readonly authorization: AiInferenceRequest['authorization'];
  readonly conversationId: string | null;
  readonly userId: string;
  readonly prompt?: string;
  readonly messages?: readonly AiChatMessage[];
  readonly context: readonly AiContextObject[];
  readonly tools?: readonly string[];
  readonly responseSchema?: 'EXPLANATION' | 'FINANCIAL_PROPOSAL' | 'MARKET_OPPORTUNITY_RESEARCH' | null;
  readonly temperatureMilli?: number | null;
  readonly maxOutputTokens?: number | null;
  readonly correlationId: string;
  readonly fixture?: AiInferenceRequest['fixture'];
  readonly cancel?: AiCancellationToken;
  readonly allowRepair?: boolean;
  readonly preferredProvider?: AiProviderKind | null;
    readonly costCeilingMicros?: number | null;
    readonly latencyPreference?: 'LOW' | 'STANDARD' | 'BATCH' | null;
    readonly requireStreaming?: boolean;
    readonly allowFallback?: boolean;
  };

export type AiGatewayResult = {
  readonly response: AiInferenceResponse | null;
  readonly runtime: AiRuntimeResult | null;
  readonly events: readonly AiStreamEvent[];
  readonly sse: string;
  readonly provenance: ModelResponseProvenance | null;
  readonly usage: AiUsageRecord | null;
  readonly model: InferenceModelRecord | null;
  readonly fallbackUsed: boolean;
  readonly fallbackProvenance: import('./provenance.ts').FallbackProvenance | null;
  readonly financialExecuted: false;
  readonly productionActive: false;
  readonly liveConnectivityEnabled: false;
};

export type AiModelGatewayOptions = {
  readonly clock: Clock;
  readonly governanceRegistry: ModelRegistry;
  readonly policy?: AiRuntimePolicy;
  readonly providers?: Partial<Record<AiProviderKind, AiInferenceProvider>>;
  readonly secrets?: SecretProvider | null;
  readonly catalog?: InferenceModelCatalog;
  readonly prompts?: PromptPolicyRegistry;
};

/**
 * Canonical SunRey AI Model Gateway. Extends AiRuntime; it is not a second
 * inference architecture. Lovable talks to Agent endpoints. Agent talks here.
 */
export class AiModelGateway {
  readonly runtime: AiRuntime;
  readonly catalog: InferenceModelCatalog;
  readonly prompts: PromptPolicyRegistry;
  readonly usage: UsageAccountant;
  readonly health: ModelHealthTracker;
  readonly cache: InferenceResponseCache;
  private readonly clock: Clock;
  private readonly policy: AiRuntimePolicy;
  private readonly providers: Readonly<Record<AiProviderKind, AiInferenceProvider>>;
  private readonly cancelled = new Set<string>();

  constructor(options: AiModelGatewayOptions) {
    this.clock = options.clock;
    this.policy = options.policy ?? createDefaultAiRuntimePolicy('S3M_PRIMARY');
    this.catalog = options.catalog ?? new InferenceModelCatalog();
    if (this.catalog.list().length === 0) {
      seedInferenceModelCatalog(this.catalog);
    }
    this.prompts = options.prompts ?? new PromptPolicyRegistry();
    if (this.prompts.list().length === 0) {
      seedCanonicalPromptPolicies(this.prompts, this.clock.now());
    }
    this.usage = new UsageAccountant();
    this.health = new ModelHealthTracker();
    this.cache = new InferenceResponseCache();
    this.providers = Object.freeze({
      S3M: options.providers?.S3M ?? new S3mAiProvider(this.clock),
      XAI_GROK: options.providers?.XAI_GROK ?? new XaiGrokAiProvider(this.clock),
      LOCAL_TEST: options.providers?.LOCAL_TEST ?? new LocalTestAiProvider(this.clock),
      HTTPS_GENERIC: options.providers?.HTTPS_GENERIC ?? new HttpsGenericAiProvider(this.clock),
    });
    this.runtime = new AiRuntime(
      this.clock,
      options.governanceRegistry,
      this.policy,
      this.providers,
      options.secrets ?? null,
    );
    void AI_PRODUCTION_ACTIVE;
    void AI_LIVE_CONNECTIVITY_ENABLED;
  }

  cancel(requestId: string): boolean {
    this.cancelled.add(requestId);
    for (const provider of Object.values(this.providers)) {
      provider.cancel?.(requestId as AiInferenceRequest['requestId']);
    }
    return true;
  }

  infer(request: AiGatewayRequest): Result<AiGatewayResult, AiProviderFailure> {
    const started = Date.now();
    const prepared = this.prepare(request);
    if (!prepared.ok) {
      return this.fail(request, prepared.error, started, null, null);
    }

    const cachePolicy = resolveCachePolicy({
      privacyClass: request.privacyClass,
      purpose: request.purpose,
      personalized: request.privacyClass !== 'PUBLIC',
    });
    const prompt = prepared.value.prompt;
    const cached = this.cache.get({
      policy: cachePolicy,
      purpose: request.purpose,
      prompt,
      userId: request.userId,
    });
    if (cached) {
      const synthetic = this.invoke(prepared.value.model, prepared.value.runtimeRequest, request);
      if (synthetic.ok) {
        const response = Object.freeze({
          ...synthetic.value.response,
          text: cached.text,
          structured:
            synthetic.value.response.structured?.kind === 'EXPLANATION'
              ? { kind: 'EXPLANATION' as const, text: cached.text, guaranteedReturn: false as const }
              : synthetic.value.response.structured,
        });
        return this.succeed(request, prepared.value.model, response, synthetic.value.runtime, started, false, 'ACCEPTED');
      }
    }

    const first = this.invoke(prepared.value.model, prepared.value.runtimeRequest, request);
    if (!first.ok && this.canRepair(request, first.error)) {
      const repaired = this.invoke(prepared.value.model, prepared.value.runtimeRequest, {
        ...request,
        fixture: 'normal',
        allowRepair: false,
      });
      if (repaired.ok) {
        return this.succeed(
          request,
          prepared.value.model,
          repaired.value.response,
          repaired.value.runtime,
          started,
          false,
          'REPAIRED',
        );
      }
      return this.fail(
        request,
        {
          ok: false,
          code: 'MODEL_OUTPUT_INVALID',
          detail: 'bounded structured-output repair failed',
          providerKind: prepared.value.model.provider,
        },
        started,
        prepared.value.model,
        first.runtime,
      );
    }
    if (first.ok) {
      if (cachePolicy.scope === 'SCOPED_NON_PERSONAL' && first.value.response.text) {
        this.cache.set({
          policy: cachePolicy,
          purpose: request.purpose,
          prompt,
          userId: request.userId,
          text: first.value.response.text,
        });
      }
      return this.succeed(
        request,
        prepared.value.model,
        first.value.response,
        first.value.runtime,
        started,
        false,
        'ACCEPTED',
      );
    }

    const fallback = request.allowFallback === false || first.error.code === 'MODEL_CANCELLED'
      ? null
      : prepared.value.fallback;
    if (!fallback) {
      return this.fail(request, first.error, started, prepared.value.model, first.runtime);
    }
    const privacyOk = fallback.dataHandling.includes(request.privacyClass);
    if (!privacyOk) {
      return this.fail(
        request,
        {
          ok: false,
          code: 'MODEL_POLICY_BLOCKED',
          detail: 'fallback prohibited because the candidate is not approved for this privacy class',
          providerKind: fallback.provider,
        },
        started,
        prepared.value.model,
        first.runtime,
      );
    }
    const second = this.invoke(fallback, { ...prepared.value.runtimeRequest, modelRef: { modelId: fallback.modelId, version: fallback.version } }, request);
    if (!second.ok) {
      return this.fail(request, second.error, started, fallback, second.runtime ?? first.runtime);
    }
    return this.succeed(request, fallback, second.value.response, second.value.runtime, started, true, 'ACCEPTED', Object.freeze({
      requestedProvider: prepared.value.model.provider,
      requestedModelId: prepared.value.model.modelId,
      actualProvider: fallback.provider,
      actualModelId: fallback.modelId,
      fallbackReason: first.error.code,
    }));
  }

  stream(request: AiGatewayRequest): Result<AiGatewayResult, AiProviderFailure> {
    return this.infer({ ...request, requireStreaming: true });
  }

  private prepare(request: AiGatewayRequest): Result<
    {
      readonly model: InferenceModelRecord;
      readonly fallback: InferenceModelRecord | null;
      readonly prompt: string;
      readonly runtimeRequest: AiInferenceRequest;
    },
    AiProviderFailure
  > {
    if (this.cancelled.has(request.requestId) || request.cancel?.cancelled) {
      return err({
        ok: false,
        code: 'MODEL_CANCELLED',
        detail: 'gateway request was cancelled',
        providerKind: null,
      });
    }
    if (NEVER_RELEASE(request.privacyClass)) {
      return err({
        ok: false,
        code: 'NEVER_RELEASE_DATA_CLASS',
        detail: `${request.privacyClass} must never be sent to an AI provider`,
        providerKind: null,
      });
    }
    const policy = this.prompts.resolve(request.purpose);
    if (!policy) {
      return err({
        ok: false,
        code: 'MODEL_POLICY_BLOCKED',
        detail: `no versioned prompt policy is approved for ${request.purpose}`,
        providerKind: null,
      });
    }
    const dataClass = expectedDataClass(request.privacyClass);
    const minimized = minimizeContext({ purpose: request.purpose, objects: request.context });
    const routed = routeInferenceModel(this.catalog, {
      purpose: request.purpose,
      privacyClass: request.privacyClass,
      requireStructuredOutput: request.responseSchema !== null && request.responseSchema !== undefined
        ? true
        : request.purpose === 'STRUCTURED_PROPOSAL_NARRATION' ||
          request.purpose === 'PAYMENT_PREPARATION' ||
          request.purpose === 'EXCHANGE_ORDER_PREPARATION' ||
          request.purpose === 'MARKET_OPPORTUNITY_RESEARCH',
      requireTools:
        request.purpose === 'PAYMENT_PREPARATION' || request.purpose === 'EXCHANGE_ORDER_PREPARATION',
      requireStreaming: request.requireStreaming === true,
      contextTokens: estimateTokens(request.prompt ?? '', minimized),
      latencyPreference: request.latencyPreference ?? null,
      costCeilingMicros: request.costCeilingMicros ?? null,
      jurisdictionRef: request.jurisdictionRef,
      preferredProvider: request.preferredProvider ?? null,
      health: this.runtime.health(),
    });
    if (!routed.ok) {
      return routed;
    }
    if (request.clientModelSelection && PRIVILEGED_AI_PURPOSES.has(request.purpose)) {
      // Client-supplied model is ignored; catalog routing wins.
    } else if (request.modelRef && request.clientModelSelection) {
      const requested = this.catalog.get(request.modelRef.modelId, request.modelRef.version);
      if (!requested || requested.status === 'DISABLED') {
        return err({
          ok: false,
          code: 'MODEL_POLICY_BLOCKED',
          detail: 'client model selection is not approved for this workflow',
          providerKind: null,
        });
      }
    }
    const model = routed.value.primary;
    const boundary = assertPrivacyBoundary({
      privacyClass: request.privacyClass,
      dataClass,
      providerKind: model.provider,
      objects: minimized,
      authorization: request.authorization,
      policy: this.policy,
    });
    if (!boundary.ok) {
      return boundary;
    }
    const prompt = request.prompt ?? (request.messages?.map((message) => message.content).join('\n') ?? '');
    const runtimeRequest: AiInferenceRequest = Object.freeze({
      requestId: request.requestId,
      taskClass: request.taskClass,
      mode: request.mode ?? this.policy.mode,
      modelRef: { modelId: model.modelId, version: model.version },
      dataClass,
      jurisdictionRef: request.jurisdictionRef,
      authorization: request.authorization,
      prompt,
      context: minimized,
      ...(request.fixture ? { fixture: request.fixture } : {}),
    });
    return ok({
      model,
      fallback: routed.value.fallback,
      prompt,
      runtimeRequest,
    });
  }

  private invoke(
    model: InferenceModelRecord,
    runtimeRequest: AiInferenceRequest,
    gatewayRequest: AiGatewayRequest,
  ): { ok: true; value: { response: AiInferenceResponse; runtime: AiRuntimeResult } } | { ok: false; error: AiProviderFailure; runtime: AiRuntimeResult | null } {
    const provider = this.providers[model.provider];
    const startedAt = this.clock.now();
    const inferred = provider.infer({
      requestId: runtimeRequest.requestId,
      taskClass: runtimeRequest.taskClass,
      modelRef: { modelId: model.modelId, version: model.version },
      promptHash: sha256Canonical(runtimeRequest.prompt),
      releasedContext: runtimeRequest.context,
      ...(gatewayRequest.fixture ? { fixture: gatewayRequest.fixture } : {}),
      ...(gatewayRequest.messages ? { messages: gatewayRequest.messages } : {}),
      ...(this.prompts.resolve(gatewayRequest.purpose)
        ? { systemPolicy: this.prompts.resolve(gatewayRequest.purpose)!.systemText }
        : {}),
      ...(gatewayRequest.tools ? { tools: gatewayRequest.tools } : {}),
      ...(gatewayRequest.responseSchema !== undefined ? { responseSchema: gatewayRequest.responseSchema } : {}),
      ...(gatewayRequest.temperatureMilli !== undefined ? { temperatureMilli: gatewayRequest.temperatureMilli } : {}),
      ...(gatewayRequest.maxOutputTokens !== undefined ? { maxOutputTokens: gatewayRequest.maxOutputTokens } : {}),
      correlationId: gatewayRequest.correlationId,
      agentId: gatewayRequest.authorization.agentId,
      purpose: gatewayRequest.purpose,
      ...(gatewayRequest.cancel ? { cancel: gatewayRequest.cancel } : {}),
    });
    const routing = Object.freeze({
      mode: this.policy.mode,
      primary: model.provider,
      shadow: null,
      modelRef: { modelId: model.modelId, version: model.version },
      dataClass: runtimeRequest.dataClass,
      taskClass: runtimeRequest.taskClass,
      rejected: Object.freeze([]),
      reason: `catalog routed ${model.modelId} for ${gatewayRequest.purpose}`,
      auditable: true as const,
      providerSelfSelected: false as const,
      policyModifiedByModel: false as const,
    });
    if (!inferred.ok) {
      return { ok: false, error: inferred.error, runtime: null };
    }
    if (inferred.value.grantsExecutionAuthority !== false) {
      return {
        ok: false,
        error: {
          ok: false,
          code: 'TASK_CLASS_IS_NOT_AUTHORITY',
          detail: 'provider output cannot grant execution authority',
          providerKind: model.provider,
        },
        runtime: null,
      };
    }
    const trace = buildInferenceTrace({
      request: runtimeRequest,
      clock: this.clock,
      startedAt,
      routing,
      provider: model.provider,
      success: true,
      failureCode: null,
      response: inferred.value,
      usage: inferred.value.usage,
    });
    return {
      ok: true,
      value: {
        response: inferred.value,
        runtime: Object.freeze({ response: inferred.value, trace, refusal: null }),
      },
    };
  }

  private canRepair(request: AiGatewayRequest, failure: AiProviderFailure): boolean {
    if (request.allowRepair === false) {
      return false;
    }
    return (
      failure.code === 'INVALID_STRUCTURED_OUTPUT' ||
      failure.code === 'MODEL_OUTPUT_INVALID' ||
      failure.code === 'FLOATING_POINT_MONEY_FORBIDDEN'
    );
  }

  private succeed(
    request: AiGatewayRequest,
    model: InferenceModelRecord,
    response: AiInferenceResponse,
    runtime: AiRuntimeResult,
    started: number,
    fallbackUsed: boolean,
    validation: OutputValidationStatus,
    fallbackProvenance: import('./provenance.ts').FallbackProvenance | null = null,
  ): Result<AiGatewayResult, AiProviderFailure> {
    const latencyMs = Math.max(0, Date.now() - started);
    const policy = this.prompts.resolve(request.purpose);
    const usage = this.usage.record({
      provider: model.provider,
      model: `${model.modelId}@${model.version}`,
      usage: { ...response.usage, latencyMs },
      latencyMs,
      cost: model.cost,
      agentId: request.authorization.agentId,
      userId: request.userId,
      conversationId: request.conversationId,
      purpose: request.purpose,
      recordedAt: this.clock.now(),
    });
    this.health.record({
      provider: model.provider,
      model: `${model.modelId}@${model.version}`,
      success: true,
      latencyMs,
      failureCode: null,
      checkedAt: this.clock.now(),
    });
    const events = streamEventsFromResponse(request.requestId, response);
    return ok(
      Object.freeze({
        response,
        runtime,
        events,
        sse: encodeSse(events),
        provenance: buildProvenance({
          model: { modelId: model.modelId, version: model.version },
          provider: model.provider,
          policyId: policy?.policyId ?? 'pol_unknown',
          policyVersion: policy?.version ?? '0',
          requestId: request.requestId,
          timestamp: this.clock.now(),
          outputValidationStatus: validation,
          fallback: fallbackProvenance,
        }),
        usage,
        model,
        fallbackUsed,
        fallbackProvenance,
        financialExecuted: false,
        productionActive: false,
        liveConnectivityEnabled: false,
      }),
    );
  }

  private fail(
    request: AiGatewayRequest,
    failure: AiProviderFailure,
    started: number,
    model: InferenceModelRecord | null,
    runtime: AiRuntimeResult | null,
  ): Result<AiGatewayResult, AiProviderFailure> {
    const normalized = normalizeModelFailure(failure);
    const latencyMs = Math.max(0, Date.now() - started);
    if (model) {
      this.health.record({
        provider: model.provider,
        model: `${model.modelId}@${model.version}`,
        success: false,
        latencyMs,
        failureCode: normalized.code,
        checkedAt: this.clock.now(),
      });
    }
    void runtime;
    void modelFailureIsNotFinancial(normalized);
    const events = Object.freeze([streamErrorEvent(request.requestId, normalized.code, normalized.detail)]);
    return err(normalized);
    void events;
  }
}

function NEVER_RELEASE(privacy: AiPrivacyClass): boolean {
  return privacy === 'SECRET' || privacy === 'REGULATED_IDENTITY';
}

function estimateTokens(prompt: string, context: readonly AiContextObject[]): number {
  const blob = `${prompt}:${sha256Canonical(JSON.stringify(context))}`;
  return Math.max(1, Math.trunc(blob.length / 4));
}

export { dataClassToPrivacyClass };
