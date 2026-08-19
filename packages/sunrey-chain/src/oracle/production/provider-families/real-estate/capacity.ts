import { err, ok, type Result } from '../../../../../../domain/src/result.ts';
import type { RealEstateRefusal, RealEstateSourceRecord, RealEstateUsageState } from './types.ts';
import {
  CAPACITY_EQUALS_REALIZED_USE,
  LISTING_EQUALS_PRODUCTIVE_USE,
  PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE,
  VACANCY_EQUALS_PRODUCTIVE_USE,
  isRealizedUsageState,
} from './types.ts';

export function vacancyIsNotUsage(state: RealEstateUsageState): Result<true, RealEstateRefusal> {
  if (state === 'VACANT') {
    return err({
      code: 'VACANCY_IS_NOT_USAGE',
      detail: 'vacant space is available capacity, not realized usage',
    });
  }
  return ok(true);
}

export function listingIsNotUsage(state: RealEstateUsageState): Result<true, RealEstateRefusal> {
  if (state === 'LISTED' || state === 'APPRAISED') {
    return err({
      code: state === 'LISTED' ? 'LISTING_IS_NOT_USAGE' : 'APPRAISAL_IS_NOT_USAGE',
      detail: 'listing, asking rent, sale price, and appraisal are not realized productive use',
    });
  }
  return ok(true);
}

export function ownershipIsNotUsage(state: RealEstateUsageState): Result<true, RealEstateRefusal> {
  if (state === 'OWNED_ONLY') {
    return err({
      code: 'OWNERSHIP_IS_NOT_USAGE',
      detail: 'owning a property does not prove productive service during the measurement period',
    });
  }
  return ok(true);
}

export function capacityCannotBecomeUsage(record: RealEstateSourceRecord): Result<true, RealEstateRefusal> {
  if (record.factType === 'REAL_ESTATE_USE_CAPACITY' && isRealizedUsageState(record.usageState)) {
    return err({
      code: 'CAPACITY_IS_NOT_USAGE',
      detail: 'REAL_ESTATE_USE_CAPACITY cannot represent completed occupancy',
    });
  }
  if (record.factType === 'REAL_ESTATE_USAGE' && !isRealizedUsageState(record.usageState)) {
    if (record.usageState === 'VACANT') {
      return vacancyIsNotUsage(record.usageState);
    }
    if (record.usageState === 'LISTED' || record.usageState === 'APPRAISED') {
      return listingIsNotUsage(record.usageState);
    }
    if (record.usageState === 'OWNED_ONLY') {
      return ownershipIsNotUsage(record.usageState);
    }
    return err({
      code: 'CAPACITY_IS_NOT_USAGE',
      detail: `${record.usageState} is not a realized usage state`,
    });
  }
  return ok(true);
}

export function capacityEqualsRealizedUse(): false {
  return CAPACITY_EQUALS_REALIZED_USE;
}

export function vacancyEqualsProductiveUse(): false {
  return VACANCY_EQUALS_PRODUCTIVE_USE;
}

export function listingEqualsProductiveUse(): false {
  return LISTING_EQUALS_PRODUCTIVE_USE;
}

export function ownershipEqualsProductiveUse(): false {
  return PROPERTY_OWNERSHIP_EQUALS_PRODUCTIVE_USE;
}
