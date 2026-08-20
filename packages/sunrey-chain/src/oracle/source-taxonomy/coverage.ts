import { FACT_TYPES, type FactType } from '../types.ts';
import { DATA_SOURCE_CATEGORIES, type DataSourceCategory } from '../production/types.ts';
import { PRODUCTIVE_CATEGORIES, type ClaimType, type ProductiveCategory } from '../../productive/types.ts';
import { activeMappings, CANONICAL_SOURCE_TAXONOMY } from './registry.ts';
import type { SourceProductiveMapping, SourceTaxonomyRegistry } from './types.ts';

export type ProductiveCategoryCoverage = {
  readonly productiveCategory: ProductiveCategory;
  readonly sourceCategories: readonly DataSourceCategory[];
  readonly factTypes: readonly FactType[];
  readonly units: readonly string[];
  readonly claimTypes: readonly ClaimType[];
  readonly mappingStatus: 'MAPPED';
  readonly attributionRequired: boolean;
  readonly overlapRisk: boolean;
};

export type MoonReySourceCoverageReport = {
  readonly taxonomyId: string;
  readonly coveragePercent: number;
  readonly categories: readonly ProductiveCategoryCoverage[];
  readonly unmappedProductiveCategories: readonly ProductiveCategory[];
  readonly unmappedFactTypes: readonly FactType[];
  readonly invalidMappings: readonly string[];
  readonly referenceOnlyMappings: readonly string[];
  readonly overlapRiskMappings: readonly string[];
};

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

function coverageFor(
  category: ProductiveCategory,
  mappings: readonly SourceProductiveMapping[],
): ProductiveCategoryCoverage | null {
  const rows = mappings.filter((row) => row.productiveCategory === category);
  if (rows.length === 0) {
    return null;
  }
  return Object.freeze({
    productiveCategory: category,
    sourceCategories: unique(rows.map((row) => row.sourceCategory)),
    factTypes: unique(rows.map((row) => row.factType)),
    units: unique(rows.flatMap((row) => row.allowedSourceUnits)),
    claimTypes: unique(rows.flatMap((row) => row.allowedClaimTypes)),
    mappingStatus: 'MAPPED',
    attributionRequired: rows.some((row) => row.requiresAttributionPolicy),
    overlapRisk: rows.some((row) => row.overlapRisk),
  });
}

export function moonreySourceCoverageReport(
  registry: SourceTaxonomyRegistry = CANONICAL_SOURCE_TAXONOMY,
): MoonReySourceCoverageReport {
  const active = activeMappings(registry);
  const categories = PRODUCTIVE_CATEGORIES.map((category) => coverageFor(category, active)).filter(
    (row): row is ProductiveCategoryCoverage => row !== null,
  );
  const mapped = new Set(categories.map((row) => row.productiveCategory));
  const unmappedProductiveCategories = PRODUCTIVE_CATEGORIES.filter((category) => !mapped.has(category));
  const mappedFacts = new Set(active.map((row) => row.factType));
  const unmappedFactTypes = FACT_TYPES.filter((factType) => !mappedFacts.has(factType));
  const invalidMappings = registry.mappings
    .filter((row) => {
      if (!DATA_SOURCE_CATEGORIES.includes(row.sourceCategory)) {
        return true;
      }
      if (row.referenceDataOnly) {
        return row.productiveCategory !== null || row.allowedClaimTypes.length > 0;
      }
      return row.productiveCategory === null || row.allowedClaimTypes.length === 0 || row.allowedSourceUnits.length === 0;
    })
    .map((row) => `${row.mappingId}@${row.mappingVersion}`);

  const categoryCount: number = PRODUCTIVE_CATEGORIES.length;
  const coveragePercent =
    categoryCount === 0
      ? 0
      : Math.floor(((categoryCount - unmappedProductiveCategories.length) * 100) / categoryCount);

  return Object.freeze({
    taxonomyId: registry.taxonomyId,
    coveragePercent,
    categories: Object.freeze(categories),
    unmappedProductiveCategories: Object.freeze(unmappedProductiveCategories),
    unmappedFactTypes: Object.freeze(unmappedFactTypes),
    invalidMappings: Object.freeze(invalidMappings),
    referenceOnlyMappings: Object.freeze(
      active.filter((row) => row.referenceDataOnly).map((row) => `${row.mappingId}@${row.mappingVersion}`),
    ),
    overlapRiskMappings: Object.freeze(
      active.filter((row) => row.overlapRisk).map((row) => `${row.mappingId}@${row.mappingVersion}`),
    ),
  });
}
