import { KNOWN_SECURITY_LIMITATIONS } from '../../audit/limitations.ts';
import { AUDIT_CLAIMS_EXTERNAL_AUDIT } from '../../audit/types.ts';
import {
  DEFAULT_PRODUCTION_SECURITY_POLICY,
  fixtureFindings,
  fixtureReview,
  reviewSatisfiesRealExternalReadiness,
} from '../../audit/remediation/index.ts';
import { buildSecurityReviewStatusReport } from '../../audit/remediation/report.ts';
import { sha256Text } from '../../supply-chain/inventory.ts';
import type { AuditRemediationSnapshot } from './types.ts';

/**
 * Consume Chunk 83 actual external-review state.
 * Internal fixtures cannot satisfy external review.
 */
export function snapshotAuditRemediation(): AuditRemediationSnapshot {
  const review = fixtureReview();
  const findings = fixtureFindings();
  const report = buildSecurityReviewStatusReport({
    review,
    findings,
    acceptedRisks: [],
    policy: DEFAULT_PRODUCTION_SECURITY_POLICY,
  });
  const realExternal = reviewSatisfiesRealExternalReadiness(review);
  const open = KNOWN_SECURITY_LIMITATIONS.filter((row) => row.status === 'OPEN');
  const accepted = KNOWN_SECURITY_LIMITATIONS.filter((row) => row.status === 'ACCEPTED_WITH_HUMAN_APPROVAL');
  const critical = open.filter((row) => row.riskClassification === 'CRITICAL').map((row) => row.limitation_id);
  const high = open.filter((row) => row.riskClassification === 'HIGH').map((row) => row.limitation_id);
  return Object.freeze({
    externalReviewStatus: realExternal ? 'COMPLETED_WITH_EVIDENCE' : 'ENGINEERING_PREPARATION_ONLY',
    openFindings: Object.freeze(open.map((row) => row.limitation_id)),
    criticalBlockers: Object.freeze(critical),
    highFindings: Object.freeze(high),
    riskAcceptances: Object.freeze(accepted.map((row) => row.limitation_id)),
    retestState: 'NOT_APPLICABLE',
    claimsExternalAuditPassed: false,
    digest: sha256Text(
      JSON.stringify({
        claims: AUDIT_CLAIMS_EXTERNAL_AUDIT,
        realExternal,
        fixtureOnly: report.fixtureOnly,
        readinessEffect: report.readinessEffect,
        open: open.map((row) => row.limitation_id),
        high,
        critical,
      }),
    ),
  });
}

export function rejectFakeAuditResult(snapshot: AuditRemediationSnapshot, claimedPass: boolean): void {
  if (claimedPass || snapshot.claimsExternalAuditPassed !== false || snapshot.externalReviewStatus === 'COMPLETED_WITH_EVIDENCE') {
    throw new TypeError('fake audit result rejected');
  }
}

export function openCriticalFindingBlocksAuthorization(snapshot: AuditRemediationSnapshot): boolean {
  return snapshot.criticalBlockers.length > 0;
}
