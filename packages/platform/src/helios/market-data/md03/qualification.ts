/**
 * HELIOS MD03 qualification gate.
 */

import {
  FEED_RECOVERY_PHASES,
  RECOVERY_ADAPTER_KINDS,
  SEQUENCE_ANOMALY_KINDS,
  type FeedRecoveryPhase,
} from './taxonomy.ts';
import { listRecoveryAdapterKinds } from './recovery-adapters.ts';

export const HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED = 'HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED' as const;
export const HELIOS_MD03_SEQUENCE_RECOVERY_BLOCKED = 'HELIOS_MD03_SEQUENCE_RECOVERY_BLOCKED' as const;

export type Md03QualificationChecks = {
  readonly gapMarksNonAuthoritative: boolean;
  readonly snapshotRestoresAuthoritative: boolean;
  readonly failedSafeNeverAuthoritative: boolean;
  readonly duplicateRejectedWithoutGap: boolean;
  readonly bufferOverflowFailedSafe: boolean;
  readonly adapterProfilesComplete: boolean;
  readonly anomalyTaxonomyComplete: boolean;
  readonly recoveryPhaseTaxonomyComplete: boolean;
};

export type Md03QualificationResult = {
  readonly marker:
    | typeof HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED
    | typeof HELIOS_MD03_SEQUENCE_RECOVERY_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
};

export function evaluateMd03SequenceRecoveryQualification(
  checks: Md03QualificationChecks,
): Md03QualificationResult {
  const blockers: string[] = [];
  if (!checks.gapMarksNonAuthoritative) blockers.push('gap_non_authoritative');
  if (!checks.snapshotRestoresAuthoritative) blockers.push('snapshot_restore');
  if (!checks.failedSafeNeverAuthoritative) blockers.push('failed_safe_authority');
  if (!checks.duplicateRejectedWithoutGap) blockers.push('duplicate_handling');
  if (!checks.bufferOverflowFailedSafe) blockers.push('buffer_overflow');
  if (!checks.adapterProfilesComplete) blockers.push('adapter_profiles');
  if (!checks.anomalyTaxonomyComplete) blockers.push('anomaly_taxonomy');
  if (!checks.recoveryPhaseTaxonomyComplete) blockers.push('recovery_phases');

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_MD03_SEQUENCE_RECOVERY_QUALIFIED : HELIOS_MD03_SEQUENCE_RECOVERY_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
  });
}

export function md03EngineeringTaxonomySelfCheck(): {
  readonly anomalyKinds: readonly string[];
  readonly recoveryPhases: readonly FeedRecoveryPhase[];
  readonly adapterKinds: readonly string[];
} {
  return Object.freeze({
    anomalyKinds: Object.freeze([...SEQUENCE_ANOMALY_KINDS]),
    recoveryPhases: Object.freeze([...FEED_RECOVERY_PHASES]),
    adapterKinds: Object.freeze(listRecoveryAdapterKinds()),
  });
}

export function adapterTaxonomyMatchesRegistry(): boolean {
  return listRecoveryAdapterKinds().length === RECOVERY_ADAPTER_KINDS.length;
}
