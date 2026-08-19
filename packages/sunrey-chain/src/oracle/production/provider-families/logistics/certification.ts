/**
 * Logistics / storage certification fixtures over the existing Chunk 128 suite.
 * Certification remains an admission control. It does not mint MoonRey.
 */

import {
  SANDBOX_CLASSES,
  emptyEvidenceStates,
  feedSchemaFor,
  runCertificationSuite,
  sandboxSubject,
  type CertificationSuiteResult,
} from '../../certification/index.ts';
import { LOGISTICS_FEED_SCHEMAS } from './schemas.ts';
import type { LogisticsFactType } from './types.ts';

export type LogisticsCertificationKind =
  | 'VALID_TONNE_KM'
  | 'MULTI_LEG'
  | 'COMPLETED_DELIVERY'
  | 'WAREHOUSE_VOLUME_TIME'
  | 'COLD_STORAGE'
  | 'DISTANCE_WITHOUT_MASS'
  | 'MASS_WITHOUT_DISTANCE'
  | 'DELIVERY_NOT_COMPLETED'
  | 'DUPLICATE_CARRIER_REPORTS'
  | 'OVERLAPPING_LEGS'
  | 'WHOLE_TRIP_PLUS_LEGS'
  | 'RAW_GPS_LEAKAGE'
  | 'LOCATION_IMPOSSIBLE'
  | 'CAPACITY_AS_SERVICE'
  | 'MISSING_DURATION'
  | 'SAME_CONTROLLER_QUORUM'
  | 'FLOAT_MASS_DISTANCE'
  | 'SCHEMA_DRIFT';

export function certifyLogisticsSandbox(): CertificationSuiteResult {
  const subject = sandboxSubject('logistics', 'VALID', emptyEvidenceStates());
  return runCertificationSuite(subject, feedSchemaFor(SANDBOX_CLASSES.logistics));
}

export function certifySameControllerQuorum(): CertificationSuiteResult {
  const subject = sandboxSubject('logistics', 'SAME_CONTROLLER', emptyEvidenceStates());
  return runCertificationSuite(subject, feedSchemaFor(SANDBOX_CLASSES.logistics));
}

export function certifySchemaDrift(): CertificationSuiteResult {
  const subject = sandboxSubject('logistics', 'SCHEMA_MISMATCH', emptyEvidenceStates());
  return runCertificationSuite(subject, feedSchemaFor(SANDBOX_CLASSES.logistics));
}

export function certifyFloatValue(): CertificationSuiteResult {
  const subject = sandboxSubject('logistics', 'FLOAT_VALUE', emptyEvidenceStates());
  return runCertificationSuite(subject, feedSchemaFor(SANDBOX_CLASSES.logistics));
}

export function logisticsFeedSchema(factType: LogisticsFactType) {
  return LOGISTICS_FEED_SCHEMAS[factType];
}

export function certificationDoesNotMint(): false {
  return false;
}
