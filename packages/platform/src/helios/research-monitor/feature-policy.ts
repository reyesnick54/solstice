import type { UtcInstant } from '../../../../domain/src/time.ts';
import { isKnowableAt } from '../observation/information-time.ts';
import type { ResearchMonitorBlockReason, StaleFeaturePolicy } from './taxonomy.ts';
import type {
  CanonicalFeatureObservation,
  FeatureResolutionDiagnostic,
  PointInTimeFeatureRequirement,
  ResearchMonitorDefinition,
} from './types.ts';

function evalMs(instant: UtcInstant): number {
  return Date.parse(instant);
}

function requirementFor(
  featureId: string,
  requirements: readonly PointInTimeFeatureRequirement[],
): PointInTimeFeatureRequirement | null {
  return requirements.find((row) => row.featureId === featureId) ?? null;
}

export function diagnoseFeatureObservation(input: {
  readonly observation: CanonicalFeatureObservation;
  readonly evaluationTime: UtcInstant;
  readonly requirements: readonly PointInTimeFeatureRequirement[];
}): FeatureResolutionDiagnostic {
  const { observation, evaluationTime, requirements } = input;
  if (observation.missing) {
    return Object.freeze({
      featureId: observation.featureId,
      ok: false,
      reason: 'MISSING_FEATURE',
      asOf: observation.asOf,
      knowableAt: observation.informationTime.knowableAt,
    });
  }

  if (!isKnowableAt(evaluationTime, observation.informationTime)) {
    return Object.freeze({
      featureId: observation.featureId,
      ok: false,
      reason: 'FUTURE_FEATURE',
      asOf: observation.asOf,
      knowableAt: observation.informationTime.knowableAt,
    });
  }

  const requirement = requirementFor(observation.featureId, requirements);
  if (requirement) {
    const asOfMs = evalMs(observation.asOf);
    const evalTimeMs = evalMs(evaluationTime);
    if (Number.isFinite(asOfMs) && Number.isFinite(evalTimeMs) && evalTimeMs - asOfMs > requirement.maxAgeMs) {
      return Object.freeze({
        featureId: observation.featureId,
        ok: false,
        reason: 'STALE_FEATURE',
        asOf: observation.asOf,
        knowableAt: observation.informationTime.knowableAt,
      });
    }
  }

  if (observation.stale) {
    return Object.freeze({
      featureId: observation.featureId,
      ok: false,
      reason: 'STALE_FEATURE',
      asOf: observation.asOf,
      knowableAt: observation.informationTime.knowableAt,
    });
  }

  return Object.freeze({
    featureId: observation.featureId,
    ok: true,
    reason: null,
    asOf: observation.asOf,
    knowableAt: observation.informationTime.knowableAt,
  });
}

export function resolveFeaturePolicyBlock(input: {
  readonly diagnostics: readonly FeatureResolutionDiagnostic[];
  readonly staleDataPolicy: StaleFeaturePolicy;
}): ResearchMonitorBlockReason | null {
  const failed = input.diagnostics.filter((row) => !row.ok);
  if (failed.length === 0) {
    return null;
  }

  const reasons = new Set(failed.map((row) => row.reason).filter((row): row is ResearchMonitorBlockReason => row !== null));
  if (input.staleDataPolicy === 'IGNORE_MONITOR' && [...reasons].every((r) => r === 'STALE_FEATURE')) {
    return 'IGNORED_STALE_POLICY';
  }
  if (input.staleDataPolicy === 'TREAT_CONDITION_FALSE' && [...reasons].every((r) => r === 'STALE_FEATURE')) {
    return null;
  }

  if (reasons.has('FUTURE_FEATURE')) return 'FUTURE_FEATURE';
  if (reasons.has('MISSING_FEATURE')) return 'MISSING_FEATURE';
  if (reasons.has('STALE_FEATURE')) return 'STALE_FEATURE';
  return 'MISSING_FEATURE';
}

export function buildFeatureValueMap(input: {
  readonly observations: readonly CanonicalFeatureObservation[];
  readonly diagnostics: readonly FeatureResolutionDiagnostic[];
  readonly definition: ResearchMonitorDefinition;
}): { readonly ok: true; readonly values: ReadonlyMap<string, string> } | { readonly ok: false; readonly blockReason: ResearchMonitorBlockReason } {
  const blockReason = resolveFeaturePolicyBlock({
    diagnostics: input.diagnostics,
    staleDataPolicy: input.definition.staleDataPolicy,
  });
  if (blockReason === 'IGNORED_STALE_POLICY') {
    return { ok: false, blockReason: 'IGNORED_STALE_POLICY' };
  }
  if (blockReason !== null && input.definition.staleDataPolicy === 'FAIL_CLOSED') {
    return { ok: false, blockReason };
  }
  if (blockReason !== null && input.definition.staleDataPolicy === 'TREAT_CONDITION_FALSE') {
    return { ok: true, values: new Map() };
  }
  if (blockReason !== null) {
    return { ok: false, blockReason };
  }

  const failedIds = new Set(
    input.diagnostics.filter((row) => !row.ok).map((row) => row.featureId),
  );
  const values = new Map<string, string>();
  for (const observation of input.observations) {
    if (!observation.missing && !failedIds.has(observation.featureId)) {
      values.set(observation.featureId, observation.value);
    }
  }
  return { ok: true, values };
}
