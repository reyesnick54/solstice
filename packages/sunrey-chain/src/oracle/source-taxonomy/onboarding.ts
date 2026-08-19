import { err, type Result } from '../../../../domain/src/result.ts';
import type { EconomicDataSource, FeedSchemaDefinition, ProductionFeedConfiguration } from '../production/types.ts';
import { mappingRejection, type SourceClaimCompatibilityRejection } from './types.ts';
import { validateFeedDefinitionMapping, validateSourceRegistrationMapping } from './validator.ts';

export function enforceSourceRegistrationMapping(
  source: EconomicDataSource,
): Result<EconomicDataSource, SourceClaimCompatibilityRejection> {
  const checked = validateSourceRegistrationMapping({
    sourceCategory: source.category,
    factType: source.factType,
    sourceUnit: source.unit,
  });
  if (!checked.ok) {
    return checked;
  }
  return { ok: true, value: source };
}

export function enforceFeedDefinitionMapping(
  feed: ProductionFeedConfiguration,
  sourceCategory?: string | null,
): Result<ProductionFeedConfiguration, SourceClaimCompatibilityRejection> {
  const checked = validateFeedDefinitionMapping({
    sourceCategory,
    factType: feed.factType,
    measurementUnit: feed.measurementUnit,
  });
  if (!checked.ok) {
    return checked;
  }
  if (feed.schema.factType !== feed.factType) {
    return err(
      mappingRejection(
        'FACT_NOT_ALLOWED_FOR_SOURCE',
        `feed schema fact ${feed.schema.factType} does not match feed fact ${feed.factType}`,
      ),
    );
  }
  if (feed.schema.unit !== feed.measurementUnit) {
    return err(
      mappingRejection(
        'SOURCE_UNIT_NOT_ALLOWED',
        `feed schema unit ${feed.schema.unit} does not match measurement unit ${feed.measurementUnit}`,
      ),
    );
  }
  return { ok: true, value: feed };
}

export function enforceFeedSchemaMapping(
  schema: FeedSchemaDefinition,
  sourceCategory?: string | null,
): Result<FeedSchemaDefinition, SourceClaimCompatibilityRejection> {
  const checked = validateFeedDefinitionMapping({
    sourceCategory,
    factType: schema.factType,
    measurementUnit: schema.unit,
  });
  if (!checked.ok) {
    return checked;
  }
  return { ok: true, value: schema };
}
