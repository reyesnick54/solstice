import { validateSourceFactClaimMapping } from '../../source-taxonomy/validator.ts';
import type { CertificationSubject, TaxonomyConformanceResult } from './types.ts';

export function evaluateTaxonomyConformance(subject: CertificationSubject): TaxonomyConformanceResult {
  const validated = validateSourceFactClaimMapping({
    sourceCategory: subject.sourceCategory,
    factType: subject.factType,
    sourceUnit: subject.unit,
    productiveCategory: subject.productiveCategory,
    claimType: subject.claimType,
    mappingVersion: subject.mappingVersion,
  });
  if (!validated.ok) {
    return Object.freeze({
      verdict: 'FAIL',
      mappingId: null,
      mappingVersion: null,
      compatible: false,
      details: Object.freeze([`${validated.error.code}: ${validated.error.detail}`]),
    });
  }
  return Object.freeze({
    verdict: 'PASS',
    mappingId: validated.value.mapping.mappingId,
    mappingVersion: validated.value.mapping.mappingVersion,
    compatible: true,
    details: Object.freeze([
      `compatible ${subject.sourceCategory} → ${subject.factType} → ${validated.value.mapping.productiveCategory ?? 'null'}`,
    ]),
  });
}
