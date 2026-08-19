import { CanonicalUnitRegistry } from '../../../units/registry.ts';
import { measureSourceObservation } from '../../../units/pipeline.ts';
import type { ResourceClass } from '../../../units/constitution.ts';
import type { CertificationSubject, UnitConformanceResult } from './types.ts';

const registry = new CanonicalUnitRegistry();

export function evaluateUnitConformance(subject: CertificationSubject): UnitConformanceResult {
  const details: string[] = [];
  const observation = subject.observations[0];
  const unit = observation?.unit ?? subject.unit;
  const definition = registry.definitionOf(unit);
  const unitKnown = definition !== undefined;
  if (!unitKnown) {
    details.push(`unknown source unit ${unit}`);
  }

  let dimensionCompatible = unitKnown;
  let contextSatisfied = true;
  let semanticsUnambiguous = true;
  let canonicalNormalizationOk = false;

  if (definition) {
    if (
      subject.productiveCategory &&
      definition.allowedProductiveCategories.length > 0 &&
      !definition.allowedProductiveCategories.includes(subject.productiveCategory)
    ) {
      dimensionCompatible = false;
      details.push(
        `unit ${unit} dimension ${definition.dimension} is incompatible with ${subject.productiveCategory}`,
      );
    }
    if (definition.allowedFactTypes.length > 0 && !definition.allowedFactTypes.includes(subject.factType)) {
      dimensionCompatible = false;
      details.push(`unit ${unit} is not allowed for fact type ${subject.factType}`);
    }
    if (definition.requiresContext) {
      const extras = observation?.extras ?? {};
      const resourceClass = extras.resourceClass;
      const missing = definition.contextRequirements.filter((requirement) => {
        if (requirement === 'RESOURCE_CLASS') {
          return resourceClass !== 'CPU' && resourceClass !== 'GPU';
        }
        if (requirement === 'DURATION') {
          return extras.durationSeconds === undefined && extras.measurementStart === undefined;
        }
        return extras[requirement] === undefined;
      });
      if (missing.length > 0) {
        contextSatisfied = false;
        semanticsUnambiguous = false;
        details.push(`unit ${unit} requires missing context: ${missing.join(',')}`);
      }
    }
    if (unit === 'compute_s' && (observation?.extras?.resourceClass === undefined)) {
      contextSatisfied = false;
      semanticsUnambiguous = false;
      details.push('generic compute_s must declare CPU/GPU/resource context');
    }

    if (observation && subject.productiveCategory) {
      const measured = measureSourceObservation({
        sourceUnit: unit,
        sourceMantissa: safeMantissa(observation.numericValue),
        sourceScale: 0,
        productiveCategory: subject.productiveCategory,
        factType: subject.factType,
        claimType: subject.claimType,
        resourceClass: observation.extras?.resourceClass as ResourceClass | undefined,
        durationSeconds:
          typeof observation.extras?.durationSeconds === 'string' ||
          typeof observation.extras?.durationSeconds === 'number' ||
          typeof observation.extras?.durationSeconds === 'bigint'
            ? BigInt(observation.extras.durationSeconds as string | number | bigint)
            : undefined,
        mappingVersion: subject.mappingVersion,
      });
      canonicalNormalizationOk = measured.ok;
      if (!measured.ok) {
        details.push(`${measured.error.code}: ${measured.error.detail}`);
        if (measured.error.code === 'NORMALIZATION_CONTEXT_REQUIRED') {
          contextSatisfied = false;
        }
        if (
          measured.error.code === 'NORMALIZATION_DIMENSION_MISMATCH' ||
          measured.error.code === 'FACT_UNIT_MISMATCH' ||
          measured.error.code === 'CLAIM_UNIT_MISMATCH'
        ) {
          dimensionCompatible = false;
        }
        if (measured.error.code === 'NORMALIZATION_SEMANTIC_MISMATCH') {
          semanticsUnambiguous = false;
        }
      }
    } else if (unitKnown && contextSatisfied && dimensionCompatible) {
      canonicalNormalizationOk = observation !== undefined && !observation.numericValue.includes('.');
    }
  }

  const verdict: UnitConformanceResult['verdict'] =
    unitKnown && dimensionCompatible && contextSatisfied && semanticsUnambiguous && canonicalNormalizationOk
      ? 'PASS'
      : 'FAIL';

  return Object.freeze({
    verdict,
    unitKnown,
    dimensionCompatible,
    contextSatisfied,
    semanticsUnambiguous,
    canonicalNormalizationOk,
    details: Object.freeze(details),
  });
}

function safeMantissa(value: string): bigint {
  if (!/^-?\d+$/.test(value)) {
    return 0n;
  }
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}
