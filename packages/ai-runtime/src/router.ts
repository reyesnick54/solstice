import { err, ok, type Result } from '../../domain/src/result.ts';
import type { ModelRegistry } from '../../model-registry/src/registry.ts';
import { evaluateContextRelease, externalProviderEligible } from './policy.ts';
import { resolveModelRef } from './registry.ts';
import {
  LOCAL_FALLBACK_DATA_CLASSES,
  isExternalProvider,
  taskClassGrantsExecutionAuthority,
  type AiProviderKind,
  type AiRuntimeMode,
} from './taxonomy.ts';
import type {
  AiContextAuthorization,
  AiContextObject,
  AiInferenceRequest,
  AiProviderFailure,
  AiProviderHealth,
  AiRoutingDecision,
  AiRoutingRejection,
  AiRuntimePolicy,
} from './types.ts';

export type AiRouterInput = {
  readonly request: AiInferenceRequest;
  readonly policy: AiRuntimePolicy;
  readonly health: Readonly<Partial<Record<AiProviderKind, AiProviderHealth>>>;
  readonly registry: ModelRegistry;
};

export class AiRuntimeRouter {
  route(input: AiRouterInput): Result<AiRoutingDecision, AiProviderFailure> {
    if (input.policy.providerMaySelfSelect !== false || input.policy.modelMayModifyPolicy !== false) {
      return err({
        ok: false,
        code: 'POLICY_IMMUTABLE',
        detail: 'providers and models cannot modify or self-select routing policy',
        providerKind: null,
      });
    }
    if (!input.request.authorization.actorId || !input.request.authorization.subjectId) {
      return err({
        ok: false,
        code: 'AUTHORIZATION_REQUIRED',
        detail: 'user/context authorization is required; routing fails closed',
        providerKind: null,
      });
    }
    if (
      (input.request.dataClass === 'REGULATORY_SENSITIVE' || input.request.taskClass === 'REGULATORY_EXPLANATION') &&
      !input.request.jurisdictionRef
    ) {
      return err({
        ok: false,
        code: 'JURISDICTION_REQUIRED',
        detail: 'jurisdiction reference is required for regulatory-sensitive inference',
        providerKind: null,
      });
    }
    if (taskClassGrantsExecutionAuthority(input.request.taskClass)) {
      return err({
        ok: false,
        code: 'TASK_CLASS_IS_NOT_AUTHORITY',
        detail: 'task class does not grant execution authority',
        providerKind: null,
      });
    }

    const resolved = resolveModelRef(input.registry, input.request.modelRef);
    if (!resolved.ok) {
      return resolved;
    }

    const rejected: AiRoutingRejection[] = [];
    const eligible: AiProviderKind[] = [];
    for (const kind of candidatesForMode(input.policy.mode)) {
      const decision = this.evaluateCandidate(kind, input);
      if (!decision.ok) {
        rejected.push({
          providerKind: kind,
          reason: decision.error.code,
          detail: decision.error.detail,
        });
        continue;
      }
      eligible.push(kind);
    }

    const selected = selectPrimary(input.policy.mode, eligible, input, rejected);
    if (!selected.ok) {
      return selected;
    }

    const shadow =
      input.policy.mode === 'DUAL_SHADOW_COMPARE' &&
      eligible.includes('XAI_GROK') &&
      selected.value === 'S3M'
        ? 'XAI_GROK'
        : null;

    return ok(
      Object.freeze({
        mode: input.policy.mode,
        primary: selected.value,
        shadow,
        modelRef: input.request.modelRef,
        dataClass: input.request.dataClass,
        taskClass: input.request.taskClass,
        rejected: Object.freeze(rejected),
        reason: `deterministic ${input.policy.mode} selected ${selected.value}`,
        auditable: true as const,
        providerSelfSelected: false as const,
        policyModifiedByModel: false as const,
      }),
    );
  }

  private evaluateCandidate(
    kind: AiProviderKind,
    input: AiRouterInput,
  ): Result<true, AiProviderFailure> {
    if (isExternalProvider(kind) && !externalProviderEligible({
      dataClass: input.request.dataClass,
      authorization: input.request.authorization,
      policy: input.policy,
    })) {
      return err({
        ok: false,
        code: 'DATA_CLASS_BLOCKS_EXTERNAL',
        detail: 'external eligibility is independent of task class',
        providerKind: kind,
      });
    }
    const release = evaluateContextRelease({
      objects: input.request.context,
      providerKind: kind,
      requestDataClass: input.request.dataClass,
      authorization: input.request.authorization,
      policy: input.policy,
    });
    if (!release.ok) {
      return release;
    }
    const health = input.health[kind];
    if (health && !health.healthy) {
      return err({
        ok: false,
        code: 'PROVIDER_UNHEALTHY',
        detail: health.reason ?? `${kind} is unhealthy`,
        providerKind: kind,
      });
    }
    return ok(true);
  }
}

function candidatesForMode(mode: AiRuntimeMode): readonly AiProviderKind[] {
  switch (mode) {
    case 'S3M_ONLY':
      return Object.freeze(['S3M']);
    case 'S3M_PRIMARY':
    case 'DUAL_SHADOW_COMPARE':
      return Object.freeze(['S3M', 'LOCAL_TEST', 'XAI_GROK']);
    case 'GROK_BETA_PRIMARY':
      return Object.freeze(['XAI_GROK', 'S3M']);
    case 'GROK_DEMO_ONLY':
      return Object.freeze(['XAI_GROK']);
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function selectPrimary(
  mode: AiRuntimeMode,
  eligible: readonly AiProviderKind[],
  input: AiRouterInput,
  rejected: readonly AiRoutingRejection[],
): Result<AiProviderKind, AiProviderFailure> {
  const s3mRejected = rejected.find((item) => item.providerKind === 'S3M');
  if (mode === 'S3M_PRIMARY' || mode === 'S3M_ONLY' || mode === 'DUAL_SHADOW_COMPARE') {
    if (eligible.includes('S3M')) {
      return ok('S3M');
    }
    if (
      mode !== 'S3M_ONLY' &&
      input.policy.allowLocalTestFallback &&
      eligible.includes('LOCAL_TEST') &&
      LOCAL_FALLBACK_DATA_CLASSES.has(input.request.dataClass)
    ) {
      return ok('LOCAL_TEST');
    }
    if (input.policy.s3mUnavailableFallsBackToGrok === false) {
      return err({
        ok: false,
        code: 'S3M_UNAVAILABLE_NO_EXTERNAL_FALLBACK',
        detail: s3mRejected
          ? `S3M unavailable (${s3mRejected.reason}); primary traffic is not silently routed to an external provider`
          : 'S3M unavailable; primary traffic is not silently routed to an external provider',
        providerKind: 'S3M',
      });
    }
    return err({
      ok: false,
      code: s3mRejected?.reason ?? 'ROUTING_REFUSED',
      detail: s3mRejected?.detail ?? 'no policy-permitted provider is available',
      providerKind: 'S3M',
    });
  }
  if (mode === 'GROK_BETA_PRIMARY') {
    if (eligible.includes('XAI_GROK')) {
      return ok('XAI_GROK');
    }
    if (eligible.includes('S3M')) {
      return ok('S3M');
    }
    return err({
      ok: false,
      code: 'ROUTING_REFUSED',
      detail: 'GROK_BETA_PRIMARY has no eligible provider',
      providerKind: 'XAI_GROK',
    });
  }
  if (eligible.includes('XAI_GROK')) {
    return ok('XAI_GROK');
  }
  return err({
    ok: false,
    code: 'ROUTING_REFUSED',
    detail: 'GROK_DEMO_ONLY requires an eligible Grok provider and does not silently fall back',
    providerKind: 'XAI_GROK',
  });
}

export type { AiContextAuthorization, AiContextObject };
