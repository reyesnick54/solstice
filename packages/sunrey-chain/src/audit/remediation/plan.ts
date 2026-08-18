import { requiresHeightenedReview, heightenedBoundaryFor } from './surfaces.ts';
import type { ExternalSecurityFinding, FindingRemediationEvidence, FindingRemediationPlan } from './types.ts';

const CUSTOM_CRYPTO = /homemade|homegrown|roll.?our.?own|custom.?cipher|invented.?primitive/i;

export function createRemediationPlan(input: {
  readonly planId: string;
  readonly finding: ExternalSecurityFinding;
  readonly rootCauseDescription: string;
  readonly affectedAuthorityBoundary: string;
  readonly proposedFix: string;
  readonly migrationImpact: string;
  readonly compatibilityImpact: string;
  readonly securityAssumptions: string;
  readonly requiredTests: readonly string[];
  readonly owner: string;
  readonly targetRelease: string;
  readonly usesEstablishedPrimitives?: boolean;
}): FindingRemediationPlan {
  if (!input.planId.trim() || !input.owner.trim() || !input.targetRelease.trim()) {
    throw new Error('FindingRemediationPlan requires plan id, owner, and target release');
  }
  if (!input.rootCauseDescription.trim() || !input.proposedFix.trim()) {
    throw new Error('FindingRemediationPlan requires root-cause and proposed fix');
  }
  if (input.finding.affectedSurface === 'cryptography' || input.finding.affectedSurface === 'PQC') {
    if (CUSTOM_CRYPTO.test(input.proposedFix) || input.usesEstablishedPrimitives === false) {
      throw new Error('a crypto finding must not be remediated with homegrown cryptography');
    }
  }
  const heightened = requiresHeightenedReview(input.finding.affectedSurface);
  return Object.freeze({
    planId: input.planId,
    findingId: input.finding.findingId,
    rootCauseDescription: input.rootCauseDescription,
    affectedAuthorityBoundary: input.affectedAuthorityBoundary,
    proposedFix: input.proposedFix,
    migrationImpact: input.migrationImpact,
    compatibilityImpact: input.compatibilityImpact,
    securityAssumptions: input.securityAssumptions,
    requiredTests: Object.freeze([...input.requiredTests]),
    owner: input.owner,
    targetRelease: input.targetRelease,
    heightenedReviewRequired: heightened,
    heightenedReviewBoundary: heightenedBoundaryFor(input.finding.affectedSurface),
    usesHomegrownCryptography: false,
    usesEstablishedPrimitives: input.usesEstablishedPrimitives !== false,
  });
}

export function recordRemediationEvidence(input: {
  readonly evidenceId: string;
  readonly plan: FindingRemediationPlan;
  readonly remediatedCommit: string;
  readonly patchDigest: string;
  readonly artifactHash: string;
  readonly notes: string;
}): FindingRemediationEvidence {
  if (!input.remediatedCommit.trim() || !input.patchDigest.trim() || !input.artifactHash.trim()) {
    throw new Error('FindingRemediationEvidence requires remediated commit, patch digest, and artifact hash');
  }
  return Object.freeze({
    evidenceId: input.evidenceId,
    findingId: input.plan.findingId,
    planId: input.plan.planId,
    remediatedCommit: input.remediatedCommit,
    patchDigest: input.patchDigest,
    artifactHash: input.artifactHash,
    notes: input.notes,
  });
}
