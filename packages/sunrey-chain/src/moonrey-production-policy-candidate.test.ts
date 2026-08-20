import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PRODUCTIVE_CATEGORIES } from './productive/types.ts';
import {
  CATEGORY_UNIT_BINDINGS,
  EXCLUSIVE_ATTRIBUTION_GROUPS,
  FORBIDDEN_PRICE_FEEDBACK_LOOPS,
  GOVERNED_VALUE_V2,
  GPUV_EQUALS_MOONREY_BY_DEFINITION as PVF_GPUV_EQUALS_MOONREY,
  GPUV_IS_NOT_FIAT,
  GPUV_IS_NOT_MARKET_PRICE,
  GPUV_IS_NOT_MOONREY,
  GPUV_IS_NOT_PHYSICAL_UNIT,
  GPUV_DOES_NOT_GUARANTEE_ECONOMIC_VALUE,
  LEGACY_ENGINEERING_SIMULATION_V1,
  LEGACY_V1_PRODUCTION_ELIGIBLE,
  MOONREY_MARKET_PRICE_FEEDS_PVF,
  PRODUCTION_ACTIVATED,
  PRODUCTION_FORBIDDEN_FACTOR_TYPES,
  REFERENCE_PRICE_CAN_CREATE_CLAIM,
  REFERENCE_PRICE_CAN_CREATE_CONTRIBUTION,
  REFERENCE_PRICE_CAN_CREATE_GPUV_ALONE,
  REFERENCE_PRICE_CAN_MINT_MOONREY,
  VALUE_UNCONFIGURED,
  applyCandidateBaseValue,
  createBaseValueScheduleCandidate,
  evaluateProductionCandidateValue,
  everyCategoryReported,
  rehearsalEnergySchedule,
  rehearsalProductiveValuePolicyCandidate,
  rehearsalValueInput,
  reportCategoryCoverage,
  unconfiguredCategories,
  unconfiguredProductiveValuePolicyCandidate,
  validateForbiddenFactor,
  validateProductionValueInput,
  validateProductiveValuePolicyCandidate,
} from './productive/policy-governance/value-function/production-candidate/index.ts';
import {
  CANONICAL_MOONREY_ISSUANCE_CLASS,
  CONVERSION_AUTHORIZATION_CAN_MINT,
  FORBIDDEN_MOONREY_ISSUANCE_CLASSES,
  MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED,
  chunk71RemainsMintGate,
  convertProductionCandidateGpuv,
  createProductionConversionPolicyCandidate,
  gpuvResultCannotMint,
  rehearsalConversionPolicy,
  rehearsalEvidence,
  rehearsalUsage,
  unconfiguredProductionConversionPolicy,
} from './productive/policy-governance/value-settlement/production-candidate/index.ts';
import {
  PRODUCTION_CANDIDATE_UNACTIVATED,
  MoonReyEconomicShadowEvaluator,
  inspectProductionCandidatePolicy,
} from './productive/policy-governance/shadow-economics/index.ts';
import {
  evaluateProductionEconomicActivation,
  currentRepositorySnapshot,
  domainState,
  rehearsalMoonReyProductionIssuancePackage,
  revaluationSafety,
  unconfiguredMoonReyProductionIssuancePackage,
  validateMoonReySupplySafety,
} from './economics/production-activation/index.ts';

describe('Chunk 146 MoonRey production issuance candidate', () => {
  it('1. all ProductiveCategories deliberately covered/reported', () => {
    const coverage = reportCategoryCoverage();
    assert.equal(everyCategoryReported(coverage), true);
    assert.equal(coverage.length, PRODUCTIVE_CATEGORIES.length);
    for (const category of PRODUCTIVE_CATEGORIES) {
      const row = coverage.find((item) => item.category === category);
      assert.ok(row);
      assert.equal(row.canonicalUnit, CATEGORY_UNIT_BINDINGS[category].canonicalUnit);
      assert.ok(
        row.status === 'UNCONFIGURED' ||
          row.status === 'CONFIGURED_CANDIDATE' ||
          row.status === 'NOT_INTENDED_FOR_ACTIVATION' ||
          row.status === 'UNIT_GAP' ||
          row.status === 'SEMANTIC_REVIEW_REQUIRED' ||
          row.status === 'PROVIDER_GAP',
      );
    }
  });

  it('2. missing base GPUV values stay unconfigured', () => {
    const coverage = reportCategoryCoverage();
    assert.deepEqual(unconfiguredCategories(coverage), [...PRODUCTIVE_CATEGORIES]);
    for (const row of coverage) {
      assert.equal(row.valueStatus, VALUE_UNCONFIGURED);
      assert.equal(row.scheduleId, null);
    }
  });

  it('3. no default GPUV values', () => {
    const policy = unconfiguredProductiveValuePolicyCandidate();
    assert.equal(policy.baseSchedules.length, 0);
    assert.equal(policy.productionActivated, false);
    assert.equal(PRODUCTION_ACTIVATED, false);
    const refused = validateProductionValueInput(rehearsalValueInput({ fixturePolicy: false }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'VALUE_UNCONFIGURED');
    }
  });

  it('4. exact rational base value', () => {
    const schedule = rehearsalEnergySchedule();
    assert.equal(schedule.baseGpuvNumerator, 3n);
    assert.equal(schedule.baseGpuvDenominator, 7n);
    const applied = applyCandidateBaseValue(14n, schedule);
    assert.equal(applied.ok, true);
    if (applied.ok) {
      assert.equal(applied.value, 6n);
    }
    const receipt = evaluateProductionCandidateValue(
      rehearsalValueInput({ fixturePolicy: false }),
      rehearsalProductiveValuePolicyCandidate(),
      schedule,
    );
    assert.equal(receipt.ok, true);
    if (receipt.ok) {
      assert.equal(receipt.value.gpuvQuantity, 2n);
      assert.equal(receipt.value.canMint, false);
    }
  });

  it('5. float rejected', () => {
    const created = createBaseValueScheduleCandidate({
      productiveCategory: 'ENERGY',
      canonicalUnit: 'Wh',
      semanticQualifier: 'energy_output',
      claimType: 'OUTPUT',
      realizationState: 'ACTUAL_OUTPUT',
      baseGpuvNumerator: 1.5 as unknown as bigint,
      baseGpuvDenominator: 1n,
      referenceMethodologyRef: 'rehearsal',
      governanceReference: 'rehearsal',
      sourceClass: 'REHEARSAL_ONLY',
      fixture: true,
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'FLOAT_MATH_FORBIDDEN');
    }
  });

  it('6. incompatible unit rejected', () => {
    const created = createBaseValueScheduleCandidate({
      productiveCategory: 'ENERGY',
      canonicalUnit: 'gpu_s',
      semanticQualifier: 'energy_output',
      claimType: 'OUTPUT',
      realizationState: 'ACTUAL_OUTPUT',
      baseGpuvNumerator: 1n,
      baseGpuvDenominator: 1000n,
      referenceMethodologyRef: 'rehearsal',
      governanceReference: 'rehearsal',
      sourceClass: 'REHEARSAL_ONLY',
      fixture: true,
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'INCOMPATIBLE_UNIT');
    }
    assert.equal(CATEGORY_UNIT_BINDINGS.AI_COMPUTE.canonicalUnit, 'gpu_s');
    assert.equal(CATEGORY_UNIT_BINDINGS.MANUFACTURING.canonicalUnit, 'UNIT');
    assert.equal(CATEGORY_UNIT_BINDINGS.LOGISTICS_TRANSPORTATION.semanticQualifier, 'tonne_km');
    assert.equal(CATEGORY_UNIT_BINDINGS.BANDWIDTH_COMMUNICATIONS.dimension, 'DATA_VOLUME');
    assert.equal(CATEGORY_UNIT_BINDINGS.REAL_ESTATE_USE.dimension, 'AREA_TIME');
  });

  it('7. semantic mismatch rejected', () => {
    const created = createBaseValueScheduleCandidate({
      productiveCategory: 'ENERGY',
      canonicalUnit: 'Wh',
      semanticQualifier: 'installed_capacity',
      claimType: 'CAPACITY',
      realizationState: 'INSTALLED_CAPACITY',
      baseGpuvNumerator: 1n,
      baseGpuvDenominator: 1000n,
      referenceMethodologyRef: 'rehearsal',
      governanceReference: 'rehearsal',
      sourceClass: 'REHEARSAL_ONLY',
      fixture: true,
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'SEMANTIC_MISMATCH');
    }
  });

  it('8. attribution required', () => {
    const refused = validateProductionValueInput(
      rehearsalValueInput({ attributionDecisionId: undefined, fixturePolicy: false }),
      rehearsalEnergySchedule(),
    );
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'ATTRIBUTION_REQUIRED');
    }
  });

  it('9. duplicate event protection', () => {
    const refused = validateProductionValueInput(
      rehearsalValueInput({
        category: 'MANUFACTURING',
        canonicalUnit: 'UNIT',
        semanticQualifier: 'units_produced',
        creditedCategories: ['MANUFACTURING', 'AUTOMATED_MACHINE_OUTPUT'],
        fixturePolicy: false,
      }),
    );
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'DUPLICATE_EVENT_FULL_CREDIT');
    }
    assert.deepEqual(EXCLUSIVE_ATTRIBUTION_GROUPS[0], ['MANUFACTURING', 'AUTOMATED_MACHINE_OUTPUT']);
  });

  it('10. reference price alone cannot value', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ referencePriceAlone: true }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'REFERENCE_PRICE_ALONE_CANNOT_VALUE');
    }
    assert.equal(REFERENCE_PRICE_CAN_CREATE_CLAIM, false);
    assert.equal(REFERENCE_PRICE_CAN_CREATE_CONTRIBUTION, false);
    assert.equal(REFERENCE_PRICE_CAN_CREATE_GPUV_ALONE, false);
  });

  it('11. reference price alone cannot issue', () => {
    const refused = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      referencePriceAlone: true,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'REFERENCE_PRICE_ALONE_CANNOT_ISSUE');
    }
    assert.equal(REFERENCE_PRICE_CAN_MINT_MOONREY, false);
  });

  it('12. MoonRey market price cannot enter PVF', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ moonreyMarketPrice: true }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'MOONREY_MARKET_PRICE_FORBIDDEN');
    }
    assert.equal(MOONREY_MARKET_PRICE_FEEDS_PVF, false);
  });

  it('13. self-referential price feedback rejected', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ issuanceQuantityAsScarcity: true }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'SELF_REFERENTIAL_PRICE_FEEDBACK');
    }
    assert.equal(FORBIDDEN_PRICE_FEEDBACK_LOOPS.length, 2);
  });

  it('14. unbounded scarcity rejected', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ unboundedScarcityMultiplier: true }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'UNBOUNDED_SCARCITY_REJECTED');
    }
  });

  it('15. AI factor rejected', () => {
    const refused = validateForbiddenFactor('AI_VALUE_FACTOR');
    assert.ok(refused);
    assert.equal(refused.code, 'AI_FACTOR_REJECTED');
    assert.ok(PRODUCTION_FORBIDDEN_FACTOR_TYPES.includes('AI_VALUE_FACTOR'));
  });

  it('16. provider self-value factor rejected', () => {
    const refused = validateForbiddenFactor('PROVIDER_SELF_REPORTED_ECONOMIC_VALUE_MULTIPLIER');
    assert.ok(refused);
    assert.equal(refused.code, 'PROVIDER_SELF_VALUE_FACTOR_REJECTED');
  });

  it('17. exact GPUV conversion', () => {
    const converted = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      usage: rehearsalUsage(),
      authorizedBy: 'HUMAN',
    });
    assert.equal(converted.ok, true);
    if (converted.ok) {
      assert.equal(converted.value, 4n);
    }
  });

  it('18. 1:1 not assumed', () => {
    const unconfigured = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: unconfiguredProductionConversionPolicy(),
      evidence: rehearsalEvidence(),
    });
    assert.equal(unconfigured.ok, false);
    if (!unconfigured.ok) {
      assert.equal(unconfigured.code, MOONREY_PRODUCTION_CONVERSION_UNCONFIGURED);
    }
    const oneToOne = createProductionConversionPolicyCandidate({
      conversionNumerator: 1n,
      conversionDenominator: 1n,
      governanceReference: 'forbidden',
      sourceClass: 'REHEARSAL_ONLY',
      fixture: true,
    });
    assert.equal(oneToOne.ok, false);
    if (!oneToOne.ok) {
      assert.equal(oneToOne.code, 'GPUV_EQUALS_MOONREY_FORBIDDEN');
    }
    assert.equal(PVF_GPUV_EQUALS_MOONREY, false);
  });

  it('19. denominator zero rejected', () => {
    const created = createProductionConversionPolicyCandidate({
      conversionNumerator: 2n,
      conversionDenominator: 0n,
      governanceReference: 'rehearsal',
      sourceClass: 'REHEARSAL_ONLY',
      fixture: true,
    });
    assert.equal(created.ok, false);
    if (!created.ok) {
      assert.equal(created.code, 'DENOMINATOR_ZERO');
    }
  });

  it('20. per-event cap', () => {
    const refused = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      usage: rehearsalUsage({ eventIssued: 1_997n }),
      candidateIssuance: 4n,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'PER_EVENT_CAP_EXCEEDED');
    }
  });

  it('21. per-object cap', () => {
    const refused = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      usage: rehearsalUsage({ objectIssued: 3_997n }),
      candidateIssuance: 4n,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'PER_OBJECT_CAP_EXCEEDED');
    }
  });

  it('22. per-controller cap', () => {
    const refused = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      usage: rehearsalUsage({ controllerIssued: 7_997n }),
      candidateIssuance: 4n,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'PER_CONTROLLER_CAP_EXCEEDED');
    }
  });

  it('23. category cap', () => {
    const refused = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      usage: rehearsalUsage({ categoryEpochIssued: 19_997n }),
      candidateIssuance: 4n,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'PER_CATEGORY_EPOCH_CAP_EXCEEDED');
    }
  });

  it('24. global cap', () => {
    const refused = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      usage: rehearsalUsage({ globalEpochIssued: 49_997n }),
      candidateIssuance: 4n,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'GLOBAL_EPOCH_CAP_EXCEEDED');
    }
  });

  it('25. maximum supply guard', () => {
    const refused = convertProductionCandidateGpuv({
      gpuvQuantity: 10n,
      policy: rehearsalConversionPolicy(),
      evidence: rehearsalEvidence(),
      usage: rehearsalUsage({ canonicalSupply: 999_997n }),
      maximumSupply: 1_000_000n,
      candidateIssuance: 4n,
    });
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'MAXIMUM_SUPPLY_GUARD');
    }
    const genesis = validateMoonReySupplySafety({
      pkg: rehearsalMoonReyProductionIssuancePackage({
        productiveValuePolicy: rehearsalProductiveValuePolicyCandidate(),
        conversion: rehearsalConversionPolicy(),
        maximumSupply: 100n,
        genesisSupply: 200n,
      }),
    });
    assert.equal(genesis.ok, false);
    if (!genesis.ok) {
      assert.equal(genesis.code, 'GENESIS_EXCEEDS_MAXIMUM_SUPPLY');
    }
  });

  it('26. legacy V1 cannot qualify production', () => {
    const refused = validateProductionValueInput(
      rehearsalValueInput({ valuePath: LEGACY_ENGINEERING_SIMULATION_V1 }),
    );
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'LEGACY_V1_CANNOT_QUALIFY_PRODUCTION');
    }
    assert.equal(LEGACY_V1_PRODUCTION_ELIGIBLE, false);
  });

  it('27. fixture V2 cannot qualify production', () => {
    const refused = validateProductionValueInput(
      rehearsalValueInput({ valuePath: GOVERNED_VALUE_V2, fixturePolicy: true }),
    );
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'FIXTURE_V2_CANNOT_QUALIFY_PRODUCTION');
    }
  });

  it('28. AI cannot authorize', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ authorizedBy: 'AI' }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'AI_CANNOT_AUTHORIZE');
    }
  });

  it('29. S3M cannot authorize', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ authorizedBy: 'S3M' }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'S3M_CANNOT_AUTHORIZE');
    }
  });

  it('30. Grok cannot authorize', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ authorizedBy: 'GROK' }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'GROK_CANNOT_AUTHORIZE');
    }
  });

  it('31. provider cannot authorize', () => {
    const refused = validateProductionValueInput(rehearsalValueInput({ authorizedBy: 'ORACLE_PROVIDER' }));
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, 'PROVIDER_CANNOT_AUTHORIZE');
    }
  });

  it('32. GPUV result cannot mint', () => {
    const receipt = evaluateProductionCandidateValue(
      rehearsalValueInput({ fixturePolicy: false }),
      rehearsalProductiveValuePolicyCandidate(),
      rehearsalEnergySchedule(),
    );
    assert.equal(receipt.ok, true);
    if (receipt.ok) {
      assert.equal(receipt.value.canMint, false);
    }
    assert.equal(gpuvResultCannotMint(), false);
  });

  it('33. conversion authorization cannot mint', () => {
    assert.equal(CONVERSION_AUTHORIZATION_CAN_MINT, false);
    assert.equal(rehearsalConversionPolicy().canMint, false);
    assert.equal(CANONICAL_MOONREY_ISSUANCE_CLASS, 'VERIFIED_PRODUCTIVE_CONTRIBUTION');
    assert.ok(FORBIDDEN_MOONREY_ISSUANCE_CLASSES.includes('ADMIN_MINT'));
  });

  it('34. Chunk 71 remains mint gate', () => {
    assert.equal(chunk71RemainsMintGate(), true);
    const pkg = unconfiguredMoonReyProductionIssuancePackage();
    assert.equal(pkg.canMint, false);
    assert.equal(pkg.MOONREY_POST_GENESIS_ISSUANCE_POLICY, 'VERIFIED_PRODUCTIVE_CONTRIBUTION');
    const safety = revaluationSafety();
    assert.equal(safety.remintForbidden, true);
    assert.equal(safety.automaticClawbackForbidden, true);
    assert.equal(safety.customerBalanceRewriteForbidden, true);
  });

  it('35. current production remains blocked', () => {
    const snapshot = currentRepositorySnapshot();
    const decision = evaluateProductionEconomicActivation(snapshot);
    assert.equal(domainState(decision, 'MOONREY_COIN_ISSUANCE'), 'ECONOMIC_ACTIVATION_BLOCKED');
    assert.equal(decision.productionActivated, false);
    assert.equal(snapshot.moonreyProductionCandidate.gpuvValuesSelected, false);
    assert.equal(snapshot.moonreyProductionCandidate.conversionSelected, false);
    assert.equal(snapshot.moonreyProductionCandidate.fixtureAuthorizesProduction, false);
    const inspection = inspectProductionCandidatePolicy();
    assert.equal(inspection.path, PRODUCTION_CANDIDATE_UNACTIVATED);
    assert.equal(inspection.candidateActive, false);
    const evaluator = new MoonReyEconomicShadowEvaluator();
    assert.equal(evaluator.productionCandidatePath(), PRODUCTION_CANDIDATE_UNACTIVATED);
    assert.equal(evaluator.inspectProductionCandidate().productionActivated, false);
    assert.equal(validateProductiveValuePolicyCandidate(unconfiguredProductiveValuePolicyCandidate()).ok, true);
    assert.equal(GPUV_IS_NOT_PHYSICAL_UNIT, true);
    assert.equal(GPUV_IS_NOT_FIAT, true);
    assert.equal(GPUV_IS_NOT_MARKET_PRICE, true);
    assert.equal(GPUV_IS_NOT_MOONREY, true);
    assert.equal(GPUV_DOES_NOT_GUARANTEE_ECONOMIC_VALUE, true);
  });
});
