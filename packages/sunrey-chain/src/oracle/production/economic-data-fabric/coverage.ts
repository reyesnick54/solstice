/**
 * Coverage report across every DataSourceCategory, ProductiveCategory,
 * and FactType. Gaps are reported, never faked.
 */

import { FACT_TYPES, type FactType } from '../../types.ts';
import { PRODUCTIVE_CATEGORIES, type ProductiveCategory } from '../../../productive/types.ts';
import {
  DATA_SOURCE_CATEGORIES,
  resolveSourceCategory,
  type DataSourceCategory,
} from '../../../productive/source-taxonomy/types.ts';
import { activeMappings } from '../../source-taxonomy/registry.ts';
import { lookupUnit } from '../../../units/convert.ts';
import { CANONICAL_FAMILY_REGISTRY } from './registry.ts';
import { familyForFactType, familyForSourceCategory } from './routing.ts';
import {
  ECONOMIC_DATA_FABRIC_ID,
  ECONOMIC_DATA_FABRIC_VERSION,
  type CoverageFlags,
  type EconomicDataFabricCoverageReport,
  type FactCoverageClass,
  type FactTypeCoverageRow,
  type ProductiveCategoryCoverageRow,
  type ProviderFamilyId,
  type SourceCategoryCoverageRow,
} from './types.ts';

const FACT_COVERAGE_CLASS: Readonly<Record<FactType, FactCoverageClass>> = Object.freeze({
  ENERGY_PRODUCTION: 'REALIZED_OUTPUT',
  ENERGY_CAPACITY: 'CAPACITY_ONLY',
  ENERGY_CONSUMPTION: 'USAGE',
  FOOD_PRODUCTION: 'REALIZED_OUTPUT',
  AGRICULTURAL_OUTPUT: 'REALIZED_OUTPUT',
  WATER_PRODUCTION: 'REALIZED_OUTPUT',
  WATER_AVAILABILITY: 'RESERVE',
  COMPUTE_CAPACITY: 'CAPACITY_ONLY',
  COMPUTE_USAGE: 'USAGE',
  AI_INFERENCE_USAGE: 'USAGE',
  AI_COMPUTE_CAPACITY: 'CAPACITY_ONLY',
  AI_TRAINING_USAGE: 'USAGE',
  MANUFACTURING_CAPACITY: 'CAPACITY_ONLY',
  MANUFACTURING_OUTPUT: 'REALIZED_OUTPUT',
  REAL_ESTATE_USE_CAPACITY: 'CAPACITY_ONLY',
  STORAGE_CAPACITY: 'CAPACITY_ONLY',
  LOGISTICS_CAPACITY: 'CAPACITY_ONLY',
  DELIVERY_COMPLETION: 'DELIVERY',
  BANDWIDTH_CAPACITY: 'CAPACITY_ONLY',
  BANDWIDTH_USAGE: 'USAGE',
  RESOURCE_RESERVE: 'RESERVE',
  RESOURCE_EXTRACTION: 'REALIZED_OUTPUT',
  SERVICE_DELIVERY: 'DELIVERY',
  INFRASTRUCTURE_CAPACITY: 'CAPACITY_ONLY',
  INFRASTRUCTURE_USAGE: 'USAGE',
  GOODS_OUTPUT: 'REALIZED_OUTPUT',
  GOODS_DELIVERY: 'DELIVERY',
  AUTOMATED_MACHINE_OUTPUT: 'REALIZED_OUTPUT',
  REFERENCE_PRICE: 'REFERENCE_ONLY',
});

const PRODUCTIVE_FAMILY: Readonly<Record<ProductiveCategory, ProviderFamilyId>> = Object.freeze({
  ENERGY: 'ENERGY',
  FOOD_AGRICULTURE: 'AGRICULTURE_FOOD',
  WATER: 'WATER',
  MINERALS_RAW_MATERIALS: 'MINERALS_RESOURCES',
  REAL_ESTATE_USE: 'REAL_ESTATE',
  COMPUTE: 'COMPUTE',
  AI_COMPUTE: 'AI_COMPUTE',
  MANUFACTURING: 'MANUFACTURING',
  LOGISTICS_TRANSPORTATION: 'LOGISTICS',
  STORAGE: 'STORAGE',
  BANDWIDTH_COMMUNICATIONS: 'BANDWIDTH',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  GOODS: 'GOODS',
  SERVICES: 'SERVICES',
  AUTOMATED_MACHINE_OUTPUT: 'AUTOMATED_MACHINE_OUTPUT',
});

function flagsFor(input: {
  readonly familyId: ProviderFamilyId | null;
  readonly mapped: boolean;
  readonly schemaAvailable: boolean;
  readonly unitAvailable: boolean;
  readonly certificationAvailable: boolean;
  readonly referenceOnly: boolean;
  readonly unitExtensionRequired: boolean;
  readonly semanticReviewRequired: boolean;
}): CoverageFlags {
  const family = input.familyId ? CANONICAL_FAMILY_REGISTRY.get(input.familyId) : undefined;
  const implemented = family?.implementationState === 'ADAPTER_IMPLEMENTED';
  return Object.freeze({
    providerFamilyImplemented: implemented === true,
    factTypeMapped: input.mapped,
    sourceSchemaAvailable: input.schemaAvailable,
    canonicalUnitPathAvailable: input.unitAvailable,
    certificationProfileAvailable: input.certificationAvailable,
    connectorRuntimeCompatible: true,
    oracleFeedPathAvailable: true,
    eventIdentityCompatible: true,
    attributionPolicyAvailable: input.mapped && !input.referenceOnly,
    valueFunctionCategoryReviewed: !input.referenceOnly,
    referenceOnly: input.referenceOnly,
    unitExtensionRequired: input.unitExtensionRequired,
    semanticReviewRequired: input.semanticReviewRequired,
    liveProviderConnected: false,
  });
}

export function buildCoverageReport(): EconomicDataFabricCoverageReport {
  const mappings = activeMappings();
  const sourceCategories: SourceCategoryCoverageRow[] = DATA_SOURCE_CATEGORIES.map((sourceCategory) => {
    const familyId = sourceCategory === 'reference_price' ? 'REFERENCE_DATA' : familyForSourceCategory(sourceCategory);
    const family = CANONICAL_FAMILY_REGISTRY.get(familyId);
    const mapped = mappings.some((row) => row.sourceCategory === sourceCategory);
    const unitAvailable = (family?.supportedUnits ?? []).some((unit) => lookupUnit(unit) !== undefined);
    return Object.freeze({
      sourceCategory,
      familyId,
      flags: flagsFor({
        familyId,
        mapped,
        schemaAvailable: (family?.supportedSchemaIds.length ?? 0) > 0,
        unitAvailable,
        certificationAvailable: (family?.certificationProfileIds.length ?? 0) > 0,
        referenceOnly: sourceCategory === 'reference_price',
        unitExtensionRequired: false,
        semanticReviewRequired: family?.implementationState === 'ROUTING_INDEX_ONLY',
      }),
    });
  });

  const productiveCategories: ProductiveCategoryCoverageRow[] = PRODUCTIVE_CATEGORIES.map((productiveCategory) => {
    const familyId = PRODUCTIVE_FAMILY[productiveCategory];
    const family = CANONICAL_FAMILY_REGISTRY.get(familyId);
    const mapped = mappings.some((row) => row.productiveCategory === productiveCategory);
    return Object.freeze({
      productiveCategory,
      familyId,
      flags: flagsFor({
        familyId,
        mapped,
        schemaAvailable: (family?.supportedSchemaIds.length ?? 0) > 0,
        unitAvailable: (family?.supportedUnits ?? []).some((unit) => lookupUnit(unit) !== undefined),
        certificationAvailable: (family?.certificationProfileIds.length ?? 0) > 0,
        referenceOnly: false,
        unitExtensionRequired: false,
        semanticReviewRequired: family?.implementationState === 'ROUTING_INDEX_ONLY' || !mapped,
      }),
    });
  });

  const factTypes: FactTypeCoverageRow[] = FACT_TYPES.map((factType) => {
    const familyId = familyForFactType(factType) ?? null;
    const mapped = mappings.some((row) => row.factType === factType);
    return Object.freeze({
      factType,
      coverageClass: FACT_COVERAGE_CLASS[factType],
      familyId,
      mapped,
      routed: familyId !== null,
    });
  });

  const productiveCategoryGaps = productiveCategories
    .filter((row) => !row.flags.factTypeMapped || row.familyId === null)
    .map((row) => row.productiveCategory);
  const unmappedActiveSourceCategories = sourceCategories
    .filter((row) => {
      const resolved = resolveSourceCategory(row.sourceCategory);
      return !row.flags.factTypeMapped && !resolved.isLegacyAlias;
    })
    .map((row) => row.sourceCategory);
  const unmappedActiveFactTypes = factTypes.filter((row) => !row.mapped || !row.routed).map((row) => row.factType);

  return Object.freeze({
    reportId: ECONOMIC_DATA_FABRIC_ID,
    version: ECONOMIC_DATA_FABRIC_VERSION,
    sourceCategories: Object.freeze(sourceCategories),
    productiveCategories: Object.freeze(productiveCategories),
    factTypes: Object.freeze(factTypes),
    productiveCategoryGaps: Object.freeze(productiveCategoryGaps),
    unmappedActiveSourceCategories: Object.freeze(unmappedActiveSourceCategories),
    unmappedActiveFactTypes: Object.freeze(unmappedActiveFactTypes),
    liveProviderConnections: 0,
    productionActive: false,
  });
}

export function documentedCoverageGaps(report: EconomicDataFabricCoverageReport = buildCoverageReport()): readonly string[] {
  const gaps: string[] = [];
  for (const row of report.productiveCategories) {
    if (row.flags.semanticReviewRequired) {
      gaps.push(`${row.productiveCategory}:provider-family-adapter-or-mapping-gap`);
    }
  }
  for (const factType of report.unmappedActiveFactTypes) {
    gaps.push(`FACT:${factType}`);
  }
  for (const category of report.unmappedActiveSourceCategories) {
    gaps.push(`SOURCE:${category}`);
  }
  return Object.freeze(gaps);
}

export function everyProductiveCategoryHasStatus(
  report: EconomicDataFabricCoverageReport = buildCoverageReport(),
): boolean {
  return PRODUCTIVE_CATEGORIES.every((category) =>
    report.productiveCategories.some((row) => row.productiveCategory === category),
  );
}

export function everyActiveSourceCategoryHasFamilyRouting(
  report: EconomicDataFabricCoverageReport = buildCoverageReport(),
): boolean {
  return DATA_SOURCE_CATEGORIES.every((category) =>
    report.sourceCategories.some((row) => row.sourceCategory === category && row.familyId !== null),
  );
}

export function everyFactTypeHasDeliberateRouting(
  report: EconomicDataFabricCoverageReport = buildCoverageReport(),
): boolean {
  return FACT_TYPES.every((factType) => report.factTypes.some((row) => row.factType === factType && row.routed));
}

export function liveProviderConnectedCount(
  report: EconomicDataFabricCoverageReport = buildCoverageReport(),
): 0 {
  void report;
  return 0;
}
