import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateIssuanceFormula, LEGACY_FORMULA_PATH_CLASS } from './productive/formula.ts';
import { MoonReyPolicyRegistry } from './productive/policy-governance/registry.ts';
import {
  CANONICAL_FACTOR_ORDER,
  FORBIDDEN_VALUE_FACTOR_TYPES,
  PRODUCTIVE_VALUE_FUNCTION_CAN_MINT,
  PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION,
  PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT,
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED,
  PRODUCTIVE_VALUE_UNIT,
  PRODUCTIVE_VALUE_UNIT_IS_FIAT,
  PRODUCTIVE_VALUE_UNIT_IS_MOONREY,
  PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT,
  PRODUCTION_VALUE_POLICY_ACTIVE,
  REALIZATION_ELIGIBILITY,
  VALUE_FACTOR_SCALE,
  applyAttributionToBasis,
  assertExactInteger,
  attributionShareFactor,
  capacityAloneIsRealizedOutput,
  categoryFactorRules,
  composeFactors,
  developmentValueFunctionPolicy,
  everyCategoryHasDeliberateFactorPolicy,
  hashValueFunctionPolicy,
  factorDefinition,
  productionValueFunctionUnconfigured,
  productionValuePolicyActive,
  referencePriceDeterminesValue,
  rejectAiActivation,
  rejectForbiddenFactor,
  rejectForbiddenInputPayload,
  rejectUnboundedFactorAttempt,
  rejectUnsupportedFactorForCategory,
  utilizationRatio,
  validateGeographyEvidence,
  validatePolicy,
  validateScarcityEvidence,
  validateUtilizationEvidence,
  validateValueInput,
  valueFunctionCanMint,
  valueFunctionEngineImplemented,
  type ProductiveAttributionDecision,
  type ProductiveValueInput,
  type ProductiveValueReferenceFact,
} from './productive/policy-governance/value-function/index.ts';
import { ATTRIBUTION_SHARE_SCALE } from './productive/policy-governance/value-function/types.ts';
import { FORMULA_VERSION, PRODUCTIVE_CATEGORIES, WEIGHT_SCALE } from './productive/types.ts';
import type { VerifiedProductiveContribution } from './productive/verification.ts';

function contribution(category: VerifiedProductiveContribution['category'] = 'ENERGY'): VerifiedProductiveContribution {
  return Object.freeze({
    schemaVersion: 1,
    contributionId: 'c.energy.1',
    claimId: 'claim.energy.1',
    objectId: 'obj.solar.1',
    claimType: 'OUTPUT',
    category,
    quantity: 1_200n,
    unit: 'kWh',
    normalizedQuantity: 1_200_000n,
    baseUnitId: 'Wh',
    measurementPeriod: {
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      epoch: 1,
    },
    geography: { geographyId: 'grid.west', jurisdiction: 'SIMULATION' },
    oracleFactIds: ['fact.1', 'fact.2', 'fact.3'],
    rightsReferences: ['right.1'],
    controller: 'ctl.solar.1',
    fingerprint: 'fp.energy.1',
    upstreamContributionIds: [],
    downstreamContributionIds: [],
    status: 'ELIGIBLE',
    qualityFactor: WEIGHT_SCALE,
  });
}

function attribution(shareNumerator = 400_000n): ProductiveAttributionDecision {
  return Object.freeze({
    decisionId: 'attr.1',
    policyId: 'moonrey.attribution.simulation.v1',
    policyVersion: '1',
    eventId: 'event.energy.1',
    claimId: 'claim.energy.1',
    share: { numerator: shareNumerator, denominator: ATTRIBUTION_SHARE_SCALE },
    availableShare: { numerator: shareNumerator, denominator: ATTRIBUTION_SHARE_SCALE },
    authoritative: true,
    reconciled: true,
  });
}

function referenceFact(
  factType: ProductiveValueReferenceFact['factType'],
  overrides: Partial<ProductiveValueReferenceFact> = {},
): ProductiveValueReferenceFact {
  return Object.freeze({
    factId: `ref.${factType}`,
    factType,
    sourceQuorumEvidence: ['oracle.1', 'oracle.2', 'oracle.3'],
    measurementPeriod: {
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      epoch: 1,
    },
    geography: { geographyId: 'grid.west', jurisdiction: 'SIMULATION' },
    freshnessEpochs: 0,
    quality: WEIGHT_SCALE,
    policyCompatible: true,
    verified: true,
    consensusHttpCall: false,
    rawHttpData: false,
    moonreyMarketPrice: false,
    socialMediaSentiment: false,
    providerSelfReportedAlone: false,
    ...overrides,
  });
}

function valueInput(overrides: Partial<ProductiveValueInput> = {}): ProductiveValueInput {
  const decision = attribution();
  return {
    contribution: contribution(),
    measurementReference: {
      unitId: 'Wh',
      constitutionVersion: 'sunrey.economic-unit.normalization.v1',
      notUniversalPhysicalUnit: true,
    },
    normalizationReceipt: {
      receiptId: 'norm.energy.1',
      conversionVersion: 'sunrey.economic-unit.normalization.v1',
      exact: true,
      lossy: false,
      sourceUnit: 'kWh',
      targetUnit: 'Wh',
    },
    event: {
      eventId: 'event.energy.1',
      identityVersion: '1',
      category: 'ENERGY',
      objectId: 'obj.solar.1',
      measurementPeriod: {
        validFromUnixSeconds: 1_799_000_000n,
        validUntilUnixSeconds: 1_800_000_000n,
        epoch: 1,
      },
    },
    attributionDecision: decision,
    availableAttributionShare: decision.availableShare,
    valueFunctionPolicyId: 'moonrey.productive-value-function.simulation.v1',
    valueFunctionPolicyVersion: 1,
    referenceFacts: [
      referenceFact('QUALITY'),
      referenceFact('FRESHNESS'),
      referenceFact('UTILIZATION'),
      referenceFact('CAPACITY'),
      referenceFact('REGIONAL_SUPPLY'),
    ],
    jurisdiction: 'SIMULATION',
    geography: { geographyId: 'grid.west', jurisdiction: 'SIMULATION' },
    measurementPeriod: {
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      epoch: 1,
    },
    oracleQuality: WEIGHT_SCALE,
    oracleProvenance: ['oracle.1', 'oracle.2', 'oracle.3'],
    realizationState: 'ACTUAL_OUTPUT',
    claimOutputState: 'VERIFIED_OUTPUT',
    rawProviderPayload: undefined,
    ...overrides,
  };
}

describe('Chunk 123 governed Productive Value Function constitution', () => {
  it('gives every ProductiveCategory a deliberate factor-policy decision', () => {
    assert.equal(everyCategoryHasDeliberateFactorPolicy(), true);
    const policy = developmentValueFunctionPolicy();
    const covered = new Set(policy.perCategoryRules.map((rule) => rule.category));
    for (const category of PRODUCTIVE_CATEGORIES) {
      assert.equal(covered.has(category), true, category);
      const rule = policy.perCategoryRules.find((item) => item.category === category);
      assert.ok(rule);
      assert.equal(rule.requiredFactorTypes.includes('ATTRIBUTION_SHARE_FACTOR'), true);
    }
    assert.equal(categoryFactorRules().length, PRODUCTIVE_CATEGORIES.length * CANONICAL_FACTOR_ORDER.length);
    assert.equal(validatePolicy(policy).ok, true);
  });

  it('versions every factor definition', () => {
    const policy = developmentValueFunctionPolicy();
    for (const definition of policy.factorDefinitions) {
      assert.equal(typeof definition.factorId, 'string');
      assert.equal(typeof definition.factorVersion, 'number');
      assert.ok(definition.factorVersion >= 1);
      assert.equal(definition.factorId.includes(`.v${String(definition.factorVersion)}`), true);
      assert.ok(definition.transformationMethod);
      assert.ok(definition.missingInputBehavior);
      assert.ok(definition.governanceReference);
    }
  });

  it('uses exact bigint math only', () => {
    assert.equal(assertExactInteger(1.5, 'float').ok, false);
    assert.equal(assertExactInteger(400_000n, 'share').ok, true);
    const share = attributionShareFactor({ numerator: 400_000n, denominator: 1_000_000n }, 'FLOOR');
    assert.equal(share.ok, true);
    if (share.ok) {
      assert.equal(share.value, 400_000n);
    }
    const attributed = applyAttributionToBasis(1_000_000n, { numerator: 400_000n, denominator: 1_000_000n }, 'FLOOR');
    assert.equal(attributed.ok, true);
    if (attributed.ok) {
      assert.equal(attributed.value, 400_000n);
    }
    assert.equal(rejectForbiddenInputPayload({ float: 1.2 }).ok, false);
  });

  it('keeps factor bounds closed and versioned', () => {
    const scarcity = factorDefinition('SCARCITY_FACTOR');
    assert.equal(scarcity.minimum, 500_000n);
    assert.equal(scarcity.maximum, 1_500_000n);
    const policy = developmentValueFunctionPolicy();
    assert.equal(policy.factorCaps.SCARCITY_FACTOR.max, 1_500_000n);
    assert.ok(policy.aggregateFactorCeiling >= policy.aggregateFactorFloor);
  });

  it('keeps factor composition order deterministic', () => {
    const policy = developmentValueFunctionPolicy();
    assert.deepEqual([...policy.factorOrder], [...CANONICAL_FACTOR_ORDER]);
    const composed = composeFactors(
      policy.factorOrder.map((factorType) => ({ factorType, value: VALUE_FACTOR_SCALE })),
      policy.factorOrder,
      policy.aggregateFactorFloor,
      policy.aggregateFactorCeiling,
      'FLOOR',
    );
    assert.equal(composed.ok, true);
    if (composed.ok) {
      assert.equal(composed.value, VALUE_FACTOR_SCALE);
    }
    const shuffled = composeFactors(
      [{ factorType: 'ATTRIBUTION_SHARE_FACTOR', value: VALUE_FACTOR_SCALE }],
      policy.factorOrder,
      0n,
      VALUE_FACTOR_SCALE,
      'FLOOR',
    );
    assert.equal(shuffled.ok, false);
  });

  it('requires attribution and cannot ignore the claim share', () => {
    const policy = developmentValueFunctionPolicy();
    assert.equal(policy.attributionRequired, true);
    const ok = validateValueInput(policy, valueInput());
    assert.equal(ok.ok, true);
    const missing = validateValueInput(policy, valueInput({
      attributionDecision: undefined as unknown as ProductiveAttributionDecision,
    }));
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, 'ATTRIBUTION_REQUIRED');
    }
  });

  it('requires verified reference evidence for scarcity', () => {
    const energy = validateScarcityEvidence('ENERGY', true, [], false);
    assert.equal(energy.ok, false);
    if (!energy.ok) {
      assert.equal(energy.code, 'SCARCITY_REFERENCE_REQUIRED');
    }
    const priced = validateScarcityEvidence('ENERGY', true, [referenceFact('REGIONAL_SUPPLY')], true);
    assert.equal(priced.ok, false);
    if (!priced.ok) {
      assert.equal(priced.code, 'SCARCITY_PRICE_ALONE_FORBIDDEN');
    }
    const evidenced = validateScarcityEvidence('ENERGY', true, [referenceFact('REGIONAL_SUPPLY')], false);
    assert.equal(evidenced.ok, true);
  });

  it('requires independent evidence for utilization and rejects divide-by-zero', () => {
    const missing = validateUtilizationEvidence('ENERGY', true, [], false);
    assert.equal(missing.ok, false);
    const selfReport = validateUtilizationEvidence('ENERGY', true, [referenceFact('UTILIZATION')], true);
    assert.equal(selfReport.ok, false);
    if (!selfReport.ok) {
      assert.equal(selfReport.code, 'PROVIDER_SELF_REPORT_INSUFFICIENT');
    }
    const evidenced = validateUtilizationEvidence('ENERGY', true, [referenceFact('UTILIZATION')], false);
    assert.equal(evidenced.ok, true);
    const zero = utilizationRatio(10n, 0n, 'FLOOR');
    assert.equal(zero.ok, false);
    if (!zero.ok) {
      assert.equal(zero.code, 'UTILIZATION_DIVIDE_BY_ZERO');
    }
    const ratio = utilizationRatio(25n, 100n, 'FLOOR');
    assert.equal(ratio.ok, true);
    if (ratio.ok) {
      assert.equal(ratio.value, 250_000n);
    }
  });

  it('requires geography evidence and rejects country-preference multipliers', () => {
    const missing = validateGeographyEvidence('ENERGY', true, [], false);
    assert.equal(missing.ok, false);
    const preference = validateGeographyEvidence('ENERGY', true, [referenceFact('REGIONAL_SUPPLY')], true);
    assert.equal(preference.ok, false);
    if (!preference.ok) {
      assert.equal(preference.code, 'ARBITRARY_COUNTRY_PREFERENCE_FORBIDDEN');
    }
    const evidenced = validateGeographyEvidence('ENERGY', true, [referenceFact('REGIONAL_SUPPLY')], false);
    assert.equal(evidenced.ok, true);
  });

  it('treats reference price as context, never automatic value', () => {
    assert.equal(referencePriceDeterminesValue(), false);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_CONSTITUTION.REFERENCE_PRICE_IS_CONTEXT_NOT_AUTOMATIC_VALUE, true);
    const policy = developmentValueFunctionPolicy();
    const input = valueInput({
      referenceFacts: [referenceFact('REFERENCE_PRICE'), referenceFact('QUALITY')],
    });
    assert.equal(validateValueInput(policy, input).ok, true);
    const reflexive = valueInput({
      referenceFacts: [referenceFact('REFERENCE_PRICE', { moonreyMarketPrice: true })],
    });
    const refused = validateValueInput(policy, reflexive);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE');
    }
  });

  it('does not treat capacity alone as realized output', () => {
    assert.equal(capacityAloneIsRealizedOutput(), false);
    assert.equal(REALIZATION_ELIGIBILITY.INSTALLED_CAPACITY, 'DESCRIBABLE_NOT_ELIGIBLE');
    assert.equal(REALIZATION_ELIGIBILITY.AVAILABLE_CAPACITY, 'DESCRIBABLE_NOT_ELIGIBLE');
    assert.equal(REALIZATION_ELIGIBILITY.RESERVED_CAPACITY, 'DESCRIBABLE_NOT_ELIGIBLE');
    const policy = developmentValueFunctionPolicy();
    const capacity = validateValueInput(policy, valueInput({ realizationState: 'INSTALLED_CAPACITY' }));
    assert.equal(capacity.ok, false);
    if (!capacity.ok) {
      assert.equal(capacity.code, 'CAPACITY_IS_NOT_REALIZED_OUTPUT');
    }
  });

  it('lets AI propose a policy but never activate it', () => {
    const registry = new MoonReyPolicyRegistry();
    const policy = developmentValueFunctionPolicy(1, 2);
    const proposal = registry.proposeValueFunctionPolicy(policy, 'AI_PROPOSAL', 'agent.sim');
    assert.equal(proposal.activated, false);
    assert.equal(proposal.rejection, 'AI_CANNOT_ACTIVATE_POLICY');
    assert.equal(registry.getValueFunctionPolicy(policy.policyId, 2), undefined);
    assert.equal(rejectAiActivation('AI_PROPOSAL').ok, false);
    const human = registry.proposeValueFunctionPolicy(policy, 'HUMAN_GOVERNANCE', 'gov.human');
    assert.equal(human.activated, true);
  });

  it('rejects unbounded factors', () => {
    const refused = rejectUnboundedFactorAttempt(9_000_000n, 1n);
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'UNBOUNDED_FACTOR');
    }
  });

  it('rejects unsupported factors and category pairings', () => {
    for (const forbidden of FORBIDDEN_VALUE_FACTOR_TYPES) {
      const result = rejectForbiddenFactor(forbidden);
      assert.equal(result.ok, false);
    }
    assert.equal(rejectForbiddenFactor('NOT_A_FACTOR').ok, false);
    const computeScarcity = rejectUnsupportedFactorForCategory('AI_COMPUTE', 'SCARCITY_FACTOR');
    assert.equal(computeScarcity.ok, false);
    if (!computeScarcity.ok) {
      assert.equal(computeScarcity.code, 'UNSUPPORTED_FACTOR_FOR_CATEGORY');
    }
    assert.equal(rejectUnsupportedFactorForCategory('ENERGY', 'SCARCITY_FACTOR').ok, true);
  });

  it('keeps the legacy engineering-simulation formula available', () => {
    const result = evaluateIssuanceFormula({
      eligibleQuantity: 1_200_000n,
      categoryWeight: WEIGHT_SCALE,
      claimTypeWeight: WEIGHT_SCALE,
      qualityFactor: WEIGHT_SCALE,
      roundingMode: 'FLOOR',
      maximumIssuance: 10_000_000n,
    });
    assert.equal(result.formulaVersion, FORMULA_VERSION);
    assert.equal(result.formulaVersion, 'moonrey.issuance.formula.v1');
    assert.equal(result.formulaPathClass, LEGACY_FORMULA_PATH_CLASS);
    assert.equal(result.formulaPathClass, 'LEGACY_ENGINEERING_SIMULATION_V1');
    assert.equal(result.moonreyQuantity, 1_200_000n);
  });

  it('does not mint and does not implement the valuation engine', () => {
    const policy = developmentValueFunctionPolicy();
    assert.equal(policy.canMint, false);
    assert.equal(policy.engineImplemented, false);
    assert.equal(valueFunctionCanMint(), false);
    assert.equal(valueFunctionEngineImplemented(), false);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_DOES_NOT_MINT, true);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_CAN_MINT, false);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED, false);
  });

  it('defines ProductiveValueUnit as neither MoonRey, fiat, nor a physical unit', () => {
    assert.equal(PRODUCTIVE_VALUE_UNIT.notMoonReyQuantity, true);
    assert.equal(PRODUCTIVE_VALUE_UNIT.notFiatValue, true);
    assert.equal(PRODUCTIVE_VALUE_UNIT.notPhysicalUnit, true);
    assert.equal(PRODUCTIVE_VALUE_UNIT.notMarketPrice, true);
    assert.equal(PRODUCTIVE_VALUE_UNIT.notGuaranteedEconomicValue, true);
    assert.equal(PRODUCTIVE_VALUE_UNIT_IS_MOONREY, false);
    assert.equal(PRODUCTIVE_VALUE_UNIT_IS_FIAT, false);
    assert.equal(PRODUCTIVE_VALUE_UNIT_IS_PHYSICAL_UNIT, false);
  });

  it('keeps production value policy inactive and unconfigured', () => {
    const production = productionValueFunctionUnconfigured();
    assert.equal(production.productionActivated, false);
    assert.equal(production.status, 'UNCONFIGURED');
    assert.equal(productionValuePolicyActive(), false);
    assert.equal(PRODUCTION_VALUE_POLICY_ACTIVE, false);
    const registry = new MoonReyPolicyRegistry();
    const draft = {
      ...developmentValueFunctionPolicy(1, 9),
      state: 'PRODUCTION_CANDIDATE' as const,
    };
    const candidate = { ...draft, contentHash: hashValueFunctionPolicy(draft) };
    const refused = registry.proposeValueFunctionPolicy(candidate, 'HUMAN_GOVERNANCE', 'gov.human');
    assert.equal(refused.activated, false);
    assert.equal(refused.rejection, 'PRODUCTION_POLICY_INACTIVE');
  });

  it('keeps historical value-function policies immutable', () => {
    const registry = new MoonReyPolicyRegistry();
    const original = developmentValueFunctionPolicy(1, 3);
    assert.equal(registry.proposeValueFunctionPolicy(original, 'PROTOCOL_GOVERNANCE', 'gov.protocol').activated, true);
    const mutated = {
      ...original,
      contentHash: '0'.repeat(64),
    };
    const replay = registry.proposeValueFunctionPolicy(mutated, 'HUMAN_GOVERNANCE', 'gov.human');
    assert.equal(replay.activated, false);
    assert.equal(replay.rejection, 'HISTORICAL_POLICY_IMMUTABLE');
  });
});
