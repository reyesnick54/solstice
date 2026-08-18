import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ENVIRONMENT } from '../../../../config/src/index.ts';
import { collectSoftwareInventory, sha256Text } from '../../supply-chain/inventory.ts';
import {
  buildProvenance,
  buildTargetSbom,
  localTestReleaseAuthority,
  provenanceDigest,
  sbomDigest,
  signArtifact,
  verifySignature,
} from '../../supply-chain/release.ts';
import { PRODUCTION_CANDIDATE_PROTOCOL_VERSION } from '../../mainnet/identity.ts';
import { snapshotAuditRemediation } from './audit.ts';
import {
  freezeMainnetCrypto,
  freezeMainnetEconomic,
  freezeMainnetProtocol,
  freezeMainnetSource,
  freezeProductionNetworkCandidateV2,
  freezeRootOfTrust,
  mainnetMaterialChange,
} from './freeze.ts';
import { mainnetUtcNow, nextMainnetReleaseCandidateId, resolveMainnetSourceCommit } from './identity.ts';
import { loadMainnetKnownLimitations } from './limitations.ts';
import { reportHsmState, snapshotProviderAcceptance } from './providers.ts';
import { deriveMainnetRcStatus, qualifyMainnetReleaseCandidate } from './qualify.ts';
import { buildMainnetQualificationReport } from './report.ts';
import {
  FIRST_MAINNET_RC_ID,
  MAINNET_QUALIFICATION_CATEGORIES,
  type MainnetQualificationEvidence,
  type MainnetQualificationProfile,
  type MainnetQualificationReport,
  type MainnetReleaseComparison,
  type MainnetReleaseVerificationReport,
  type SignedMainnetRcBundle,
} from './types.ts';

export type CreatedMainnetCandidate = {
  readonly bundle: SignedMainnetRcBundle;
  readonly report: MainnetQualificationReport;
  readonly evidence: MainnetQualificationEvidence;
};

function signText(value: string, authorityId: string): string {
  const { authority } = localTestReleaseAuthority();
  const signed = signArtifact(Buffer.from(value), authority);
  return `${authorityId}:${signed.signatureHex}`;
}

export function createMainnetReleaseCandidate(input: {
  readonly root: string;
  readonly sourceCommit?: string | undefined;
  readonly rcId?: string | undefined;
  readonly profile?: MainnetQualificationProfile;
  readonly previous?: SignedMainnetRcBundle | null;
  readonly expectedCandidateV2Hash?: string | undefined;
}): CreatedMainnetCandidate {
  if (ENVIRONMENT !== 'simulation') {
    throw new TypeError('mainnet RC create requires ENVIRONMENT=simulation');
  }
  const sourceCommit = resolveMainnetSourceCommit(input.root, input.sourceCommit);
  const rcId = input.rcId ?? (input.previous ? nextMainnetReleaseCandidateId(input.previous.manifest.mainnet_rc_id) : FIRST_MAINNET_RC_ID);
  const { authority } = localTestReleaseAuthority();
  const artifactsPlaceholder = signText(`mainnet-rc:${rcId}:${sourceCommit}`, authority.authorityId);
  const sourceFreeze = freezeMainnetSource(input.root, sourceCommit, artifactsPlaceholder);
  const protocolFreeze = freezeMainnetProtocol(input.root);
  const economicFreeze = freezeMainnetEconomic(input.root);
  const candidateV2 = freezeProductionNetworkCandidateV2(input.expectedCandidateV2Hash);
  const cryptoFreeze = freezeMainnetCrypto();
  const rootOfTrust = freezeRootOfTrust();
  const hsm = reportHsmState();
  const providers = snapshotProviderAcceptance();
  const audit = snapshotAuditRemediation();
  const inventory = collectSoftwareInventory(input.root);
  const sbom = buildTargetSbom('sunrey-node', inventory, sourceFreeze.sbomDigest);
  const provenance = buildProvenance({
    sourceCommit,
    artifactName: 'sunrey-mainnet-rc',
    artifactDigest: sourceFreeze.combinedDigest,
    packageLock: sourceFreeze.npmLockDigest,
    cargoLockRust: sourceFreeze.cargoLockRustDigest,
    cargoLockNode: sourceFreeze.cargoLockNodeDigest,
    builderId: 'sunrey-release/mainnet-rc-local-test',
    protocolVersion: PRODUCTION_CANDIDATE_PROTOCOL_VERSION,
    networkCompatibility: candidateV2.networkId,
    toolchain: `${sourceFreeze.rustToolchain}+node-${sourceFreeze.nodeToolchain}`,
  });
  const evidence = qualifyMainnetReleaseCandidate({
    root: input.root,
    rcId,
    sourceCommit,
    profile: input.profile ?? 'smoke',
  });
  const status = deriveMainnetRcStatus(evidence.matrix);
  const manifest = Object.freeze({
    schemaVersion: 1 as const,
    mainnet_rc_id: rcId,
    source_commit: sourceCommit,
    protocol_version: PRODUCTION_CANDIDATE_PROTOCOL_VERSION,
    api_version: 'v1' as const,
    candidate_v2_id: candidateV2.candidateId,
    candidate_v2_hash: candidateV2.rootHash,
    economic_rc_id: economicFreeze.economicRcId,
    economic_rc_hash: economicFreeze.economicRcHash,
    protocol_freeze_hash: protocolFreeze.combinedHash,
    source_freeze_hash: sourceFreeze.combinedDigest,
    crypto_policy_hash: cryptoFreeze.digest,
    provider_matrix_hash: providers.digest,
    audit_snapshot_hash: audit.digest,
    root_of_trust_hash: rootOfTrust.digest,
    hsm_state: hsm.state,
    sbom_digest: sbomDigest(sbom),
    provenance_digest: provenanceDigest(provenance),
    qualification_result: status,
    environment: 'simulation' as const,
    ticker_status: 'NOT_ASSIGNED' as const,
    mainnet_enabled: false as const,
    mainnet_ready: false as const,
    production_financial_services: false as const,
    signing_activates_network: false as const,
    engineering_qualified_is_not_authorized_candidate: true as const,
    created_at_utc: mainnetUtcNow(),
  });
  const limitations = loadMainnetKnownLimitations(input.root);
  const bundle: SignedMainnetRcBundle = Object.freeze({
    manifest,
    sourceFreeze: Object.freeze({ ...sourceFreeze, releaseSignature: signText(sourceFreeze.combinedDigest, authority.authorityId) }),
    protocolFreeze,
    economicFreeze,
    candidateV2,
    cryptoFreeze,
    rootOfTrust,
    hsm,
    providers,
    audit,
    qualification: evidence.matrix,
    evidence,
    limitations,
    signatures: Object.freeze({
      manifest: signText(JSON.stringify(manifest), authority.authorityId),
      artifacts: signText(sourceFreeze.combinedDigest, authority.authorityId),
      sbom: signText(sbomDigest(sbom), authority.authorityId),
      provenance: signText(provenanceDigest(provenance), authority.authorityId),
      qualification: signText(evidence.matrix.combinedDigest, authority.authorityId),
    }),
    authorityId: authority.authorityId,
    supersededBy: null,
  });
  return Object.freeze({
    bundle,
    report: buildMainnetQualificationReport(bundle),
    evidence,
  });
}

export function verifyMainnetReleaseCandidate(
  bundle: SignedMainnetRcBundle,
  expectedCommit?: string,
  root?: string,
): MainnetReleaseVerificationReport {
  const { authority } = localTestReleaseAuthority();
  const expectedQualification = sha256Text(
    bundle.qualification.cells.map((row) => `${row.category}:${row.state}:${row.evidenceDigest}`).join('|'),
  );
  const recomputedCandidate = root ? freezeProductionNetworkCandidateV2() : null;
  const recomputedEconomic = root ? freezeMainnetEconomic(root) : null;
  const checks = [
    { id: 'not-mainnet', ok: bundle.manifest.mainnet_enabled === false && bundle.manifest.mainnet_ready === false, detail: 'mainnetEnabled=false' },
    { id: 'tickers', ok: bundle.manifest.ticker_status === 'NOT_ASSIGNED', detail: 'NOT_ASSIGNED' },
    { id: 'environment', ok: bundle.manifest.environment === 'simulation' && ENVIRONMENT === 'simulation', detail: 'simulation' },
    { id: 'signing-does-not-activate', ok: bundle.manifest.signing_activates_network === false, detail: 'ReleaseAuthority cannot activate network' },
    { id: 'not-authorized-candidate', ok: bundle.manifest.engineering_qualified_is_not_authorized_candidate === true && bundle.manifest.qualification_result !== 'SUPERSEDED' ? bundle.manifest.qualification_result !== ('AUTHORIZED_CANDIDATE' as string) : true, detail: bundle.manifest.qualification_result },
    { id: 'commit', ok: expectedCommit === undefined || bundle.manifest.source_commit === expectedCommit, detail: bundle.manifest.source_commit },
    { id: 'qualification-commit', ok: bundle.qualification.cells.every((row) => row.sourceCommit === bundle.manifest.source_commit), detail: 'all cells reference RC commit' },
    { id: 'matrix-complete', ok: bundle.qualification.cells.length === MAINNET_QUALIFICATION_CATEGORIES.length, detail: `${bundle.qualification.cells.length} categories` },
    { id: 'not-launch', ok: bundle.qualification.notLaunchAuthorization === true, detail: 'qualification is not launch authorization' },
    { id: 'limitations-visible', ok: bundle.limitations.length > 0 && bundle.limitations.every((row) => row.hiddenFromReleaseNotes === false), detail: `${bundle.limitations.length} limitations` },
    { id: 'candidate-v2', ok: recomputedCandidate === null || recomputedCandidate.rootHash === bundle.candidateV2.rootHash, detail: bundle.candidateV2.rootHash },
    { id: 'economic-rc', ok: recomputedEconomic === null || recomputedEconomic.combinedHash === bundle.economicFreeze.combinedHash, detail: bundle.economicFreeze.combinedHash },
    { id: 'audit-not-faked', ok: bundle.audit.claimsExternalAuditPassed === false && bundle.audit.externalReviewStatus !== 'COMPLETED_WITH_EVIDENCE', detail: bundle.audit.externalReviewStatus },
    { id: 'hsm-not-external', ok: bundle.hsm.simulationSatisfiesExternalHardware === false && bundle.hsm.fixtureSatisfiesExternalHardware === false, detail: bundle.hsm.state },
    { id: 'legal-missing', ok: bundle.qualification.cells.some((row) => row.category === 'LEGAL_REGULATORY' && row.state === 'EXTERNAL_EVIDENCE_REQUIRED'), detail: 'legal evidence remains missing' },
    { id: 'human-required', ok: bundle.qualification.cells.some((row) => row.category === 'HUMAN_AUTHORIZATION' && row.state === 'HUMAN_AUTHORIZATION_REQUIRED'), detail: 'human authorization required' },
    { id: 'open-critical-respected', ok: bundle.audit.criticalBlockers.length === 0 || bundle.manifest.qualification_result !== 'ENGINEERING_QUALIFIED' || bundle.qualification.cells.some((row) => row.category === 'EXTERNAL_SECURITY_REVIEW' && row.state !== 'PASS'), detail: `${bundle.audit.criticalBlockers.length} critical blockers` },
    {
      id: 'signer',
      ok: verifySignature(Buffer.from(JSON.stringify(bundle.manifest)), {
        artifactDigest: sha256Text(Buffer.from(JSON.stringify(bundle.manifest))),
        publicKeyHex: authority.publicKeyHex,
        signatureHex: bundle.signatures.manifest.split(':')[1] ?? '',
        suiteId: authority.suiteId,
        authorityId: authority.authorityId,
      }, authority),
      detail: 'ReleaseAuthority manifest signature',
    },
    { id: 'qualification-digest', ok: expectedQualification === bundle.qualification.combinedDigest, detail: bundle.qualification.combinedDigest },
    { id: 'provider-digest', ok: bundle.manifest.provider_matrix_hash === bundle.providers.digest, detail: bundle.providers.digest },
    { id: 'audit-digest', ok: bundle.manifest.audit_snapshot_hash === bundle.audit.digest, detail: bundle.audit.digest },
    { id: 'status-supersede', ok: bundle.manifest.qualification_result !== 'SUPERSEDED' || bundle.supersededBy !== null, detail: bundle.manifest.qualification_result },
  ];
  return Object.freeze({
    ok: checks.every((row) => row.ok),
    rcId: bundle.manifest.mainnet_rc_id,
    sourceCommit: bundle.manifest.source_commit,
    checks,
  });
}

export function compareMainnetReleaseCandidates(left: SignedMainnetRcBundle, right: SignedMainnetRcBundle): MainnetReleaseComparison {
  const diff = (field: string, a: string, b: string) => (a === b ? null : Object.freeze({ field, left: a, right: b }));
  const sourceChanges = [
    diff('source_commit', left.manifest.source_commit, right.manifest.source_commit),
    diff('source_freeze', left.sourceFreeze.combinedDigest, right.sourceFreeze.combinedDigest),
  ].filter((row): row is { readonly field: string; readonly left: string; readonly right: string } => row !== null);
  const protocolChanges = [
    diff('protocol_freeze', left.protocolFreeze.combinedHash, right.protocolFreeze.combinedHash),
    diff('candidate_v2', left.candidateV2.rootHash, right.candidateV2.rootHash),
  ].filter((row): row is { readonly field: string; readonly left: string; readonly right: string } => row !== null);
  const economicChanges = [
    diff('economic_rc', left.economicFreeze.combinedHash, right.economicFreeze.combinedHash),
  ].filter((row): row is { readonly field: string; readonly left: string; readonly right: string } => row !== null);
  const providerChanges = [
    diff('providers', left.providers.digest, right.providers.digest),
  ].filter((row): row is { readonly field: string; readonly left: string; readonly right: string } => row !== null);
  const securityChanges = [
    diff('crypto', left.cryptoFreeze.digest, right.cryptoFreeze.digest),
    diff('hsm', left.hsm.state, right.hsm.state),
  ].filter((row): row is { readonly field: string; readonly left: string; readonly right: string } => row !== null);
  const auditChanges = [
    diff('audit', left.audit.digest, right.audit.digest),
  ].filter((row): row is { readonly field: string; readonly left: string; readonly right: string } => row !== null);
  const qualificationChanges = [
    diff('qualification', left.qualification.combinedDigest, right.qualification.combinedDigest),
    diff('status', left.manifest.qualification_result, right.manifest.qualification_result),
  ].filter((row): row is { readonly field: string; readonly left: string; readonly right: string } => row !== null);
  return Object.freeze({
    left: left.manifest.mainnet_rc_id,
    right: right.manifest.mainnet_rc_id,
    materialChange: mainnetMaterialChange(left, right) || left.qualification.combinedDigest !== right.qualification.combinedDigest,
    sourceChanges: Object.freeze(sourceChanges),
    protocolChanges: Object.freeze(protocolChanges),
    economicChanges: Object.freeze(economicChanges),
    providerChanges: Object.freeze(providerChanges),
    securityChanges: Object.freeze(securityChanges),
    auditChanges: Object.freeze(auditChanges),
    qualificationChanges: Object.freeze(qualificationChanges),
  });
}

export function supersedeMainnetReleaseCandidate(previous: SignedMainnetRcBundle, next: SignedMainnetRcBundle): {
  readonly previous: SignedMainnetRcBundle;
  readonly next: SignedMainnetRcBundle;
} {
  return Object.freeze({
    previous: Object.freeze({
      ...previous,
      manifest: Object.freeze({ ...previous.manifest, qualification_result: 'SUPERSEDED' as const }),
      supersededBy: next.manifest.mainnet_rc_id,
    }),
    next,
  });
}

export function writeMainnetRcBundle(directory: string, bundle: SignedMainnetRcBundle): string {
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'mainnet-rc-manifest.json');
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
  return path;
}

export function mainnetRcStatusPayload(bundle: SignedMainnetRcBundle): {
  readonly rcId: string;
  readonly status: string;
  readonly sourceCommit: string;
  readonly candidateV2Hash: string;
  readonly economicRcHash: string;
  readonly mainnetEnabled: false;
  readonly authorizedCandidate: false;
  readonly banner: 'SUNREY MAINNET RC';
} {
  return Object.freeze({
    rcId: bundle.manifest.mainnet_rc_id,
    status: bundle.manifest.qualification_result,
    sourceCommit: bundle.manifest.source_commit,
    candidateV2Hash: bundle.manifest.candidate_v2_hash,
    economicRcHash: bundle.manifest.economic_rc_hash,
    mainnetEnabled: false,
    authorizedCandidate: false,
    banner: 'SUNREY MAINNET RC',
  });
}

export function invalidateMainnetBundle(
  bundle: SignedMainnetRcBundle,
  field:
    | 'binary'
    | 'container'
    | 'policy'
    | 'candidate'
    | 'provider'
    | 'security'
    | 'qualification'
    | 'limitation'
    | 'sbom'
    | 'provenance',
): SignedMainnetRcBundle {
  if (field === 'binary' || field === 'container') {
    return Object.freeze({
      ...bundle,
      sourceFreeze: Object.freeze({ ...bundle.sourceFreeze, combinedDigest: sha256Text(`tamper:${field}:${bundle.sourceFreeze.combinedDigest}`) }),
    });
  }
  if (field === 'policy') {
    return Object.freeze({
      ...bundle,
      economicFreeze: Object.freeze({ ...bundle.economicFreeze, combinedHash: sha256Text(`tamper-policy:${bundle.economicFreeze.combinedHash}`) }),
    });
  }
  if (field === 'candidate') {
    return Object.freeze({
      ...bundle,
      candidateV2: Object.freeze({ ...bundle.candidateV2, rootHash: sha256Text(`tamper-candidate:${bundle.candidateV2.rootHash}`) }),
    });
  }
  if (field === 'provider') {
    return Object.freeze({
      ...bundle,
      providers: Object.freeze({ ...bundle.providers, digest: sha256Text('tamper-provider') }),
    });
  }
  if (field === 'security') {
    return Object.freeze({
      ...bundle,
      audit: Object.freeze({ ...bundle.audit, digest: sha256Text('tamper-audit'), claimsExternalAuditPassed: false as const }),
    });
  }
  if (field === 'limitation') {
    return Object.freeze({
      ...bundle,
      limitations: Object.freeze(bundle.limitations.map((row) => Object.freeze({ ...row, title: `tampered:${row.title}` }))),
    });
  }
  if (field === 'sbom') {
    return Object.freeze({
      ...bundle,
      manifest: Object.freeze({ ...bundle.manifest, sbom_digest: sha256Text('tamper-sbom') }),
    });
  }
  if (field === 'provenance') {
    return Object.freeze({
      ...bundle,
      manifest: Object.freeze({ ...bundle.manifest, provenance_digest: sha256Text('tamper-provenance') }),
    });
  }
  return Object.freeze({
    ...bundle,
    qualification: Object.freeze({ ...bundle.qualification, combinedDigest: sha256Text('tamper-qualification') }),
  });
}

export function rejectAiReleaseAuthorization(actorKind: string): void {
  if (actorKind === 'AI' || actorKind === 'AGENT' || actorKind === 'AUTOMATION') {
    throw new TypeError('AI release authorization rejected');
  }
}
