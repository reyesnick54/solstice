import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { EconomicAssetRegistry } from '../../economic-asset-registry/src/index.ts';
import { contributionFingerprint } from './productive/fingerprint.ts';
import {
  PRODUCTIVE_CONTRIBUTION_SCHEMA_V2,
  PRODUCTIVE_FINGERPRINT_V1,
  PRODUCTIVE_FINGERPRINT_V2,
} from './productive/types.ts';
import { verifyProductiveClaim } from './productive/verification.ts';
import { defaultUnitRegistry } from './productive/units.ts';
import { developmentIssuancePolicy } from './productive/policy.ts';
import { fixtureObject, fixtureRight, fixtureFacts, fixtureClaim, DEV_CLOCK } from './productive/fixtures.ts';
import { buildProductiveClaimCandidate } from './productive/claim-candidate/builder.ts';
import { energyBuildInput, pathBuildInput, fixtureVerifiedFact } from './productive/claim-candidate/fixtures.ts';
import { recordCompatibilityLineage } from './productive/claim-candidate/lineage.ts';
import { normalizeContribution, normalizePhysicalMeasurement } from './productive/policy-governance/normalization.ts';
import { evaluateContributionEligibility } from './productive/policy-governance/eligibility.ts';
import { developmentPolicyBundle, emptyBudgetUsage } from './productive/policy-governance/index.ts';
import { solarFacility } from './productive/fixtures.ts';
import {
  CANONICAL_UNIT_AUTHORITY,
  NORMALIZATION_AUTHORIZES_MOONREY,
  PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING,
  exactFromFixed,
  integerMantissaOf,
  measureCanonical,
  measureSourceObservation,
  originalObservationPreserved,
  quantityRational,
} from './units/index.ts';
import { defaultCanonicalUnitRegistry } from './units/index.ts';

const clock = { nowIso: () => '2026-08-19T00:00:00.000Z' };

function qty(unitId: string, mantissa: bigint) {
  const built = exactFromFixed({ mantissa, unitId });
  if (!built.ok) {
    throw new Error(built.error.detail);
  }
  return built.value;
}

function integerMantissa(quantity: Parameters<typeof integerMantissaOf>[0]): bigint {
  const measured = integerMantissaOf(quantity);
  if (!measured.ok) {
    throw new Error(measured.error.detail);
  }
  return measured.value;
}

function measure(input: Parameters<typeof measureCanonical>[0]) {
  return measureCanonical({ ...input, clock });
}

describe('CHUNK-119 canonical unit migration', () => {
  it('1. energy kWh → canonical Wh', () => {
    const result = measure({
      sourceQuantity: qty('kWh', 3n),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'Wh');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 3_000n);
    assert.equal(result.value.sourceUnit, 'kWh');
    assert.equal(result.value.exact, true);
    assert.equal(result.value.lossy, false);
  });

  it('2. tonne → canonical mass', () => {
    const result = measure({
      sourceQuantity: qty('tonne', 2n),
      productiveCategory: 'FOOD_AGRICULTURE',
      factType: 'FOOD_PRODUCTION',
      claimType: 'OUTPUT',
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'g');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 2_000_000n);
  });

  it('3. gpu_s canonical compute', () => {
    const result = measure({
      sourceQuantity: qty('gpu_s', 1n),
      productiveCategory: 'COMPUTE',
      factType: 'COMPUTE_USAGE',
      claimType: 'USAGE',
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'gpu_s');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 1n);
  });

  it('4. GPU_HOUR canonical compute', () => {
    const result = measure({
      sourceQuantity: qty('GPU_HOUR', 1n),
      productiveCategory: 'AI_COMPUTE',
      factType: 'AI_INFERENCE_USAGE',
      claimType: 'USAGE',
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'gpu_s');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 3_600n);
    const truncated = defaultCanonicalUnitRegistry.convert(qty('gpu_s', 1n), 'GPU_HOUR', undefined, clock);
    assert.equal(truncated.ok, true);
    if (truncated.ok) {
      assert.equal(integerMantissaOf(truncated.value.targetQuantity).ok, false);
    }
  });

  it('5. m2 with duration', () => {
    const result = measure({
      sourceQuantity: qty('m2', 2n),
      productiveCategory: 'REAL_ESTATE_USE',
      factType: 'REAL_ESTATE_USE_CAPACITY',
      claimType: 'CAPACITY',
      context: { durationSeconds: 3_600n, factType: 'REAL_ESTATE_USE_CAPACITY', productiveCategory: 'REAL_ESTATE_USE' },
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'm2_s');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 7_200n);
  });

  it('6. m2 without duration rejected', () => {
    const result = measure({
      sourceQuantity: qty('m2', 2n),
      productiveCategory: 'REAL_ESTATE_USE',
      factType: 'REAL_ESTATE_USE_CAPACITY',
      claimType: 'CAPACITY',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'NORMALIZATION_CONTEXT_REQUIRED');
    }
  });

  it('7. m3 storage with duration', () => {
    const result = measure({
      sourceQuantity: qty('m3', 1n),
      productiveCategory: 'STORAGE',
      factType: 'STORAGE_CAPACITY',
      claimType: 'CAPACITY',
      context: { durationSeconds: 3_600n, factType: 'STORAGE_CAPACITY', productiveCategory: 'STORAGE' },
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'L_s');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 3_600_000n);
  });

  it('8. m3 storage without duration rejected', () => {
    const result = measure({
      sourceQuantity: qty('m3', 1n),
      productiveCategory: 'STORAGE',
      factType: 'STORAGE_CAPACITY',
      claimType: 'CAPACITY',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'NORMALIZATION_CONTEXT_REQUIRED');
    }
  });

  it('9. GB_s with duration', () => {
    const result = measure({
      sourceQuantity: qty('GB_s', 2n),
      productiveCategory: 'BANDWIDTH_COMMUNICATIONS',
      factType: 'BANDWIDTH_USAGE',
      claimType: 'USAGE',
      context: { durationSeconds: 5n, factType: 'BANDWIDTH_USAGE', productiveCategory: 'BANDWIDTH_COMMUNICATIONS' },
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'B');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 10_000_000_000n);
  });

  it('10. GB_s without duration rejected', () => {
    const result = measure({
      sourceQuantity: qty('GB_s', 2n),
      productiveCategory: 'BANDWIDTH_COMMUNICATIONS',
      factType: 'BANDWIDTH_USAGE',
      claimType: 'USAGE',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'NORMALIZATION_CONTEXT_REQUIRED');
    }
  });

  it('11. generic compute_s with CPU context', () => {
    const result = measure({
      sourceQuantity: qty('compute_s', 7_200n),
      productiveCategory: 'COMPUTE',
      factType: 'COMPUTE_USAGE',
      claimType: 'USAGE',
      context: { resourceClass: 'CPU', factType: 'COMPUTE_USAGE', productiveCategory: 'COMPUTE' },
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'cpu_s');
    assert.equal(integerMantissa(result.value.canonicalQuantity), 7_200n);
  });

  it('12. generic compute_s with GPU context', () => {
    const result = measure({
      sourceQuantity: qty('compute_s', 3_600n),
      productiveCategory: 'COMPUTE',
      factType: 'COMPUTE_USAGE',
      claimType: 'USAGE',
      context: { resourceClass: 'GPU', factType: 'COMPUTE_USAGE', productiveCategory: 'COMPUTE' },
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'gpu_s');
    assert.equal(result.value.measurementDimension, 'GPU_TIME');
  });

  it('13. compute_s without resource context rejected', () => {
    const result = measure({
      sourceQuantity: qty('compute_s', 3_600n),
      productiveCategory: 'COMPUTE',
      factType: 'COMPUTE_USAGE',
      claimType: 'USAGE',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'NORMALIZATION_CONTEXT_REQUIRED');
    }
  });

  it('14. token_inference semantic qualification', () => {
    const result = measure({
      sourceQuantity: qty('token_inference', 42n),
      productiveCategory: 'AI_COMPUTE',
      factType: 'AI_INFERENCE_USAGE',
      claimType: 'USAGE',
      context: { semanticQualifier: 'INFERENCE_PROCESSED_TOKENS', factType: 'AI_INFERENCE_USAGE', productiveCategory: 'AI_COMPUTE' },
    });
    if (!result.ok) {
      throw new Error(result.error.detail);
    }
    assert.equal(result.value.canonicalUnit, 'TOKEN');
    assert.equal(result.value.semanticQualifier, 'INFERENCE_PROCESSED_TOKENS');
    const training = measure({
      sourceQuantity: qty('token_inference', 42n),
      productiveCategory: 'AI_COMPUTE',
      factType: 'AI_INFERENCE_USAGE',
      claimType: 'USAGE',
      context: { semanticQualifier: 'TRAINING_TOKENS', factType: 'AI_INFERENCE_USAGE', productiveCategory: 'AI_COMPUTE' },
    });
    assert.equal(training.ok, false);
    if (!training.ok) {
      assert.equal(training.error.code, 'NORMALIZATION_SEMANTIC_MISMATCH');
    }
  });

  it('15. machine_h cannot become UNIT output', () => {
    const result = measure({
      sourceQuantity: qty('machine_h', 4n),
      productiveCategory: 'AUTOMATED_MACHINE_OUTPUT',
      factType: 'AUTOMATED_MACHINE_OUTPUT',
      claimType: 'OUTPUT',
      targetUnit: 'UNIT',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.error.code === 'CLAIM_UNIT_MISMATCH' || result.error.code === 'NORMALIZATION_DIMENSION_MISMATCH');
    }
  });

  it('16. reference price cannot become productive quantity', () => {
    const result = measure({
      sourceQuantity: qty('units_produced', 1n),
      productiveCategory: 'MANUFACTURING',
      factType: 'REFERENCE_PRICE',
      claimType: 'OUTPUT',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'FACT_UNIT_MISMATCH');
    }
  });

  it('17. source→fact→claim normalization receipt retained', () => {
    const observation = measureSourceObservation({
      sourceUnit: 'kWh',
      sourceMantissa: 1_200n,
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
      measurementStart: 1_799_000_000n,
      measurementEnd: 1_800_000_000n,
      clock,
    });
    if (!observation.ok) {
      throw new Error(observation.error.detail);
    }
    assert.equal(originalObservationPreserved({ mantissa: 1_200n, unit: 'kWh' }, observation.value), true);
    const built = buildProductiveClaimCandidate(energyBuildInput());
    if (!built.ok) {
      throw new Error(built.error.detail);
    }
    assert.equal(built.value.sourceUnit, 'kWh');
    assert.equal(built.value.canonicalUnit, 'Wh');
    assert.ok(built.value.normalizationReceiptId.startsWith('nrc_'));
    assert.equal(built.value.normalizationConstitutionVersion, observation.value.normalizationConstitutionVersion);
    assert.equal(built.value.mappingId.length > 0, true);
  });

  it('18. verified contribution records normalization version', () => {
    const built = buildProductiveClaimCandidate(energyBuildInput());
    if (!built.ok) {
      throw new Error(built.error.detail);
    }
    const object = fixtureObject({ objectId: built.value.objectId, category: 'ENERGY', unitSchema: 'kWh' });
    const facts = fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: built.value.quantity, unit: 'kWh' });
    const claim = fixtureClaim({
      claimId: 'claim.norm.v2',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: built.value.quantity,
      unit: 'kWh',
    });
    const verified = verifyProductiveClaim(
      { ...claim, canonicalMeasurement: built.value.canonicalMeasurement, contributionSchema: 2 },
      {
        height: DEV_CLOCK.height,
        blockTimeUnixSeconds: DEV_CLOCK.blockTimeUnixSeconds,
        object,
        rights: [fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller })],
        facts,
        policy: developmentIssuancePolicy(),
        knownFingerprints: new Set(),
        canonicalMeasurement: built.value.canonicalMeasurement,
        contributionSchema: 2,
      },
    );
    if (!verified.ok) {
      throw new Error(verified.code);
    }
    assert.equal(verified.contribution.schemaVersion, PRODUCTIVE_CONTRIBUTION_SCHEMA_V2);
    assert.equal(verified.contribution.fingerprintVersion, PRODUCTIVE_FINGERPRINT_V2);
    assert.equal(verified.contribution.normalizationConstitutionVersion, built.value.normalizationConstitutionVersion);
    assert.equal(verified.contribution.canonicalUnit, 'Wh');
    assert.ok(verified.contribution.canonicalMeasurement);
  });

  it('19. v1 historical fingerprint reproducible', () => {
    const first = contributionFingerprint({
      objectId: 'obj.solar.alpha',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 1_200_000n,
      baseUnitId: 'Wh',
      oracleFactIds: ['fact.a', 'fact.b'],
      upstreamContributionIds: [],
    });
    const second = contributionFingerprint({
      objectId: 'obj.solar.alpha',
      measurementPeriodEpoch: 1,
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      normalizedQuantity: 1_200_000n,
      baseUnitId: 'Wh',
      oracleFactIds: ['fact.b', 'fact.a'],
      upstreamContributionIds: [],
    });
    assert.equal(first, second);
    assert.equal(PRODUCTIVE_FINGERPRINT_V1, 'PRODUCTIVE_FINGERPRINT_V1');
  });

  it('20. v2 fingerprint deterministic', () => {
    const measurement = measure({
      sourceQuantity: qty('kWh', 5n),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
    });
    if (!measurement.ok) {
      throw new Error(measurement.error.detail);
    }
    const object = fixtureObject({ objectId: 'obj.solar.v2', category: 'ENERGY', unitSchema: 'kWh' });
    const facts = fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 5n, unit: 'kWh' });
    const claim = fixtureClaim({
      claimId: 'claim.v2.a',
      objectId: object.objectId,
      claimType: 'OUTPUT',
      category: 'ENERGY',
      quantity: 5n,
      unit: 'kWh',
    });
    const context = {
      height: DEV_CLOCK.height,
      blockTimeUnixSeconds: DEV_CLOCK.blockTimeUnixSeconds,
      object,
      rights: [fixtureRight({ rightId: object.rightsReference, objectId: object.objectId, holderId: object.controller })],
      facts,
      policy: developmentIssuancePolicy(),
      knownFingerprints: new Set<string>(),
      canonicalMeasurement: measurement.value,
      contributionSchema: 2 as const,
    };
    const left = verifyProductiveClaim({ ...claim, canonicalMeasurement: measurement.value, contributionSchema: 2 }, context);
    const right = verifyProductiveClaim({ ...claim, claimId: 'claim.v2.b', canonicalMeasurement: measurement.value, contributionSchema: 2 }, context);
    assert.equal(left.ok && right.ok, true);
    if (left.ok && right.ok) {
      assert.equal(left.contribution.fingerprint, right.contribution.fingerprint);
      assert.equal(left.contribution.fingerprintVersion, PRODUCTIVE_FINGERPRINT_V2);
    }
  });

  it('21. new contributions do not use legacy NPU unit conversion', () => {
    const measurement = measure({
      sourceQuantity: qty('kWh', 2n),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
    });
    if (!measurement.ok) {
      throw new Error(measurement.error.detail);
    }
    const physical = normalizePhysicalMeasurement(measurement.value);
    const legacy = normalizeContribution({
      category: 'ENERGY',
      sourceUnitId: 'kWh',
      sourceQuantity: 2n,
      height: 10,
      rules: developmentPolicyBundle().normalizationRules,
    });
    assert.equal(physical.ok, true);
    assert.equal(legacy.ok, true);
    if (physical.ok && legacy.ok) {
      assert.equal(physical.qualityFactorApplied, false);
      assert.equal(physical.economicCategoryFactorApplied, false);
      assert.notEqual(physical.family, 'LEGACY_NPU_V1');
      assert.ok(legacy.npu.factorsApplied.length >= 3);
    }
  });

  it('22. no quality factor applied during physical normalization', () => {
    const measurement = measure({
      sourceQuantity: qty('kWh', 1n),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
    });
    if (!measurement.ok) {
      throw new Error(measurement.error.detail);
    }
    const physical = normalizePhysicalMeasurement(measurement.value);
    assert.equal(physical.ok && physical.ok ? physical.qualityFactorApplied : true, false);
    assert.equal('qualityFactor' in measurement.value, false);
  });

  it('23. no economic category factor applied during physical normalization', () => {
    const measurement = measure({
      sourceQuantity: qty('kWh', 1n),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
    });
    if (!measurement.ok) {
      throw new Error(measurement.error.detail);
    }
    const physical = normalizePhysicalMeasurement(measurement.value);
    assert.equal(physical.ok && physical.ok ? physical.economicCategoryFactorApplied : true, false);
    const object = solarFacility();
    const facts = fixtureFacts({ objectId: object.objectId, category: 'ENERGY', quantity: 1n, unit: 'kWh' });
    const eligible = evaluateContributionEligibility({
      height: 10,
      requestedPolicyVersion: 1,
      category: 'ENERGY',
      claimType: 'OUTPUT',
      object,
      objectEligible: true,
      providerId: 'oracle.1',
      actorId: object.controller,
      sourceUnitId: 'kWh',
      sourceQuantity: 1n,
      measurementEpoch: 1,
      validFromUnixSeconds: 1_799_000_000n,
      validUntilUnixSeconds: 1_800_000_000n,
      deliveryFromUnixSeconds: 1_799_000_000n,
      deliveryUntilUnixSeconds: 1_800_000_000n,
      oracleFacts: facts,
      referenceFacts: [],
      claimLineage: [],
      knownGovernedFingerprints: new Set(),
      knownCrossCategoryEvents: new Set(),
      knownCapacityOutputEvents: new Map(),
      budgetUsage: emptyBudgetUsage(),
      issuancePolicy: developmentIssuancePolicy(),
      bundle: developmentPolicyBundle(),
      canonicalMeasurement: measurement.value,
      normalizationFamily: 'CANONICAL_MEASUREMENT_V2',
    });
    assert.equal(eligible.ok, true);
    if (eligible.ok && physical.ok) {
      assert.equal(eligible.issuanceBasis, physical.quantity);
    }
  });

  it('24. no MoonRey quantity produced by normalization', () => {
    const measurement = measure({
      sourceQuantity: qty('kWh', 8n),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
    });
    if (!measurement.ok) {
      throw new Error(measurement.error.detail);
    }
    const physical = normalizePhysicalMeasurement(measurement.value);
    assert.equal(physical.ok && physical.ok ? physical.moonreyQuantity : 1n, null);
    assert.equal(NORMALIZATION_AUTHORIZES_MOONREY, false);
    assert.equal('moonreyQuantity' in measurement.value, false);
  });

  it('25. no float math', () => {
    assert.equal(PHYSICAL_NORMALIZATION_INCLUDES_ECONOMIC_WEIGHTING, false);
    const root = join(import.meta.dirname, 'units');
    const files = readdirSync(root).filter((name) => name.endsWith('.ts'));
    for (const name of files) {
      const source = readFileSync(join(root, name), 'utf8');
      assert.equal(/parseFloat\s*\(/.test(source), false, name);
      assert.equal(/Math\.(floor|round|ceil|pow|fround)/.test(source), false, name);
      assert.equal(/\/\s*3600(?!n)/.test(source), false, name);
      assert.equal(/\*\s*1\.0/.test(source), false, name);
    }
  });

  it('26. no silent truncation', () => {
    const second = defaultCanonicalUnitRegistry.convert(qty('gpu_s', 1n), 'GPU_HOUR', undefined, clock);
    assert.equal(second.ok, true);
    if (second.ok) {
      const rational = quantityRational(second.value.targetQuantity);
      assert.equal(rational.numerator, 1n);
      assert.equal(rational.denominator, 3_600n);
      assert.equal(integerMantissaOf(second.value.targetQuantity).ok, false);
    }
    const substituted = measure({
      sourceQuantity: qty('kWh', 3n),
      productiveCategory: 'ENERGY',
      factType: 'ENERGY_PRODUCTION',
      claimType: 'OUTPUT',
      substitutedCanonicalQuantity: qty('Wh', 1n),
    });
    assert.equal(substituted.ok, false);
    if (!substituted.ok) {
      assert.equal(substituted.error.code, 'NORMALIZATION_RECEIPT_REQUIRED');
    }
    assert.equal(CANONICAL_UNIT_AUTHORITY, 'packages/sunrey-chain/src/units');
    assert.equal(defaultUnitRegistry.isIndependentSemanticAuthority(), false);
    const registry = new EconomicAssetRegistry();
    const built = buildProductiveClaimCandidate(energyBuildInput());
    assert.equal(built.ok, true);
    if (built.ok) {
      const lineage = recordCompatibilityLineage(registry, built.value);
      assert.ok(lineage?.normalizationReceiptId);
    }
    void pathBuildInput;
    void fixtureVerifiedFact;
  });
});
