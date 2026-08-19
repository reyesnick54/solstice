/**
 * Chunk 124 — Deterministic MoonRey Productive Value Function engine.
 *
 * Evaluates GovernedProductiveValueUnit (GPUV) in engineering
 * simulation. Does not mint MoonRey, does not create monetary or
 * Execution Authority, and does not activate production.
 *
 * Attribution is applied mathematically. A 40% share cannot receive
 * 100% of the event basis.
 */

import { mulDiv } from '../../formula.ts';
import type { ClaimType, ProductiveCategory } from '../../types.ts';
import {
  applyBaseValueSchedule,
  productionBaseValueScheduleUnconfigured,
  resolveBaseValueEntry,
  simulationBaseValueSchedule,
  type ProductiveBaseValueSchedule,
  type ProductiveBaseValueScheduleEntry,
} from './basis.ts';
import { PRODUCTIVE_VALUE_RESULT_SCHEMA_VERSION, sealProductiveValueResult, type FactorApplicationRecord, type PipelineTrace, type ProductiveValueOutcome, type ProductiveValueResult, type ProductiveValueResultStore } from './result.ts';
import { buildExplanationReceipt, type ProductiveValueExplanationReceipt } from './explanation.ts';
import { CANONICAL_FACTOR_ORDER, categoryPlan, factorDefinition } from './factors.ts';
import { validatePolicy, validateValueInput } from './invariants.ts';
import {
  applyAttributionToBasis,
  attributionShareFactor,
  boundFactorValue,
  composeFactors,
  freshnessToBoundedFactor,
  qualityToBoundedFactor,
  utilizationRatio,
  type OrderedFactorApplication,
} from './methods.ts';
import {
  geographyMatches,
  isPermittedGeographicContext,
  periodsMatch,
  resolveReferenceFacts,
  type ResolvedReferenceFacts,
} from './reference-resolution.ts';
import { productiveValueFunctionEngineStatus } from './status.ts';
import {
  ATTRIBUTION_SHARE_SCALE,
  PRODUCTIVE_VALUE_UNIT_ID,
  REALIZATION_ELIGIBILITY,
  VALUE_FACTOR_SCALE,
  valueFunctionRefuse,
  type ProductiveValueFunctionPolicy,
  type ProductiveValueInput,
  type RealizationState,
  type ValueFactorDefinition,
  type ValueFactorType,
  type ValueFunctionRefusal,
} from './types.ts';

export const VALUE_ENGINE_ROUNDING_DOCUMENTATION =
  'mulDiv uses bigint integer division. FLOOR discards the remainder; CEIL adds one when a remainder exists; ROUND_HALF_EVEN ties to even. Economic values are never converted to Number.';

const DEFAULT_MAX_AGE_EPOCHS = 4n;
const SOURCE_INDEPENDENCE_FULL = 3n;

export type ProductiveValueEvaluation = ProductiveValueOutcome & {
  readonly explanation: ProductiveValueExplanationReceipt | null;
  readonly engineStatus: ReturnType<typeof productiveValueFunctionEngineStatus>;
};

export type EvaluateProductiveValueContext = {
  readonly policy: ProductiveValueFunctionPolicy;
  readonly schedule?: ProductiveBaseValueSchedule;
  readonly store?: ProductiveValueResultStore;
};

type FactorEval =
  | { readonly kind: 'value'; readonly value: bigint; readonly treatment: FactorApplicationRecord['treatment']; readonly evidence: readonly string[] }
  | { readonly kind: 'review'; readonly code: ValueFunctionRefusal['code']; readonly detail: string }
  | { readonly kind: 'reject'; readonly code: ValueFunctionRefusal['code']; readonly detail: string };

export function evaluateProductiveValue(
  input: ProductiveValueInput,
  context: EvaluateProductiveValueContext,
): ProductiveValueEvaluation {
  const pipeline: PipelineTrace[] = [];
  const status = productiveValueFunctionEngineStatus();
  const policyCheck = validatePolicy(context.policy);
  if (!policyCheck.ok) {
    return finish(pipeline, 'VALUE_REJECTED', policyCheck.code, policyCheck.detail, null, null, status);
  }
  if (context.policy.productionActivated || status.productionActivated) {
    return finish(pipeline, 'VALUE_REJECTED', 'PRODUCTION_POLICY_INACTIVE', 'production value policy remains inactive', null, null, status);
  }
  if (input.aiEconomicJudgment) {
    return finish(pipeline, 'VALUE_REJECTED', 'AI_ECONOMIC_JUDGMENT_FORBIDDEN', 'AI economic judgment is forbidden', null, null, status);
  }

  const contributionStage = verifyContribution(input);
  pipeline.push(contributionStage.trace);
  if (contributionStage.failure) {
    return finish(pipeline, contributionStage.failure.state, contributionStage.failure.code, contributionStage.failure.detail, null, null, status);
  }

  const measurementStage = verifyMeasurement(input);
  pipeline.push(measurementStage.trace);
  if (measurementStage.failure) {
    return finish(pipeline, measurementStage.failure.state, measurementStage.failure.code, measurementStage.failure.detail, null, null, status);
  }

  const eventStage = verifyEvent(input);
  pipeline.push(eventStage.trace);
  if (eventStage.failure) {
    return finish(pipeline, eventStage.failure.state, eventStage.failure.code, eventStage.failure.detail, null, null, status);
  }

  const attributionStage = verifyAttribution(input, context.policy);
  pipeline.push(attributionStage.trace);
  if (attributionStage.failure) {
    return finish(pipeline, attributionStage.failure.state, attributionStage.failure.code, attributionStage.failure.detail, null, null, status);
  }

  const cross = verifyCrossReferences(input, context.policy);
  if (cross) {
    pipeline.push({ stage: 'ATTRIBUTION_VERIFICATION', status: cross.state === 'VALUE_REJECTED' ? 'REJECTED' : 'REVIEW', note: cross.detail });
    return finish(pipeline, cross.state, cross.code, cross.detail, null, null, status);
  }

  const inputCheck = validateValueInput(context.policy, input);
  if (!inputCheck.ok) {
    return finish(pipeline, 'VALUE_REJECTED', inputCheck.code, inputCheck.detail, null, null, status);
  }

  const schedule = context.schedule ?? simulationBaseValueSchedule();
  if (schedule.productionConfigured) {
    pipeline.push({ stage: 'BASE_VALUE_SCHEDULE_RESOLUTION', status: 'REJECTED', note: 'production schedule unconfigured' });
    return finish(pipeline, 'VALUE_REJECTED', 'PRODUCTION_SCHEDULE_UNCONFIGURED', 'production base-value schedules remain unconfigured', null, null, status);
  }
  const entry = resolveBaseValueEntry(schedule, {
    category: input.contribution.category,
    canonicalMeasurementUnit: input.measurementReference.unitId,
    measurementSemantic: requiredSemantic(input),
    claimType: input.contribution.claimType,
    realizationState: input.realizationState,
  });
  if (!entry.ok) {
    pipeline.push({ stage: 'BASE_VALUE_SCHEDULE_RESOLUTION', status: 'REJECTED', note: entry.detail });
    return finish(pipeline, 'VALUE_REJECTED', entry.code, entry.detail, null, null, status);
  }
  pipeline.push({
    stage: 'BASE_VALUE_SCHEDULE_RESOLUTION',
    status: 'PASSED',
    note: `${entry.value.entryId} ${entry.value.baseValueNumerator.toString()}/${entry.value.baseValueDenominator.toString()}`,
  });

  const basis = applyBaseValueSchedule(
    input.contribution.normalizedQuantity,
    entry.value,
    context.policy.roundingPolicy,
  );
  if (!basis.ok) {
    pipeline.push({ stage: 'PRELIMINARY_PRODUCTIVE_VALUE_BASIS', status: 'REJECTED', note: basis.detail });
    return finish(pipeline, 'VALUE_REJECTED', basis.code, basis.detail, null, null, status);
  }
  pipeline.push({
    stage: 'PRELIMINARY_PRODUCTIVE_VALUE_BASIS',
    status: 'PASSED',
    note: `baseProductiveValue=${basis.value.toString()} GPUV`,
  });

  const facts = resolveReferenceFacts(input.contribution.category, input);
  if (!facts.ok) {
    const review = facts.code === 'REFERENCE_FACTS_CONFLICT' || facts.code === 'REFERENCE_FACT_STALE' || facts.code === 'GEOGRAPHY_AMBIGUOUS';
    pipeline.push({
      stage: 'REQUIRED_REFERENCE_FACT_RESOLUTION',
      status: review ? 'REVIEW' : 'REJECTED',
      note: facts.detail,
    });
    return finish(
      pipeline,
      review ? 'VALUE_REVIEW_REQUIRED' : 'VALUE_REJECTED',
      facts.code,
      facts.detail,
      null,
      null,
      status,
    );
  }
  pipeline.push({
    stage: 'REQUIRED_REFERENCE_FACT_RESOLUTION',
    status: 'PASSED',
    note: `facts=${facts.value.factIds.join(',')}`,
  });

  const evaluated: FactorApplicationRecord[] = [];
  let scarcityCeilingApplied = false;
  for (const factorType of CANONICAL_FACTOR_ORDER) {
    const definition = factorDefinition(factorType);
    const factor = evaluateFactor(factorType, definition, input, facts.value, context.policy);
    if (factor.kind === 'reject') {
      pipeline.push({ stage: 'FACTOR_EVALUATION', status: 'REJECTED', note: `${factorType}: ${factor.detail}` });
      return finish(pipeline, 'VALUE_REJECTED', factor.code, factor.detail, null, null, status);
    }
    if (factor.kind === 'review') {
      pipeline.push({ stage: 'FACTOR_EVALUATION', status: 'REVIEW', note: `${factorType}: ${factor.detail}` });
      return finish(pipeline, 'VALUE_REVIEW_REQUIRED', factor.code, factor.detail, null, null, status);
    }
    if (factorType === 'SCARCITY_FACTOR' && factor.value === definition.maximum) {
      scarcityCeilingApplied = true;
    }
    evaluated.push(
      Object.freeze({
        factorType,
        value: factor.value,
        treatment: factor.treatment,
        evidenceRefs: factor.evidence,
      }),
    );
  }
  pipeline.push({
    stage: 'FACTOR_EVALUATION',
    status: 'PASSED',
    note: evaluated.map((item) => `${item.factorType}=${item.value.toString()}`).join(','),
  });

  const ordered: OrderedFactorApplication[] = evaluated
    .filter((item) => item.factorType !== 'ATTRIBUTION_SHARE_FACTOR')
    .map((item) => ({ factorType: item.factorType, value: item.value }));
  const nonAttributionOrder = CANONICAL_FACTOR_ORDER.filter((item) => item !== 'ATTRIBUTION_SHARE_FACTOR');
  const composed = composeFactors(
    ordered,
    nonAttributionOrder,
    context.policy.aggregateFactorFloor,
    context.policy.aggregateFactorCeiling,
    context.policy.roundingPolicy,
  );
  if (!composed.ok) {
    pipeline.push({ stage: 'ORDERED_FACTOR_COMPOSITION', status: 'REJECTED', note: composed.detail });
    return finish(pipeline, 'VALUE_REJECTED', composed.code, composed.detail, null, null, status);
  }
  pipeline.push({
    stage: 'ORDERED_FACTOR_COMPOSITION',
    status: 'PASSED',
    note: `aggregateFactor=${composed.value.toString()}`,
  });

  const preAttributionValue = mulDiv(basis.value, composed.value, VALUE_FACTOR_SCALE, context.policy.roundingPolicy);
  const attributed = applyAttributionToBasis(
    preAttributionValue,
    input.attributionDecision.share,
    context.policy.roundingPolicy,
  );
  if (!attributed.ok) {
    pipeline.push({ stage: 'ATTRIBUTION_APPLICATION', status: 'REJECTED', note: attributed.detail });
    return finish(pipeline, 'VALUE_REJECTED', attributed.code, attributed.detail, null, null, status);
  }
  if (input.attributionDecision.share.numerator < input.attributionDecision.share.denominator && attributed.value === preAttributionValue && preAttributionValue !== 0n) {
    pipeline.push({
      stage: 'ATTRIBUTION_APPLICATION',
      status: 'REJECTED',
      note: 'partial attribution must reduce the event basis',
    });
    return finish(
      pipeline,
      'VALUE_REJECTED',
      'ATTRIBUTION_SHARE_UNBOUNDED',
      'a partial attribution share cannot receive 100% of the event basis',
      null,
      null,
      status,
    );
  }
  pipeline.push({
    stage: 'ATTRIBUTION_APPLICATION',
    status: 'PASSED',
    note: `share=${input.attributionDecision.share.numerator.toString()}/${input.attributionDecision.share.denominator.toString()} final=${attributed.value.toString()}`,
  });
  pipeline.push({
    stage: 'POLICY_FLOOR_CEILING',
    status: 'PASSED',
    note: `floor=${context.policy.aggregateFactorFloor.toString()} ceiling=${context.policy.aggregateFactorCeiling.toString()}`,
  });

  const eventFingerprint = input.eventFingerprint ?? input.event.eventFingerprint ?? '';
  const evaluatedAt = input.evaluatedAt ?? '1970-01-01T00:00:00.000Z';
  const draft: Omit<ProductiveValueResult, 'valueDigest' | 'valueId'> = {
    schemaVersion: PRODUCTIVE_VALUE_RESULT_SCHEMA_VERSION,
    contributionId: input.contribution.contributionId,
    contributionFingerprint: input.contribution.fingerprint,
    claimId: input.contribution.claimId,
    eventId: input.event.eventId,
    eventFingerprint,
    objectId: input.contribution.objectId,
    category: input.contribution.category,
    claimType: input.contribution.claimType,
    realizationState: input.realizationState,
    normalizationReceiptId: input.normalizationReceipt.receiptId,
    normalizationConstitutionVersion: input.normalizationReceipt.conversionVersion,
    canonicalMeasurementUnit: input.measurementReference.unitId,
    canonicalMeasurementQuantity: input.contribution.normalizedQuantity,
    baseValueScheduleId: schedule.scheduleId,
    baseValueScheduleVersion: schedule.scheduleVersion,
    baseProductiveValue: basis.value,
    factorApplications: Object.freeze(evaluated),
    aggregateFactor: composed.value,
    attributionDecisionId: input.attributionDecision.decisionId,
    attributionPolicyVersion: input.attributionDecision.policyVersion,
    attributionShare: input.attributionDecision.share,
    preAttributionValue,
    finalProductiveValue: attributed.value,
    valueUnit: PRODUCTIVE_VALUE_UNIT_ID,
    valueFunctionPolicyId: context.policy.policyId,
    valueFunctionPolicyVersion: context.policy.policyVersion,
    referenceFactIds: facts.value.factIds,
    jurisdiction: input.jurisdiction,
    geography: input.geography,
    evaluatedAt,
    state: 'VALUED_SIMULATION',
    isPhysicalUnit: false,
    isFiatValue: false,
    isMarketPrice: false,
    isMoonReyQuantity: false,
    createsMintAuthority: false,
    createsExecutionAuthority: false,
    productionEligible: false,
    ...(input.supersedesValueId ? { supersedesValueId: input.supersedesValueId } : {}),
    ...(input.revaluationReason ? { revaluationReason: input.revaluationReason } : {}),
    ...(input.priorPolicyVersion !== undefined ? { priorPolicyVersion: input.priorPolicyVersion, newPolicyVersion: context.policy.policyVersion } : {}),
  };
  const result = sealProductiveValueResult(draft);
  pipeline.push({
    stage: 'FINAL_GOVERNED_PRODUCTIVE_VALUE',
    status: 'PASSED',
    note: `${result.finalProductiveValue.toString()} GPUV digest=${result.valueDigest}`,
  });

  const explanation = buildExplanationReceipt({
    result,
    sourceUnit: input.normalizationReceipt.sourceUnit,
    scheduleEntry: entry.value,
    scheduleId: schedule.scheduleId,
    scheduleVersion: schedule.scheduleVersion,
    attributionShare: input.attributionDecision.share,
    rounding: context.policy.roundingPolicy,
    aggregateFloor: context.policy.aggregateFactorFloor,
    aggregateCeiling: context.policy.aggregateFactorCeiling,
    scarcityCeilingApplied,
    pipeline,
    why: explainWhy(input, entry.value, result),
  });
  pipeline.push({ stage: 'EXPLAINABILITY_RECEIPT', status: 'PASSED', note: explanation.receiptId });

  if (context.store) {
    const stored = context.store.append(result);
    if (!stored.ok) {
      return finish(pipeline, 'VALUE_REJECTED', stored.code, stored.detail, null, explanation, status);
    }
  }

  return {
    state: 'VALUED_SIMULATION',
    result,
    explanation,
    pipeline,
    engineStatus: status,
  };
}

function requiredSemantic(input: ProductiveValueInput): string {
  return input.measurementSemantic ?? '';
}

function verifyContribution(input: ProductiveValueInput): Stage {
  if (!input.contribution?.contributionId || !input.contribution.fingerprint || input.contribution.status !== 'ELIGIBLE') {
    return rejected('VERIFIED_PRODUCTIVE_CONTRIBUTION', 'INCOMPLETE_VALUE_INPUT', 'verified productive contribution is required');
  }
  return passed('VERIFIED_PRODUCTIVE_CONTRIBUTION', input.contribution.contributionId);
}

function verifyMeasurement(input: ProductiveValueInput): Stage {
  if (!input.measurementReference?.unitId || !input.measurementReference.constitutionVersion) {
    return rejected('CANONICAL_MEASUREMENT_VERIFICATION', 'MEASUREMENT_REFERENCE_REQUIRED', 'canonical measurement reference is required');
  }
  if (!input.normalizationReceipt?.receiptId || !input.normalizationReceipt.conversionVersion) {
    return rejected('CANONICAL_MEASUREMENT_VERIFICATION', 'NORMALIZATION_RECEIPT_REQUIRED', 'normalization receipt is required');
  }
  if (input.normalizationReceipt.lossy || !input.normalizationReceipt.exact) {
    return rejected('CANONICAL_MEASUREMENT_VERIFICATION', 'FORBIDDEN_INPUT', 'lossy normalization cannot be valued');
  }
  if (!input.measurementSemantic) {
    return rejected('CANONICAL_MEASUREMENT_VERIFICATION', 'INCOMPLETE_VALUE_INPUT', 'measurement semantic is required for base-value schedule resolution');
  }
  if (typeof input.contribution.normalizedQuantity !== 'bigint') {
    return rejected('CANONICAL_MEASUREMENT_VERIFICATION', 'FLOAT_MATH_FORBIDDEN', 'canonical measurement quantity must be bigint');
  }
  return passed('CANONICAL_MEASUREMENT_VERIFICATION', `${input.measurementReference.unitId} ${input.contribution.normalizedQuantity.toString()}`);
}

function verifyEvent(input: ProductiveValueInput): Stage {
  if (!input.event?.eventId || !input.event.identityVersion) {
    return rejected('ECONOMIC_EVENT_VERIFICATION', 'INCOMPLETE_VALUE_INPUT', 'canonical productive economic event is required');
  }
  if (!(input.eventFingerprint ?? input.event.eventFingerprint)) {
    return rejected('ECONOMIC_EVENT_VERIFICATION', 'INCOMPLETE_VALUE_INPUT', 'event fingerprint is required');
  }
  if (!input.evaluatedAt) {
    return rejected('ECONOMIC_EVENT_VERIFICATION', 'INCOMPLETE_VALUE_INPUT', 'evaluatedAt is required for a deterministic value digest');
  }
  return passed('ECONOMIC_EVENT_VERIFICATION', input.event.eventId);
}

function verifyAttribution(input: ProductiveValueInput, policy: ProductiveValueFunctionPolicy): Stage {
  if (!policy.attributionRequired) {
    return rejected('ATTRIBUTION_VERIFICATION', 'ATTRIBUTION_REQUIRED', 'value function cannot ignore attribution');
  }
  if (!input.attributionDecision) {
    return rejected('ATTRIBUTION_VERIFICATION', 'ATTRIBUTION_REQUIRED', 'missing attribution decision');
  }
  if (!input.attributionDecision.authoritative) {
    return rejected('ATTRIBUTION_VERIFICATION', 'ATTRIBUTION_REQUIRED', 'attribution must be the Chunk 121/122 authority');
  }
  if (!input.attributionDecision.reconciled) {
    return review('ATTRIBUTION_VERIFICATION', 'ATTRIBUTION_UNRESOLVED', 'attribution decision is not reconciled');
  }
  return passed('ATTRIBUTION_VERIFICATION', input.attributionDecision.decisionId);
}

function verifyCrossReferences(
  input: ProductiveValueInput,
  policy: ProductiveValueFunctionPolicy,
): { state: 'VALUE_REJECTED' | 'VALUE_REVIEW_REQUIRED'; code: ValueFunctionRefusal['code']; detail: string } | null {
  const contribution = input.contribution;
  const event = input.event;
  const attribution = input.attributionDecision;
  if (policy.policyId !== input.valueFunctionPolicyId || policy.policyVersion !== input.valueFunctionPolicyVersion) {
    return { state: 'VALUE_REVIEW_REQUIRED', code: 'POLICY_VERSION_MISMATCH', detail: 'active value-function policy/version does not match the input' };
  }
  if (contribution.claimId !== attribution.claimId) {
    return { state: 'VALUE_REJECTED', code: 'CROSS_REFERENCE_MISMATCH', detail: 'attribution claimId does not match the contribution' };
  }
  if (attribution.contributionId && attribution.contributionId !== contribution.contributionId) {
    return { state: 'VALUE_REJECTED', code: 'CROSS_REFERENCE_MISMATCH', detail: 'attribution contributionId does not match the contribution' };
  }
  if (attribution.eventId !== event.eventId) {
    return { state: 'VALUE_REJECTED', code: 'EVENT_ATTRIBUTION_MISMATCH', detail: 'a valid attribution for Event A cannot value Event B' };
  }
  if (contribution.objectId !== event.objectId) {
    return { state: 'VALUE_REJECTED', code: 'CROSS_REFERENCE_MISMATCH', detail: 'event objectId does not match the contribution' };
  }
  if (contribution.category !== event.category) {
    return { state: 'VALUE_REJECTED', code: 'CROSS_REFERENCE_MISMATCH', detail: 'event category does not match the contribution' };
  }
  if (!periodsMatch(contribution.measurementPeriod, event.measurementPeriod) || !periodsMatch(contribution.measurementPeriod, input.measurementPeriod)) {
    return { state: 'VALUE_REJECTED', code: 'CROSS_REFERENCE_MISMATCH', detail: 'measurement periods are inconsistent' };
  }
  if (input.normalizationReceipt.receiptId !== (contribution.normalizationReceiptId ?? input.normalizationReceipt.receiptId)) {
    return { state: 'VALUE_REJECTED', code: 'CROSS_REFERENCE_MISMATCH', detail: 'normalization receipt does not match the contribution' };
  }
  if (
    attribution.availableShare.numerator !== input.availableAttributionShare.numerator ||
    attribution.availableShare.denominator !== input.availableAttributionShare.denominator
  ) {
    return { state: 'VALUE_REJECTED', code: 'ATTRIBUTION_SHARE_INVALID', detail: 'available attribution share does not match the decision' };
  }
  return null;
}

function evaluateFactor(
  factorType: ValueFactorType,
  definition: ValueFactorDefinition,
  input: ProductiveValueInput,
  facts: ResolvedReferenceFacts,
  policy: ProductiveValueFunctionPolicy,
): FactorEval {
  const plan = categoryPlan(input.contribution.category);
  if (plan.disabled.includes(factorType)) {
    return { kind: 'value', value: VALUE_FACTOR_SCALE, treatment: 'DISABLED_NEUTRAL', evidence: [] };
  }
  const required = plan.required.includes(factorType);
  const evaluated = evaluateSupportedFactor(factorType, definition, input, facts, policy);
  if (evaluated.kind !== 'value') {
    if (!required && isMissingEvidence(evaluated) && factorType !== 'ATTRIBUTION_SHARE_FACTOR') {
      return {
        kind: 'value',
        value: VALUE_FACTOR_SCALE,
        treatment: 'NOT_REQUIRED_NEUTRAL',
        evidence: [],
      };
    }
    return evaluated;
  }
  const capped = applyFactorCap(definition, evaluated.value, policy, factorType);
  if (capped.kind !== 'value') {
    return capped;
  }
  return { ...evaluated, value: capped.value };
}

function isMissingEvidence(result: FactorEval): boolean {
  return result.kind !== 'value' && (
    result.code === 'MISSING_INPUT_FAIL_CLOSED' ||
    result.code === 'MISSING_INPUT_REVIEW_REQUIRED' ||
    result.code === 'SCARCITY_REFERENCE_REQUIRED' ||
    result.code === 'UTILIZATION_EVIDENCE_REQUIRED' ||
    result.code === 'GEOGRAPHY_EVIDENCE_REQUIRED'
  );
}

function evaluateSupportedFactor(
  factorType: ValueFactorType,
  definition: ValueFactorDefinition,
  input: ProductiveValueInput,
  facts: ResolvedReferenceFacts,
  policy: ProductiveValueFunctionPolicy,
): FactorEval {
  switch (factorType) {
    case 'REALIZATION_FACTOR':
      return realizationFactor(input, definition);
    case 'CLAIM_STATE_FACTOR':
      return claimStateFactor(input, definition);
    case 'VERIFICATION_QUALITY_FACTOR':
      return qualityFactor(input, facts, definition);
    case 'FRESHNESS_FACTOR':
      return freshnessFactor(input, facts, definition);
    case 'SOURCE_INDEPENDENCE_FACTOR':
      return sourceIndependenceFactor(input, facts, definition);
    case 'UTILIZATION_FACTOR':
      return utilizationFactor(input, facts, definition);
    case 'SCARCITY_FACTOR':
      return scarcityFactor(input, facts, definition);
    case 'DELIVERY_FACTOR':
      return deliveryFactor(input, facts, definition);
    case 'GEOGRAPHIC_CONTEXT_FACTOR':
      return geographicFactor(input, facts, definition);
    case 'ECONOMIC_CATEGORY_FACTOR':
      return categoryFactor(input.contribution.category, definition);
    case 'PROVENANCE_CONFIDENCE_FACTOR':
      return provenanceFactor(input, facts, definition);
    case 'ATTRIBUTION_SHARE_FACTOR':
      return attributionFactor(input, definition, policy);
    case 'CONCENTRATION_RISK_FACTOR':
      return concentrationFactor(input, definition);
  }
}

function realizationFactor(input: ProductiveValueInput, definition: ValueFactorDefinition): FactorEval {
  const eligibility = REALIZATION_ELIGIBILITY[input.realizationState];
  if (eligibility === 'DESCRIBABLE_NOT_ELIGIBLE') {
    return { kind: 'reject', code: 'CAPACITY_IS_NOT_REALIZED_OUTPUT', detail: `${input.realizationState} cannot masquerade as realized output` };
  }
  return bounded(definition, VALUE_FACTOR_SCALE, ['realization_state']);
}

function claimStateFactor(input: ProductiveValueInput, definition: ValueFactorDefinition): FactorEval {
  const schedule: Record<typeof input.claimOutputState, bigint> = {
    CLAIMED_OUTPUT: 250_000n,
    VERIFIED_OUTPUT: 800_000n,
    DELIVERED_OUTPUT: 900_000n,
    COMPLETED_SERVICE: VALUE_FACTOR_SCALE,
  };
  return bounded(definition, schedule[input.claimOutputState], ['claim_output_state']);
}

function qualityFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  const qualityFacts = facts.byType.QUALITY ?? [];
  if (qualityFacts.length === 0 && input.oracleQuality === undefined) {
    return missing(definition, 'canonical quality evidence is required');
  }
  const quality = qualityFacts[0]?.quality ?? input.oracleQuality;
  const scaled = qualityToBoundedFactor(quality, VALUE_FACTOR_SCALE, definition.roundingRule);
  if (!scaled.ok) {
    return { kind: 'reject', code: scaled.code, detail: scaled.detail };
  }
  return bounded(definition, scaled.value, qualityFacts.map((fact) => fact.factId));
}

function freshnessFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  const freshnessFacts = facts.byType.FRESHNESS ?? [];
  const age = input.freshnessAgeEpochs ?? (freshnessFacts[0] ? BigInt(freshnessFacts[0].freshnessEpochs) : undefined);
  const maxAge = input.policyMaxAgeEpochs ?? DEFAULT_MAX_AGE_EPOCHS;
  if (age === undefined) {
    return missing(definition, 'freshness age evidence is required');
  }
  const scaled = freshnessToBoundedFactor(age, maxAge, definition.roundingRule);
  if (!scaled.ok) {
    return { kind: 'reject', code: scaled.code, detail: scaled.detail };
  }
  return bounded(definition, scaled.value, freshnessFacts.map((fact) => fact.factId));
}

function sourceIndependenceFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  const sources = new Set<string>([...input.oracleProvenance, ...facts.facts.flatMap((fact) => fact.sourceQuorumEvidence)]);
  if (sources.size === 0) {
    return missing(definition, 'independent-source evidence is required');
  }
  if (BigInt(sources.size) < SOURCE_INDEPENDENCE_FULL && definition.missingInputBehavior === 'REVIEW_REQUIRED' && sources.size < 2) {
    return { kind: 'review', code: 'MISSING_INPUT_REVIEW_REQUIRED', detail: 'independent source quorum is below policy' };
  }
  const value = sources.size >= 3 ? VALUE_FACTOR_SCALE : sources.size === 2 ? 750_000n : 500_000n;
  return bounded(definition, value, [...sources]);
}

function utilizationFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  if (input.providerSelfReportAlone) {
    return { kind: 'reject', code: 'PROVIDER_SELF_REPORT_INSUFFICIENT', detail: 'utilization cannot be provider self-report alone' };
  }
  const evidence = input.utilization;
  const capacityFacts = [...(facts.byType.UTILIZATION ?? []), ...(facts.byType.CAPACITY ?? []), ...(facts.byType.AVAILABILITY ?? [])];
  if (!evidence) {
    return missing(definition, 'governed utilization actual/basis evidence is required');
  }
  if (!evidence.independentlyEvidenced || capacityFacts.length === 0) {
    return { kind: 'reject', code: 'UTILIZATION_EVIDENCE_REQUIRED', detail: 'utilization requires independent verified capacity evidence' };
  }
  if (evidence.objectId !== input.contribution.objectId) {
    return { kind: 'reject', code: 'UTILIZATION_OBJECT_MISMATCH', detail: 'utilization basis object does not match the valued object' };
  }
  if (!periodsMatch(evidence.measurementPeriod, input.measurementPeriod)) {
    return { kind: 'review', code: 'UTILIZATION_PERIOD_MISMATCH', detail: 'utilization basis period does not match the valued event' };
  }
  if (!geographyMatches(evidence.geography, input.geography)) {
    return { kind: 'review', code: 'UTILIZATION_GEOGRAPHY_MISMATCH', detail: 'utilization basis geography does not match the valued event' };
  }
  if (evidence.basisFreshnessEpochs > 2) {
    return { kind: 'review', code: 'UTILIZATION_BASIS_STALE', detail: 'utilization capacity basis is stale' };
  }
  if (evidence.basis === 0n) {
    return { kind: 'reject', code: 'UTILIZATION_DIVIDE_BY_ZERO', detail: 'governed capacity basis cannot be zero; denominator is never fabricated' };
  }
  const ratio = utilizationRatio(evidence.actual, evidence.basis, definition.roundingRule);
  if (!ratio.ok) {
    return { kind: 'reject', code: ratio.code, detail: ratio.detail };
  }
  return bounded(definition, ratio.value, capacityFacts.map((fact) => fact.factId));
}

function scarcityFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  const evidenced =
    (facts.byType.REGIONAL_SUPPLY?.length ?? 0) +
      (facts.byType.REGIONAL_DEMAND_PROXY?.length ?? 0) +
      (facts.byType.CAPACITY?.length ?? 0) +
      (facts.byType.AVAILABILITY?.length ?? 0) >
    0;
  if (input.referencePriceAlone || ((facts.byType.REFERENCE_PRICE?.length ?? 0) > 0 && !evidenced)) {
    return { kind: 'reject', code: 'SCARCITY_PRICE_ALONE_FORBIDDEN', detail: 'price alone cannot define scarcity' };
  }
  const supply = facts.byType.REGIONAL_SUPPLY ?? [];
  const demand = facts.byType.REGIONAL_DEMAND_PROXY ?? [];
  const capacity = [...(facts.byType.CAPACITY ?? []), ...(facts.byType.AVAILABILITY ?? [])];
  if (supply.length === 0 && demand.length === 0 && capacity.length === 0) {
    return missing(definition, 'scarcity requires permitted verified reference facts');
  }
  const supplyQty = supply[0]?.quantity ?? capacity[0]?.quantity;
  const demandQty = demand[0]?.quantity;
  let value = definition.neutralValue;
  if (supplyQty && demandQty) {
    if (supplyQty.denominator <= 0n || demandQty.denominator <= 0n || supplyQty.numerator === 0n) {
      return { kind: 'reject', code: 'UNBOUNDED_FACTOR', detail: 'scarcity reference quantities must be exact positive rationals' };
    }
    const demandAbs = demandQty.numerator * supplyQty.denominator;
    const supplyAbs = supplyQty.numerator * demandQty.denominator;
    const unclamped = mulDiv(VALUE_FACTOR_SCALE, demandAbs, supplyAbs, definition.roundingRule);
    if (unclamped > definition.maximum) {
      value = definition.maximum;
    } else if (unclamped < definition.minimum) {
      value = definition.minimum;
    } else {
      value = unclamped;
    }
  }
  return bounded(definition, value, [...supply, ...demand, ...capacity].map((fact) => fact.factId));
}

function deliveryFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  const deliveryFacts = facts.byType.DELIVERY_STATE ?? [];
  const delivered =
    input.realizationState === 'VERIFIED_DELIVERY' ||
    input.realizationState === 'COMPLETED_ECONOMIC_SERVICE' ||
    input.claimOutputState === 'DELIVERED_OUTPUT' ||
    input.claimOutputState === 'COMPLETED_SERVICE' ||
    deliveryFacts.length > 0;
  if (!delivered) {
    return missing(definition, 'delivery evidence is required');
  }
  return bounded(definition, VALUE_FACTOR_SCALE, deliveryFacts.map((fact) => fact.factId));
}

function geographicFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  if (input.countryPreferenceRequested) {
    return { kind: 'reject', code: 'ARBITRARY_COUNTRY_PREFERENCE_FORBIDDEN', detail: 'geography cannot be an arbitrary country-preference multiplier' };
  }
  if (input.geographyContextKind && !isPermittedGeographicContext(input.geographyContextKind)) {
    return { kind: 'reject', code: 'ARBITRARY_COUNTRY_PREFERENCE_FORBIDDEN', detail: `${input.geographyContextKind} is not a permitted geographic context` };
  }
  const geoFacts = [...(facts.byType.REGIONAL_SUPPLY ?? []), ...(facts.byType.REGIONAL_DEMAND_PROXY ?? [])];
  if (!input.geographyContextKind || geoFacts.length === 0) {
    return missing(definition, 'geography requires governed geographic reference evidence');
  }
  const jurisdictions = new Set(geoFacts.map((fact) => fact.geography.jurisdiction));
  if (jurisdictions.size > 1) {
    return { kind: 'review', code: 'GEOGRAPHY_AMBIGUOUS', detail: 'geographic reference facts span more than one jurisdiction' };
  }
  const qty = geoFacts.find((fact) => fact.quantity)?.quantity;
  const value = qty
    ? clamp(
        mulDiv(VALUE_FACTOR_SCALE, qty.numerator, qty.denominator, definition.roundingRule),
        definition.minimum,
        definition.maximum,
      )
    : definition.neutralValue;
  return bounded(definition, value, geoFacts.map((fact) => fact.factId));
}

function categoryFactor(category: ProductiveCategory, definition: ValueFactorDefinition): FactorEval {
  const schedule: Record<ProductiveCategory, bigint> = {
    ENERGY: VALUE_FACTOR_SCALE,
    AI_COMPUTE: 900_000n,
    MANUFACTURING: 800_000n,
    LOGISTICS_TRANSPORTATION: 750_000n,
    WATER: 850_000n,
    SERVICES: 600_000n,
    FOOD_AGRICULTURE: 700_000n,
    MINERALS_RAW_MATERIALS: 650_000n,
    REAL_ESTATE_USE: 550_000n,
    COMPUTE: 850_000n,
    STORAGE: 500_000n,
    BANDWIDTH_COMMUNICATIONS: 700_000n,
    INFRASTRUCTURE: 550_000n,
    GOODS: 750_000n,
    AUTOMATED_MACHINE_OUTPUT: 800_000n,
  };
  return bounded(definition, schedule[category], ['category_policy_schedule']);
}

function provenanceFactor(input: ProductiveValueInput, facts: ResolvedReferenceFacts, definition: ValueFactorDefinition): FactorEval {
  if (input.oracleProvenance.length === 0) {
    return missing(definition, 'canonical provenance evidence is required');
  }
  const complete = input.oracleProvenance.length >= 2 && facts.facts.every((fact) => fact.sourceQuorumEvidence.length > 0);
  if (!complete) {
    return { kind: 'review', code: 'MISSING_INPUT_REVIEW_REQUIRED', detail: 'provenance lineage is incomplete' };
  }
  return bounded(definition, VALUE_FACTOR_SCALE, [...input.oracleProvenance]);
}

function attributionFactor(
  input: ProductiveValueInput,
  definition: ValueFactorDefinition,
  policy: ProductiveValueFunctionPolicy,
): FactorEval {
  const scaled = attributionShareFactor(input.attributionDecision.share, policy.roundingPolicy);
  if (!scaled.ok) {
    return { kind: 'reject', code: scaled.code, detail: scaled.detail };
  }
  if (scaled.value > ATTRIBUTION_SHARE_SCALE) {
    return { kind: 'reject', code: 'ATTRIBUTION_SHARE_UNBOUNDED', detail: 'attribution share cannot exceed the event basis' };
  }
  return bounded(definition, scaled.value, [input.attributionDecision.decisionId]);
}

function concentrationFactor(input: ProductiveValueInput, definition: ValueFactorDefinition): FactorEval {
  if (!input.concentration) {
    return missing(definition, 'governed concentration context is absent');
  }
  const share = input.concentration.providerShare;
  if (share.denominator <= 0n) {
    return { kind: 'reject', code: 'UNBOUNDED_FACTOR', detail: 'concentration share denominator must be positive' };
  }
  const threshold = input.concentration.reviewThreshold;
  if (share.numerator * threshold.denominator > threshold.numerator * share.denominator) {
    return { kind: 'review', code: 'CONCENTRATION_REVIEW_REQUIRED', detail: 'source concentration exceeds the policy review threshold' };
  }
  const scaled = mulDiv(VALUE_FACTOR_SCALE, share.denominator - share.numerator, share.denominator, definition.roundingRule);
  const value = scaled < definition.minimum ? definition.minimum : scaled;
  return bounded(definition, value, ['governed_concentration_context']);
}

function missing(definition: ValueFactorDefinition, detail: string): FactorEval {
  if (definition.missingInputBehavior === 'FAIL_CLOSED') {
    return { kind: 'reject', code: 'MISSING_INPUT_FAIL_CLOSED', detail };
  }
  if (definition.missingInputBehavior === 'REVIEW_REQUIRED') {
    return { kind: 'review', code: 'MISSING_INPUT_REVIEW_REQUIRED', detail };
  }
  return { kind: 'value', value: definition.neutralValue, treatment: 'NOT_REQUIRED_NEUTRAL', evidence: [] };
}

function bounded(definition: ValueFactorDefinition, value: bigint, evidence: readonly string[]): FactorEval {
  const checked = boundFactorValue(definition, value);
  if (!checked.ok) {
    if (checked.code === 'FACTOR_OUT_OF_BOUNDS') {
      const clamped = clamp(value, definition.minimum, definition.maximum);
      return { kind: 'value', value: clamped, treatment: 'EVALUATED', evidence };
    }
    return { kind: 'reject', code: checked.code, detail: checked.detail };
  }
  return { kind: 'value', value: checked.value, treatment: 'EVALUATED', evidence };
}

function applyFactorCap(
  definition: ValueFactorDefinition,
  value: bigint,
  policy: ProductiveValueFunctionPolicy,
  factorType: ValueFactorType,
): FactorEval {
  const cap = policy.factorCaps[factorType];
  if (!cap) {
    return { kind: 'reject', code: 'UNBOUNDED_FACTOR', detail: `${factorType} is missing an explicit cap` };
  }
  if (value > cap.max || value > definition.maximum) {
    if (factorType === 'SCARCITY_FACTOR') {
      return { kind: 'value', value: cap.max < definition.maximum ? cap.max : definition.maximum, treatment: 'EVALUATED', evidence: ['scarcity_ceiling'] };
    }
    return { kind: 'reject', code: 'FACTOR_OUT_OF_BOUNDS', detail: `${factorType} exceeds its policy cap` };
  }
  if (value < cap.min) {
    return { kind: 'reject', code: 'FACTOR_OUT_OF_BOUNDS', detail: `${factorType} is below its policy cap` };
  }
  return { kind: 'value', value, treatment: 'EVALUATED', evidence: [] };
}

function clamp(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function explainWhy(
  input: ProductiveValueInput,
  entry: ProductiveBaseValueScheduleEntry,
  result: ProductiveValueResult,
): string {
  return [
    `Canonical ${result.canonicalMeasurementQuantity.toString()} ${result.canonicalMeasurementUnit} (${input.normalizationReceipt.sourceUnit} via ${result.normalizationReceiptId})`,
    `converted by governed schedule ${entry.entryId} ${entry.baseValueNumerator.toString()}/${entry.baseValueDenominator.toString()}`,
    `to base ${result.baseProductiveValue.toString()} GPUV.`,
    `Non-attribution factors composed to ${result.aggregateFactor.toString()} / ${VALUE_FACTOR_SCALE.toString()}.`,
    `Attribution share ${result.attributionShare.numerator.toString()}/${result.attributionShare.denominator.toString()} was applied to ${result.preAttributionValue.toString()} GPUV`,
    `producing ${result.finalProductiveValue.toString()} GPUV.`,
    'GPUV is not a physical unit, not fiat, not a market price, and not MoonRey.',
  ].join(' ');
}

type Stage = {
  readonly trace: PipelineTrace;
  readonly failure?: { readonly state: 'VALUE_REJECTED' | 'VALUE_REVIEW_REQUIRED'; readonly code: ValueFunctionRefusal['code']; readonly detail: string };
};

function passed(stage: PipelineTrace['stage'], note: string): Stage {
  return { trace: { stage, status: 'PASSED', note } };
}

function rejected(stage: PipelineTrace['stage'], code: ValueFunctionRefusal['code'], detail: string): Stage {
  return { trace: { stage, status: 'REJECTED', note: detail }, failure: { state: 'VALUE_REJECTED', code, detail } };
}

function review(stage: PipelineTrace['stage'], code: ValueFunctionRefusal['code'], detail: string): Stage {
  return { trace: { stage, status: 'REVIEW', note: detail }, failure: { state: 'VALUE_REVIEW_REQUIRED', code, detail } };
}

function finish(
  pipeline: readonly PipelineTrace[],
  state: ProductiveValueOutcome['state'],
  code: string,
  detail: string,
  result: ProductiveValueResult | null,
  explanation: ProductiveValueExplanationReceipt | null,
  engineStatus: ReturnType<typeof productiveValueFunctionEngineStatus>,
): ProductiveValueEvaluation {
  return { state, result, code, detail, pipeline, explanation, engineStatus };
}

export function engineCannotMint(): false {
  return productiveValueFunctionEngineStatus().canMint;
}

export function engineProductionActive(): false {
  return productiveValueFunctionEngineStatus().productionActivated;
}

export { productionBaseValueScheduleUnconfigured, simulationBaseValueSchedule };

export type { ClaimType };
