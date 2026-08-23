import type { Clock } from '../../config/src/clock.ts';
import { err, ok, type Result } from '../../domain/src/result.ts';
import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import type { SecretProvider } from '../../security/src/secrets.ts';
import { sha256Canonical } from './ids.ts';
import { evaluateContextRelease } from './policy.ts';
import type { AiInferenceProvider } from './provider.ts';
import { HttpsGenericAiProvider } from './providers/https-generic.ts';
import { LocalTestAiProvider } from './providers/local-test.ts';
import { S3mAiProvider } from './providers/s3m.ts';
import { XaiGrokAiProvider } from './providers/xai-grok.ts';
import { AiRuntimeRouter } from './router.ts';
import { assertNoPlaintextCredential, redactSecrets, resolveProviderCredential } from './secrets.ts';
import type { AiProviderKind } from './taxonomy.ts';
import { NEVER_RELEASE_DATA_CLASSES } from './taxonomy.ts';
import { buildInferenceTrace } from './tracing.ts';
import type {
  AiInferenceRequest,
  AiInferenceResponse,
  AiInferenceTrace,
  AiProviderFailure,
  AiProviderHealth,
  AiRoutingDecision,
  AiRuntimePolicy,
  AiStreamChunk,
} from './types.ts';

const PROMPT_INJECTION =
  /ignore (all|any|previous|prior) (instructions|rules|mandates)|reveal (the )?(master|private) key|you are now|jailbreak/i;

export type AiRuntimeResult = {
  readonly response: AiInferenceResponse | null;
  readonly trace: AiInferenceTrace;
  readonly refusal: AiProviderFailure | null;
};

export class AiRuntime {
  readonly router = new AiRuntimeRouter();
  private readonly clock: Clock;
  private readonly registry: ModelRegistry;
  private readonly policy: AiRuntimePolicy;
  private readonly secrets: SecretProvider | null;
  private readonly providers: Readonly<Record<AiProviderKind, AiInferenceProvider>>;
  private readonly traces: AiInferenceTrace[] = [];

  constructor(
    clock: Clock,
    registry: ModelRegistry,
    policy: AiRuntimePolicy,
    providers?: Partial<Record<AiProviderKind, AiInferenceProvider>>,
    secrets: SecretProvider | null = null,
  ) {
    this.clock = clock;
    this.registry = registry;
    this.policy = policy;
    this.secrets = secrets;
    this.providers = Object.freeze({
      S3M: providers?.S3M ?? new S3mAiProvider(clock),
      XAI_GROK: providers?.XAI_GROK ?? new XaiGrokAiProvider(clock),
      LOCAL_TEST: providers?.LOCAL_TEST ?? new LocalTestAiProvider(clock),
      HTTPS_GENERIC: providers?.HTTPS_GENERIC ?? new HttpsGenericAiProvider(clock),
    });
  }

  health(): Readonly<Record<AiProviderKind, AiProviderHealth>> {
    return Object.freeze({
      S3M: this.providers.S3M.health(),
      XAI_GROK: this.providers.XAI_GROK.health(),
      LOCAL_TEST: this.providers.LOCAL_TEST.health(),
      HTTPS_GENERIC: this.providers.HTTPS_GENERIC.health(),
    });
  }

  latestTrace(): AiInferenceTrace | undefined {
    return this.traces.at(-1);
  }

  tracesSnapshot(): readonly AiInferenceTrace[] {
    return Object.freeze([...this.traces]);
  }

  *inferStream(request: AiInferenceRequest): Generator<AiStreamChunk, Result<AiRuntimeResult, AiProviderFailure>, void> {
    const result = this.infer(request);
    if (!result.ok) {
      yield {
        kind: 'refused',
        text: result.error.detail,
        requestId: request.requestId,
        grantsExecutionAuthority: false,
        executedFinancialMutation: false,
      };
      return result;
    }
    const text = result.value.response?.text ?? '';
    for (const token of text.split(/(\s+)/)) {
      if (token.length === 0) {
        continue;
      }
      yield {
        kind: 'token',
        text: token,
        requestId: request.requestId,
        grantsExecutionAuthority: false,
        executedFinancialMutation: false,
      };
    }
    yield {
      kind: 'done',
      text: '',
      requestId: request.requestId,
      grantsExecutionAuthority: false,
      executedFinancialMutation: false,
    };
    return result;
  }

  infer(request: AiInferenceRequest): Result<AiRuntimeResult, AiProviderFailure> {
    const startedAt = this.clock.now();
    const secretCheck = assertNoPlaintextCredential(
      { prompt: request.prompt, context: request.context },
      'inference request',
    );
    if (!secretCheck.ok) {
      return this.fail(request, startedAt, null, secretCheck.error);
    }
    if (NEVER_RELEASE_DATA_CLASSES.has(request.dataClass)) {
      return this.fail(request, startedAt, null, {
        ok: false,
        code: 'NEVER_RELEASE_DATA_CLASS',
        detail: `${request.dataClass} must never be sent to an AI provider`,
        providerKind: null,
      });
    }
    if (PROMPT_INJECTION.test(request.prompt)) {
      return this.fail(request, startedAt, null, {
        ok: false,
        code: 'PROMPT_INJECTION',
        detail: 'prompt-injection content cannot enter the inference plane',
        providerKind: null,
      });
    }

    const routing = this.router.route({
      request,
      policy: this.policy,
      health: this.health(),
      registry: this.registry,
    });
    if (!routing.ok) {
      return this.fail(request, startedAt, null, routing.error);
    }
    if (!routing.value.primary) {
      return this.fail(request, startedAt, routing.value, {
        ok: false,
        code: 'ROUTING_REFUSED',
        detail: 'router returned no primary provider',
        providerKind: null,
      });
    }

    const provider = this.providers[routing.value.primary];
    const credential = resolveProviderCredential(this.secrets, provider.providerMetadata().credentialRef);
    if (!credential.ok) {
      return this.fail(request, startedAt, routing.value, credential.error);
    }
    const release = evaluateContextRelease({
      objects: request.context,
      providerKind: routing.value.primary,
      requestDataClass: request.dataClass,
      authorization: request.authorization,
      policy: this.policy,
    });
    if (!release.ok) {
      return this.fail(request, startedAt, routing.value, release.error);
    }

    const releasedContext = request.context.filter((object) =>
      release.value.releasedObjectIds.includes(object.objectId),
    );
    const inferred = provider.infer({
      requestId: request.requestId,
      taskClass: request.taskClass,
      modelRef: request.modelRef,
      promptHash: sha256Canonical(request.prompt),
      releasedContext,
      ...(request.fixture ? { fixture: request.fixture } : {}),
    });
    if (!inferred.ok) {
      return this.fail(request, startedAt, routing.value, inferred.error);
    }
    if (inferred.value.grantsExecutionAuthority !== false) {
      return this.fail(request, startedAt, routing.value, {
        ok: false,
        code: 'TASK_CLASS_IS_NOT_AUTHORITY',
        detail: 'provider output cannot grant execution authority',
        providerKind: routing.value.primary,
      });
    }
    if (PROMPT_INJECTION.test(inferred.value.text ?? '') ||
      (inferred.value.structured?.kind === 'EXPLANATION' && PROMPT_INJECTION.test(inferred.value.structured.text))) {
      return this.fail(request, startedAt, routing.value, {
        ok: false,
        code: 'PROMPT_INJECTION',
        detail: 'provider output contained prompt-injection content',
        providerKind: routing.value.primary,
      });
    }

    const trace = buildInferenceTrace({
      request,
      clock: this.clock,
      startedAt,
      routing: routing.value,
      provider: routing.value.primary,
      success: true,
      failureCode: null,
      response: inferred.value,
      usage: inferred.value.usage,
    });
    this.traces.push(trace);
    return ok(Object.freeze({ response: inferred.value, trace, refusal: null }));
  }

  private fail(
    request: AiInferenceRequest,
    startedAt: AiInferenceTrace['startedAt'],
    routing: AiRoutingDecision | null,
    failure: AiProviderFailure,
  ): Result<AiRuntimeResult, AiProviderFailure> {
    const fallbackRouting = routing ?? Object.freeze({
      mode: this.policy.mode,
      primary: null,
      shadow: null,
      modelRef: request.modelRef,
      dataClass: request.dataClass,
      taskClass: request.taskClass,
      rejected: Object.freeze([
        {
          providerKind: failure.providerKind ?? 'LOCAL_TEST',
          reason: failure.code,
          detail: redactSecrets(failure.detail),
        },
      ]),
      reason: redactSecrets(failure.detail),
      auditable: true as const,
      providerSelfSelected: false as const,
      policyModifiedByModel: false as const,
    });
    const trace = buildInferenceTrace({
      request,
      clock: this.clock,
      startedAt,
      routing: fallbackRouting,
      provider: fallbackRouting.primary,
      success: false,
      failureCode: failure.code,
      response: null,
      usage: Object.freeze({ promptTokens: null, completionTokens: null, totalTokens: null }),
    });
    this.traces.push(trace);
    return err(failure);
  }
}
