import { createExternalSecurityReview } from './review.ts';
import { receiveExternalFinding } from './finding.ts';
import { TEST_FIXTURE_NOT_EXTERNAL_AUDIT } from './types.ts';
import type { ExternalSecurityFinding, ExternalSecurityReview } from './types.ts';

/**
 * Fictional independent-review fixtures. Clearly labeled
 * TEST_FIXTURE_NOT_EXTERNAL_AUDIT. They must never satisfy real
 * external-review readiness.
 */
export const FIXTURE_REVIEW_ID = 'REV-TEST-FIXTURE-001' as const;
export const FIXTURE_CRITICAL_ID = 'FND-TEST-CRITICAL-001' as const;
export const FIXTURE_HIGH_ID = 'FND-TEST-HIGH-001' as const;
export const FIXTURE_INFO_ID = 'FND-TEST-INFO-001' as const;
export const FIXTURE_PROVIDER_ID = 'FND-TEST-PROVIDER-001' as const;

export function fixtureReview(): ExternalSecurityReview {
  return createExternalSecurityReview({
    reviewId: FIXTURE_REVIEW_ID,
    reviewOrganizationReference: 'org_ref_test_fixture_not_named',
    scope: 'TEST_FIXTURE isolated consensus and custody surfaces',
    sourceCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    protocolVersion: '1',
    releaseCandidate: 'SUNREY_TESTNET_RC_1',
    reportDigest: 'fixture-report-digest-not-external',
    fixture: true,
  });
}

export function fixtureFindings(): readonly ExternalSecurityFinding[] {
  const critical = receiveExternalFinding({
    findingId: FIXTURE_CRITICAL_ID,
    externalReviewId: FIXTURE_REVIEW_ID,
    externalSeverity: 'CRITICAL',
    title: 'TEST_FIXTURE fictional consensus safety observation',
    affectedComponent: 'packages/sunrey-chain/rust/crates/consensus',
    affectedSurface: 'consensus',
    affectedCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    descriptionReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT description ref',
    evidenceReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT evidence ref',
    disclosureClass: 'SECURITY_RESTRICTED',
    fixture: true,
  }).finding;
  const high = receiveExternalFinding({
    findingId: FIXTURE_HIGH_ID,
    externalReviewId: FIXTURE_REVIEW_ID,
    externalSeverity: 'HIGH',
    title: 'TEST_FIXTURE fictional custody signing observation',
    affectedComponent: 'packages/custody',
    affectedSurface: 'custody',
    affectedCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    descriptionReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT description ref',
    evidenceReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT evidence ref',
    disclosureClass: 'REVIEWER_SHARED',
    fixture: true,
  }).finding;
  const info = receiveExternalFinding({
    findingId: FIXTURE_INFO_ID,
    externalReviewId: FIXTURE_REVIEW_ID,
    externalSeverity: 'INFORMATIONAL',
    title: 'TEST_FIXTURE fictional documentation observation',
    affectedComponent: 'docs/audit',
    affectedSurface: 'operations',
    affectedCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    descriptionReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT description ref',
    evidenceReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT evidence ref',
    disclosureClass: 'PUBLIC',
    fixture: true,
  }).finding;
  const provider = receiveExternalFinding({
    findingId: FIXTURE_PROVIDER_ID,
    externalReviewId: FIXTURE_REVIEW_ID,
    externalSeverity: 'MEDIUM',
    title: 'TEST_FIXTURE fictional provider-surface observation',
    affectedComponent: 'packages/custody/src/regulated',
    affectedSurface: 'custody',
    affectedCommit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    descriptionReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT description ref',
    evidenceReference: 'TEST_FIXTURE_NOT_EXTERNAL_AUDIT evidence ref',
    disclosureClass: 'REVIEWER_SHARED',
    providerSurfaceReference: 'chunk82:hsm_custody:sim-provider',
    fixture: true,
  }).finding;
  return Object.freeze([critical, high, info, provider]);
}

export function assertFixtureNeverReal(review: ExternalSecurityReview): void {
  if (review.fixtureLabel !== TEST_FIXTURE_NOT_EXTERNAL_AUDIT) {
    throw new Error('expected TEST_FIXTURE_NOT_EXTERNAL_AUDIT label');
  }
  if (review.claimsExternalAuditCompleted !== false) {
    throw new Error('fixture review cannot claim an external audit completed');
  }
}
