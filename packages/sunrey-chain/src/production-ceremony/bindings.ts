/**
 * Bind the actual merged Chunk 81 Candidate V2, Chunk 84 Mainnet RC,
 * Chunk 82 ProductionProviderMatrix, Chunk 83 audit remediation, and
 * Chunk 65 MainnetReadinessRegistry. Stand-in identifiers are not
 * production ceremony defaults.
 */

import { createProductionNetworkCandidateV2 } from '../mainnet/candidate-v2/assemble.ts';
import { CANDIDATE_V2_ID } from '../mainnet/candidate-v2/identity.ts';
import { verifyProductionNetworkCandidateV2 } from '../mainnet/candidate-v2/verify.ts';
import { consumeLegalRegulatory } from '../mainnet/consumers.ts';
import { assembleReadinessRegistry } from '../mainnet/registry.ts';
import type { MainnetReadinessRegistry } from '../mainnet/types.ts';
import { PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID, productionCandidateCryptoPolicy } from '../mainnet/crypto-policy.ts';
import { allocationManifestHash, emptyAllocationManifest } from '../mainnet/allocation.ts';
import {
  fixtureFindings,
  fixtureReview,
  reviewSatisfiesRealExternalReadiness,
  TEST_FIXTURE_NOT_EXTERNAL_AUDIT,
} from '../audit/remediation/index.ts';
import { buildSecurityReviewStatusReport } from '../audit/remediation/report.ts';
import { DEFAULT_PRODUCTION_SECURITY_POLICY } from '../audit/remediation/policy.ts';
import { KNOWN_SECURITY_LIMITATIONS } from '../audit/limitations.ts';
import { createProviderAcceptanceFixture, missingEvidenceFor } from '../providers/fixture.ts';
import { buildAcceptanceReport, buildProductionProviderMatrix } from '../providers/report.ts';
import type { AcceptanceState, ProductionProviderMatrix } from '../providers/types.ts';
import {
  createMainnetReleaseCandidate,
  FIRST_MAINNET_RC_ID,
  verifyMainnetReleaseCandidate,
  type SignedMainnetRcBundle,
} from '../release-candidate/mainnet/index.ts';
import { FIRST_RC_ID } from '../release-candidate/types.ts';
import { ECONOMIC_RC_ID } from '../economic-rehearsal/identity.ts';
import { encodeString, sha256Hex } from '../validators/canonical.ts';
import { EXPECTED_CANDIDATE_V2_ID, EXPECTED_MAINNET_RC_ID } from './identity.ts';

export type ArtifactBinding = {
  readonly id: string;
  readonly hash: string | null;
  readonly present: boolean;
  readonly source: string;
  readonly verified: boolean;
  readonly usableForProduction: boolean;
  readonly notes: string;
};

export type ProviderAcceptanceBinding = {
  readonly providerId: string;
  readonly acceptanceStatus: AcceptanceState | 'NOT_PRESENT';
  readonly engineeringTested: boolean;
  readonly humanAccepted: boolean;
  readonly productionEligible: boolean;
  readonly matrix: ProductionProviderMatrix | null;
  readonly notes: string;
};

export type AuditBinding = {
  readonly chunk83Present: boolean;
  readonly externalReviewStatus: string;
  readonly claimsExternalAudit: false;
  readonly fixtureSatisfiesExternalReview: false;
  readonly openCritical: readonly string[];
  readonly openHigh: readonly string[];
  readonly notes: string;
};

const rcCache = new Map<string, { binding: ArtifactBinding; bundle: SignedMainnetRcBundle }>();

export function cryptoPolicyHash(): string {
  return sha256Hex(Buffer.concat([encodeString('sunrey.cryptopolicy.hash.v1'), encodeString(PRODUCTION_CANDIDATE_CRYPTO_POLICY_ID)]));
}

export function economicBundleHash(): string {
  return sha256Hex(
    Buffer.concat([
      encodeString('sunrey.economic.bundle.hash.v1'),
      encodeString(ECONOMIC_RC_ID),
      encodeString(productionCandidateCryptoPolicy().policyId),
    ]),
  );
}

export function productionAllocationHash(): string {
  return allocationManifestHash(emptyAllocationManifest());
}

export function mainnetRcCryptographicHash(bundle: SignedMainnetRcBundle): string {
  return sha256Hex(
    Buffer.concat([
      encodeString('sunrey.mainnet-rc.manifest.v1'),
      encodeString(bundle.manifest.mainnet_rc_id),
      encodeString(bundle.manifest.source_commit),
      encodeString(bundle.manifest.candidate_v2_id),
      encodeString(bundle.manifest.candidate_v2_hash),
      encodeString(bundle.manifest.protocol_freeze_hash),
      encodeString(bundle.manifest.source_freeze_hash),
      encodeString(bundle.manifest.economic_rc_hash),
      encodeString(bundle.manifest.crypto_policy_hash),
      encodeString(bundle.manifest.provider_matrix_hash),
      encodeString(bundle.manifest.audit_snapshot_hash),
      encodeString(bundle.manifest.limitations_hash),
      encodeString(bundle.signatures.manifest),
    ]),
  );
}

export function consumeCandidateV2(root = process.cwd()): ArtifactBinding {
  const candidate = createProductionNetworkCandidateV2(root);
  const report = verifyProductionNetworkCandidateV2(candidate, root);
  if (candidate.candidateId !== CANDIDATE_V2_ID || candidate.candidateId !== EXPECTED_CANDIDATE_V2_ID) {
    throw new TypeError(`wrong Candidate V2 rejected: ${candidate.candidateId}`);
  }
  return Object.freeze({
    id: candidate.candidateId,
    hash: candidate.candidateRootHash,
    present: true,
    source: 'packages/sunrey-chain/src/mainnet/candidate-v2',
    verified: report.ok,
    usableForProduction: false,
    notes:
      'Canonical Chunk 81 ProductionNetworkCandidateV2 bound by candidateRootHash. Topology, validator set, network identity, or economic policy changes invalidate the binding.',
  });
}

export function consumeMainnetRc(root = process.cwd()): ArtifactBinding {
  const cached = rcCache.get(root);
  if (cached) {
    return cached.binding;
  }
  const created = createMainnetReleaseCandidate({
    root,
    rcId: FIRST_MAINNET_RC_ID,
    profile: 'smoke',
  });
  const verified = verifyMainnetReleaseCandidate(created.bundle, created.bundle.manifest.source_commit, root);
  if (created.bundle.manifest.mainnet_rc_id !== EXPECTED_MAINNET_RC_ID) {
    throw new TypeError(`wrong Mainnet RC rejected: ${created.bundle.manifest.mainnet_rc_id}`);
  }
  const binding = Object.freeze({
    id: created.bundle.manifest.mainnet_rc_id,
    hash: mainnetRcCryptographicHash(created.bundle),
    present: true,
    source: 'packages/sunrey-chain/src/release-candidate/mainnet',
    verified: verified.ok,
    usableForProduction: false,
    notes: 'Canonical Chunk 84 SUNREY_MAINNET_RC_1 cryptographic manifest verified. Release authority does not equal genesis authority.',
  });
  rcCache.set(root, { binding, bundle: created.bundle });
  return binding;
}

export function consumeMainnetRcBundle(root = process.cwd()): SignedMainnetRcBundle {
  consumeMainnetRc(root);
  return rcCache.get(root)!.bundle;
}

export function consumeProviderAcceptance(_root = process.cwd()): ProviderAcceptanceBinding {
  const fixture = createProviderAcceptanceFixture();
  const inputs = fixture.suites.map((suite) =>
    Object.freeze({
      providerId: suite.providerId,
      domain: suite.domain,
      configured: true,
      suite,
      evidence: missingEvidenceFor(suite.providerId, suite.domain),
      humanAccepted: false,
      humanReviewerKind: null,
      nowUtc: fixture.nowUtc,
    }),
  );
  const report = buildAcceptanceReport(inputs, fixture.nowUtc);
  const matrix = buildProductionProviderMatrix(report.results);
  const engineering = matrix.rows.filter((row) => row.engineeringTested && !row.humanAccepted && !row.productionEligible);
  return Object.freeze({
    providerId: matrix.rows[0]?.providerId ?? 'UNCONFIGURED',
    acceptanceStatus: engineering.length > 0 ? 'ENGINEERING_TESTED' : 'NOT_CONFIGURED',
    engineeringTested: engineering.length > 0,
    humanAccepted: matrix.rows.some((row) => row.humanAccepted),
    productionEligible: false,
    matrix,
    notes:
      'Chunk 82 ProductionProviderMatrix consumed. ENGINEERING_TESTED is distinct from HUMAN_ACCEPTED and PRODUCTION_ELIGIBLE. No provider is production eligible.',
  });
}

export function consumeAuditEvidence(_root = process.cwd()): AuditBinding {
  const review = fixtureReview();
  const findings = fixtureFindings();
  const report = buildSecurityReviewStatusReport({
    review,
    findings,
    acceptedRisks: [],
    policy: DEFAULT_PRODUCTION_SECURITY_POLICY,
  });
  const real = reviewSatisfiesRealExternalReadiness(review);
  const openCritical = KNOWN_SECURITY_LIMITATIONS.filter(
    (row) => row.status === 'OPEN' && row.riskClassification === 'CRITICAL',
  ).map((row) => row.limitation_id);
  const openHigh = KNOWN_SECURITY_LIMITATIONS.filter(
    (row) => row.status === 'OPEN' && row.riskClassification === 'HIGH',
  ).map((row) => row.limitation_id);
  return Object.freeze({
    chunk83Present: true,
    externalReviewStatus: real ? 'HUMAN_VERIFIED' : report.readinessEffect,
    claimsExternalAudit: false,
    fixtureSatisfiesExternalReview: false,
    openCritical: Object.freeze(openCritical),
    openHigh: Object.freeze(openHigh),
    notes: `${TEST_FIXTURE_NOT_EXTERNAL_AUDIT} cannot satisfy real external-review readiness. Chunk 83 readiness effect ${report.readinessEffect}.`,
  });
}

export function consumeReadinessRegistry(): MainnetReadinessRegistry {
  return assembleReadinessRegistry();
}

export function consumeLegalLicense(): {
  readonly legal: ReturnType<typeof consumeLegalRegulatory>;
  readonly licenseMissing: true;
  readonly legalMissing: true;
} {
  return Object.freeze({
    legal: consumeLegalRegulatory(),
    licenseMissing: true,
    legalMissing: true,
  });
}

export function verifyReleaseAuthorityIndependently(rc: ArtifactBinding): boolean {
  return rc.verified && rc.hash !== null && rc.id !== FIRST_RC_ID && rc.id === EXPECTED_MAINNET_RC_ID;
}
