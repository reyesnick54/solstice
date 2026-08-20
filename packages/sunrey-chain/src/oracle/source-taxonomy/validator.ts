import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { isFactType, isUnitCode } from '../types.ts';
import { isDataSourceCategory } from '../production/types.ts';
import { isClaimType, isProductiveCategory, PRODUCTIVE_CATEGORIES } from '../../productive/types.ts';
import { activeMappings, CANONICAL_SOURCE_TAXONOMY, mappingById } from './registry.ts';
import {
  mappingRejection,
  type AttributionState,
  type CompatibleMapping,
  type MappingValidationInput,
  type SourceClaimCompatibilityRejection,
  type SourceProductiveMapping,
  type SourceTaxonomyRegistry,
} from './types.ts';

export type MappingValidationResult = Result<CompatibleMapping, SourceClaimCompatibilityRejection>;

function attributionStateOf(mapping: SourceProductiveMapping): AttributionState {
  return mapping.requiresAttributionPolicy ? 'ATTRIBUTION_REVIEW_REQUIRED' : 'NOT_REQUIRED';
}

function compatible(mapping: SourceProductiveMapping): CompatibleMapping {
  return Object.freeze({
    status: 'COMPATIBLE',
    mapping,
    attributionState: attributionStateOf(mapping),
  });
}

export function validateSourceFactClaimMapping(
  input: MappingValidationInput,
  registry: SourceTaxonomyRegistry = CANONICAL_SOURCE_TAXONOMY,
): MappingValidationResult {
  if (input.mappingId) {
    const pinned = mappingById(input.mappingId, input.mappingVersion, registry);
    if (!pinned) {
      if (input.mappingVersion !== undefined && input.mappingVersion !== null) {
        const anyVersion = mappingById(input.mappingId, null, registry);
        if (anyVersion) {
          return err(
            mappingRejection(
              'MAPPING_VERSION_MISMATCH',
              `mapping ${input.mappingId} has no version ${input.mappingVersion}`,
            ),
          );
        }
      }
      return err(mappingRejection('MAPPING_VERSION_MISMATCH', `unknown mapping ${input.mappingId}`));
    }
    if (input.mappingVersion !== undefined && input.mappingVersion !== null && pinned.mappingVersion !== input.mappingVersion) {
      return err(
        mappingRejection(
          'MAPPING_VERSION_MISMATCH',
          `requested version ${input.mappingVersion} does not match ${pinned.mappingVersion}`,
        ),
      );
    }
    if (pinned.status === 'SUPERSEDED') {
      return err(
        mappingRejection(
          'MAPPING_SUPERSEDED',
          `mapping ${pinned.mappingId}@${pinned.mappingVersion} is superseded by ${pinned.supersededBy ?? 'a later version'}`,
        ),
      );
    }
    if (pinned.status === 'RETIRED') {
      return err(mappingRejection('SOURCE_CATEGORY_RETIRED', `mapping ${pinned.mappingId} is retired`));
    }
    return validateAgainstMapping(input, pinned, registry);
  }

  if (!isDataSourceCategory(input.sourceCategory)) {
    return err(mappingRejection('SOURCE_CATEGORY_UNKNOWN', `unknown source category ${input.sourceCategory}`));
  }
  if (registry.sourceCategoryStatus[input.sourceCategory] === 'RETIRED') {
    return err(mappingRejection('SOURCE_CATEGORY_RETIRED', `source category ${input.sourceCategory} is retired`));
  }
  if (!isFactType(input.factType)) {
    return err(
      mappingRejection('FACT_NOT_ALLOWED_FOR_SOURCE', `unknown fact type ${input.factType} is not allowed for ${input.sourceCategory}`),
    );
  }
  if (!isUnitCode(input.sourceUnit)) {
    return err(mappingRejection('SOURCE_UNIT_NOT_ALLOWED', `unknown source unit ${input.sourceUnit}`));
  }

  const sourceFacts = activeMappings(registry).filter(
    (row) => row.sourceCategory === input.sourceCategory && row.factType === input.factType,
  );
  if (sourceFacts.length === 0) {
    return err(
      mappingRejection(
        'FACT_NOT_ALLOWED_FOR_SOURCE',
        `fact ${input.factType} is not allowed for source category ${input.sourceCategory}`,
      ),
    );
  }

  const claimRequested = input.claimType !== undefined && input.claimType !== null && input.claimType.length > 0;
  const categoryRequested =
    input.productiveCategory !== undefined && input.productiveCategory !== null && input.productiveCategory.length > 0;

  if (sourceFacts.every((row) => row.referenceDataOnly)) {
    if (claimRequested || (categoryRequested && sourceFacts.every((row) => row.productiveCategory === null))) {
      return err(
        mappingRejection(
          'REFERENCE_DATA_CANNOT_CREATE_CLAIM',
          `reference data from ${input.sourceCategory}/${input.factType} cannot create a productive claim`,
        ),
      );
    }
    const unitOk = sourceFacts.find((row) => row.allowedSourceUnits.includes(input.sourceUnit as never));
    if (!unitOk) {
      return err(
        mappingRejection(
          'SOURCE_UNIT_NOT_ALLOWED',
          `unit ${input.sourceUnit} is not allowed for ${input.sourceCategory}/${input.factType}`,
        ),
      );
    }
    return ok(compatible(unitOk));
  }

  if (categoryRequested && !isProductiveCategory(input.productiveCategory!)) {
    return err(
      mappingRejection(
        'PRODUCTIVE_CATEGORY_UNMAPPED',
        `unknown productive category ${input.productiveCategory}`,
      ),
    );
  }
  if (categoryRequested && !productiveCategoryHasMapping(input.productiveCategory!, registry)) {
    return err(
      mappingRejection(
        'PRODUCTIVE_CATEGORY_UNMAPPED',
        `productive category ${input.productiveCategory} has no source mapping`,
      ),
    );
  }

  let candidates = sourceFacts.filter((row) => row.allowedSourceUnits.includes(input.sourceUnit as never));
  if (candidates.length === 0) {
    return err(
      mappingRejection(
        'SOURCE_UNIT_NOT_ALLOWED',
        `unit ${input.sourceUnit} is not allowed for ${input.sourceCategory}/${input.factType}`,
      ),
    );
  }

  if (categoryRequested) {
    const forCategory = candidates.filter((row) => row.productiveCategory === input.productiveCategory);
    if (forCategory.length === 0) {
      return err(
        mappingRejection(
          'FACT_NOT_ALLOWED_FOR_PRODUCTIVE_CATEGORY',
          `fact ${input.factType} cannot support productive category ${input.productiveCategory}`,
        ),
      );
    }
    candidates = forCategory;
  }

  if (claimRequested) {
    if (!isClaimType(input.claimType!)) {
      return err(mappingRejection('CLAIM_TYPE_NOT_ALLOWED', `unknown claim type ${input.claimType}`));
    }
    const forClaim = candidates.filter((row) => row.allowedClaimTypes.includes(input.claimType as never));
    if (forClaim.length === 0) {
      if (candidates.some((row) => row.referenceDataOnly)) {
        return err(
          mappingRejection(
            'REFERENCE_DATA_CANNOT_CREATE_CLAIM',
            `reference data from ${input.sourceCategory}/${input.factType} cannot create claim type ${input.claimType}`,
          ),
        );
      }
      return err(
        mappingRejection(
          'CLAIM_TYPE_NOT_ALLOWED',
          `claim type ${input.claimType} is not allowed for ${input.sourceCategory}/${input.factType}`,
        ),
      );
    }
    candidates = forClaim;
  }

  const selected = candidates[0];
  if (!selected) {
    return err(
      mappingRejection(
        'FACT_NOT_ALLOWED_FOR_SOURCE',
        `no compatible mapping for ${input.sourceCategory}/${input.factType}`,
      ),
    );
  }
  return ok(compatible(selected));
}

function validateAgainstMapping(
  input: MappingValidationInput,
  mapping: SourceProductiveMapping,
  registry: SourceTaxonomyRegistry,
): MappingValidationResult {
  if (mapping.sourceCategory !== input.sourceCategory) {
    return err(
      mappingRejection(
        'FACT_NOT_ALLOWED_FOR_SOURCE',
        `mapping ${mapping.mappingId} is for ${mapping.sourceCategory}, not ${input.sourceCategory}`,
      ),
    );
  }
  if (mapping.factType !== input.factType) {
    return err(
      mappingRejection(
        'FACT_NOT_ALLOWED_FOR_SOURCE',
        `mapping ${mapping.mappingId} is for ${mapping.factType}, not ${input.factType}`,
      ),
    );
  }
  if (!isUnitCode(input.sourceUnit) || !mapping.allowedSourceUnits.includes(input.sourceUnit)) {
    return err(
      mappingRejection(
        'SOURCE_UNIT_NOT_ALLOWED',
        `unit ${input.sourceUnit} is not allowed for mapping ${mapping.mappingId}`,
      ),
    );
  }
  if (mapping.referenceDataOnly) {
    const claimRequested = input.claimType !== undefined && input.claimType !== null && input.claimType.length > 0;
    if (claimRequested) {
      return err(
        mappingRejection(
          'REFERENCE_DATA_CANNOT_CREATE_CLAIM',
          `mapping ${mapping.mappingId} is reference data and cannot create a productive claim`,
        ),
      );
    }
    return ok(compatible(mapping));
  }
  if (
    input.productiveCategory !== undefined &&
    input.productiveCategory !== null &&
    input.productiveCategory.length > 0 &&
    mapping.productiveCategory !== input.productiveCategory
  ) {
    if (isProductiveCategory(input.productiveCategory) && !productiveCategoryHasMapping(input.productiveCategory, registry)) {
      return err(
        mappingRejection(
          'PRODUCTIVE_CATEGORY_UNMAPPED',
          `productive category ${input.productiveCategory} has no source mapping`,
        ),
      );
    }
    return err(
      mappingRejection(
        'FACT_NOT_ALLOWED_FOR_PRODUCTIVE_CATEGORY',
        `mapping ${mapping.mappingId} cannot support productive category ${input.productiveCategory}`,
      ),
    );
  }
  if (
    input.claimType !== undefined &&
    input.claimType !== null &&
    input.claimType.length > 0 &&
    !mapping.allowedClaimTypes.includes(input.claimType as never)
  ) {
    return err(
      mappingRejection(
        'CLAIM_TYPE_NOT_ALLOWED',
        `claim type ${input.claimType} is not allowed for mapping ${mapping.mappingId}`,
      ),
    );
  }
  return ok(compatible(mapping));
}

export function validateSourceRegistrationMapping(input: {
  readonly sourceCategory: string;
  readonly factType: string;
  readonly sourceUnit: string;
}): MappingValidationResult {
  return validateSourceFactClaimMapping({
    sourceCategory: input.sourceCategory,
    factType: input.factType,
    sourceUnit: input.sourceUnit,
  });
}

export function validateFeedDefinitionMapping(input: {
  readonly sourceCategory?: string | null | undefined;
  readonly factType: string;
  readonly measurementUnit: string;
}): MappingValidationResult {
  if (input.sourceCategory) {
    return validateSourceFactClaimMapping({
      sourceCategory: input.sourceCategory,
      factType: input.factType,
      sourceUnit: input.measurementUnit,
    });
  }
  const matches = activeMappings().filter(
    (row) => row.factType === input.factType && isUnitCode(input.measurementUnit) && row.allowedSourceUnits.includes(input.measurementUnit),
  );
  if (matches.length === 0) {
    if (!isFactType(input.factType)) {
      return err(mappingRejection('FACT_NOT_ALLOWED_FOR_SOURCE', `unknown fact type ${input.factType}`));
    }
    return err(
      mappingRejection(
        'SOURCE_UNIT_NOT_ALLOWED',
        `unit ${input.measurementUnit} is not allowed for fact ${input.factType}`,
      ),
    );
  }
  return ok(compatible(matches[0]!));
}

export function historicalMapping(
  mappingId: string,
  mappingVersion: number,
  registry: SourceTaxonomyRegistry = CANONICAL_SOURCE_TAXONOMY,
): SourceProductiveMapping | undefined {
  return mappingById(mappingId, mappingVersion, registry);
}

function productiveCategoryHasMapping(
  category: string,
  registry: SourceTaxonomyRegistry,
): boolean {
  if (!isProductiveCategory(category)) {
    return false;
  }
  return activeMappings(registry).some((row) => row.productiveCategory === category);
}

export function allProductiveCategoriesMapped(registry: SourceTaxonomyRegistry = CANONICAL_SOURCE_TAXONOMY): boolean {
  return PRODUCTIVE_CATEGORIES.every((category) => productiveCategoryHasMapping(category, registry));
}
