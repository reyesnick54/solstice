import { objectIsActive, type ProductiveEconomicObject } from '../objects.ts';
import { detectConflicts, distinctOracleSources, factIsConflicted, factIsStale, type OracleFact } from '../oracle.ts';
import type { MoonReyIssuancePolicy } from '../policy.ts';
import type { ClaimType, ProductiveCategory } from '../types.ts';
import { evaluateBudget, type BudgetUsage } from './budget.ts';
import { epochFromHeight } from './epochs.ts';
import {
  capacityOutputEventFingerprint,
  claimTypeOfEvent,
  crossCategoryEventFingerprint,
  governedContributionFingerprint,
} from './fingerprint.ts';
import { issuanceBasisFromNpu, normalizeContribution } from './normalization.ts';
import {
  evaluateAttributionEligibility,
  routeRequiresAttribution,
  type AttributionReservationRequest,
  type ProductiveAttributionBook,
  type ProductiveAttributionDecision,
} from './attribution-accounting/index.ts';
import {
  POLICY_GOVERNANCE_SCHEMA_VERSION,
  type CapacityOutputAllocationRule,
  type ContributionEligibilityPolicy,
  type CrossCategoryAllocationRule,
  type MoonReyIssuancePolicyBundle,
  type MoonReyPolicyDecisionCode,
} from './types.ts';

export function developmentEligibilityPolicy(
  policyVersion = 1,
  issuance?: MoonReyIssuancePolicy,
): ContributionEligibilityPolicy {
  return Object.freeze({
    schemaVersion: POLICY_GOVERNANCE_SCHEMA_VERSION,
    policyVersion,
    requireCategoryEligibility: true,
    requireObjectEligibility: true,
    requireProviderEligibility: true,
    requireOracleQuorum: true,
    requireFactFreshness: true,
    requireSourceQuality: true,
    requireContributionLineage: true,
    requireTimeWindow: true,
    rejectDuplicates: true,
    requireMatchingPolicyVersion: true,
    requireBudgetAvailability: true,
    requireReferenceFactsCanonical: true,
    capacityIsNotDelivery: true,
    minimumOracleQuorum: issuance?.minimumOracleQuorum ?? 3,
    requiredFactQuality: issuance?.requiredFactQuality ?? 500_000n,
    maxFactAgeEpochs: 1,
    eligibleProviders: 'ANY_REGISTERED',
  });
}

export type EligibilityInput = {
  readonly height: number;
  readonly requestedPolicyVersion: number;
  readonly category: ProductiveCategory;
  readonly claimType: ClaimType;
  readonly object: ProductiveEconomicObject | undefined;
  readonly objectEligible: boolean;
  readonly providerId: string;
  readonly actorId: string;
  readonly sourceUnitId: string;
  readonly sourceQuantity: bigint;
  readonly measurementEpoch: number;
  readonly validFromUnixSeconds: bigint;
  readonly validUntilUnixSeconds: bigint;
  readonly deliveryFromUnixSeconds: bigint;
  readonly deliveryUntilUnixSeconds: bigint;
  readonly oracleFacts: readonly OracleFact[];
  readonly referenceFacts: readonly OracleFact[];
  readonly claimLineage: readonly string[];
  readonly knownGovernedFingerprints: ReadonlySet<string>;
  readonly knownCrossCategoryEvents: ReadonlySet<string>;
  readonly knownCapacityOutputEvents: ReadonlyMap<string, ReadonlySet<ClaimType>>;
  readonly budgetUsage: BudgetUsage;
  readonly issuancePolicy: MoonReyIssuancePolicy;
  readonly bundle: MoonReyIssuancePolicyBundle;
  readonly attributionBook?: ProductiveAttributionBook;
  readonly attributionDecision?: ProductiveAttributionDecision;
  readonly attributionRequest?: AttributionReservationRequest;
  readonly independentlyEvidenced?: boolean;
  readonly requireAttributionWhenSensitive?: boolean;
};

export type EligibilityOk = {
  readonly ok: true;
  readonly fingerprint: string;
  readonly crossCategoryFingerprint: string;
  readonly capacityOutputFingerprint: string;
  readonly issuanceBasis: bigint;
  readonly policyVersion: number;
  readonly epoch: number;
};

export type EligibilityResult = EligibilityOk | { readonly ok: false; readonly code: MoonReyPolicyDecisionCode };

export function refuseArbitraryMint(): { readonly ok: false; readonly code: 'ARBITRARY_MINT_UNAVAILABLE' } {
  return { ok: false, code: 'ARBITRARY_MINT_UNAVAILABLE' };
}

export function evaluateContributionEligibility(input: EligibilityInput): EligibilityResult {
  const { bundle, issuancePolicy } = input;
  if (bundle.activationHeight > input.height) {
    return { ok: false, code: 'POLICY_NOT_YET_ACTIVE' };
  }
  if (input.requestedPolicyVersion !== bundle.policyVersion) {
    return input.requestedPolicyVersion < bundle.policyVersion
      ? { ok: false, code: 'POLICY_REPLAY' }
      : { ok: false, code: 'WRONG_POLICY_VERSION' };
  }
  if (!bundle.eligibleCategories.includes(input.category) || !issuancePolicy.eligibleCategories.includes(input.category)) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CATEGORY' };
  }
  if (!input.object || !input.objectEligible || !objectIsActive(input.object, input.height, input.validFromUnixSeconds)) {
    return { ok: false, code: input.object ? 'OBJECT_INELIGIBLE' : 'UNREGISTERED_OBJECT' };
  }
  if (input.object.category !== input.category) {
    return { ok: false, code: 'OBJECT_INELIGIBLE' };
  }
  const eligibility = bundle.eligibility;
  if (
    eligibility.eligibleProviders !== 'ANY_REGISTERED' &&
    !eligibility.eligibleProviders.includes(input.providerId)
  ) {
    return { ok: false, code: 'PROVIDER_INELIGIBLE' };
  }
  if (input.validUntilUnixSeconds <= input.validFromUnixSeconds) {
    return { ok: false, code: 'TIME_WINDOW_INVALID' };
  }
  if (input.deliveryUntilUnixSeconds < input.deliveryFromUnixSeconds) {
    return { ok: false, code: 'TIME_WINDOW_INVALID' };
  }
  if (input.claimType === 'CAPACITY' && !issuancePolicy.countCapacityAsProduction) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CLAIM_TYPE' };
  }
  if (input.claimType === 'DELIVERY' && !issuancePolicy.countDeliveryIndependentOfOutput) {
    return { ok: false, code: 'POLICY_INELIGIBLE_CLAIM_TYPE' };
  }
  if (input.claimType === 'RESERVE') {
    return { ok: false, code: 'POLICY_INELIGIBLE_CLAIM_TYPE' };
  }
  if (eligibility.requireContributionLineage && input.claimLineage.length === 0 && input.claimType !== 'OUTPUT' && input.claimType !== 'USAGE') {
    return { ok: false, code: 'LINEAGE_INCOMPLETE' };
  }
  const facts = input.oracleFacts;
  if (facts.some((fact) => factIsStale(fact, input.validUntilUnixSeconds))) {
    return { ok: false, code: 'STALE_ORACLE_FACT' };
  }
  if (facts.some((fact) => factIsConflicted(fact)) || detectConflicts(facts).length > 0) {
    return { ok: false, code: 'CONFLICTED_ORACLE_FACT' };
  }
  if (distinctOracleSources(facts).length < eligibility.minimumOracleQuorum) {
    return { ok: false, code: 'INSUFFICIENT_ORACLE_QUORUM' };
  }
  if (facts.some((fact) => fact.quality < eligibility.requiredFactQuality)) {
    return { ok: false, code: 'SOURCE_QUALITY_BELOW_MINIMUM' };
  }
  const currentEpoch = epochFromHeight(input.height, bundle.epochLengthHeights);
  for (const fact of facts) {
    const factEpoch = epochFromHeight(Number(fact.attestationHeight), bundle.epochLengthHeights);
    if (currentEpoch.epoch - factEpoch.epoch > eligibility.maxFactAgeEpochs) {
      return { ok: false, code: 'FACT_FRESHNESS_EXPIRED' };
    }
  }
  const referenceCheck = evaluateReferenceFacts(bundle, input.referenceFacts, input.validUntilUnixSeconds);
  if (!referenceCheck.ok) {
    return referenceCheck;
  }
  const normalized = normalizeContribution({
    category: input.category,
    sourceUnitId: input.sourceUnitId,
    sourceQuantity: input.sourceQuantity,
    height: input.height,
    rules: bundle.normalizationRules,
  });
  if (!normalized.ok) {
    return normalized;
  }
  const issuanceBasis = issuanceBasisFromNpu(normalized.npu);
  const budget = evaluateBudget(bundle.budget, input.budgetUsage, issuanceBasis);
  if (!budget.ok) {
    return budget.code === 'CONTRIBUTION_CAP' || budget.code === 'BUDGET_UNAVAILABLE'
      ? { ok: false, code: 'BUDGET_UNAVAILABLE' }
      : { ok: false, code: budget.code };
  }
  const fingerprint = governedContributionFingerprint({
    objectId: input.object.objectId,
    measurementPeriodEpoch: input.measurementEpoch,
    validFromUnixSeconds: input.validFromUnixSeconds,
    validUntilUnixSeconds: input.validUntilUnixSeconds,
    claimType: input.claimType,
    category: input.category,
    normalizedQuantity: normalized.npu.quantity,
    baseUnitId: normalized.npu.unitId,
    oracleFactIds: facts.map((fact) => fact.factId),
    upstreamContributionIds: input.claimLineage,
    actorId: input.actorId,
    deliveryFromUnixSeconds: input.deliveryFromUnixSeconds,
    deliveryUntilUnixSeconds: input.deliveryUntilUnixSeconds,
    claimLineage: input.claimLineage,
  });
  if (input.knownGovernedFingerprints.has(fingerprint)) {
    return { ok: false, code: 'DUPLICATE_CONTRIBUTION' };
  }
  const cross = crossCategoryEventFingerprint({
    objectId: input.object.objectId,
    measurementPeriodEpoch: input.measurementEpoch,
    validFromUnixSeconds: input.validFromUnixSeconds,
    validUntilUnixSeconds: input.validUntilUnixSeconds,
    deliveryFromUnixSeconds: input.deliveryFromUnixSeconds,
    deliveryUntilUnixSeconds: input.deliveryUntilUnixSeconds,
    actorId: input.actorId,
    oracleFactIds: facts.map((fact) => fact.factId),
    claimLineage: input.claimLineage,
  });
  if (input.knownCrossCategoryEvents.has(cross) && !allocationAllows(bundle.crossCategoryAllocations, cross, input.category)) {
    return { ok: false, code: 'CROSS_CATEGORY_DUPLICATE' };
  }
  const capacityOutput = capacityOutputEventFingerprint({
    objectId: input.object.objectId,
    category: input.category,
    measurementPeriodEpoch: input.measurementEpoch,
    validFromUnixSeconds: input.validFromUnixSeconds,
    validUntilUnixSeconds: input.validUntilUnixSeconds,
  });
  const priorClaims = input.knownCapacityOutputEvents.get(capacityOutput);
  const kind = claimTypeOfEvent(input.claimType);
  if (
    priorClaims &&
    kind !== 'OTHER' &&
    !capacityAllocationAllows(bundle.capacityOutputAllocations, input.object.objectId, input.measurementEpoch, input.claimType)
  ) {
    return { ok: false, code: 'CAPACITY_OUTPUT_DUPLICATE' };
  }
  const attribution = evaluateSensitiveAttribution(input);
  if (attribution) {
    return attribution;
  }
  return {
    ok: true,
    fingerprint,
    crossCategoryFingerprint: cross,
    capacityOutputFingerprint: capacityOutput,
    issuanceBasis,
    policyVersion: bundle.policyVersion,
    epoch: currentEpoch.epoch,
  };
}

function evaluateSensitiveAttribution(input: EligibilityInput): EligibilityResult | undefined {
  const required = routeRequiresAttribution({
    category: input.category,
    independentlyEvidenced: input.independentlyEvidenced,
    attributionRequired: input.requireAttributionWhenSensitive,
  });
  if (!required) {
    return undefined;
  }
  if (!input.attributionDecision || !input.attributionRequest || !input.attributionBook) {
    return { ok: false, code: 'ATTRIBUTION_DECISION_REQUIRED' };
  }
  const gated = evaluateAttributionEligibility({
    category: input.category,
    claimType: input.claimType,
    independentlyEvidenced: input.independentlyEvidenced,
    attributionRequired: true,
    expectedPolicyVersion: input.requestedPolicyVersion,
    decision: input.attributionDecision,
    request: input.attributionRequest,
    book: input.attributionBook,
  });
  if (!gated.ok) {
    return { ok: false, code: gated.code };
  }
  return undefined;
}

function evaluateReferenceFacts(
  bundle: MoonReyIssuancePolicyBundle,
  facts: readonly OracleFact[],
  now: bigint,
): { readonly ok: true } | { readonly ok: false; readonly code: MoonReyPolicyDecisionCode } {
  if (bundle.referenceFactKeys.length === 0) {
    return { ok: true };
  }
  if (facts.length === 0) {
    return { ok: false, code: 'REFERENCE_FACT_MISSING' };
  }
  if (facts.some((fact) => factIsStale(fact, now))) {
    return { ok: false, code: 'REFERENCE_FACT_STALE' };
  }
  if (facts.some((fact) => factIsConflicted(fact)) || detectConflicts(facts).length > 0) {
    return { ok: false, code: 'REFERENCE_FACT_CONFLICTED' };
  }
  return { ok: true };
}

function allocationAllows(
  rules: readonly CrossCategoryAllocationRule[],
  eventFingerprint: string,
  category: ProductiveCategory,
): boolean {
  const rule = rules.find((item) => item.eventFingerprint === eventFingerprint);
  if (!rule) {
    return false;
  }
  const share = rule.shares[category] ?? 0n;
  return share > 0n && share < rule.shareScale;
}

function capacityAllocationAllows(
  rules: readonly CapacityOutputAllocationRule[],
  objectId: string,
  epoch: number,
  claimType: ClaimType,
): boolean {
  const rule = rules.find((item) => item.objectId === objectId && item.epoch === epoch);
  if (!rule) {
    return false;
  }
  const share = rule.claimShares[claimType] ?? 0n;
  return share > 0n && share < rule.shareScale;
}

