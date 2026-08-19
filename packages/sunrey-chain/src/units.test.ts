import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { UNIT_CODES } from './oracle/types.ts';
import { defaultUnitRegistry } from './productive/units.ts';
import {
  CANONICAL_UNIT_REGISTRY_ID,
  FAKE_UNIVERSAL_UNIT,
  FLOAT_MATH_USED,
  LOSSY_CONVERSION_ALLOWED,
  NORMALIZATION_CONSTITUTION_VERSION,
  PRODUCTION_ACTIVE,
  TOKEN_INFERENCE_QUALIFIER,
  defaultCanonicalUnitRegistry,
  integerMantissaOf,
  quantitiesEqual,
  quantityRational,
} from './units/index.ts';

const registry = defaultCanonicalUnitRegistry;
const clock = { nowIso: () => '2026-08-19T00:00:00.000Z' };

function qty(unitId: string, mantissa: bigint) {
  const built = registry.integer(unitId, mantissa);
  assert.equal(built.ok, true);
  if (!built.ok) {
    throw new Error(built.error.detail);
  }
  return built.value;
}

function accept(unitId: string, mantissa: bigint, target: string, context?: Parameters<typeof registry.convert>[2]) {
  const result = registry.convert(qty(unitId, mantissa), target, context, clock);
  assert.equal(result.ok, true, result.ok ? '' : `${result.error.outcome} ${result.error.detail}`);
  if (!result.ok) {
    throw new Error(result.error.detail);
  }
  assert.equal(result.value.exact, true);
  assert.equal(result.value.roundingApplied, false);
  assert.equal(result.value.lossy, false);
  assert.equal(result.value.conversionVersion, NORMALIZATION_CONSTITUTION_VERSION);
  return result.value;
}

function refuse(unitId: string, mantissa: bigint, target: string, context?: Parameters<typeof registry.convert>[2]) {
  const result = registry.convert(qty(unitId, mantissa), target, context, clock);
  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error('expected refusal');
  }
  return result.error;
}

describe('CHUNK-118 canonical economic unit normalization', () => {
  it('1. normalizes Wh/kWh/MWh exactly, including large quantities', () => {
    const kwh = accept('kWh', 3n, 'Wh');
    assert.equal(integerMantissaOf(kwh.targetQuantity).ok && integerMantissaOf(kwh.targetQuantity).ok, true);
    assert.equal(integerMantissaOf(kwh.targetQuantity).ok ? integerMantissaOf(kwh.targetQuantity).value : 0n, 3_000n);
    const mwh = accept('MWh', 2n, 'kWh');
    assert.equal(integerMantissaOf(mwh.targetQuantity).ok ? integerMantissaOf(mwh.targetQuantity).value : 0n, 2_000n);
    const large = accept('kWh', 10n ** 18n, 'Wh');
    assert.equal(integerMantissaOf(large.targetQuantity).ok ? integerMantissaOf(large.targetQuantity).value : 0n, 10n ** 21n);
  });

  it('2. normalizes kg/tonne/t into canonical grams', () => {
    const tonne = accept('tonne', 2n, 'g');
    assert.equal(integerMantissaOf(tonne.targetQuantity).ok ? integerMantissaOf(tonne.targetQuantity).value : 0n, 2_000_000n);
    const alias = accept('t', 1n, 'kg');
    assert.equal(integerMantissaOf(alias.targetQuantity).ok ? integerMantissaOf(alias.targetQuantity).value : 0n, 1_000n);
    const kg = accept('kg', 4n, 'g');
    assert.equal(integerMantissaOf(kg.targetQuantity).ok ? integerMantissaOf(kg.targetQuantity).value : 0n, 4_000n);
  });

  it('3. normalizes L/m3 exactly without inventing volume-time', () => {
    const volume = accept('m3', 3n, 'L');
    assert.equal(integerMantissaOf(volume.targetQuantity).ok ? integerMantissaOf(volume.targetQuantity).value : 0n, 3_000n);
    const refusal = refuse('m3', 3n, 'm3_hour');
    assert.equal(refusal.outcome, 'REQUIRE_CONTEXT');
  });

  it('4. treats tonne_km and t_km as equivalent mass-distance', () => {
    const receipt = accept('tonne_km', 11n, 't_km');
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 11n);
    assert.equal(refuse('tonne', 11n, 't_km').outcome, 'INCOMPATIBLE_DIMENSION');
  });

  it('5. aliases units_produced to UNIT for item-count/output facts', () => {
    const receipt = accept('units_produced', 9n, 'UNIT', { factType: 'MANUFACTURING_OUTPUT' });
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 9n);
    assert.equal(receipt.conversionRuleId, 'item-count.alias.v1');
    assert.equal(refuse('units_produced', 9n, 'UNIT', { factType: 'ENERGY_PRODUCTION' }).outcome, 'INCOMPATIBLE_DIMENSION');
  });

  it('6. converts gpu_s to GPU time exactly without requiring a 3600 multiple', () => {
    const hour = accept('gpu_s', 3_600n, 'GPU_HOUR');
    assert.equal(integerMantissaOf(hour.targetQuantity).ok ? integerMantissaOf(hour.targetQuantity).value : 0n, 1n);
    const second = accept('gpu_s', 1n, 'GPU_HOUR');
    const rational = quantityRational(second.targetQuantity);
    assert.equal(rational.numerator, 1n);
    assert.equal(rational.denominator, 3_600n);
    assert.equal(integerMantissaOf(second.targetQuantity).ok, false);
  });

  it('7. rejects generic compute_s without resource classification', () => {
    const refusal = refuse('compute_s', 3_600n, 'GPU_HOUR');
    assert.equal(refusal.outcome, 'REQUIRE_CONTEXT');
    assert.deepEqual(refusal.missingContext, ['RESOURCE_CLASS']);
  });

  it('8. classifies compute_s as CPU time when resourceClass is CPU', () => {
    const receipt = accept('compute_s', 7_200n, 'CPU_HOUR', { resourceClass: 'CPU' });
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 2n);
    assert.equal(receipt.dimension, 'CPU_TIME');
    assert.equal(refuse('compute_s', 7_200n, 'GPU_HOUR', { resourceClass: 'CPU' }).outcome, 'INCOMPATIBLE_DIMENSION');
  });

  it('9. classifies compute_s as GPU time when resourceClass is GPU', () => {
    const receipt = accept('compute_s', 1_800n, 'GPU_HOUR', { resourceClass: 'GPU', resourceCount: 2n });
    const rational = quantityRational(receipt.targetQuantity);
    assert.equal(rational.numerator, 1n);
    assert.equal(rational.denominator, 1n);
    assert.equal(receipt.dimension, 'GPU_TIME');
  });

  it('10. rejects m2 → m2_hour without duration', () => {
    assert.equal(refuse('m2', 5n, 'm2_hour').outcome, 'REQUIRE_CONTEXT');
  });

  it('11. converts area × duration into area-time when a period is supplied', () => {
    const receipt = accept('m2', 2n, 'm2_hour', { durationSeconds: 3_600n });
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 2n);
    const windowed = accept('m2', 1n, 'm2_hour', { measurementStart: 10n, measurementEnd: 1_810n });
    const rational = quantityRational(windowed.targetQuantity);
    assert.equal(rational.numerator, 1n);
    assert.equal(rational.denominator, 2n);
  });

  it('12. rejects m3 → m3_hour without duration', () => {
    assert.equal(refuse('m3', 1n, 'm3_hour').outcome, 'REQUIRE_CONTEXT');
  });

  it('13. converts volume × duration into volume-time when a period is supplied', () => {
    const receipt = accept('m3', 1n, 'm3_hour', { durationSeconds: 3_600n });
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 1n);
    const litres = accept('L', 500n, 'm3_hour', { durationSeconds: 3_600n });
    const rational = quantityRational(litres.targetQuantity);
    assert.equal(rational.numerator, 1n);
    assert.equal(rational.denominator, 2n);
  });

  it('14. normalizes GB/TB on the decimal data-volume scale', () => {
    const receipt = accept('TB', 3n, 'GB');
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 3_000n);
    const bytes = accept('GB', 1n, 'B');
    assert.equal(integerMantissaOf(bytes.targetQuantity).ok ? integerMantissaOf(bytes.targetQuantity).value : 0n, 1_000_000_000n);
  });

  it('15. rejects GB_s → GB without duration', () => {
    assert.equal(refuse('GB_s', 2n, 'GB').outcome, 'REQUIRE_CONTEXT');
  });

  it('16. converts data-rate × duration into transferred volume', () => {
    const receipt = accept('GB_s', 2n, 'GB', { durationSeconds: 5n });
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 10n);
  });

  it('17. rejects machine_h → UNIT', () => {
    const refusal = refuse('machine_h', 4n, 'UNIT');
    assert.equal(refusal.outcome, 'INCOMPATIBLE_DIMENSION');
  });

  it('18. rejects service_hour ↔ facility_hour', () => {
    assert.equal(refuse('service_hour', 1n, 'facility_hour').outcome, 'INCOMPATIBLE_DIMENSION');
    assert.equal(refuse('facility_hour', 1n, 'service_hour').outcome, 'INCOMPATIBLE_DIMENSION');
    assert.equal(refuse('service_hour', 1n, 'm3_hour').outcome, 'INCOMPATIBLE_DIMENSION');
  });

  it('19. validates token_inference ↔ TOKEN as processed inference tokens', () => {
    const receipt = accept('token_inference', 42n, 'TOKEN');
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok ? integerMantissaOf(receipt.targetQuantity).value : 0n, 42n);
    assert.equal(receipt.conversionRuleId, 'token.inference.alias.v1');
    assert.equal(registry.definitionOf('token_inference')?.semanticQualifier, TOKEN_INFERENCE_QUALIFIER);
    assert.equal(refuse('token_inference', 42n, 'TOKEN', { semanticQualifier: 'TRAINING_TOKENS' }).outcome, 'INCOMPATIBLE_DIMENSION');
    assert.equal(
      refuse('token_inference', 42n, 'TOKEN', { semanticQualifier: 'INFERENCE_GENERATED_TOKENS' }).outcome,
      'INCOMPATIBLE_DIMENSION',
    );
  });

  it('20. rejects incompatible dimensions', () => {
    assert.equal(refuse('Wh', 1n, 'kg').outcome, 'INCOMPATIBLE_DIMENSION');
    assert.equal(refuse('GB', 1n, 'GB_s').outcome, 'INCOMPATIBLE_DIMENSION');
  });

  it('21. rejects unknown units', () => {
    const unknown = registry.convert(qty('Wh', 1n), 'furlong', undefined, clock);
    assert.equal(unknown.ok, false);
    if (!unknown.ok) {
      assert.equal(unknown.error.outcome, 'UNKNOWN_UNIT');
    }
    const source = registry.quantity('parsec', 1n);
    assert.equal(source.ok, false);
    if (!source.ok) {
      assert.equal(source.error.outcome, 'UNKNOWN_UNIT');
    }
  });

  it('22. uses no JavaScript floating-point conversion', () => {
    assert.equal(FLOAT_MATH_USED, false);
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

  it('23. does not silently truncate a GPU second to zero GPU hours', () => {
    const receipt = accept('gpu_s', 1n, 'GPU_HOUR');
    const rational = quantityRational(receipt.targetQuantity);
    assert.equal(rational.numerator === 0n, false);
    assert.equal(integerMantissaOf(receipt.targetQuantity).ok, false);
    if (!integerMantissaOf(receipt.targetQuantity).ok) {
      assert.equal(integerMantissaOf(receipt.targetQuantity).error.outcome, 'LOSSY_CONVERSION_FORBIDDEN');
    }
  });

  it('24. issues a deterministic normalization receipt', () => {
    const first = accept('kWh', 5n, 'Wh');
    const second = accept('kWh', 5n, 'Wh');
    assert.equal(first.receiptId, second.receiptId);
    assert.equal(first.receiptId.startsWith('nrc_'), true);
    assert.equal(quantitiesEqual(first.targetQuantity, second.targetQuantity), true);
  });

  it('25. retains the normalization constitution version on every receipt', () => {
    const receipt = accept('tonne_km', 1n, 't_km');
    assert.equal(receipt.conversionVersion, NORMALIZATION_CONSTITUTION_VERSION);
    assert.equal(registry.constitutionVersion, NORMALIZATION_CONSTITUTION_VERSION);
    assert.equal(registry.registryId, CANONICAL_UNIT_REGISTRY_ID);
  });

  it('26. reproduces a historical receipt under the retained version', () => {
    const original = accept('MWh', 4n, 'Wh');
    const replayed = registry.reproduce(original, clock);
    assert.equal(replayed.ok, true);
    if (!replayed.ok) {
      throw new Error(replayed.error.detail);
    }
    assert.equal(replayed.value.receiptId, original.receiptId);
    assert.equal(quantitiesEqual(replayed.value.targetQuantity, original.targetQuantity), true);
    const foreign = registry.reproduce({ ...original, conversionVersion: 'sunrey.economic-unit.normalization.v0' as typeof original.conversionVersion });
    assert.equal(foreign.ok, false);
  });

  it('keeps REFERENCE_PRICE out of the physical unit lattice', () => {
    const refusal = refuse('units_produced', 1n, 'UNIT', { factType: 'REFERENCE_PRICE' });
    assert.equal(refusal.outcome, 'INCOMPATIBLE_DIMENSION');
  });

  it('does not create a second unit authority or rewrite productive/oracle facades', () => {
    assert.equal(defaultUnitRegistry.isAllowed('ENERGY', 'kWh'), true);
    assert.equal(UNIT_CODES.includes('gpu_s'), true);
    assert.equal(LOSSY_CONVERSION_ALLOWED, false);
    assert.equal(FAKE_UNIVERSAL_UNIT, false);
    assert.equal(PRODUCTION_ACTIVE, false);
  });
});
