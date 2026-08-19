import { err, ok, type Result } from '../../../../domain/src/result.ts';
import { isFactType, type FactType } from '../../oracle/types.ts';
import {
  isClaimType,
  isProductiveCategory,
  type ClaimType,
  type ProductiveCategory,
} from '../types.ts';
import { assertTaxonomyComplete } from './completeness.ts';
import { mappingAuthorizesMoonRey, mappingDeclaresProductiveContribution } from './invariants.ts';
import { SOURCE_PRODUCTIVE_MAPPINGS } from './mapping.ts';
import {
  PRIMARY_FACT_TYPE_BY_CATEGORY,
  isDataSourceCategory,
  isAttributionRiskCategory,
  resolveSourceCategory,
  type DataSourceCategory,
  type MappingRejection,
  type SourceCategoryResolution,
  type SourceProductiveMapping,
} from './types.ts';

export class SourceProductiveTaxonomyRegistry {
  private readonly records: readonly SourceProductiveMapping[];
  private readonly byId = new Map<string, SourceProductiveMapping>();

  constructor(records: readonly SourceProductiveMapping[] = SOURCE_PRODUCTIVE_MAPPINGS) {
    assertTaxonomyComplete(records);
    this.records = Object.freeze([...records]);
    for (const record of this.records) {
      this.byId.set(record.mappingId, record);
    }
  }

  all(): readonly SourceProductiveMapping[] {
    return this.records;
  }

  mappingById(mappingId: string): SourceProductiveMapping | undefined {
    return this.byId.get(mappingId);
  }

  mappingsForSourceCategory(category: DataSourceCategory): readonly SourceProductiveMapping[] {
    return this.records.filter((row) => row.dataSourceCategory === category && row.status !== 'SUPERSEDED');
  }

  mappingsForFactType(factType: FactType): readonly SourceProductiveMapping[] {
    return this.records.filter((row) => row.factType === factType && row.status !== 'SUPERSEDED');
  }

  mappingsForProductiveCategory(category: ProductiveCategory): readonly SourceProductiveMapping[] {
    return this.records.filter(
      (row) => row.productiveCategory === category && row.status !== 'SUPERSEDED',
    );
  }

  allowedFactTypesFor(category: DataSourceCategory): readonly FactType[] {
    return unique(this.mappingsForSourceCategory(category).map((row) => row.factType));
  }

  allowedClaimTypesFor(
    input: DataSourceCategory | FactType | { readonly category?: DataSourceCategory; readonly factType?: FactType },
  ): readonly ClaimType[] {
    const category = typeof input === 'string' && isDataSourceCategory(input) ? input : undefined;
    const factType = typeof input === 'string' && isFactType(input) ? input : undefined;
    const objectInput = typeof input === 'object' ? input : { category, factType };
    const rows = this.records.filter((row) => {
      if (row.status === 'SUPERSEDED') {
        return false;
      }
      if (objectInput.category && row.dataSourceCategory !== objectInput.category) {
        return false;
      }
      if (objectInput.factType && row.factType !== objectInput.factType) {
        return false;
      }
      return objectInput.category !== undefined || objectInput.factType !== undefined;
    });
    return unique(rows.flatMap((row) => row.allowedClaimTypes));
  }

  sourcePathExistsFor(category: ProductiveCategory): boolean {
    return this.mappingsForProductiveCategory(category).length > 0;
  }

  mappingRequiresAttribution(
    key: string | ProductiveCategory | DataSourceCategory | SourceProductiveMapping,
  ): boolean {
    if (typeof key === 'object') {
      return key.requiresAttributionPolicy;
    }
    const byId = this.byId.get(key);
    if (byId) {
      return byId.requiresAttributionPolicy;
    }
    if (isAttributionRiskCategory(key)) {
      return true;
    }
    if (isProductiveCategory(key)) {
      return this.mappingsForProductiveCategory(key).some((row) => row.requiresAttributionPolicy);
    }
    if (isDataSourceCategory(key)) {
      return this.mappingsForSourceCategory(key).some((row) => row.requiresAttributionPolicy);
    }
    return false;
  }

  resolveSourceCategory(category: DataSourceCategory): SourceCategoryResolution {
    return resolveSourceCategory(category);
  }

  primaryFactTypeFor(category: DataSourceCategory): FactType {
    return PRIMARY_FACT_TYPE_BY_CATEGORY[category];
  }

  factTypeIsMappedForSource(category: DataSourceCategory, factType: FactType): boolean {
    return this.mappingsForSourceCategory(category).some((row) => row.factType === factType);
  }

  claimTypeIsMappedForFact(factType: FactType, claimType: ClaimType): boolean {
    return this.mappingsForFactType(factType).some((row) => row.allowedClaimTypes.includes(claimType));
  }

  evaluateFactCategoryPair(
    category: string,
    factType: string,
  ): Result<readonly SourceProductiveMapping[], MappingRejection> {
    if (!isDataSourceCategory(category)) {
      return err({ code: 'UNKNOWN_SOURCE_CATEGORY', detail: category });
    }
    if (!isFactType(factType)) {
      return err({ code: 'UNKNOWN_FACT_TYPE', detail: factType });
    }
    const matches = this.mappingsForSourceCategory(category).filter((row) => row.factType === factType);
    if (matches.length === 0) {
      return err({
        code: 'INVALID_FACT_CATEGORY_PAIR',
        detail: `${category} does not collect ${factType}`,
      });
    }
    return ok(matches);
  }

  evaluateFactClaimPair(
    factType: string,
    claimType: string,
  ): Result<readonly SourceProductiveMapping[], MappingRejection> {
    if (!isFactType(factType)) {
      return err({ code: 'UNKNOWN_FACT_TYPE', detail: factType });
    }
    if (!isClaimType(claimType)) {
      return err({ code: 'UNKNOWN_CLAIM_TYPE', detail: claimType });
    }
    const matches = this.mappingsForFactType(factType).filter((row) =>
      row.allowedClaimTypes.includes(claimType),
    );
    if (matches.length === 0) {
      return err({
        code: 'INVALID_FACT_CLAIM_PAIR',
        detail: `${factType} cannot support claim ${claimType}`,
      });
    }
    return ok(matches);
  }

  mappingAloneCannotMint(): false {
    return mappingAuthorizesMoonRey();
  }

  mappingAloneCannotDeclareContribution(): false {
    return mappingDeclaresProductiveContribution();
  }
}

export const canonicalSourceTaxonomy = new SourceProductiveTaxonomyRegistry();

export function mappingsForSourceCategory(
  category: DataSourceCategory,
): readonly SourceProductiveMapping[] {
  return canonicalSourceTaxonomy.mappingsForSourceCategory(category);
}

export function mappingsForFactType(factType: FactType): readonly SourceProductiveMapping[] {
  return canonicalSourceTaxonomy.mappingsForFactType(factType);
}

export function mappingsForProductiveCategory(
  category: ProductiveCategory,
): readonly SourceProductiveMapping[] {
  return canonicalSourceTaxonomy.mappingsForProductiveCategory(category);
}

export function allowedFactTypesFor(category: DataSourceCategory): readonly FactType[] {
  return canonicalSourceTaxonomy.allowedFactTypesFor(category);
}

export function allowedClaimTypesFor(
  input: DataSourceCategory | FactType | { readonly category?: DataSourceCategory; readonly factType?: FactType },
): readonly ClaimType[] {
  return canonicalSourceTaxonomy.allowedClaimTypesFor(input);
}

export function sourcePathExistsFor(category: ProductiveCategory): boolean {
  return canonicalSourceTaxonomy.sourcePathExistsFor(category);
}

export function mappingRequiresAttribution(
  key: string | ProductiveCategory | DataSourceCategory | SourceProductiveMapping,
): boolean {
  return canonicalSourceTaxonomy.mappingRequiresAttribution(key);
}

export function factTypeIsMappedForSource(category: DataSourceCategory, factType: FactType): boolean {
  return canonicalSourceTaxonomy.factTypeIsMappedForSource(category, factType);
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
