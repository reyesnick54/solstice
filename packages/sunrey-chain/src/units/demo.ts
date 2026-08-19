import {
  FAKE_UNIVERSAL_UNIT,
  FLOAT_MATH_USED,
  LOSSY_CONVERSION_ALLOWED,
  PRODUCTION_ACTIVE,
  defaultCanonicalUnitRegistry,
  integerMantissaOf,
} from './index.ts';

const registry = defaultCanonicalUnitRegistry;
const clock = { nowIso: () => '2026-08-19T00:00:00.000Z' };

function must(label: string, unitId: string, mantissa: bigint) {
  const quantity = registry.integer(unitId, mantissa);
  if (!quantity.ok) {
    throw new Error(`${label}: ${quantity.error.detail}`);
  }
  return quantity.value;
}

function showAccepted(label: string, sourceUnit: string, source: bigint, targetUnit: string, context?: Parameters<typeof registry.convert>[2]) {
  const result = registry.convert(must(label, sourceUnit, source), targetUnit, context, clock);
  if (!result.ok) {
    throw new Error(`${label} expected SUCCEED_EXACTLY: ${result.error.outcome} ${result.error.detail}`);
  }
  const integer = integerMantissaOf(result.value.targetQuantity);
  const targetShown = integer.ok
    ? `${integer.value.toString()} ${result.value.targetUnit}`
    : `${result.value.targetQuantity.mantissa}/${result.value.targetQuantity.denominator}×10^-${result.value.targetQuantity.scale} ${result.value.targetUnit}`;
  console.log(
    `${label} ACCEPTED ${source.toString()} ${sourceUnit} -> ${targetShown} rule=${result.value.conversionRuleId} version=${result.value.conversionVersion} exact=${result.value.exact}`,
  );
}

function showRefused(label: string, sourceUnit: string, source: bigint, targetUnit: string, context?: Parameters<typeof registry.convert>[2]) {
  const result = registry.convert(must(label, sourceUnit, source), targetUnit, context, clock);
  if (result.ok) {
    throw new Error(`${label} expected refusal`);
  }
  console.log(`${label} REFUSED ${source.toString()} ${sourceUnit} -> ${targetUnit} outcome=${result.error.outcome}`);
}

console.log('SunRey canonical economic unit normalization demo');
console.log(`constitution=${registry.constitutionVersion}`);
console.log(`registry=${registry.registryId}`);

showAccepted('energy', 'kWh', 3n, 'Wh');
showAccepted('mass', 'tonne', 2n, 'g');
showAccepted('gpu', 'gpu_s', 7_200n, 'GPU_HOUR');
showAccepted('logistics', 'tonne_km', 15n, 't_km');

showRefused('area_without_duration', 'm2', 10n, 'm2_hour');
showRefused('rate_without_duration', 'GB_s', 4n, 'GB');
showRefused('machine_to_output', 'machine_h', 8n, 'UNIT');
showRefused('compute_without_class', 'compute_s', 3_600n, 'GPU_HOUR');

console.log(`FLOAT_MATH_USED=${String(FLOAT_MATH_USED)}`);
console.log(`LOSSY_CONVERSION_ALLOWED=${String(LOSSY_CONVERSION_ALLOWED)}`);
console.log(`FAKE_UNIVERSAL_UNIT=${String(FAKE_UNIVERSAL_UNIT)}`);
console.log(`PRODUCTION_ACTIVE=${String(PRODUCTION_ACTIVE)}`);
console.log('demo ok — constitution only; no MoonRey issuance; no live providers');
