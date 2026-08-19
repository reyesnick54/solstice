import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateIssuanceFormula, LEGACY_FORMULA_PATH_CLASS } from './productive/formula.ts';
import { emptyMoonReySupply } from './productive/supply.ts';
import { PRODUCTIVE_CATEGORIES, FORMULA_VERSION, WEIGHT_SCALE } from './productive/types.ts';
import {
  ADVERSARIAL_SCENARIO_KINDS,
  GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2,
  LEGACY_ENGINEERING_SIMULATION_V1,
  LEGACY_V1_REMOVED,
  MoonReyEconomicShadowEvaluator,
  PRODUCTION_MIGRATION_APPROVED,
  PRODUCTION_VALUE_PATH,
  V2_PRODUCTION_ACTIVATION_PATH_EXISTS,
  V2_PRODUCTION_ACTIVE,
  analyzeSensitivity,
  adversarialTestsPassing,
  buildDistributionReport,
  buildV2MigrationReadinessReport,
  capacityNotValuedScenario,
  checkShadowInvariants,
  compareShadowSupplyPressure,
  detectFeedbackLoops,
  evaluateGovernedV2,
  excessiveSensitivityDetected,
  feedbackLoopCheckPassing,
  legacyV1DeprecationStatus,
  productionActivationAuthorized,
  replayV1Receipt,
  replayV2Receipt,
  representativeScenario,
  representativeScenarioLibrary,
  requestLegacyV1Deprecation,
  runAdversarialScenarios,
  runBoundedStressSweep,
  runMoonreyV2ShadowEconomicsDemo,
  sealV1Receipt,
  sealV2Receipt,
  shadowInvariantsHold,
} from './productive/policy-governance/shadow-economics/index.ts';

describe('Chunk 126 MoonRey V2 shadow economics', () => {
  it('keeps explicit path identities and does not call V2 production', () => {
    assert.equal(LEGACY_ENGINEERING_SIMULATION_V1, 'LEGACY_ENGINEERING_SIMULATION_V1');
    assert.equal(LEGACY_FORMULA_PATH_CLASS, LEGACY_ENGINEERING_SIMULATION_V1);
    assert.equal(GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2, 'GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2');
    assert.equal(PRODUCTION_VALUE_PATH, 'UNCONFIGURED');
    assert.equal(V2_PRODUCTION_ACTIVE, false);
    assert.equal(V2_PRODUCTION_ACTIVATION_PATH_EXISTS, false);
    assert.equal(productionActivationAuthorized(), false);
    assert.equal(PRODUCTION_MIGRATION_APPROVED, false);
    assert.equal(LEGACY_V1_REMOVED, false);
  });

  it('evaluates V1 and V2 without double-issuing or mutating supply', () => {
    const supply = emptyMoonReySupply();
    const evaluator = new MoonReyEconomicShadowEvaluator(supply);
    const scenario = representativeScenario('solar-energy');
    const first = evaluator.evaluate(scenario);
    const replay = evaluator.evaluate({ ...scenario, scenarioId: 'solar-energy.replay', replayAttempt: 1 });
    assert.equal(first.supplyMutated, false);
    assert.equal(first.v1Path, LEGACY_ENGINEERING_SIMULATION_V1);
    assert.equal(first.v2Path, GOVERNED_PRODUCTIVE_VALUE_SIMULATION_V2);
    assert.equal(first.v1Valued, true);
    assert.equal(first.v2Valued, true);
    assert.ok(first.v1Quantity !== null);
    assert.ok(first.v2GpuvValue !== null);
    assert.ok(first.v2MoonReyCandidateQuantity !== null);
    assert.equal(first.absoluteDelta, first.v2MoonReyCandidateQuantity! - first.v1Quantity!);
    assert.equal(first.v2ProductionActive, false);
    assert.equal(first.productionPath, 'UNCONFIGURED');
    assert.equal(replay.v2Valued, false);
    assert.ok(replay.reasonCodes.includes('V2_DUPLICATE_CLAIM') || replay.reasonCodes.includes('V2_REPLAY_NO_INCREMENT'));
    assert.equal(evaluator.canonicalSupply().issued, 0n);
    assert.deepEqual(evaluator.canonicalSupply(), supply);
  });

  it('covers every productive category and reports deliberate non-valuation', () => {
    const evaluator = new MoonReyEconomicShadowEvaluator();
    const library = representativeScenarioLibrary();
    const covered = new Set(library.map((row) => row.category));
    for (const category of PRODUCTIVE_CATEGORIES) {
      assert.equal(covered.has(category), true, category);
    }
    const comparisons = evaluator.evaluateMany(library);
    assert.equal(comparisons.length, library.length);
    assert.ok(comparisons.every((row) => row.v2Valued), comparisons.filter((row) => !row.v2Valued).map((row) => row.category).join(','));
    const capacity = evaluator.evaluate(capacityNotValuedScenario());
    assert.equal(capacity.v1Valued, false);
    assert.equal(capacity.v2Valued, false);
    assert.ok(capacity.reasonCodes.includes('V1_CLAIM_NOT_VALUED'));
    assert.ok(
      capacity.reasonCodes.includes('V2_REALIZATION_NOT_ELIGIBLE') ||
        capacity.reasonCodes.includes('V2_CLAIM_NOT_ELIGIBLE'),
    );
    assert.equal(capacity.v1Quantity, null);
    assert.equal(capacity.v2MoonReyCandidateQuantity, null);
  });

  it('builds distributional and supply-pressure reports without market forecasts', () => {
    const evaluator = new MoonReyEconomicShadowEvaluator();
    const library = representativeScenarioLibrary();
    const comparisons = evaluator.evaluateMany(library);
    const distribution = buildDistributionReport(comparisons, library);
    assert.equal(distribution.classification, 'ENGINEERING_ECONOMIC_SIMULATION');
    assert.equal(distribution.marketForecast, false);
    assert.ok(distribution.byCategory.length >= PRODUCTIVE_CATEGORIES.length);
    assert.ok(distribution.topControllerConcentration.length >= 1);
    assert.ok(distribution.topObjectConcentration.length >= 1);
    assert.ok(distribution.topCategoryConcentration.length >= 1);
    const pressure = compareShadowSupplyPressure(comparisons);
    assert.equal(pressure.canonicalSupplyMutated, false);
    assert.equal(pressure.v1.futurePriceProjection, false);
    assert.equal(pressure.v2.futurePriceProjection, false);
    assert.equal(pressure.v1.supplyMutated, false);
    assert.equal(pressure.v2.supplyMutated, false);
    assert.ok(pressure.v1.candidateIssuance > 0n);
    assert.ok(pressure.v2.candidateIssuance > 0n);
    assert.ok(pressure.v1.minCandidate <= pressure.v1.maxCandidate);
  });

  it('rejects the adversarial catalog without honest-path inflation', () => {
    const outcomes = runAdversarialScenarios();
    assert.equal(outcomes.length, ADVERSARIAL_SCENARIO_KINDS.length);
    for (const kind of ADVERSARIAL_SCENARIO_KINDS) {
      const row = outcomes.find((item) => item.kind === kind);
      assert.ok(row, kind);
      assert.equal(row.rejectedOrCapped, true, kind);
      assert.equal(row.inflatedRelativeToHonest, false, kind);
    }
    assert.equal(adversarialTestsPassing(outcomes), true);
  });

  it('holds documented monotonicity and safety invariants', () => {
    const results = checkShadowInvariants();
    for (const result of results) {
      assert.equal(result.holds, true, `${result.name}: ${result.detail}`);
    }
    assert.equal(shadowInvariantsHold(results), true);
  });

  it('measures sensitivity without extreme output jumps on small factor changes', () => {
    const rows = analyzeSensitivity();
    assert.ok(rows.length >= 7);
    assert.equal(excessiveSensitivityDetected(rows), false);
    for (const row of rows) {
      assert.equal(row.extremeSensitivity, false, row.factor);
    }
  });

  it('rejects self-referential price and issuance feedback loops', () => {
    const clean = detectFeedbackLoops(representativeScenario('solar-energy'));
    assert.deepEqual(clean.loops, []);
    assert.equal(feedbackLoopCheckPassing(), true);
    const price = evaluateGovernedV2({
      ...representativeScenario('solar-energy'),
      poison: { moonreyMarketPriceSelfReference: true },
    });
    assert.equal(price.valued, false);
    assert.ok(price.reasonCodes.includes('V2_FEEDBACK_LOOP_REJECTED'));
    const issuance = evaluateGovernedV2({
      ...representativeScenario('water'),
      poison: { issuanceQuantityAsScarcity: true },
    });
    assert.equal(issuance.valued, false);
  });

  it('keeps production migration gates unapproved even when engineering checks pass', () => {
    const report = buildV2MigrationReadinessReport();
    assert.equal(report.canonicalUnitsReady, true);
    assert.equal(report.sourceTaxonomyReady, true);
    assert.equal(report.eventIdentityReady, true);
    assert.equal(report.attributionReady, true);
    assert.equal(report.valueEngineReady, false);
    assert.equal(report.conversionBridgeReady, false);
    assert.equal(report.monetaryAuthorityReady, true);
    assert.equal(report.supplyReconciliationReady, true);
    assert.equal(report.allCategoriesReviewed, true);
    assert.equal(report.adversarialTestsPassing, true);
    assert.equal(report.feedbackLoopCheckPassing, true);
    assert.equal(report.productionParametersConfigured, false);
    assert.equal(report.productionMigrationApproved, false);
  });

  it('marks V1 as legacy engineering simulation with a non-automatic deprecation path', () => {
    const status = legacyV1DeprecationStatus();
    assert.equal(status.pathClass, 'LEGACY_ENGINEERING_SIMULATION_V1');
    assert.equal(status.productionEconomics, false);
    assert.equal(status.deleted, false);
    assert.equal(status.automaticRemovalDate, null);
    assert.equal(status.removalRequiresExplicitGovernance, true);
    const requested = requestLegacyV1Deprecation();
    assert.equal(requested.deprecationRequested, true);
    assert.equal(requested.deleted, false);
    const formula = evaluateIssuanceFormula({
      eligibleQuantity: 1_200_000n,
      categoryWeight: WEIGHT_SCALE,
      claimTypeWeight: WEIGHT_SCALE,
      qualityFactor: WEIGHT_SCALE,
      roundingMode: 'FLOOR',
      maximumIssuance: 10_000_000n,
    });
    assert.equal(formula.formulaVersion, FORMULA_VERSION);
    assert.equal(formula.formulaPathClass, 'LEGACY_ENGINEERING_SIMULATION_V1');
  });

  it('reproduces historic V1 and V2 receipts after later policy objects exist', () => {
    const v1 = sealV1Receipt({
      eligibleQuantity: 1_200_000n,
      categoryWeight: WEIGHT_SCALE,
      claimTypeWeight: WEIGHT_SCALE,
      qualityFactor: WEIGHT_SCALE,
      roundingMode: 'FLOOR',
      maximumIssuance: 10_000_000n,
    });
    assert.equal(replayV1Receipt(v1).contentHash, v1.contentHash);
    const scenario = representativeScenario('gpu-compute');
    const v2 = sealV2Receipt(scenario);
    assert.equal(v2.normalizationVersion, scenario.normalizationVersion);
    assert.equal(v2.eventIdentityVersion, scenario.eventIdentityVersion);
    assert.equal(v2.attributionPolicyId, scenario.attributionPolicyId);
    assert.equal(v2.valuePolicyId, scenario.valuePolicyId);
    assert.equal(v2.conversionPolicyId, scenario.conversionPolicyId);
    assert.equal(replayV2Receipt(scenario, v2).contentHash, v2.contentHash);
  });

  it('runs a bounded deterministic stress sweep without mutating supply', () => {
    const report = runBoundedStressSweep();
    assert.ok(report.cases >= 18);
    assert.ok(report.valuedV2 >= 1);
    assert.ok(report.unvaluedV2 >= 1);
    assert.equal(report.supplyMutated, false);
    assert.ok(report.comparisons.every((row) => row.supplyMutated === false));
  });

  it('prints the shadow comparison demo without activating production', () => {
    const output = runMoonreyV2ShadowEconomicsDemo();
    assert.match(output, /Category/);
    assert.match(output, /V1 Candidate/);
    assert.match(output, /V2 GPUV/);
    assert.match(output, /V2 MoonRey Candidate/);
    assert.match(output, /ENERGY/);
    assert.match(output, /AI_COMPUTE/);
    assert.match(output, /SHADOW_MODE=true/);
    assert.match(output, /CANONICAL_SUPPLY_MUTATED=false/);
    assert.match(output, /V2_PRODUCTION_ACTIVE=false/);
    assert.match(output, /LEGACY_V1_REMOVED=false/);
    assert.match(output, /PRODUCTION_MIGRATION_APPROVED=false/);
  });
});
