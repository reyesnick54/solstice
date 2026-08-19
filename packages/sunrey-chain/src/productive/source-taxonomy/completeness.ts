import { isFactType } from '../../oracle/types.ts';
import { isClaimType, PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../types.ts';
import { SOURCE_PRODUCTIVE_MAPPINGS } from './mapping.ts';
import {
  DATA_SOURCE_CATEGORIES,
  isDataSourceCategory,
  type DataSourceCategory,
  type SourceProductiveMapping,
  type TaxonomyCompletenessReport,
} from './types.ts';

export function productiveCategoriesWithoutSourcePath(
  mappings: readonly SourceProductiveMapping[] = SOURCE_PRODUCTIVE_MAPPINGS,
): readonly ProductiveCategory[] {
  const covered = new Set(
    mappings
      .filter((row) => row.status !== 'SUPERSEDED' && row.productiveCategory !== null)
      .map((row) => row.productiveCategory),
  );
  return PRODUCTIVE_CATEGORIES.filter((category) => !covered.has(category));
}

export function unmappedActiveSourceCategories(
  mappings: readonly SourceProductiveMapping[] = SOURCE_PRODUCTIVE_MAPPINGS,
): readonly DataSourceCategory[] {
  const covered = new Set(
    mappings.filter((row) => row.status !== 'SUPERSEDED').map((row) => row.dataSourceCategory),
  );
  return DATA_SOURCE_CATEGORIES.filter((category) => !covered.has(category));
}

export function evaluateTaxonomyCompleteness(
  mappings: readonly SourceProductiveMapping[] = SOURCE_PRODUCTIVE_MAPPINGS,
): TaxonomyCompletenessReport {
  const productiveCategoryGaps = productiveCategoriesWithoutSourcePath(mappings);
  const unmappedActiveSourceCategoriesList = unmappedActiveSourceCategories(mappings);
  return Object.freeze({
    productiveCategoryGaps,
    unmappedActiveSourceCategories: unmappedActiveSourceCategoriesList,
    gapCount: productiveCategoryGaps.length + unmappedActiveSourceCategoriesList.length,
    referencePriceCanCreateClaim: false,
    mappingAuthorizesMoonRey: false,
    productionActive: false,
  });
}

export function assertTaxonomyComplete(
  mappings: readonly SourceProductiveMapping[] = SOURCE_PRODUCTIVE_MAPPINGS,
): TaxonomyCompletenessReport {
  const report = evaluateTaxonomyCompleteness(mappings);
  if (report.gapCount > 0) {
    throw new Error(
      `MoonRey source taxonomy is incomplete: missing productive paths [${report.productiveCategoryGaps.join(', ')}] missing source categories [${report.unmappedActiveSourceCategories.join(', ')}]`,
    );
  }
  for (const mapping of mappings) {
    if (!isDataSourceCategory(mapping.dataSourceCategory)) {
      throw new Error(`unknown data source category ${mapping.dataSourceCategory}`);
    }
    if (!isFactType(mapping.factType)) {
      throw new Error(`unknown fact type ${mapping.factType}`);
    }
    for (const claim of mapping.allowedClaimTypes) {
      if (!isClaimType(claim)) {
        throw new Error(`unknown claim type ${claim} on ${mapping.mappingId}`);
      }
    }
    if (mapping.automaticIssuance !== false || mapping.mappingAuthorizesIssuance !== false) {
      throw new Error(`mapping ${mapping.mappingId} must not authorize issuance`);
    }
    if (mapping.productiveCategory === null && mapping.canCreateProductiveClaim) {
      throw new Error(`reference mapping ${mapping.mappingId} cannot create a productive claim`);
    }
  }
  return report;
}
