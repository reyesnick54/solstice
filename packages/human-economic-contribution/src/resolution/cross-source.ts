import type { SourceClass } from '../taxonomy.ts';
import { buildCanonicalHumanContributionEvent } from './canonical-event.ts';
import { assessContributionSplitting } from './splitting.ts';
import type {
  CanonicalHumanContributionEvent,
  CanonicalHumanContributionEventMaterial,
  EvidenceObservation,
  ResolutionStatus,
} from './types.ts';

export type CrossSourceResolutionResult = {
  readonly canonicalEvent: CanonicalHumanContributionEvent;
  readonly observationIds: readonly string[];
  readonly sourceClasses: readonly SourceClass[];
  readonly resolutionStatus: ResolutionStatus;
  readonly splittingReason: string | null;
};

function dominantObservation(observations: readonly EvidenceObservation[]): EvidenceObservation {
  const sorted = [...observations].sort((left, right) => {
    const leftScore = left.authoritativeIdCommitments.length;
    const rightScore = right.authoritativeIdCommitments.length;
    return rightScore - leftScore || left.observedAtUtc.localeCompare(right.observedAtUtc);
  });
  return sorted[0]!;
}

function mergedAuthoritativeIds(observations: readonly EvidenceObservation[]): readonly string[] {
  const merged = new Set<string>();
  for (const observation of observations) {
    for (const id of observation.authoritativeIdCommitments) {
      merged.add(String(id));
    }
  }
  return Object.freeze([...merged].sort());
}

function resolutionStatusFor(observations: readonly EvidenceObservation[]): ResolutionStatus {
  if (observations.length <= 1) {
    return 'PENDING_CORROBORATION';
  }
  const sourceClasses = new Set(observations.map((observation) => observation.sourceClass));
  const providers = new Set(observations.map((observation) => observation.providerId));
  if (sourceClasses.size >= 2 || providers.size >= 2) {
    return 'RESOLVED';
  }
  return 'PENDING_CORROBORATION';
}

/**
 * Resolve multiple evidence observations from different sources into one
 * canonical human contribution event.
 */
export function resolveCrossSourceObservations(observations: readonly EvidenceObservation[]): CrossSourceResolutionResult {
  if (observations.length === 0) {
    throw new Error('at least one evidence observation is required for cross-source resolution');
  }
  const lead = dominantObservation(observations);
  const splitting = assessContributionSplitting(lead.contributionClass, lead.projectWorkIdentifier, observations);
  const material: CanonicalHumanContributionEventMaterial = Object.freeze({
    humanEconomicIdentityId: lead.humanEconomicIdentityId,
    contributionClass: lead.contributionClass,
    authoritativeIdCommitments: mergedAuthoritativeIds(observations) as CanonicalHumanContributionEventMaterial['authoritativeIdCommitments'],
    ...(lead.issuerCommitment !== undefined ? { issuerCommitment: lead.issuerCommitment } : {}),
    ...(lead.projectWorkIdentifier !== undefined ? { projectWorkIdentifier: lead.projectWorkIdentifier } : {}),
    validFromUtc: lead.validFromUtc,
    validUntilUtc: lead.validUntilUtc,
    contentCommitment: lead.contentCommitment,
    ...(lead.contributorRole !== undefined ? { contributorRole: lead.contributorRole } : {}),
    measurementQuantity: lead.measurementQuantity,
    measurementUnit: lead.measurementUnit,
  });
  const canonicalEvent = buildCanonicalHumanContributionEvent(material);
  const sourceClasses = Object.freeze([...new Set(observations.map((observation) => observation.sourceClass))].sort());
  let resolutionStatus = resolutionStatusFor(observations);
  if (splitting.suspected) {
    resolutionStatus = 'SPLITTING_SUSPECTED';
  }
  return Object.freeze({
    canonicalEvent,
    observationIds: Object.freeze(observations.map((observation) => observation.observationId)),
    sourceClasses,
    resolutionStatus,
    splittingReason: splitting.reason,
  });
}

export function observationsShareCanonicalEvent(left: EvidenceObservation, right: EvidenceObservation): boolean {
  const leftIds = new Set(left.authoritativeIdCommitments.map((id) => String(id)));
  for (const id of right.authoritativeIdCommitments) {
    if (leftIds.has(String(id))) {
      return true;
    }
  }
  if (left.projectWorkIdentifier && left.projectWorkIdentifier === right.projectWorkIdentifier) {
    return left.contentCommitment === right.contentCommitment;
  }
  if (left.receiptId && left.receiptId === right.receiptId) {
    return true;
  }
  if (left.credentialCommitment && left.credentialCommitment === right.credentialCommitment) {
    return true;
  }
  return false;
}

export function groupObservationsByCanonicalEvent(
  observations: readonly EvidenceObservation[],
): readonly EvidenceObservation[][] {
  const groups: EvidenceObservation[][] = [];
  const assigned = new Set<string>();
  for (const observation of observations) {
    if (assigned.has(observation.observationId)) {
      continue;
    }
    const group = [observation];
    assigned.add(observation.observationId);
    for (const candidate of observations) {
      if (assigned.has(candidate.observationId)) {
        continue;
      }
      if (observationsShareCanonicalEvent(observation, candidate)) {
        group.push(candidate);
        assigned.add(candidate.observationId);
      }
    }
    groups.push(group);
  }
  return Object.freeze(groups);
}
