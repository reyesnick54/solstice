/**
 * EconomicDataProviderFamilyRegistry — operational index over Chunk 116.
 *
 * Verifies family records against SourceProductiveMapping. Does not
 * redefine DataSourceCategory, FactType, ProductiveCategory, or ClaimType.
 */

import { err, ok, type Result } from '../../../../../domain/src/result.ts';
import { FACT_TYPES, type FactType } from '../../types.ts';
import { PRODUCTIVE_CATEGORIES } from '../../../productive/types.ts';
import {
  CANONICAL_DATA_SOURCE_CATEGORIES,
  DATA_SOURCE_CATEGORIES,
  resolveSourceCategory,
  type DataSourceCategory,
} from '../../../productive/source-taxonomy/types.ts';
import { activeMappings, CANONICAL_SOURCE_TAXONOMY } from '../../source-taxonomy/registry.ts';
import { CANONICAL_PROVIDER_FAMILIES } from './family.ts';
import { fabricRejection, PROVIDER_FAMILY_IDS, type EconomicDataProviderFamilyRecord, type FabricRejection, type ProviderFamilyId } from './types.ts';

export class EconomicDataProviderFamilyRegistry {
  private readonly byId = new Map<ProviderFamilyId, EconomicDataProviderFamilyRecord>();

  constructor(records: readonly EconomicDataProviderFamilyRecord[] = CANONICAL_PROVIDER_FAMILIES) {
    for (const record of records) {
      if (this.byId.has(record.familyId)) {
        throw new Error(`duplicate canonical provider-family ID ${record.familyId}`);
      }
      this.byId.set(record.familyId, record);
    }
  }

  list(): readonly EconomicDataProviderFamilyRecord[] {
    return PROVIDER_FAMILY_IDS.map((id) => this.byId.get(id)).filter(
      (row): row is EconomicDataProviderFamilyRecord => row !== undefined,
    );
  }

  get(familyId: ProviderFamilyId): EconomicDataProviderFamilyRecord | undefined {
    return this.byId.get(familyId);
  }

  require(familyId: ProviderFamilyId): Result<EconomicDataProviderFamilyRecord, FabricRejection> {
    const record = this.byId.get(familyId);
    if (!record) {
      return err(fabricRejection('FAMILY_NOT_REGISTERED', `provider family ${familyId} is not registered`));
    }
    return ok(record);
  }

  registeredFamilyIds(): readonly ProviderFamilyId[] {
    return this.list().map((row) => row.familyId);
  }

  hasDuplicateFamilyIds(): false {
    return false;
  }

  verifyTaxonomyCompatibility(): Result<true, FabricRejection> {
    const mappings = activeMappings(CANONICAL_SOURCE_TAXONOMY);
    for (const family of this.list()) {
      if (family.sourceTaxonomyVersion !== 'moonrey.source-taxonomy.v1') {
        return err(
          fabricRejection(
            'TAXONOMY_INCOMPATIBLE',
            `${family.familyId} does not point at the canonical Chunk 116 taxonomy`,
          ),
        );
      }
      for (const category of family.supportedSourceCategories) {
        if (!(DATA_SOURCE_CATEGORIES as readonly string[]).includes(category)) {
          return err(
            fabricRejection('TAXONOMY_INCOMPATIBLE', `${family.familyId} uses unknown source category ${category}`),
          );
        }
      }
      for (const factType of family.supportedFactTypes) {
        if (!(FACT_TYPES as readonly string[]).includes(factType)) {
          return err(fabricRejection('TAXONOMY_INCOMPATIBLE', `${family.familyId} uses unknown fact type ${factType}`));
        }
      }
      for (const productive of family.supportedProductiveCategories) {
        if (!(PRODUCTIVE_CATEGORIES as readonly string[]).includes(productive)) {
          return err(
            fabricRejection(
              'TAXONOMY_INCOMPATIBLE',
              `${family.familyId} uses unknown productive category ${productive}`,
            ),
          );
        }
      }
      if (family.implementationState === 'ADAPTER_IMPLEMENTED' && family.familyId !== 'REFERENCE_DATA') {
        const compatible = mappings.some(
          (row) =>
            family.supportedSourceCategories.includes(row.sourceCategory) &&
            family.supportedFactTypes.includes(row.factType) &&
            row.productiveCategory !== null &&
            family.supportedProductiveCategories.includes(row.productiveCategory),
        );
        if (!compatible) {
          return err(
            fabricRejection(
              'TAXONOMY_INCOMPATIBLE',
              `${family.familyId} has no Chunk 116 mapping for its implemented source/fact pair`,
            ),
          );
        }
      }
      if (family.familyId === 'REFERENCE_DATA') {
        const price = mappings.find((row) => row.factType === 'REFERENCE_PRICE');
        if (!price || price.productiveCategory !== null || price.referenceDataOnly !== true) {
          return err(
            fabricRejection('REFERENCE_PRICE_CANNOT_CREATE_CLAIM', 'REFERENCE_PRICE must remain reference-only'),
          );
        }
      }
    }
    return ok(true);
  }
}

export const CANONICAL_FAMILY_REGISTRY = new EconomicDataProviderFamilyRegistry();

export function registeredFamilyCount(
  registry: EconomicDataProviderFamilyRegistry = CANONICAL_FAMILY_REGISTRY,
): number {
  return registry.list().length;
}

export function everyCanonicalFamilyRegistered(
  registry: EconomicDataProviderFamilyRegistry = CANONICAL_FAMILY_REGISTRY,
): boolean {
  return PROVIDER_FAMILY_IDS.every((id) => registry.get(id) !== undefined);
}

export function familySupportsSource(
  family: EconomicDataProviderFamilyRecord,
  sourceCategory: DataSourceCategory,
  factType: FactType,
): boolean {
  const resolved = resolveSourceCategory(sourceCategory);
  const categories = new Set<string>(family.supportedSourceCategories);
  if (resolved.isLegacyAlias) {
    categories.add(resolved.canonical);
  }
  return categories.has(sourceCategory) && family.supportedFactTypes.includes(factType);
}

export function canonicalSourceCategories(): readonly DataSourceCategory[] {
  return CANONICAL_DATA_SOURCE_CATEGORIES;
}
