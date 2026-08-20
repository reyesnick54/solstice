/**
 * Production-candidate GPUV → MoonRey conversion.
 *
 * Never defaults to 1 GPUV = 1 MoonRey. Unconfigured conversion fails
 * with MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED.
 */

import { GPUV_UNIT, MOONREY_OUTPUT_ASSET, type ConversionRoundingRule } from '../types.ts';
import {
  CANONICAL_MOONREY_ISSUANCE_CLASS,
  CONVERSION_AUTHORIZATION_CAN_MINT,
  FORBIDDEN_MOONREY_ISSUANCE_CLASSES,
  GPUV_EQUALS_MOONREY_BY_DEFINITION,
  MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED,
  PRODUCTION_CONVERSION_CANDIDATE_ID,
  productionConversionOk,
  productionConversionRefuse,
  type MoonReyProductionSettlementConversionPolicyCandidate,
  type ProductionCandidateConversionInput,
  type ProductionConversionResult,
} from './types.ts';
import { validateCompleteEvidence, validateConversionAuthorizer } from './evidence.ts';

export function unconfiguredProductionConversionPolicy(): MoonReyProductionSettlementConversionPolicyCandidate {
  return Object.freeze({
    policyId: PRODUCTION_CONVERSION_CANDIDATE_ID,
    policyVersion: 1,
    inputValueUnit: GPUV_UNIT,
    outputAsset: MOONREY_OUTPUT_ASSET,
    conversionNumerator: null,
    conversionDenominator: null,
    roundingRule: 'FLOOR',
    perContributionCeiling: null,
    perEventCeiling: null,
    perObjectCeiling: null,
    perControllerCeiling: null,
    perCategoryEpochCeiling: null,
    globalEpochCeiling: null,
    effectiveHeightCandidate: 1,
    supersededHeightCandidate: null,
    governanceReference: 'chunk-146.gpuv-moonrey.conversion.unconfigured',
    sourceClass: 'UNCONFIGURED',
    fixture: false,
    productionActivated: false,
    gpuvEqualsMoonReyByDefinition: false,
    canMint: false,
  });
}

export function createProductionConversionPolicyCandidate(input: {
  readonly policyId?: string;
  readonly policyVersion?: number;
  readonly conversionNumerator: bigint;
  readonly conversionDenominator: bigint;
  readonly roundingRule?: ConversionRoundingRule;
  readonly perContributionCeiling?: bigint;
  readonly perEventCeiling?: bigint;
  readonly perObjectCeiling?: bigint;
  readonly perControllerCeiling?: bigint;
  readonly perCategoryEpochCeiling?: bigint;
  readonly globalEpochCeiling?: bigint;
  readonly effectiveHeightCandidate?: number;
  readonly supersededHeightCandidate?: number | null;
  readonly governanceReference: string;
  readonly sourceClass: MoonReyProductionSettlementConversionPolicyCandidate['sourceClass'];
  readonly fixture: boolean;
}): ProductionConversionResult<MoonReyProductionSettlementConversionPolicyCandidate> {
  if (typeof input.conversionNumerator !== 'bigint' || typeof input.conversionDenominator !== 'bigint') {
    return productionConversionRefuse('FLOAT_MATH_FORBIDDEN', 'conversion rationals must be bigint');
  }
  if (input.conversionDenominator === 0n) {
    return productionConversionRefuse('DENOMINATOR_ZERO', 'conversion denominator cannot be zero');
  }
  if (input.conversionNumerator <= 0n || input.conversionDenominator < 0n) {
    return productionConversionRefuse('FLOAT_MATH_FORBIDDEN', 'conversion numerator must be positive');
  }
  if (input.conversionNumerator === input.conversionDenominator) {
    return productionConversionRefuse('GPUV_EQUALS_MOONREY_FORBIDDEN', '1 GPUV = 1 MoonRey is forbidden');
  }
  return productionConversionOk(
    Object.freeze({
      policyId: input.policyId ?? `${PRODUCTION_CONVERSION_CANDIDATE_ID}.explicit`,
      policyVersion: input.policyVersion ?? 1,
      inputValueUnit: GPUV_UNIT,
      outputAsset: MOONREY_OUTPUT_ASSET,
      conversionNumerator: input.conversionNumerator,
      conversionDenominator: input.conversionDenominator,
      roundingRule: input.roundingRule ?? 'FLOOR',
      perContributionCeiling: input.perContributionCeiling ?? null,
      perEventCeiling: input.perEventCeiling ?? null,
      perObjectCeiling: input.perObjectCeiling ?? null,
      perControllerCeiling: input.perControllerCeiling ?? null,
      perCategoryEpochCeiling: input.perCategoryEpochCeiling ?? null,
      globalEpochCeiling: input.globalEpochCeiling ?? null,
      effectiveHeightCandidate: input.effectiveHeightCandidate ?? 1,
      supersededHeightCandidate: input.supersededHeightCandidate ?? null,
      governanceReference: input.governanceReference,
      sourceClass: input.sourceClass,
      fixture: input.fixture,
      productionActivated: false,
      gpuvEqualsMoonReyByDefinition: false,
      canMint: false,
    }),
  );
}

export function convertProductionCandidateGpuv(
  input: ProductionCandidateConversionInput,
): ProductionConversionResult<bigint> {
  const policy = input.policy;
  if (policy.productionActivated) {
    return productionConversionRefuse('PRODUCTION_CANDIDATE_CANNOT_ACTIVATE', 'conversion cannot activate production');
  }
  if (policy.canMint || CONVERSION_AUTHORIZATION_CAN_MINT) {
    return productionConversionRefuse('CONVERSION_AUTHORIZATION_CANNOT_MINT', 'conversion authorization cannot mint');
  }
  if (input.referencePriceAlone) {
    return productionConversionRefuse('REFERENCE_PRICE_ALONE_CANNOT_ISSUE', 'REFERENCE_PRICE cannot mint MoonRey');
  }
  if (input.issuanceClass && input.issuanceClass !== CANONICAL_MOONREY_ISSUANCE_CLASS) {
    return productionConversionRefuse(
      'FORBIDDEN_ISSUANCE_CLASS',
      `${input.issuanceClass} is not a canonical MoonRey issuance class`,
    );
  }
  if ((FORBIDDEN_MOONREY_ISSUANCE_CLASSES as readonly string[]).includes(input.issuanceClass ?? '')) {
    return productionConversionRefuse('FORBIDDEN_ISSUANCE_CLASS', `${input.issuanceClass} is forbidden`);
  }
  const authorizer = validateConversionAuthorizer(input.authorizedBy);
  if (authorizer) {
    return authorizer;
  }
  if (input.valuePath === 'LEGACY_ENGINEERING_SIMULATION_V1') {
    return productionConversionRefuse('LEGACY_V1_CANNOT_QUALIFY_PRODUCTION', 'legacy V1 cannot qualify production');
  }
  if (input.fixturePolicy) {
    return productionConversionRefuse('FIXTURE_V2_CANNOT_QUALIFY_PRODUCTION', 'fixture V2 cannot qualify production');
  }
  const evidence = validateCompleteEvidence(input.evidence);
  if (evidence) {
    return evidence;
  }
  if (
    policy.conversionNumerator === null ||
    policy.conversionDenominator === null ||
    policy.sourceClass === 'UNCONFIGURED'
  ) {
    return productionConversionRefuse(
      MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED,
      'production GPUV → MoonRey conversion is unconfigured',
    );
  }
  if (typeof input.gpuvQuantity !== 'bigint') {
    return productionConversionRefuse('FLOAT_MATH_FORBIDDEN', 'GPUV quantity must be bigint');
  }
  if (policy.gpuvEqualsMoonReyByDefinition || GPUV_EQUALS_MOONREY_BY_DEFINITION) {
    return productionConversionRefuse('GPUV_EQUALS_MOONREY_FORBIDDEN', 'GPUV is not MoonRey');
  }
  if (policy.conversionNumerator === policy.conversionDenominator) {
    return productionConversionRefuse('GPUV_EQUALS_MOONREY_FORBIDDEN', '1 GPUV = 1 MoonRey is forbidden');
  }
  if (policy.conversionDenominator === 0n) {
    return productionConversionRefuse('DENOMINATOR_ZERO', 'conversion denominator cannot be zero');
  }
  const converted = applyRounding(
    input.gpuvQuantity * policy.conversionNumerator,
    policy.conversionDenominator,
    policy.roundingRule,
  );
  const cap = applyCaps(converted, policy, input);
  if (!cap.ok) {
    return cap;
  }
  return productionConversionOk(cap.value);
}

function applyRounding(numerator: bigint, denominator: bigint, rule: ConversionRoundingRule): bigint {
  if (rule === 'CEILING') {
    return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
  }
  if (rule === 'NEAREST_EVEN') {
    const floor = numerator / denominator;
    const remainder = numerator % denominator;
    if (remainder * 2n < denominator) {
      return floor;
    }
    if (remainder * 2n > denominator) {
      return floor + 1n;
    }
    return floor % 2n === 0n ? floor : floor + 1n;
  }
  return numerator / denominator;
}

function applyCaps(
  converted: bigint,
  policy: MoonReyProductionSettlementConversionPolicyCandidate,
  input: ProductionCandidateConversionInput,
): ProductionConversionResult<bigint> {
  const usage = input.usage;
  const candidate = input.candidateIssuance ?? converted;
  if (policy.perEventCeiling !== null && usage && usage.eventIssued + candidate > policy.perEventCeiling) {
    return productionConversionRefuse('PER_EVENT_CAP_EXCEEDED', 'per-event ceiling exceeded');
  }
  if (policy.perObjectCeiling !== null && usage && usage.objectIssued + candidate > policy.perObjectCeiling) {
    return productionConversionRefuse('PER_OBJECT_CAP_EXCEEDED', 'per-object ceiling exceeded');
  }
  if (policy.perControllerCeiling !== null && usage && usage.controllerIssued + candidate > policy.perControllerCeiling) {
    return productionConversionRefuse('PER_CONTROLLER_CAP_EXCEEDED', 'per-controller ceiling exceeded');
  }
  if (policy.perCategoryEpochCeiling !== null && usage && usage.categoryEpochIssued + candidate > policy.perCategoryEpochCeiling) {
    return productionConversionRefuse('PER_CATEGORY_EPOCH_CAP_EXCEEDED', 'category epoch ceiling exceeded');
  }
  if (policy.globalEpochCeiling !== null && usage && usage.globalEpochIssued + candidate > policy.globalEpochCeiling) {
    return productionConversionRefuse('GLOBAL_EPOCH_CAP_EXCEEDED', 'global epoch ceiling exceeded');
  }
  if (policy.perEventCeiling !== null && policy.perCategoryEpochCeiling !== null && policy.perEventCeiling > policy.perCategoryEpochCeiling) {
    return productionConversionRefuse('EVENT_CAP_EXCEEDS_BROADER_CAP', 'event cap cannot exceed category epoch cap');
  }
  if (policy.perControllerCeiling !== null && policy.globalEpochCeiling !== null && policy.perControllerCeiling > policy.globalEpochCeiling) {
    return productionConversionRefuse('CONTROLLER_CAP_EXCEEDS_GLOBAL_CAP', 'controller cap cannot exceed global cap');
  }
  if (input.maximumSupply !== null && input.maximumSupply !== undefined && usage && usage.canonicalSupply + candidate > input.maximumSupply) {
    return productionConversionRefuse('MAXIMUM_SUPPLY_GUARD', 'conversion cannot bypass maximum supply');
  }
  if (policy.perContributionCeiling !== null && converted > policy.perContributionCeiling) {
    return productionConversionRefuse('PER_EVENT_CAP_EXCEEDED', 'per-contribution ceiling exceeded');
  }
  return productionConversionOk(converted);
}
