/**
 * Exact rational conversion for a production-candidate policy.
 *
 * Reuses bigint arithmetic. 1 reference unit is not 1 SunRey.
 * Does not invent a fiat peg.
 */

import { createHash } from 'node:crypto';

import { convertReferenceToSunRey, mostRestrictiveCap } from '../conversion.ts';
import type { ConversionRoundingRule } from '../types.ts';

import {
  NO_PRODUCTION_ECONOMIC_MEANING,
  PRODUCTION_CANDIDATE_CONVERSION_ID,
  REHEARSAL_FIXTURE,
  SUNREY_COIN,
  conversionFailure,
  type ConversionCompleteness,
  type ConversionSourceClass,
  type NumericPolicyValue,
  type PolicyVersionBinding,
  type SunReyProductionSettlementConversionPolicyCandidate,
} from './types.ts';

export function unconfiguredNumeric(): NumericPolicyValue {
  return Object.freeze({ status: 'UNCONFIGURED', value: null });
}

export function configuredNumeric(value: bigint): NumericPolicyValue {
  if (typeof value !== 'bigint') {
    throw new TypeError('conversion numeric values must be bigint');
  }
  return Object.freeze({ status: 'CONFIGURED', value });
}

export type ConversionCandidateDraft = {
  readonly policyId?: string;
  readonly version?: string;
  readonly inputReferenceDenomination: string;
  readonly conversionNumerator?: NumericPolicyValue;
  readonly conversionDenominator?: NumericPolicyValue;
  readonly roundingRule?: ConversionRoundingRule;
  readonly perContributionCeiling?: NumericPolicyValue;
  readonly perContributionClassCeiling?: NumericPolicyValue;
  readonly perEpochCeiling?: NumericPolicyValue;
  readonly globalEpochCeiling?: NumericPolicyValue;
  readonly jurisdictionPolicyRef: PolicyVersionBinding;
  readonly valuationPolicyRef: PolicyVersionBinding;
  readonly verificationPolicyRef: PolicyVersionBinding;
  readonly governanceReference: string;
  readonly effectiveHeightCandidate?: bigint | null;
  readonly supersededHeightCandidate?: bigint | null;
  readonly sourceClass?: ConversionSourceClass;
  readonly fixture?: boolean;
};

export function hashConversionPolicyCandidate(
  policy: Omit<SunReyProductionSettlementConversionPolicyCandidate, 'policyHash'>,
): string {
  const material = [
    'SUNREY_PRODUCTION_CANDIDATE_CONVERSION_POLICY_V1',
    policy.policyId,
    policy.version,
    policy.inputReferenceDenomination,
    policy.outputAsset,
    numericMaterial(policy.conversionNumerator),
    numericMaterial(policy.conversionDenominator),
    policy.roundingRule,
    numericMaterial(policy.perContributionCeiling),
    numericMaterial(policy.perContributionClassCeiling),
    numericMaterial(policy.perEpochCeiling),
    numericMaterial(policy.globalEpochCeiling),
    `${policy.jurisdictionPolicyRef.versionId}:${policy.jurisdictionPolicyRef.contentHash}`,
    `${policy.valuationPolicyRef.versionId}:${policy.valuationPolicyRef.contentHash}`,
    `${policy.verificationPolicyRef.versionId}:${policy.verificationPolicyRef.contentHash}`,
    policy.governanceReference,
    policy.effectiveHeightCandidate?.toString() ?? '',
    policy.supersededHeightCandidate?.toString() ?? '',
    policy.sourceClass,
    policy.fixture ? '1' : '0',
    'productionActivated=false',
    'REFERENCE_VALUE_EQUALS_SUNREY_BY_DEFINITION=false',
  ].join('|');
  return createHash('sha256').update(material).digest('hex');
}

function numericMaterial(value: NumericPolicyValue): string {
  return `${value.status}:${value.value?.toString() ?? ''}`;
}

export function createConversionPolicyCandidate(
  draft: ConversionCandidateDraft,
): SunReyProductionSettlementConversionPolicyCandidate {
  const numerator = draft.conversionNumerator ?? unconfiguredNumeric();
  const denominator = draft.conversionDenominator ?? unconfiguredNumeric();
  const valuesConfigured =
    numerator.status === 'CONFIGURED' &&
    denominator.status === 'CONFIGURED' &&
    (draft.perContributionCeiling ?? unconfiguredNumeric()).status === 'CONFIGURED' &&
    (draft.perContributionClassCeiling ?? unconfiguredNumeric()).status === 'CONFIGURED' &&
    (draft.perEpochCeiling ?? unconfiguredNumeric()).status === 'CONFIGURED' &&
    (draft.globalEpochCeiling ?? unconfiguredNumeric()).status === 'CONFIGURED';
  const fixture = draft.fixture === true;
  const completeness: ConversionCompleteness = valuesConfigured ? 'STRUCTURALLY_COMPLETE' : 'VALUES_UNCONFIGURED';
  const candidate: Omit<SunReyProductionSettlementConversionPolicyCandidate, 'policyHash'> = {
    policyId: draft.policyId ?? PRODUCTION_CANDIDATE_CONVERSION_ID,
    version: draft.version ?? '1',
    schemaVersion: 1,
    inputReferenceDenomination: draft.inputReferenceDenomination,
    outputAsset: SUNREY_COIN,
    conversionNumerator: numerator,
    conversionDenominator: denominator,
    roundingRule: draft.roundingRule ?? 'FLOOR',
    perContributionCeiling: draft.perContributionCeiling ?? unconfiguredNumeric(),
    perContributionClassCeiling: draft.perContributionClassCeiling ?? unconfiguredNumeric(),
    perEpochCeiling: draft.perEpochCeiling ?? unconfiguredNumeric(),
    globalEpochCeiling: draft.globalEpochCeiling ?? unconfiguredNumeric(),
    jurisdictionPolicyRef: Object.freeze(draft.jurisdictionPolicyRef),
    valuationPolicyRef: Object.freeze(draft.valuationPolicyRef),
    verificationPolicyRef: Object.freeze(draft.verificationPolicyRef),
    governanceReference: draft.governanceReference,
    effectiveHeightCandidate: draft.effectiveHeightCandidate ?? null,
    supersededHeightCandidate: draft.supersededHeightCandidate ?? null,
    sourceClass: draft.sourceClass ?? (fixture ? 'FIXTURE' : 'UNCONFIGURED'),
    fixture,
    rehearsalOnly: true,
    productionActivated: false,
    completeness,
    referenceValueEqualsSunReyByDefinition: false,
    fixtureAuthorizesProduction: false,
    rehearsalFixtureLabel: fixture ? REHEARSAL_FIXTURE : null,
    economicMeaning: fixture || !valuesConfigured ? NO_PRODUCTION_ECONOMIC_MEANING : 'UNCONFIGURED',
  };
  return Object.freeze({
    ...candidate,
    policyHash: hashConversionPolicyCandidate(candidate),
  });
}

export function convertReferenceUnderCandidate(
  referenceValue: bigint,
  policy: SunReyProductionSettlementConversionPolicyCandidate,
): bigint {
  if (policy.conversionNumerator.status !== 'CONFIGURED' || policy.conversionDenominator.status !== 'CONFIGURED') {
    throw new TypeError('conversion values are unconfigured');
  }
  if (policy.conversionDenominator.value === 0n) {
    throw new TypeError('conversion denominator cannot be zero');
  }
  return convertReferenceToSunRey(referenceValue, {
    policyId: policy.policyId,
    version: policy.version,
    environment: 'SIMULATION',
    inputDenomination: policy.inputReferenceDenomination,
    conversionNumerator: policy.conversionNumerator.value,
    conversionDenominator: policy.conversionDenominator.value,
    roundingRule: policy.roundingRule,
    perContributionCeiling: policy.perContributionCeiling.value ?? 0n,
    perEpochCeiling: policy.perEpochCeiling.value ?? 0n,
    jurisdictionPolicyRef: policy.jurisdictionPolicyRef.versionId,
    governanceReference: policy.governanceReference,
    effectiveFrom: '2026-08-20T00:00:00.000Z',
    effectiveUntil: null,
    simulationOnly: true,
    productionActivated: false,
    parameterClass: 'ENGINEERING_SIMULATION_PARAMETERS',
  });
}

export function applyMostRestrictiveCap(quantity: bigint, caps: readonly bigint[]): bigint {
  return mostRestrictiveCap([quantity, ...caps]);
}

export { conversionFailure };
