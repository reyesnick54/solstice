import type { AlternativeDataAlt14Phase, AlternativeDataAlt14Role } from './types.ts';

export const DEFAULT_ALTERNATIVE_DATA_ALT14_PIPELINE: readonly AlternativeDataAlt14Phase[] = Object.freeze([
  'LABOR_AND_DIGITAL',
  'PRODUCT_AND_PRICING',
  'PHYSICAL_AND_LOGISTICS',
  'INNOVATION_AND_SUPPLY',
  'ADVERSARIAL_REVIEW',
  'SYNTHESIS',
]);

export function rolesForAlt14Phase(phase: AlternativeDataAlt14Phase): readonly AlternativeDataAlt14Role[] {
  switch (phase) {
    case 'LABOR_AND_DIGITAL':
      return Object.freeze(['WORKFORCE_INTELLIGENCE', 'DIGITAL_DEMAND']);
    case 'PRODUCT_AND_PRICING':
      return Object.freeze(['PRODUCT_DEMAND']);
    case 'PHYSICAL_AND_LOGISTICS':
      return Object.freeze(['LOGISTICS', 'GEOSPATIAL']);
    case 'INNOVATION_AND_SUPPLY':
      return Object.freeze(['INNOVATION', 'PROCUREMENT', 'SUPPLY_CHAIN']);
    case 'ADVERSARIAL_REVIEW':
      return Object.freeze(['ALTERNATIVE_DATA_SKEPTIC']);
    case 'SYNTHESIS':
      return Object.freeze(['ALTERNATIVE_DATA_SYNTHESIS']);
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function defaultAlternativeDataAlt14Roles(): readonly AlternativeDataAlt14Role[] {
  return Object.freeze(DEFAULT_ALTERNATIVE_DATA_ALT14_PIPELINE.flatMap((phase) => [...rolesForAlt14Phase(phase)]));
}
