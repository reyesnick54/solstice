/**
 * Engineering-implemented reference valuation.
 *
 * Output is a contribution reference settlement value, never a
 * SunRey Coin quantity. Production valuation remains NOT_ACTIVATED.
 */

import { computeValuationDigest } from './digest.ts';
import { actorValuationRejection, validateValuationInput, valuationFirewallRejection } from './invariants.ts';
import { validateValuationPolicy } from './policy.ts';
import type {
  HumanContributionValuationPolicy,
  ValuationComputeResult,
  VerifiedContributionValuationInput,
} from './types.ts';

function scaleReference(quantity: bigint, numerator: bigint, denominator: bigint): bigint {
  return (quantity * numerator) / denominator;
}

export function valueVerifiedContribution(input: {
  readonly contribution: VerifiedContributionValuationInput;
  readonly policy: HumanContributionValuationPolicy;
  readonly actor: string;
  readonly valuationId?: string;
  readonly extra?: Readonly<Record<string, unknown>>;
}): ValuationComputeResult {
  if (input.extra) {
    const extraPoison = valuationFirewallRejection(input.extra);
    if (extraPoison) {
      return { ok: false, code: extraPoison };
    }
  }
  const actorRejection = actorValuationRejection(input.actor);
  if (actorRejection) {
    return { ok: false, code: actorRejection };
  }
  const contributionRejection = validateValuationInput(input.contribution);
  if (contributionRejection) {
    return { ok: false, code: contributionRejection };
  }
  const policyRejection = validateValuationPolicy(input.policy);
  if (policyRejection) {
    return { ok: false, code: policyRejection };
  }
  if (input.policy.jurisdictionPolicyRef !== input.contribution.jurisdictionPolicyRef) {
    return { ok: false, code: 'JURISDICTION_POLICY_MISMATCH' };
  }
  const raw = scaleReference(
    input.contribution.measurementQuantity,
    input.policy.unitScaleNumerator,
    input.policy.unitScaleDenominator,
  );
  if (raw <= 0n) {
    return { ok: false, code: 'INVALID_MEASUREMENT' };
  }
  if (raw > input.policy.perContributionReferenceCeiling) {
    return { ok: false, code: 'VALUATION_CAP_EXCEEDED' };
  }
  const valuationId =
    input.valuationId ?? `hcv.${input.contribution.contributionId}.${input.policy.version}`;
  const digest = computeValuationDigest({
    valuationId,
    contributionId: input.contribution.contributionId,
    fingerprint: input.contribution.fingerprint,
    valuationPolicyId: input.policy.policyId,
    valuationPolicyVersion: input.policy.version,
    valuationMethod: input.policy.method,
    finalReferenceValue: raw,
    referenceDenomination: input.policy.referenceDenomination,
  });
  return {
    ok: true,
    result: Object.freeze({
      schemaVersion: 1,
      valuationId,
      contributionId: input.contribution.contributionId,
      fingerprint: input.contribution.fingerprint,
      valuationPolicyId: input.policy.policyId,
      valuationPolicyVersion: input.policy.version,
      valuationMethod: input.policy.method,
      valuationDigest: digest,
      finalReferenceValue: raw,
      referenceDenomination: input.policy.referenceDenomination,
      jurisdictionPolicyRef: input.contribution.jurisdictionPolicyRef,
      status: 'ACTIVE',
      environment: input.policy.environment,
      simulationOnly: true,
      productionActivated: false,
      parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
      peveUsedAsTokenFormula: false,
      humanWorthUsedAsValue: false,
      aiAuthorized: false,
      referenceValueEqualsSunReyByDefinition: false,
      sunReyQuantity: null,
    }),
  };
}

export function refuseProductionValuation(): ValuationComputeResult {
  return { ok: false, code: 'PRODUCTION_VALUATION_UNAVAILABLE' };
import { FORBIDDEN_IDENTITY_FIELDS, FORBIDDEN_SCORE_FIELDS, PROTECTED_TRAIT_FIELDS } from '../taxonomy.ts';
import {
  applyCap,
  applyFloor,
  assertBounded,
  BASIS_POINTS_PER_UNIT,
  multiplyBasisPoints,
  multiplyRational,
  rejectNegative,
  ValuationArithmeticError,
} from './arithmetic.ts';
import { asVerifiedHumanEconomicContribution, type ValuationContributionSource } from './contribution.ts';
import { buildExplanation } from './explanation.ts';
import { HumanContributionValuationHistory } from './history.ts';
import { valuationDigestFor, valuationIdFor } from './ids.ts';
import { requiredReferenceSource } from './policy.ts';
import type {
  CapApplication,
  ConfidenceClass,
  FactorRequest,
  HumanContributionValuationPolicy,
  HumanContributionValuationResult,
  PipelineStep,
  ValuationAdjustment,
  ValuationEngineInput,
  ValuationFactor,
  ValuationMethod,
  ValuationReasonCode,
  ValuationReferenceDataPort,
  ValuationReferenceDatum,
  ValuationState,
  VerifiedHumanEconomicContribution,
} from './types.ts';
import {
  VALUATION_INVARIANTS,
  confidenceClassFromBps,
  isForbiddenFactorType,
  isValuationFactorType,
} from './types.ts';

export type EngineEvaluateInput = Omit<ValuationEngineInput, 'contribution'> & {
  readonly contribution: ValuationContributionSource;
};

function instantSeconds(value: string): bigint {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    return 0n;
  }
  return BigInt(Math.trunc(millis / 1000));
}

function reasonForStatus(contribution: VerifiedHumanEconomicContribution): ValuationReasonCode | null {
  if (contribution.status === 'VERIFIED' && contribution.dataQuality === 'CURRENT' && contribution.verifiedMeasurement) {
    return null;
  }
  if (contribution.status === 'SUPERSEDED' || contribution.status === 'CORRECTED' || contribution.dataQuality === 'SUPERSEDED') {
    return 'SUPERSEDED_CONTRIBUTION';
  }
  if (contribution.status === 'REJECTED') {
    return 'REJECTED_CONTRIBUTION';
  }
  if (contribution.dataQuality === 'INCOMPLETE') {
    return 'INCOMPLETE_CONTRIBUTION';
  }
  if (contribution.dataQuality === 'CONFLICTED') {
    return 'CONFLICTED_CONTRIBUTION';
  }
  return 'UNVERIFIED_CONTRIBUTION';
}

function asPolicyFactor(factor: FactorRequest): ValuationFactor | null {
  if (!isValuationFactorType(factor.factorType) || isForbiddenFactorType(factor.factorType)) {
    return null;
  }
  return Object.freeze({
    factorType: factor.factorType,
    inputRef: factor.inputRef,
    numerator: factor.numerator,
    denominator: factor.denominator,
    basisPoints: factor.basisPoints,
    reasonCode: factor.reasonCode,
    policyRuleRef: factor.policyRuleRef,
  });
}

const ENGINE_INPUT_KEYS = new Set([
  'contribution',
  'policy',
  'valuationTimestamp',
  'requestedFactors',
  'supersedesValuationId',
  'revaluationReason',
  'outcomeEvidenceRefs',
  'attributionPolicyRef',
]);

function scanForbiddenValuationInput(input: EngineEvaluateInput): ValuationReasonCode | null {
  const extra = input as unknown as Record<string, unknown>;
  for (const [key, item] of Object.entries(extra)) {
    if (ENGINE_INPUT_KEYS.has(key)) {
      continue;
    }
    if ((PROTECTED_TRAIT_FIELDS as readonly string[]).includes(key) || (PROTECTED_TRAIT_FIELDS as readonly string[]).includes(key.toLowerCase())) {
      return 'PROTECTED_TRAIT_FORBIDDEN';
    }
    if ((FORBIDDEN_IDENTITY_FIELDS as readonly string[]).includes(key)) {
      return 'PROTECTED_TRAIT_FORBIDDEN';
    }
    if (key === 'personLevelMultiplier' || key === 'humanWorthMultiplier') {
      return 'PERSON_LEVEL_MULTIPLIER_FORBIDDEN';
    }
    if (key === 'aiSubjectiveScore' || key === 'modelScore') {
      return 'AI_SUBJECTIVE_SCORE_FORBIDDEN';
    }
    if ((FORBIDDEN_SCORE_FIELDS as readonly string[]).includes(key) || key === 'peveScore' || key === 'isPeveScore') {
      if (item === false || item === null) {
        continue;
      }
      return key.toLowerCase().includes('peve') ? 'PEVE_INPUT_FORBIDDEN' : 'AI_SUBJECTIVE_SCORE_FORBIDDEN';
    }
  }
  return null;
}

function materializeValuationId(
  contribution: VerifiedHumanEconomicContribution,
  policy: HumanContributionValuationPolicy,
  valuationTimestamp: ValuationEngineInput['valuationTimestamp'],
  method: ValuationMethod | null,
  state: ValuationState,
  supersedesValuationId?: ValuationEngineInput['supersedesValuationId'],
  revaluationReason?: ValuationEngineInput['revaluationReason'],
): ReturnType<typeof valuationIdFor> {
  return valuationIdFor(
    [
      contribution.contributionId,
      contribution.contributionFingerprint,
      policy.valuationPolicyVersion,
      method ?? 'NONE',
      valuationTimestamp,
      supersedesValuationId ?? '',
      revaluationReason ?? '',
      state,
    ].join('\n'),
  );
}

function digestOf(result: Omit<HumanContributionValuationResult, 'valuationDigest' | 'explanation'> & {
  readonly explanation: HumanContributionValuationResult['explanation'];
}): ReturnType<typeof valuationDigestFor> {
  return valuationDigestFor(
    JSON.stringify({
      valuationId: result.valuationId,
      contributionId: result.contributionId,
      contributionFingerprint: result.contributionFingerprint,
      contributionClass: result.contributionClass,
      valuationPolicyId: result.valuationPolicyId,
      valuationPolicyVersion: result.valuationPolicyVersion,
      valuationMethod: result.valuationMethod,
      referenceDataRefs: result.referenceDataRefs,
      evidenceRefs: result.evidenceRefs,
      baseReferenceValue: result.baseReferenceValue?.toString() ?? null,
      adjustments: result.adjustments.map((item) => ({
        factorType: item.factor.factorType,
        inputRef: item.factor.inputRef,
        numerator: item.factor.numerator.toString(),
        denominator: item.factor.denominator.toString(),
        before: item.before.toString(),
        after: item.after.toString(),
        policyRuleRef: item.factor.policyRuleRef,
      })),
      finalReferenceValue: result.finalReferenceValue?.toString() ?? null,
      roundingApplied: result.roundingApplied,
      capsApplied: result.capsApplied.map((item) => ({
        kind: item.kind,
        limit: item.limit.toString(),
        applied: item.applied,
      })),
      state: result.state,
      reasonCodes: result.reasonCodes,
      valuationTimestamp: result.valuationTimestamp,
      invariants: result.invariants,
    }),
  );
}

function emptyResult(input: {
  readonly contribution: VerifiedHumanEconomicContribution;
  readonly policy: HumanContributionValuationPolicy;
  readonly valuationTimestamp: ValuationEngineInput['valuationTimestamp'];
  readonly state: ValuationState;
  readonly reasonCodes: readonly ValuationReasonCode[];
  readonly method: ValuationMethod | null;
  readonly methodSelectedReason: string;
  readonly references?: readonly ValuationReferenceDatum[];
  readonly evidenceRefs?: HumanContributionValuationResult['evidenceRefs'];
  readonly confidenceClass?: ConfidenceClass;
  readonly supersedesValuationId?: ValuationEngineInput['supersedesValuationId'];
  readonly revaluationReason?: ValuationEngineInput['revaluationReason'];
  readonly priorPolicyVersion?: HumanContributionValuationResult['priorPolicyVersion'];
}): HumanContributionValuationResult {
  const valuationId = materializeValuationId(
    input.contribution,
    input.policy,
    input.valuationTimestamp,
    input.method,
    input.state,
    input.supersedesValuationId,
    input.revaluationReason,
  );
  const explanation = buildExplanation({
    valuationId,
    contribution: input.contribution,
    policy: input.policy,
    method: input.method,
    methodSelectedReason: input.methodSelectedReason,
    references: input.references ?? [],
    adjustments: [],
    capApplied: null,
    roundingRule: null,
    reasonCodes: input.reasonCodes,
  });
  const draft = {
    valuationId,
    contributionId: input.contribution.contributionId,
    contributionFingerprint: input.contribution.contributionFingerprint,
    contributionClass: input.contribution.contributionClass,
    valuationPolicyId: input.policy.valuationPolicyId,
    valuationPolicyVersion: input.policy.valuationPolicyVersion,
    valuationMethod: input.method,
    referenceDataRefs: Object.freeze((input.references ?? []).map((item) => item.referenceId)),
    evidenceRefs: input.evidenceRefs ?? input.contribution.evidenceReferences,
    baseReferenceValue: null,
    adjustments: Object.freeze([]),
    finalReferenceValue: null,
    referenceDenomination: 'SIMULATION_REFERENCE_MINOR_UNIT' as const,
    roundingApplied: null,
    capsApplied: Object.freeze([]),
    confidenceClass: input.confidenceClass ?? 'INSUFFICIENT',
    valuationTimestamp: input.valuationTimestamp,
    jurisdictionPolicyRef: input.policy.jurisdictionPolicyRef,
    state: input.state,
    reasonCodes: input.reasonCodes,
    explanation,
    supersedesValuationId: input.supersedesValuationId ?? null,
    revaluationReason: input.revaluationReason ?? null,
    priorPolicyVersion: input.priorPolicyVersion ?? null,
    newPolicyVersion: input.policy.valuationPolicyVersion,
    invariants: VALUATION_INVARIANTS,
  };
  return Object.freeze({
    ...draft,
    valuationDigest: digestOf(draft),
  });
}

function computeBaseValue(
  method: ValuationMethod,
  contribution: VerifiedHumanEconomicContribution,
  reference: ValuationReferenceDatum,
): bigint {
  const quantity = contribution.verifiedMeasurement?.quantity ?? 0n;
  if (method === 'CREATOR_ROYALTY_SCHEDULE') {
    const basis = reference.value;
    const bps = reference.royaltyBasisPoints ?? 0n;
    return multiplyBasisPoints(basis, bps, 'ROUND_DOWN');
  }
  if (method === 'CONTRACTUAL_COMPENSATION' && reference.unit === 'CONTRACT_MINOR_UNIT') {
    return reference.value;
  }
  return quantity * reference.value;
}

function selectEligibleMethods(
  contribution: VerifiedHumanEconomicContribution,
  policy: HumanContributionValuationPolicy,
): readonly ValuationMethod[] {
  const rule = policy.eligibility.find((item) => item.contributionClass === contribution.contributionClass);
  return rule?.methods ?? [];
}

export class HumanContributionValuationEngine {
  private readonly references: ValuationReferenceDataPort;
  private readonly historyStore: HumanContributionValuationHistory;

  constructor(
    references: ValuationReferenceDataPort,
    historyStore: HumanContributionValuationHistory = new HumanContributionValuationHistory(),
  ) {
    this.references = references;
    this.historyStore = historyStore;
  }

  history(): HumanContributionValuationHistory {
    return this.historyStore;
  }

  evaluate(raw: EngineEvaluateInput): HumanContributionValuationResult {
    const forbidden = scanForbiddenValuationInput(raw);
    const contribution = asVerifiedHumanEconomicContribution(raw.contribution);
    const input: ValuationEngineInput = {
      contribution,
      policy: raw.policy,
      valuationTimestamp: raw.valuationTimestamp,
      ...(raw.requestedFactors ? { requestedFactors: raw.requestedFactors } : {}),
      ...(raw.supersedesValuationId ? { supersedesValuationId: raw.supersedesValuationId } : {}),
      ...(raw.revaluationReason ? { revaluationReason: raw.revaluationReason } : {}),
      ...(raw.outcomeEvidenceRefs ? { outcomeEvidenceRefs: raw.outcomeEvidenceRefs } : {}),
      ...(raw.attributionPolicyRef ? { attributionPolicyRef: raw.attributionPolicyRef } : {}),
    };
    const result = this.evaluateVerified(input, forbidden);
    return this.historyStore.append(result);
  }

  private evaluateVerified(input: ValuationEngineInput, forbidden: ValuationReasonCode | null): HumanContributionValuationResult {
    const steps: PipelineStep[] = [];
    const contribution = input.contribution;
    const policy = input.policy;
    const prior = input.supersedesValuationId ? this.historyStore.get(input.supersedesValuationId) : this.historyStore.latest(contribution.contributionId);

    if (forbidden) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REJECTED',
        reasonCodes: [forbidden],
        method: null,
        methodSelectedReason: 'valuation input violated an anti-manipulation or privacy invariant',
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }

    if (policy.status !== 'ACTIVE') {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REJECTED',
        reasonCodes: ['POLICY_INACTIVE'],
        method: null,
        methodSelectedReason: 'valuation policy is not ACTIVE',
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }

    if (input.valuationTimestamp < policy.effectiveFrom || (policy.effectiveUntil && input.valuationTimestamp >= policy.effectiveUntil)) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['POLICY_TIME_DOMAIN_MISMATCH'],
        method: null,
        methodSelectedReason: 'valuation timestamp is outside the active policy time domain',
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }

    const statusReason = reasonForStatus(contribution);
    if (statusReason) {
      const correctionApplies =
        statusReason === 'SUPERSEDED_CONTRIBUTION' && policy.correction.allowSupersededRecord && Boolean(input.revaluationReason);
      if (!correctionApplies) {
        return emptyResult({
          contribution,
          policy,
          valuationTimestamp: input.valuationTimestamp,
          state: 'VALUATION_REJECTED',
          reasonCodes: [statusReason],
          method: null,
          methodSelectedReason: 'engine accepts only an active VERIFIED contribution',
          supersedesValuationId: input.supersedesValuationId,
          revaluationReason: input.revaluationReason,
          priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
        });
      }
    }
    steps.push({
      name: 'VERIFIED_CONTRIBUTION',
      reasonCodes: [],
      detail: 'contribution is VERIFIED with CURRENT data quality',
    });

    if (!policy.jurisdictions.includes(contribution.jurisdiction)) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['JURISDICTION_UNRESOLVED'],
        method: null,
        methodSelectedReason: 'contribution jurisdiction is not listed on the active valuation policy',
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }

    const eligible = selectEligibleMethods(contribution, policy);
    if (eligible.length === 0) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REJECTED',
        reasonCodes: ['UNSUPPORTED_METHOD'],
        method: null,
        methodSelectedReason: 'no policy method is eligible for this contribution class',
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    if (eligible.length > 1) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['INCOMPATIBLE_METHODS'],
        method: null,
        methodSelectedReason: 'multiple incompatible policy methods apply; the engine does not invent a winner',
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    const method = eligible[0]!;
    const eligibility = policy.eligibility.find((item) => item.contributionClass === contribution.contributionClass);
    steps.push({
      name: 'METHOD_ELIGIBILITY',
      reasonCodes: ['METHOD_SELECTED'],
      detail: `selected ${method} from policy ${policy.valuationPolicyVersion}`,
    });

    if ((contribution.evidenceReferences.length ?? 0) < (eligibility?.requiredEvidenceMin ?? 1)) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['REQUIRED_EVIDENCE_MISSING'],
        method,
        methodSelectedReason: `${method} is eligible but required evidence is missing`,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    if (
      (contribution.contributionClass === 'INFORMATION_RIGHT_CONTRIBUTION' ||
        contribution.contributionClass === 'MODEL_TRAINING_PARTICIPATION') &&
      (contribution.rightsReferences.length === 0 || contribution.usageReceiptReferences.length === 0)
    ) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['RIGHTS_SCOPE_AMBIGUOUS'],
        method,
        methodSelectedReason: 'rights scope or usage receipt is ambiguous',
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    if (method === 'VERIFIED_OUTCOME_ATTRIBUTION') {
      const outcomeRefs = input.outcomeEvidenceRefs ?? [];
      if (outcomeRefs.length === 0 || !input.attributionPolicyRef) {
        return emptyResult({
          contribution,
          policy,
          valuationTimestamp: input.valuationTimestamp,
          state: 'VALUATION_REJECTED',
          reasonCodes: ['OUTCOME_EVIDENCE_MISSING'],
          method,
          methodSelectedReason: 'verified outcome attribution requires explicit outcome evidence and an attribution policy',
          supersedesValuationId: input.supersedesValuationId,
          revaluationReason: input.revaluationReason,
          priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
        });
      }
      if (outcomeRefs.length !== 1) {
        return emptyResult({
          contribution,
          policy,
          valuationTimestamp: input.valuationTimestamp,
          state: 'VALUATION_REVIEW_REQUIRED',
          reasonCodes: ['OUTCOME_ATTRIBUTION_AMBIGUOUS'],
          method,
          methodSelectedReason: 'outcome attribution evidence is ambiguous',
          supersedesValuationId: input.supersedesValuationId,
          revaluationReason: input.revaluationReason,
          priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
        });
      }
    }
    steps.push({
      name: 'REQUIRED_EVIDENCE',
      reasonCodes: [],
      detail: 'required evidence and rights-scope checks passed',
    });

    const resolved = this.references.resolve({
      sourceClasses: [requiredReferenceSource(method)],
      contributionClass: contribution.contributionClass,
      valuationMethod: method,
      measurementUnit: contribution.measurementUnit,
      jurisdiction: contribution.jurisdiction,
      at: input.valuationTimestamp,
    });
    if (resolved.length === 0) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['REFERENCE_MISSING'],
        method,
        methodSelectedReason: `selected ${method} but the required reference snapshot is missing`,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    const uniqueIds = new Set(resolved.map((item) => item.referenceId));
    if (uniqueIds.size !== resolved.length) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['REFERENCE_DUPLICATE'],
        method,
        methodSelectedReason: 'duplicate reference data was presented',
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    const values = new Set(resolved.map((item) => item.value.toString()));
    const provenances = new Set(resolved.map((item) => item.provenanceDigest));
    if (resolved.length > 1 && (values.size > 1 || provenances.size > 1)) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['REFERENCE_CONFLICT'],
        method,
        methodSelectedReason: 'reference sources materially conflict; the engine does not invent a value',
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    const reference = resolved[0]!;
    if (reference.relatedContributionId === contribution.contributionId || reference.selfReferential) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REJECTED',
        reasonCodes: ['SELF_REFERENTIAL_MARKET_REFERENCE'],
        method,
        methodSelectedReason: 'market reference is self-referential to the contribution being valued',
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    const age = instantSeconds(input.valuationTimestamp) - instantSeconds(reference.observedAt < reference.effectiveAt ? reference.observedAt : reference.effectiveAt);
    if (age > policy.maxReferenceAgeSeconds) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['REFERENCE_STALE'],
        method,
        methodSelectedReason: 'resolved reference is stale relative to the policy maximum age',
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    if (!reference.policyCompatibility || reference.confidenceBps < policy.minConfidenceBps) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['CONFIDENCE_BELOW_MINIMUM'],
        method,
        methodSelectedReason: 'reference confidence is below the policy minimum',
        references: resolved,
        confidenceClass: confidenceClassFromBps(reference.confidenceBps, policy.minConfidenceBps),
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    steps.push({
      name: 'REFERENCE_DATA_RESOLUTION',
      reasonCodes: [],
      detail: `resolved ${reference.referenceId}`,
    });

    let base: bigint;
    try {
      base = assertBounded(computeBaseValue(method, contribution, reference), 'base reference value');
      rejectNegative(base, policy.allowNegative);
    } catch (error) {
      const code = error instanceof ValuationArithmeticError ? error.code : 'INTEGER_OVERFLOW';
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REJECTED',
        reasonCodes: [code === 'NEGATIVE_VALUE_FORBIDDEN' ? 'NEGATIVE_VALUE_FORBIDDEN' : 'INTEGER_OVERFLOW'],
        method,
        methodSelectedReason: `selected ${method} but the base reference value is not arithmetically admissible`,
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    steps.push({
      name: 'BASE_REFERENCE_VALUE',
      reasonCodes: [],
      detail: `base=${base.toString()}`,
    });

    const requested = input.requestedFactors ?? [];
    const accepted: ValuationFactor[] = [];
    for (const factor of requested) {
      const normalized = asPolicyFactor(factor);
      if (!normalized || !policy.allowedFactors.includes(normalized.factorType)) {
        return emptyResult({
          contribution,
          policy,
          valuationTimestamp: input.valuationTimestamp,
          state: 'VALUATION_REJECTED',
          reasonCodes: [
            factor.factorType === 'PERSON_LEVEL' || factor.factorType === 'HUMAN_WORTH'
              ? 'PERSON_LEVEL_MULTIPLIER_FORBIDDEN'
              : factor.factorType === 'AI_SUBJECTIVE' || factor.factorType === 'PEVE_SCORE'
                ? factor.factorType === 'PEVE_SCORE'
                  ? 'PEVE_INPUT_FORBIDDEN'
                  : 'AI_SUBJECTIVE_SCORE_FORBIDDEN'
                : 'FORBIDDEN_FACTOR',
          ],
          method,
          methodSelectedReason: `selected ${method} but a hidden or forbidden factor was injected`,
          references: resolved,
          supersedesValuationId: input.supersedesValuationId,
          revaluationReason: input.revaluationReason,
          priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
        });
      }
      accepted.push(normalized);
    }

    const factors: ValuationFactor[] = [...policy.defaultFactors, ...accepted];
    let working = base;
    const adjustments: ValuationAdjustment[] = [];
    let productBps = BASIS_POINTS_PER_UNIT;
    try {
      for (const factor of factors) {
        const before = working;
        working = factor.basisPoints !== null
          ? multiplyBasisPoints(working, factor.basisPoints, policy.roundingRule)
          : multiplyRational(working, factor.numerator, factor.denominator, policy.roundingRule);
        rejectNegative(working, policy.allowNegative);
        const factorBps =
          factor.basisPoints ??
          (factor.denominator === 0n ? 0n : (factor.numerator * BASIS_POINTS_PER_UNIT) / factor.denominator);
        productBps = (productBps * factorBps) / BASIS_POINTS_PER_UNIT;
        adjustments.push(Object.freeze({ factor, before, after: working }));
      }
    } catch (error) {
      const code = error instanceof ValuationArithmeticError && error.code === 'NEGATIVE_VALUE_FORBIDDEN'
        ? 'NEGATIVE_VALUE_FORBIDDEN'
        : 'INTEGER_OVERFLOW';
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REJECTED',
        reasonCodes: [code],
        method,
        methodSelectedReason: `selected ${method} but factor arithmetic is not admissible`,
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    if (productBps > policy.maxFactorProductBps) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REJECTED',
        reasonCodes: ['EXCESSIVE_FACTOR_PRODUCT'],
        method,
        methodSelectedReason: 'contribution-level factor product exceeds the policy maximum',
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }
    steps.push({
      name: 'ALLOWED_ADJUSTMENTS',
      reasonCodes: [],
      detail: `applied ${adjustments.length} explicit factors`,
    });

    const caps: CapApplication[] = [];
    const methodCap = policy.methodCaps[method];
    if (methodCap !== undefined) {
      const capped = applyCap(working, methodCap);
      caps.push(Object.freeze({ kind: 'METHOD', limit: methodCap, applied: capped.applied }));
      working = capped.value;
    }
    if (policy.globalCap !== null) {
      const capped = applyCap(working, policy.globalCap);
      caps.push(Object.freeze({ kind: 'GLOBAL', limit: policy.globalCap, applied: capped.applied }));
      working = capped.value;
    }
    if (policy.globalFloor !== null) {
      const floored = applyFloor(working, policy.globalFloor);
      if (floored.applied) {
        caps.push(Object.freeze({ kind: 'GLOBAL', limit: policy.globalFloor, applied: true }));
      }
      working = floored.value;
    }
    steps.push({
      name: 'CAPS_FLOORS',
      reasonCodes: caps.some((item) => item.applied) ? ['CAP_APPLIED'] : [],
      detail: 'caps and floors applied after factors',
    });

    const rounded = working;
    steps.push({
      name: 'DETERMINISTIC_ROUNDING',
      reasonCodes: ['ROUNDING_APPLIED'],
      detail: `rounding=${policy.roundingRule}`,
    });

    if (rounded === 0n && policy.zeroValueRequiresReview) {
      return emptyResult({
        contribution,
        policy,
        valuationTimestamp: input.valuationTimestamp,
        state: 'VALUATION_REVIEW_REQUIRED',
        reasonCodes: ['ZERO_VALUE'],
        method,
        methodSelectedReason: `selected ${method} and the final reference value is zero`,
        references: resolved,
        supersedesValuationId: input.supersedesValuationId,
        revaluationReason: input.revaluationReason,
        priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      });
    }

    const reasonCodes: ValuationReasonCode[] = ['METHOD_SELECTED'];
    if (caps.some((item) => item.applied)) {
      reasonCodes.push('CAP_APPLIED');
    }
    if (rounded === 0n) {
      reasonCodes.push('ZERO_VALUE');
    }
    reasonCodes.push('ROUNDING_APPLIED');

    const valuationId = materializeValuationId(
      input.contribution,
      input.policy,
      input.valuationTimestamp,
      method,
      'VALUED_SIMULATION',
      input.supersedesValuationId,
      input.revaluationReason,
    );
    const appliedCap = caps.find((item) => item.applied) ?? null;
    const explanation = buildExplanation({
      valuationId,
      contribution,
      policy,
      method,
      methodSelectedReason: `${method} is the sole eligible method for ${contribution.contributionClass} under ${policy.valuationPolicyVersion}`,
      references: resolved,
      adjustments,
      capApplied: appliedCap,
      roundingRule: policy.roundingRule,
      reasonCodes,
    });
    const draft = {
      valuationId,
      contributionId: contribution.contributionId,
      contributionFingerprint: contribution.contributionFingerprint,
      contributionClass: contribution.contributionClass,
      valuationPolicyId: policy.valuationPolicyId,
      valuationPolicyVersion: policy.valuationPolicyVersion,
      valuationMethod: method,
      referenceDataRefs: Object.freeze(resolved.map((item) => item.referenceId)),
      evidenceRefs: contribution.evidenceReferences,
      baseReferenceValue: base,
      adjustments: Object.freeze(adjustments),
      finalReferenceValue: rounded,
      referenceDenomination: 'SIMULATION_REFERENCE_MINOR_UNIT' as const,
      roundingApplied: policy.roundingRule,
      capsApplied: Object.freeze(caps),
      confidenceClass: confidenceClassFromBps(reference.confidenceBps, policy.minConfidenceBps),
      valuationTimestamp: input.valuationTimestamp,
      jurisdictionPolicyRef: policy.jurisdictionPolicyRef,
      state: 'VALUED_SIMULATION' as const,
      reasonCodes: Object.freeze(reasonCodes),
      explanation,
      supersedesValuationId: input.supersedesValuationId ?? null,
      revaluationReason: input.revaluationReason ?? null,
      priorPolicyVersion: prior?.valuationPolicyVersion ?? null,
      newPolicyVersion: policy.valuationPolicyVersion,
      invariants: VALUATION_INVARIANTS,
    };
    void steps;
    return Object.freeze({
      ...draft,
      valuationDigest: digestOf(draft),
    });
  }
}
