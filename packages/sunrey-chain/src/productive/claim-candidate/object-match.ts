import { periodIsDefined } from '../claims.ts';
import { objectIsActive, type ProductiveEconomicObject } from '../objects.ts';
import type { GeographyRef, MeasurementPeriod } from '../types.ts';
import type { VerifiedEconomicFact } from '../../oracle/types.ts';
import type { SourceProductiveMapping } from '../../oracle/source-taxonomy/types.ts';
import { mappingRejection, type SourceClaimCompatibilityRejection } from '../../oracle/source-taxonomy/types.ts';

export function evaluateProductiveObjectMatch(input: {
  readonly object: ProductiveEconomicObject;
  readonly fact: VerifiedEconomicFact;
  readonly mapping: SourceProductiveMapping;
  readonly measurementPeriod: MeasurementPeriod | null;
  readonly geography: GeographyRef | null;
  readonly rightsReferences: readonly string[];
  readonly nowUnix: bigint;
  readonly height: number;
}): SourceClaimCompatibilityRejection | null {
  if (input.mapping.requiresProductiveObject && input.object.objectId.length === 0) {
    return mappingRejection('PRODUCTIVE_OBJECT_REQUIRED', 'a registered productive object is required');
  }
  if (input.fact.subject !== input.object.objectId) {
    return mappingRejection(
      'PRODUCTIVE_OBJECT_REQUIRED',
      `fact ${input.fact.factId} subject ${input.fact.subject} does not match object ${input.object.objectId}`,
    );
  }
  if (input.mapping.productiveCategory !== null && input.mapping.productiveCategory !== input.object.category) {
    return mappingRejection(
      'FACT_NOT_ALLOWED_FOR_PRODUCTIVE_CATEGORY',
      `object ${input.object.objectId} is ${input.object.category}, mapping requires ${input.mapping.productiveCategory}`,
    );
  }
  if (!objectIsActive(input.object, input.height, input.nowUnix)) {
    return mappingRejection('PRODUCTIVE_OBJECT_REQUIRED', `object ${input.object.objectId} is not active`);
  }
  if (input.mapping.requiresRights) {
    if (input.rightsReferences.length === 0) {
      return mappingRejection('RIGHTS_REQUIRED', `object ${input.object.objectId} requires rights references`);
    }
    if (!input.rightsReferences.includes(input.object.rightsReference)) {
      return mappingRejection(
        'RIGHTS_REQUIRED',
        `rights ${input.rightsReferences.join(',')} are not compatible with object controller rights ${input.object.rightsReference}`,
      );
    }
  }
  if (input.mapping.requiresMeasurementPeriod) {
    if (!input.measurementPeriod || !periodIsDefined(input.measurementPeriod)) {
      return mappingRejection('MEASUREMENT_PERIOD_REQUIRED', 'a defined measurement period is required');
    }
    if (
      input.measurementPeriod.validUntilUnixSeconds <= input.fact.observationWindow.startUnix ||
      input.measurementPeriod.validFromUnixSeconds >= input.fact.observationWindow.endUnix
    ) {
      return mappingRejection(
        'MEASUREMENT_PERIOD_REQUIRED',
        `measurement period does not overlap fact window for ${input.fact.factId}`,
      );
    }
  }
  if (input.mapping.requiresGeography) {
    const geography = input.geography ?? input.object.geography;
    if (geography.geographyId.length === 0 || geography.jurisdiction.length === 0) {
      return mappingRejection('GEOGRAPHY_REQUIRED', 'geography is required for this mapping');
    }
    if (
      geography.geographyId !== input.object.geography.geographyId ||
      geography.jurisdiction !== input.object.geography.jurisdiction
    ) {
      return mappingRejection(
        'GEOGRAPHY_REQUIRED',
        `geography ${geography.geographyId}/${geography.jurisdiction} does not match object ${input.object.geography.geographyId}/${input.object.geography.jurisdiction}`,
      );
    }
  }
  return null;
}
