import { err, ok, type Result } from '../../domain/src/result.ts';
import type { InferenceModelRecord } from './catalog.ts';
import type { InferenceModelCatalog } from './catalog.ts';
import type { AiApprovedPurpose, AiPrivacyClass, AiProviderKind } from './taxonomy.ts';
import { modelMayReceivePrivacy } from './privacy.ts';
import type { AiProviderFailure, AiProviderHealth } from './types.ts';

export type GatewayRouteInput = {
  readonly purpose: AiApprovedPurpose;
  readonly privacyClass: AiPrivacyClass;
  readonly requireStructuredOutput: boolean;
  readonly requireTools: boolean;
  readonly requireStreaming: boolean;
  readonly contextTokens: number;
  readonly latencyPreference: 'LOW' | 'STANDARD' | 'BATCH' | null;
  readonly costCeilingMicros: number | null;
  readonly jurisdictionRef: string | null;
  readonly preferredProvider: AiProviderKind | null;
  readonly health: Readonly<Partial<Record<AiProviderKind, AiProviderHealth>>>;
};

export type GatewayRouteDecision = {
  readonly primary: InferenceModelRecord;
  readonly fallback: InferenceModelRecord | null;
  readonly rejected: readonly { readonly modelId: string; readonly reason: string }[];
  readonly cheapestWasNotSelected: boolean;
};

export function routeInferenceModel(
  catalog: InferenceModelCatalog,
  input: GatewayRouteInput,
): Result<GatewayRouteDecision, AiProviderFailure> {
  const rejected: { readonly modelId: string; readonly reason: string }[] = [];
  const eligible: InferenceModelRecord[] = [];
  for (const model of catalog.list()) {
    const reason = eligibilityReason(model, input);
    if (reason) {
      rejected.push({ modelId: `${model.modelId}@${model.version}`, reason });
      continue;
    }
    eligible.push(model);
  }
  if (eligible.length === 0) {
    return err({
      ok: false,
      code: 'MODEL_POLICY_BLOCKED',
      detail: `no registered model is approved for ${input.purpose}/${input.privacyClass}`,
      providerKind: null,
    });
  }

  const ranked = [...eligible].sort((left, right) => compareModels(left, right, input));
  const primary = ranked[0];
  if (!primary) {
    return err({
      ok: false,
      code: 'ROUTING_REFUSED',
      detail: 'router returned no primary model',
      providerKind: null,
    });
  }
  const cheapest = [...eligible].sort((left, right) => totalCost(left) - totalCost(right))[0];
  const fallback = ranked.find((model) => model !== primary && fallbackCompatible(primary, model, input)) ?? null;
  return ok(
    Object.freeze({
      primary,
      fallback,
      rejected: Object.freeze(rejected),
      cheapestWasNotSelected: cheapest !== undefined && cheapest.modelId !== primary.modelId,
    }),
  );
}

export function fallbackCompatible(
  primary: InferenceModelRecord,
  candidate: InferenceModelRecord,
  input: GatewayRouteInput,
): boolean {
  if (candidate.status === 'DISABLED') {
    return false;
  }
  if (!candidate.approvedPurposes.includes(input.purpose)) {
    return false;
  }
  if (!modelMayReceivePrivacy(candidate.dataHandling, input.privacyClass)) {
    return false;
  }
  if (input.requireStructuredOutput && !candidate.supportsStructuredOutput) {
    return false;
  }
  if (input.requireTools && !candidate.supportsTools) {
    return false;
  }
  void primary;
  return true;
}

function eligibilityReason(model: InferenceModelRecord, input: GatewayRouteInput): string | null {
  if (model.status === 'DISABLED') {
    return 'DISABLED';
  }
  if (!model.approvedPurposes.includes(input.purpose)) {
    return 'PURPOSE_NOT_APPROVED';
  }
  if (!modelMayReceivePrivacy(model.dataHandling, input.privacyClass)) {
    return 'PRIVACY_NOT_APPROVED';
  }
  if (input.requireStructuredOutput && !model.supportsStructuredOutput) {
    return 'STRUCTURED_OUTPUT_REQUIRED';
  }
  if (input.requireTools && !model.supportsTools) {
    return 'TOOLS_REQUIRED';
  }
  if (input.requireStreaming && !model.supportsStreaming) {
    return 'STREAMING_REQUIRED';
  }
  if (input.contextTokens > model.contextWindow) {
    return 'CONTEXT_WINDOW';
  }
  if (
    model.jurisdictionRestrictions.length > 0 &&
    input.jurisdictionRef &&
    model.jurisdictionRestrictions.includes(input.jurisdictionRef)
  ) {
    return 'JURISDICTION_RESTRICTED';
  }
  const health = input.health[model.provider];
  if (health && !health.healthy) {
    return 'PROVIDER_UNHEALTHY';
  }
  if (input.preferredProvider && model.provider !== input.preferredProvider && input.purpose !== 'SIMPLE_CLASSIFICATION') {
    return null;
  }
  return null;
}

function compareModels(left: InferenceModelRecord, right: InferenceModelRecord, input: GatewayRouteInput): number {
  const leftPreferred = input.preferredProvider === left.provider ? 0 : 1;
  const rightPreferred = input.preferredProvider === right.provider ? 0 : 1;
  if (leftPreferred !== rightPreferred) {
    return leftPreferred - rightPreferred;
  }
  if (input.purpose === 'SIMPLE_CLASSIFICATION') {
    return totalCost(left) - totalCost(right);
  }
  const capability = capabilityScore(right, input) - capabilityScore(left, input);
  if (capability !== 0) {
    return capability;
  }
  const latency = latencyRank(left.latencyClass) - latencyRank(right.latencyClass);
  if (latency !== 0 && input.latencyPreference === 'LOW') {
    return latency;
  }
  if (input.costCeilingMicros !== null) {
    const leftOver = totalCost(left) > input.costCeilingMicros ? 1 : 0;
    const rightOver = totalCost(right) > input.costCeilingMicros ? 1 : 0;
    if (leftOver !== rightOver) {
      return leftOver - rightOver;
    }
  }
  return totalCost(left) - totalCost(right);
}

function capabilityScore(model: InferenceModelRecord, input: GatewayRouteInput): number {
  let score = 0;
  if (model.supportsStructuredOutput && input.requireStructuredOutput) {
    score += 8;
  }
  if (model.supportsTools && input.requireTools) {
    score += 6;
  }
  if (model.supportsStreaming && input.requireStreaming) {
    score += 2;
  }
  if (model.provider === 'S3M') {
    score += 4;
  }
  return score;
}

function latencyRank(value: InferenceModelRecord['latencyClass']): number {
  if (value === 'LOW') {
    return 0;
  }
  if (value === 'STANDARD') {
    return 1;
  }
  return 2;
}

function totalCost(model: InferenceModelRecord): number {
  return model.cost.inputMicrosPer1kTokens + model.cost.outputMicrosPer1kTokens;
}
