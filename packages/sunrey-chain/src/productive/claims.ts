import type { CanonicalProductiveMeasurement } from '../units/measurement.ts';
import type { ClaimStatus, ClaimType, GeographyRef, MeasurementPeriod, ProductiveCategory } from './types.ts';
import { PRODUCTIVE_SCHEMA_VERSION } from './types.ts';

export type ProductiveClaim = {
  readonly schemaVersion: typeof PRODUCTIVE_SCHEMA_VERSION;
  readonly claimId: string;
  readonly objectId: string;
  readonly claimType: ClaimType;
  readonly category: ProductiveCategory;
  readonly quantity: bigint;
  readonly unit: string;
  readonly measurementPeriod: MeasurementPeriod;
  readonly geography: GeographyRef;
  readonly oracleFactIds: readonly string[];
  readonly rightsReferences: readonly string[];
  readonly controller: string;
  readonly proofReferences: readonly string[];
  readonly status: ClaimStatus;
  readonly upstreamContributionIds: readonly string[];
  readonly canonicalMeasurement?: CanonicalProductiveMeasurement;
  readonly contributionSchema?: 1 | 2;
};

export function periodIsDefined(period: MeasurementPeriod): boolean {
  return period.validUntilUnixSeconds > period.validFromUnixSeconds && period.epoch >= 0;
}
