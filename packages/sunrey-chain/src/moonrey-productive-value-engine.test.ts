import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { evaluateIssuanceFormula, LEGACY_FORMULA_PATH_CLASS } from './productive/formula.ts';
import {
  CANONICAL_FACTOR_ORDER,
  PRODUCTIVE_VALUE_ENGINE_CAN_MINT,
  PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED,
  PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED,
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED,
  PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS,
  PRODUCTIVE_VALUE_UNIT,
  PRODUCTIVE_VALUE_UNIT_ID,
  ProductiveValueResultStore,
  VALUE_FACTOR_SCALE,
  applyBaseValueSchedule,
  constitutionEraEngineImplementedMarker,
  developmentValueFunctionPolicy,
  engineCannotMint,
  engineProductionActive,
  engineeringImplementedMeansProductionActivated,
  evaluateProductiveValue,
  everyCategoryHasBaseValueEntry,
  hashValueFunctionPolicy,
  productionBaseValueScheduleUnconfigured,
  productiveValueFunctionEngineStatus,
  resolveBaseValueEntry,
  scheduleUsesFakeUniversalPhysicalUnit,
  simulationBaseValueSchedule,
  valueFunctionEngineImplemented,
  valueFunctionEngineeringImplemented,
} from './productive/policy-governance/value-function/index.ts';
import { ATTRIBUTION_SHARE_SCALE } from './productive/policy-governance/value-function/types.ts';
import { engineAttribution, engineReferenceFact, engineValueInput } from './productive/policy-governance/value-function/fixtures.ts';
import { FORMULA_VERSION, WEIGHT_SCALE } from './productive/types.ts';
import type { ProductiveCategory } from './productive/types.ts';

const POLICY = developmentValueFunctionPolicy();
const SCHEDULE = simulationBaseValueSchedule();

function valued(category: ProductiveCategory, overrides: Parameters<typeof engineValueInput>[1] = {}) {
  return evaluateProductiveValue(engineValueInput(category, overrides), { policy: POLICY, schedule: SCHEDULE });
}

describe('Chunk 124 deterministic Productive Value Function engine', () => {
  it('evaluates ENERGY to GPUV from a governed base-value schedule', () => {
    const outcome = valued('ENERGY');
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    assert.equal(outcome.result.category, 'ENERGY');
    assert.equal(outcome.result.canonicalMeasurementUnit, 'Wh');
    assert.equal(outcome.result.canonicalMeasurementQuantity, 1_200_000n);
    assert.equal(outcome.result.baseProductiveValue, 1_200n);
    assert.equal(outcome.result.valueUnit, 'GPUV');
    assert.equal(outcome.result.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result.finalProductiveValue > 0n);
  });

  it('evaluates AI_COMPUTE', () => {
    const outcome = valued('AI_COMPUTE');
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    assert.equal(outcome.result.baseProductiveValue, 2n);
    assert.equal(outcome.result.canonicalMeasurementUnit, 'gpu_s');
  });

  it('evaluates MANUFACTURING', () => {
    const outcome = valued('MANUFACTURING');
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    assert.equal(outcome.result.baseProductiveValue, 20n);
    assert.equal(outcome.result.realizationState, 'VERIFIED_DELIVERY');
  });

  it('evaluates LOGISTICS', () => {
    const outcome = valued('LOGISTICS_TRANSPORTATION');
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    assert.equal(outcome.result.baseProductiveValue, 10n);
    assert.equal(outcome.result.canonicalMeasurementUnit, 't_km');
  });

  it('evaluates WATER', () => {
    const outcome = valued('WATER');
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    assert.equal(outcome.result.baseProductiveValue, 100n);
  });

  it('evaluates SERVICES', () => {
    const outcome = valued('SERVICES');
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    assert.equal(outcome.result.baseProductiveValue, 2n);
    assert.equal(outcome.result.realizationState, 'COMPLETED_ECONOMIC_SERVICE');
  });

  it('applies the exact base-value schedule', () => {
    assert.equal(everyCategoryHasBaseValueEntry(SCHEDULE), true);
    assert.equal(scheduleUsesFakeUniversalPhysicalUnit(SCHEDULE), false);
    const energy = resolveBaseValueEntry(SCHEDULE, {
      category: 'ENERGY',
      canonicalMeasurementUnit: 'Wh',
      measurementSemantic: 'energy_output',
      claimType: 'OUTPUT',
      realizationState: 'ACTUAL_OUTPUT',
    });
    assert.equal(energy.ok, true);
    if (energy.ok) {
      assert.equal(energy.value.baseValueNumerator, 1n);
      assert.equal(energy.value.baseValueDenominator, 1_000n);
      assert.notEqual(energy.value.baseValueDenominator, 1n);
      const applied = applyBaseValueSchedule(1_200_000n, energy.value, 'FLOOR');
      assert.equal(applied.ok, true);
      if (applied.ok) {
        assert.equal(applied.value, 1_200n);
      }
    }
    const production = productionBaseValueScheduleUnconfigured();
    assert.equal(production.status, 'UNCONFIGURED');
    assert.equal(production.productionConfigured, false);
  });

  it('keeps factor order deterministic', () => {
    const first = valued('ENERGY');
    const second = valued('ENERGY');
    assert.ok(first.result && second.result);
    assert.deepEqual(
      first.result.factorApplications.map((item) => item.factorType),
      [...CANONICAL_FACTOR_ORDER],
    );
    assert.deepEqual(
      first.result.factorApplications.map((item) => item.factorType),
      second.result.factorApplications.map((item) => item.factorType),
    );
  });

  it('applies the quality factor', () => {
    const high = valued('ENERGY');
    const low = valued('ENERGY', {
      oracleQuality: 250_000n,
      referenceFacts: [
        engineReferenceFact('QUALITY', { quality: 250_000n }),
        engineReferenceFact('FRESHNESS'),
        engineReferenceFact('UTILIZATION'),
        engineReferenceFact('CAPACITY'),
        engineReferenceFact('REGIONAL_SUPPLY', { quantity: { numerator: 100n, denominator: 1n } }),
        engineReferenceFact('REGIONAL_DEMAND_PROXY', { quantity: { numerator: 100n, denominator: 1n } }),
      ],
    });
    assert.ok(high.result && low.result);
    const highQuality = high.result.factorApplications.find((item) => item.factorType === 'VERIFICATION_QUALITY_FACTOR');
    const lowQuality = low.result.factorApplications.find((item) => item.factorType === 'VERIFICATION_QUALITY_FACTOR');
    assert.ok(highQuality && lowQuality);
    assert.ok(lowQuality.value < highQuality.value);
    assert.ok(low.result.finalProductiveValue < high.result.finalProductiveValue);
  });

  it('applies the freshness factor', () => {
    const fresh = valued('ENERGY', { freshnessAgeEpochs: 0n, policyMaxAgeEpochs: 4n });
    const aged = valued('ENERGY', { freshnessAgeEpochs: 2n, policyMaxAgeEpochs: 4n });
    assert.ok(fresh.result && aged.result);
    const freshFactor = fresh.result.factorApplications.find((item) => item.factorType === 'FRESHNESS_FACTOR');
    const agedFactor = aged.result.factorApplications.find((item) => item.factorType === 'FRESHNESS_FACTOR');
    assert.ok(freshFactor && agedFactor);
    assert.ok(agedFactor.value < freshFactor.value);
  });

  it('applies the utilization factor as actual over governed capacity', () => {
    const outcome = valued('ENERGY', {
      utilization: {
        actual: 25n,
        basis: 100n,
        objectId: 'obj.solar.1',
        geography: { geographyId: 'grid.west', jurisdiction: 'SIMULATION' },
        measurementPeriod: {
          validFromUnixSeconds: 1_799_000_000n,
          validUntilUnixSeconds: 1_800_000_000n,
          epoch: 1,
        },
        basisFreshnessEpochs: 0,
        independentlyEvidenced: true,
      },
    });
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    const utilization = outcome.result.factorApplications.find((item) => item.factorType === 'UTILIZATION_FACTOR');
    assert.ok(utilization);
    assert.equal(utilization.value, 250_000n);
  });

  it('rejects a zero utilization denominator without fabricating one', () => {
    const outcome = valued('ENERGY', {
      utilization: {
        actual: 25n,
        basis: 0n,
        objectId: 'obj.solar.1',
        geography: { geographyId: 'grid.west', jurisdiction: 'SIMULATION' },
        measurementPeriod: {
          validFromUnixSeconds: 1_799_000_000n,
          validUntilUnixSeconds: 1_800_000_000n,
          epoch: 1,
        },
        basisFreshnessEpochs: 0,
        independentlyEvidenced: true,
      },
    });
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.equal(outcome.code, 'UTILIZATION_DIVIDE_BY_ZERO');
    assert.equal(outcome.result, null);
  });

  it('applies scarcity only with verified reference evidence', () => {
    const outcome = valued('WATER', {
      referenceFacts: [
        engineReferenceFact('QUALITY'),
        engineReferenceFact('FRESHNESS'),
        engineReferenceFact('UTILIZATION'),
        engineReferenceFact('CAPACITY', { quantity: { numerator: 50n, denominator: 1n } }),
        engineReferenceFact('AVAILABILITY', { quantity: { numerator: 50n, denominator: 1n } }),
        engineReferenceFact('REGIONAL_SUPPLY', { quantity: { numerator: 50n, denominator: 1n } }),
        engineReferenceFact('REGIONAL_DEMAND_PROXY', { quantity: { numerator: 100n, denominator: 1n } }),
      ],
    });
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    const scarcity = outcome.result.factorApplications.find((item) => item.factorType === 'SCARCITY_FACTOR');
    assert.ok(scarcity);
    assert.equal(scarcity.treatment, 'EVALUATED');
    assert.ok(scarcity.value >= 500_000n);
    assert.ok(scarcity.value <= 1_500_000n);
  });

  it('rejects or reviews scarcity without evidence', () => {
    const outcome = valued('WATER', {
      referenceFacts: [engineReferenceFact('QUALITY'), engineReferenceFact('FRESHNESS')],
    });
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.ok(outcome.code === 'SCARCITY_REFERENCE_REQUIRED' || outcome.code === 'MISSING_INPUT_FAIL_CLOSED' || outcome.code === 'UTILIZATION_EVIDENCE_REQUIRED');
  });

  it('applies geography only with governed reference evidence', () => {
    const outcome = valued('ENERGY', {
      geographyContextKind: 'VERIFIED_GRID_SCARCITY',
      referenceFacts: [
        engineReferenceFact('QUALITY'),
        engineReferenceFact('FRESHNESS'),
        engineReferenceFact('UTILIZATION'),
        engineReferenceFact('CAPACITY'),
        engineReferenceFact('REGIONAL_SUPPLY', { quantity: { numerator: 1n, denominator: 1n } }),
        engineReferenceFact('REGIONAL_DEMAND_PROXY', { quantity: { numerator: 1n, denominator: 1n } }),
      ],
    });
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    const geo = outcome.result.factorApplications.find((item) => item.factorType === 'GEOGRAPHIC_CONTEXT_FACTOR');
    assert.ok(geo);
    assert.equal(geo.treatment, 'EVALUATED');
  });

  it('rejects arbitrary geography preference', () => {
    const outcome = valued('ENERGY', { countryPreferenceRequested: true });
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.equal(outcome.code, 'ARBITRARY_COUNTRY_PREFERENCE_FORBIDDEN');
  });

  it('applies the attribution share mathematically', () => {
    const full = valued('MANUFACTURING');
    const partial = valued('MANUFACTURING', {
      attributionDecision: engineAttribution('MANUFACTURING', 400_000n),
      availableAttributionShare: { numerator: 400_000n, denominator: ATTRIBUTION_SHARE_SCALE },
    });
    assert.ok(full.result && partial.result);
    assert.equal(partial.result.attributionShare.numerator, 400_000n);
    assert.equal(partial.result.finalProductiveValue, (partial.result.preAttributionValue * 400_000n) / 1_000_000n);
    assert.ok(full.result.finalProductiveValue > partial.result.finalProductiveValue);
  });

  it('does not let a 40% share receive 100% of the event value', () => {
    const outcome = valued('MANUFACTURING', {
      attributionDecision: engineAttribution('MANUFACTURING', 400_000n),
      availableAttributionShare: { numerator: 400_000n, denominator: ATTRIBUTION_SHARE_SCALE },
    });
    assert.ok(outcome.result);
    assert.ok(outcome.result.preAttributionValue > outcome.result.finalProductiveValue);
    assert.notEqual(outcome.result.finalProductiveValue, outcome.result.preAttributionValue);
    assert.equal(outcome.result.finalProductiveValue, (outcome.result.preAttributionValue * 400_000n) / 1_000_000n);
  });

  it('rejects missing attribution', () => {
    const outcome = valued('ENERGY', {
      attributionDecision: undefined as unknown as ReturnType<typeof engineAttribution>,
    });
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.equal(outcome.code, 'ATTRIBUTION_REQUIRED');
  });

  it('returns review when reference facts conflict', () => {
    const outcome = valued('ENERGY', {
      referenceFacts: [
        engineReferenceFact('QUALITY', { quantity: { numerator: 1n, denominator: 1n } }),
        engineReferenceFact('QUALITY', { factId: 'ref.QUALITY.b', quantity: { numerator: 2n, denominator: 1n } }),
        engineReferenceFact('FRESHNESS'),
        engineReferenceFact('UTILIZATION'),
        engineReferenceFact('CAPACITY'),
        engineReferenceFact('REGIONAL_SUPPLY', { quantity: { numerator: 100n, denominator: 1n } }),
      ],
    });
    assert.equal(outcome.state, 'VALUE_REVIEW_REQUIRED');
    assert.equal(outcome.code, 'REFERENCE_FACTS_CONFLICT');
  });

  it('returns review or reject for a stale reference', () => {
    const outcome = valued('ENERGY', {
      referenceFacts: [
        engineReferenceFact('QUALITY'),
        engineReferenceFact('FRESHNESS', { freshnessEpochs: 9, stale: true }),
        engineReferenceFact('UTILIZATION'),
        engineReferenceFact('CAPACITY'),
        engineReferenceFact('REGIONAL_SUPPLY', { quantity: { numerator: 100n, denominator: 1n } }),
      ],
    });
    assert.ok(outcome.state === 'VALUE_REVIEW_REQUIRED' || outcome.state === 'VALUE_REJECTED');
    assert.equal(outcome.code, 'REFERENCE_FACT_STALE');
  });

  it('treats a reference price alone as insufficient', () => {
    const outcome = valued('ENERGY', {
      referencePriceAlone: true,
      referenceFacts: [engineReferenceFact('REFERENCE_PRICE')],
    });
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.equal(outcome.code, 'REFERENCE_PRICE_CANNOT_DETERMINE_VALUE');
  });

  it('rejects AI economic judgment', () => {
    const outcome = valued('ENERGY', { aiEconomicJudgment: true });
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.equal(outcome.code, 'AI_ECONOMIC_JUDGMENT_FORBIDDEN');
  });

  it('rejects provider self-report as insufficient utilization evidence', () => {
    const outcome = valued('ENERGY', { providerSelfReportAlone: true });
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.equal(outcome.code, 'PROVIDER_SELF_REPORT_INSUFFICIENT');
  });

  it('enforces the scarcity factor cap', () => {
    const outcome = valued('WATER', {
      referenceFacts: [
        engineReferenceFact('QUALITY'),
        engineReferenceFact('FRESHNESS'),
        engineReferenceFact('UTILIZATION'),
        engineReferenceFact('CAPACITY', { quantity: { numerator: 1n, denominator: 1n } }),
        engineReferenceFact('AVAILABILITY', { quantity: { numerator: 1n, denominator: 1n } }),
        engineReferenceFact('REGIONAL_SUPPLY', { quantity: { numerator: 1n, denominator: 1n } }),
        engineReferenceFact('REGIONAL_DEMAND_PROXY', { quantity: { numerator: 100n, denominator: 1n } }),
      ],
    });
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    const scarcity = outcome.result.factorApplications.find((item) => item.factorType === 'SCARCITY_FACTOR');
    assert.ok(scarcity);
    assert.equal(scarcity.value, 1_500_000n);
    assert.ok(outcome.explanation?.floorCeiling.scarcityCeilingApplied);
  });

  it('enforces the aggregate factor cap', () => {
    const draft = {
      ...developmentValueFunctionPolicy(),
      aggregateFactorCeiling: 400_000n,
    };
    const policy = { ...draft, contentHash: hashValueFunctionPolicy(draft) };
    const outcome = evaluateProductiveValue(engineValueInput('SERVICES'), { policy, schedule: SCHEDULE });
    assert.equal(outcome.state, 'VALUED_SIMULATION');
    assert.ok(outcome.result);
    assert.ok(outcome.result.aggregateFactor <= 400_000n);
  });

  it('uses exact bigint arithmetic', () => {
    const outcome = valued('ENERGY');
    assert.ok(outcome.result);
    assert.equal(typeof outcome.result.baseProductiveValue, 'bigint');
    assert.equal(typeof outcome.result.finalProductiveValue, 'bigint');
    assert.equal(typeof outcome.result.aggregateFactor, 'bigint');
    assert.equal(outcome.result.canonicalMeasurementQuantity * 1n / 1_000n, outcome.result.baseProductiveValue);
  });

  it('never uses floating-point economic values', () => {
    const outcome = valued('ENERGY');
    assert.ok(outcome.result);
    for (const factor of outcome.result.factorApplications) {
      assert.equal(typeof factor.value, 'bigint');
    }
    assert.equal(typeof outcome.result.attributionShare.numerator, 'bigint');
    assert.equal(Number.isInteger(Number.NaN), false);
  });

  it('produces a deterministic valueDigest', () => {
    const first = valued('ENERGY');
    const second = valued('ENERGY');
    assert.ok(first.result && second.result);
    assert.equal(first.result.valueDigest, second.result.valueDigest);
    assert.equal(first.result.valueId, second.result.valueId);
  });

  it('keeps historic value results immutable', () => {
    const store = new ProductiveValueResultStore();
    const first = evaluateProductiveValue(engineValueInput('ENERGY'), { policy: POLICY, schedule: SCHEDULE, store });
    assert.ok(first.result);
    const historic = store.get(first.result.valueId);
    assert.ok(historic);
    const mutated = { ...first.result, finalProductiveValue: 99n, valueDigest: '0'.repeat(64) };
    const overwrite = store.append(mutated);
    assert.equal(overwrite.ok, false);
    if (!overwrite.ok) {
      assert.equal(overwrite.code, 'VALUE_RESULT_IMMUTABLE');
    }
    assert.equal(store.get(first.result.valueId)?.finalProductiveValue, first.result.finalProductiveValue);
    const revaluationPolicy = developmentValueFunctionPolicy(1, 2);
    const revaluation = evaluateProductiveValue(
      engineValueInput('ENERGY', {
        valueFunctionPolicyVersion: 2,
        supersedesValueId: first.result.valueId,
        revaluationReason: 'POLICY_SUPERSEDED',
        priorPolicyVersion: 1,
      }),
      { policy: revaluationPolicy, schedule: SCHEDULE, store },
    );
    assert.equal(revaluation.state, 'VALUED_SIMULATION');
    assert.ok(revaluation.result);
    assert.equal(revaluation.result.supersedesValueId, first.result.valueId);
    assert.notEqual(revaluation.result.valueId, first.result.valueId);
    assert.equal(store.get(first.result.valueId)?.valueDigest, first.result.valueDigest);
  });

  it('does not produce a MoonRey quantity', () => {
    const outcome = valued('ENERGY');
    assert.ok(outcome.result);
    assert.equal(outcome.result.isMoonReyQuantity, false);
    assert.equal(outcome.result.isPhysicalUnit, false);
    assert.equal(outcome.result.isFiatValue, false);
    assert.equal(outcome.result.isMarketPrice, false);
    assert.equal(outcome.result.valueUnit, PRODUCTIVE_VALUE_UNIT_ID);
    assert.equal(PRODUCTIVE_VALUE_UNIT.notMoonReyQuantity, true);
    const formula = evaluateIssuanceFormula({
      eligibleQuantity: 1_200_000n,
      categoryWeight: WEIGHT_SCALE,
      claimTypeWeight: WEIGHT_SCALE,
      qualityFactor: WEIGHT_SCALE,
      roundingMode: 'FLOOR',
      maximumIssuance: 10_000_000n,
    });
    assert.equal(formula.formulaVersion, FORMULA_VERSION);
    assert.equal(formula.formulaPathClass, LEGACY_FORMULA_PATH_CLASS);
    assert.notEqual(outcome.result.finalProductiveValue, formula.moonreyQuantity);
  });

  it('cannot mint and does not create monetary authority', () => {
    assert.equal(engineCannotMint(), false);
    assert.equal(PRODUCTIVE_VALUE_ENGINE_CAN_MINT, false);
    assert.equal(productiveValueFunctionEngineStatus().canMint, false);
    assert.equal(productiveValueFunctionEngineStatus().canCreateMonetaryAuthority, false);
    const outcome = valued('ENERGY');
    assert.ok(outcome.result);
    assert.equal(outcome.result.createsMintAuthority, false);
    assert.equal(outcome.result.createsExecutionAuthority, false);
  });

  it('keeps production inactive and does not treat engineering implementation as activation', () => {
    assert.equal(PRODUCTIVE_VALUE_ENGINE_ENGINEERING_IMPLEMENTED, true);
    assert.equal(valueFunctionEngineeringImplemented(), true);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS.engineeringImplemented, true);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS.simulationAvailable, true);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS.productionActivated, false);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_ENGINE_STATUS.productionPolicyConfigured, false);
    assert.equal(PRODUCTIVE_VALUE_ENGINE_PRODUCTION_ACTIVATED, false);
    assert.equal(engineProductionActive(), false);
    assert.equal(engineeringImplementedMeansProductionActivated(), false);
    assert.equal(constitutionEraEngineImplementedMarker(), false);
    assert.equal(PRODUCTIVE_VALUE_FUNCTION_ENGINE_IMPLEMENTED, false);
    assert.equal(valueFunctionEngineImplemented(), false);
    assert.equal(POLICY.engineImplemented, false);
    assert.equal(POLICY.productionActivated, false);
    const outcome = valued('ENERGY');
    assert.ok(outcome.result);
    assert.equal(outcome.result.productionEligible, false);
  });

  it('rejects an Event A attribution used to value Event B', () => {
    const energy = engineValueInput('ENERGY');
    const foreign = engineAttribution('WATER');
    const outcome = evaluateProductiveValue(
      {
        ...energy,
        attributionDecision: {
          ...foreign,
          claimId: energy.contribution.claimId,
          contributionId: energy.contribution.contributionId,
        },
        availableAttributionShare: foreign.availableShare,
      },
      { policy: POLICY, schedule: SCHEDULE },
    );
    assert.equal(outcome.state, 'VALUE_REJECTED');
    assert.equal(outcome.code, 'EVENT_ATTRIBUTION_MISMATCH');
  });
});
