/**
 * Wave 4 — duplicate fingerprint for observation deduplication.
 */

import { sha256Hex } from '../../../../security/src/hash.ts';
import type { EconomicDomain } from './types.ts';
import type { GeographicReference } from './geography.ts';
import { geographyKey } from './geography.ts';
import type { ObservationTimeWindow } from './time.ts';

export const DUPLICATE_FINGERPRINT_VERSION = 'sunrey.economic-observation.fingerprint.v1' as const;

export type FingerprintInput = {
  readonly providerId: string;
  readonly sourceRecordId: string;
  readonly economicDomain: EconomicDomain;
  readonly metric: string;
  readonly canonicalUnit: string;
  readonly canonicalValue: bigint;
  readonly subjectOrResourceId: string;
  readonly time: ObservationTimeWindow;
  readonly geography: GeographicReference;
};

export function duplicateFingerprint(input: FingerprintInput): string {
  const periodKey =
    input.time.isPeriodAggregate && input.time.periodStart && input.time.periodEnd
      ? `${input.time.periodStart}|${input.time.periodEnd}`
      : input.time.observedAt;

  return sha256Hex(
    [
      DUPLICATE_FINGERPRINT_VERSION,
      input.providerId,
      input.sourceRecordId,
      input.economicDomain,
      input.metric,
      input.canonicalUnit,
      input.canonicalValue.toString(),
      input.subjectOrResourceId,
      periodKey,
      geographyKey(input.geography),
    ].join('|'),
  );
}

export function lineageFingerprint(parentIds: readonly string[]): string | null {
  if (parentIds.length === 0) return null;
  const sorted = [...parentIds].sort();
  return sha256Hex(['sunrey.economic-lineage.v1', ...sorted].join('|'));
}
