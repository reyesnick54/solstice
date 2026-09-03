// @ts-nocheck
import { err, ok, type Result } from '../../../domain/src/result.ts';
import type { UtcInstant } from '../../../domain/src/time.ts';
import { humanEconomicClaimIdFor, resolutionClusterIdFor } from './ids.ts';
import type {
  CanonicalHumanContributionEvent,
  HumanEconomicClaim,
  HumanEconomicClaimId,
  ResolutionCluster,
  ResolutionFailure,
  ResolutionStatus,
} from './types.ts';

function failure(code: ResolutionFailure['code'], message: string): ResolutionFailure {
  return Object.freeze({ code, message });
}

const CLAIMABLE_STATUSES = new Set<ResolutionStatus>(['RESOLVED', 'PENDING_CORROBORATION']);

export function canGenerateClaim(resolutionStatus: ResolutionStatus, hasConflicts: boolean): boolean {
  if (hasConflicts) {
    return false;
  }
  if (resolutionStatus === 'CONFLICT' || resolutionStatus === 'FRAUD_SUSPECTED' || resolutionStatus === 'MANUAL_REVIEW_REQUIRED') {
    return false;
  }
  if (resolutionStatus === 'UNRESOLVED_DUPLICATE' || resolutionStatus === 'SPLITTING_SUSPECTED') {
    return false;
  }
  return CLAIMABLE_STATUSES.has(resolutionStatus);
}

/**
 * Only resolved canonical Human Contribution Events progress into claims.
 * Unresolved duplicate conflicts must not silently produce multiple monetizable claims.
 */
export function generateHumanEconomicClaim(input: {
  readonly canonicalEvent: CanonicalHumanContributionEvent;
  readonly cluster: ResolutionCluster;
  readonly createdAtUtc: UtcInstant;
  readonly forcePendingCorroboration?: boolean;
}): Result<HumanEconomicClaim, ResolutionFailure> {
  if (input.cluster.claimId) {
    return err(failure('CLAIM_ALREADY_EXISTS', `cluster ${input.cluster.clusterId} already has claim ${input.cluster.claimId}`));
  }
  if (!canGenerateClaim(input.cluster.resolutionStatus, false)) {
    return err(
      failure(
        'CLAIM_NOT_RESOLVED',
        `cannot generate claim while resolution status is ${input.cluster.resolutionStatus}`,
      ),
    );
  }
  if (input.cluster.resolutionStatus === 'PENDING_CORROBORATION' && !input.forcePendingCorroboration) {
    return err(
      failure(
        'CLAIM_NOT_RESOLVED',
        'single-source observation requires corroboration or explicit force before claim generation',
      ),
    );
  }
  const claimId = humanEconomicClaimIdFor(input.canonicalEvent.canonicalEventId, input.canonicalEvent.humanEconomicIdentityId);
  return ok(
    Object.freeze({
      claimId,
      canonicalEventId: input.canonicalEvent.canonicalEventId,
      resolutionFingerprint: input.canonicalEvent.resolutionFingerprint,
      humanEconomicIdentityId: input.canonicalEvent.humanEconomicIdentityId,
      contributionClass: input.canonicalEvent.contributionClass,
      supportingObservationIds: input.cluster.observationIds,
      clusterId: input.cluster.clusterId,
      measurementQuantity: input.canonicalEvent.measurementQuantity,
      measurementUnit: input.canonicalEvent.measurementUnit,
      validFromUtc: input.canonicalEvent.validFromUtc,
      validUntilUtc: input.canonicalEvent.validUntilUtc,
      createdAtUtc: input.createdAtUtc,
    }),
  );
}

export function buildResolutionCluster(input: {
  readonly canonicalEvent: CanonicalHumanContributionEvent;
  readonly observationIds: readonly string[];
  readonly sourceClasses: ResolutionCluster['sourceClasses'];
  readonly resolutionStatus: ResolutionStatus;
  readonly claimId?: HumanEconomicClaimId | null;
}): ResolutionCluster {
  return Object.freeze({
    clusterId: resolutionClusterIdFor(input.canonicalEvent.canonicalEventId),
    canonicalEventId: input.canonicalEvent.canonicalEventId,
    resolutionFingerprint: input.canonicalEvent.resolutionFingerprint,
    observationIds: Object.freeze([...input.observationIds]),
    sourceClasses: Object.freeze([...input.sourceClasses]),
    resolutionStatus: input.resolutionStatus,
    humanEconomicIdentityId: input.canonicalEvent.humanEconomicIdentityId,
    claimId: input.claimId ?? null,
  });
}
