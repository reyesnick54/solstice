/**
 * Access category → merchant category code (MCC) mapping.
 *
 * MCC alone is not proof of provider identity. Prefer merchant-locked controls
 * where the issuer supports them.
 */

import type { AccessCategoryId } from '../domain/taxonomy.ts';

export type AccessMccMapping = {
  readonly category: AccessCategoryId;
  readonly allowedMccs: readonly string[];
  readonly blockedMccs: readonly string[];
};

export const ACCESS_CATEGORY_MCC_MAPPINGS: Readonly<Record<AccessCategoryId, AccessMccMapping>> =
  Object.freeze({
    LODGING: Object.freeze({
      category: 'LODGING',
      allowedMccs: Object.freeze(['7011', '7032', '7033', '3501', '3502', '3503']),
      blockedMccs: Object.freeze(['6011', '6012']),
    }),
    MOBILITY: Object.freeze({
      category: 'MOBILITY',
      allowedMccs: Object.freeze(['7512', '7513', '7519', '4121', '4789']),
      blockedMccs: Object.freeze(['5541', '5542']),
    }),
    TRANSPORTATION: Object.freeze({
      category: 'TRANSPORTATION',
      allowedMccs: Object.freeze(['4111', '4112', '4121', '4131', '4789']),
      blockedMccs: Object.freeze([]),
    }),
    EXPERIENCES: Object.freeze({
      category: 'EXPERIENCES',
      allowedMccs: Object.freeze(['7922', '7991', '7832', '7941', '7996', '7999']),
      blockedMccs: Object.freeze([]),
    }),
    FOOD: Object.freeze({
      category: 'FOOD',
      allowedMccs: Object.freeze(['5812', '5814', '5411', '5499']),
      blockedMccs: Object.freeze([]),
    }),
    AI_COMPUTE: Object.freeze({
      category: 'AI_COMPUTE',
      allowedMccs: Object.freeze(['7372', '5734', '4816']),
      blockedMccs: Object.freeze([]),
    }),
    ENERGY: Object.freeze({
      category: 'ENERGY',
      allowedMccs: Object.freeze(['4900', '5541', '5542']),
      blockedMccs: Object.freeze([]),
    }),
    ROBOTICS: Object.freeze({
      category: 'ROBOTICS',
      allowedMccs: Object.freeze(['7372', '7699', '8999']),
      blockedMccs: Object.freeze([]),
    }),
    OTHER: Object.freeze({
      category: 'OTHER',
      allowedMccs: Object.freeze([]),
      blockedMccs: Object.freeze([]),
    }),
  });

export function mccAllowedForCategory(category: AccessCategoryId, mcc: string): boolean {
  const mapping = ACCESS_CATEGORY_MCC_MAPPINGS[category];
  if (mapping.blockedMccs.includes(mcc)) {
    return false;
  }
  if (mapping.allowedMccs.length === 0) {
    return true;
  }
  return mapping.allowedMccs.includes(mcc);
}

export function allowedMccsForCategory(category: AccessCategoryId): readonly string[] {
  return ACCESS_CATEGORY_MCC_MAPPINGS[category].allowedMccs;
}
