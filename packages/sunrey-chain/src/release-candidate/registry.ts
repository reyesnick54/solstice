import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { collectSoftwareInventory, sha256Text } from '../supply-chain/inventory.ts';
import {
  buildProvenance,
  buildTargetSbom,
  localTestReleaseAuthority,
  provenanceDigest,
  sbomDigest,
  signArtifact,
  verifySignature,
} from '../supply-chain/release.ts';
import { FEATURE_INVENTORY, assertNoAmbiguousFeatureState } from './features.ts';
import {
  freezeApi,
  freezeArtifacts,
  freezeCryptoPolicy,
  freezeDependencies,
  freezeProtocol,
  governancePolicyHash,
  materialFreezeChange,
  moduleHashes,
  nativeAssetRegistryHash,
  testnetIdentityFreeze,
} from './freeze.ts';
import { nextReleaseCandidateId, resolveSourceCommit, utcNow } from './identity.ts';
import { generateReleaseNotes } from './notes.ts';
import { deriveRcStatus, qualifyReleaseCandidate, type QualificationEvidence } from './qualification.ts';
import type {
  QualificationProfile,
  RcCompareReport,
  RcVerifyReport,
  SignedRcBundle,
  TestnetReleaseCandidateManifest,
} from './types.ts';
import { FIRST_RC_ID } from './types.ts';

export type CreatedCandidate = {
  readonly bundle: SignedRcBundle;
  readonly evidence: QualificationEvidence;
};

function signText(value: string, authorityId: string): string {
  const { authority } = localTestReleaseAuthority();
  const signed = signArtifact(Buffer.from(value), authority);
  return `${authorityId}:${signed.signatureHex}`;
}

export function createReleaseCandidate(input: {
  readonly root: string;
  readonly sourceCommit?: string;
  readonly rcId?: string;
  readonly profile?: QualificationProfile;
  readonly enduranceTicks?: number;
  readonly previous?: SignedRcBundle | null;
}): CreatedCandidate {
  assertNoAmbiguousFeatureState();
  const sourceCommit = resolveSourceCommit(input.root, input.sourceCommit);
  const rcId = input.rcId ?? (input.previous ? nextReleaseCandidateId(input.previous.manifest.rc_id) : FIRST_RC_ID);
  const identity = testnetIdentityFreeze();
  const protocol = freezeProtocol(input.root);
  const api = freezeApi(input.root);
  const crypto = freezeCryptoPolicy();
  const deps = freezeDependencies(input.root);
  const artifacts = freezeArtifacts(input.root);
  const inventory = collectSoftwareInventory(input.root);
  const sbom = buildTargetSbom('sunrey-node', inventory, artifacts.combinedDigest);
  const provenance = buildProvenance({
    sourceCommit,
    artifactName: 'sunrey-testnet-rc',
    artifactDigest: artifacts.combinedDigest,
    packageLock: deps.npmLockDigest,
    cargoLockRust: deps.cargoLockRustDigest,
    cargoLockNode: deps.cargoLockNodeDigest,
    builderId: 'sunrey-release/rc-local-test',
    protocolVersion: protocol.protocolVersion,
    networkCompatibility: identity.networkId,
    toolchain: `${deps.toolchain.rust}+node-${deps.toolchain.node}`,
  });
  const { authority } = localTestReleaseAuthority();
  const building: TestnetReleaseCandidateManifest = Object.freeze({
    schemaVersion: 1,
    rc_id: rcId,
    source_commit: sourceCommit,
    protocol_version: protocol.protocolVersion,
    api_version: 'v1',
    testnet_network_id: identity.networkId,
    chain_id: identity.chainId,
    genesis_hash: identity.genesisHash,
    validator_set_fixture_hash: identity.validatorSetHash,
    protocol_schema_hash: protocol.combinedHash,
    module_hashes: moduleHashes(input.root),
    crypto_suite_policy: crypto,
    native_asset_registry_hash: nativeAssetRegistryHash(input.root),
    governance_policy_hash: governancePolicyHash(input.root),
    dependency_lock_digests: deps,
    sbom_digest: sbomDigest(sbom),
    provenance_digest: provenanceDigest(provenance),
    formal_report_digest: 'pending',
    audit_bundle_digest: sha256Text(artifacts.combinedDigest),
    fuzz_report_reference: 'pending',
    adversarial_report_reference: 'pending',
    performance_baseline_reference: 'packages/sunrey-chain/perf/baseline/manifest.json',
    build_artifact_digests: artifacts.digests,
    qualification_state: 'BUILDING',
    environment: 'simulation',
    ticker_status: 'NOT_ASSIGNED',
    mainnet_ready: false,
    production_financial_services: false,
    created_at_utc: utcNow(),
  });

  const evidence = qualifyReleaseCandidate({
    root: input.root,
    rcId,
    sourceCommit,
    profile: input.profile ?? 'smoke',
    ...(input.enduranceTicks !== undefined ? { enduranceTicks: input.enduranceTicks } : {}),
  });
  const status = deriveRcStatus(evidence.matrix);
  const manifest: TestnetReleaseCandidateManifest = Object.freeze({
    ...building,
    formal_report_digest: evidence.formal.digest,
    fuzz_report_reference: evidence.fuzz.digest,
    adversarial_report_reference: evidence.adversarial.digest,
    qualification_state: status,
  });
  const notes = generateReleaseNotes(input.root, manifest, evidence);
  const bundle: SignedRcBundle = Object.freeze({
    manifest,
    featureInventory: FEATURE_INVENTORY,
    protocolFreeze: protocol,
    apiFreeze: api,
    qualification: evidence.matrix,
    notes,
    signatures: Object.freeze({
      manifest: signText(JSON.stringify(manifest), authority.authorityId),
      artifacts: signText(artifacts.combinedDigest, authority.authorityId),
      sbom: signText(manifest.sbom_digest, authority.authorityId),
      provenance: signText(manifest.provenance_digest, authority.authorityId),
      qualification: signText(evidence.matrix.combinedDigest, authority.authorityId),
    }),
    authorityId: authority.authorityId,
    supersededBy: null,
  });
  return Object.freeze({ bundle, evidence });
}

export function verifyReleaseCandidate(bundle: SignedRcBundle, expectedCommit?: string): RcVerifyReport {
  const { authority } = localTestReleaseAuthority();
  const checks = [
    { id: 'banner', ok: bundle.notes.banner === 'SUNREY TESTNET', detail: bundle.notes.banner },
    { id: 'not-mainnet', ok: bundle.manifest.mainnet_ready === false && bundle.notes.mainnetReady === false, detail: 'no mainnet implication' },
    { id: 'tickers', ok: bundle.manifest.ticker_status === 'NOT_ASSIGNED', detail: 'NOT_ASSIGNED' },
    { id: 'environment', ok: bundle.manifest.environment === 'simulation', detail: 'simulation' },
    { id: 'network-identity', ok: bundle.manifest.testnet_network_id === 'net_sunrey_testnet_1', detail: bundle.manifest.testnet_network_id },
    { id: 'commit', ok: expectedCommit === undefined || bundle.manifest.source_commit === expectedCommit, detail: bundle.manifest.source_commit },
    { id: 'qualification-commit', ok: bundle.qualification.cells.every((row) => row.sourceCommit === bundle.manifest.source_commit), detail: 'all cells reference RC commit' },
    { id: 'limitations-visible', ok: bundle.notes.knownLimitations.length > 0 && bundle.notes.knownLimitations.every((row) => row.hiddenFromReleaseNotes === false), detail: `${bundle.notes.knownLimitations.length} limitations` },
    { id: 'feature-states', ok: bundle.featureInventory.every((row) => row.state === 'FROZEN_IN_RC' || row.state === 'EXCLUDED_FROM_RC' || row.state === 'EXPERIMENTAL_TESTNET_ONLY'), detail: 'no ambiguous feature state' },
    { id: 'signer', ok: verifySignature(Buffer.from(JSON.stringify(bundle.manifest)), {
      artifactDigest: sha256Text(Buffer.from(JSON.stringify(bundle.manifest))),
      publicKeyHex: authority.publicKeyHex,
      signatureHex: bundle.signatures.manifest.split(':')[1] ?? '',
      suiteId: authority.suiteId,
      authorityId: authority.authorityId,
    }, authority), detail: 'ReleaseAuthority manifest signature' },
    { id: 'status-not-mainnet', ok: bundle.manifest.qualification_state !== 'SUPERSEDED' || bundle.supersededBy !== null, detail: bundle.manifest.qualification_state },
  ];
  return Object.freeze({
    ok: checks.every((row) => row.ok),
    rcId: bundle.manifest.rc_id,
    sourceCommit: bundle.manifest.source_commit,
    checks,
  });
}

export function compareReleaseCandidates(left: SignedRcBundle, right: SignedRcBundle): RcCompareReport {
  const fields: readonly (readonly [string, string, string])[] = [
    ['source_commit', left.manifest.source_commit, right.manifest.source_commit],
    ['protocol_schema_hash', left.manifest.protocol_schema_hash, right.manifest.protocol_schema_hash],
    ['api_digest', left.apiFreeze.digest, right.apiFreeze.digest],
    ['dependency_digest', left.manifest.dependency_lock_digests.combinedDigest, right.manifest.dependency_lock_digests.combinedDigest],
    ['artifact_digest', sha256Text(JSON.stringify(left.manifest.build_artifact_digests)), sha256Text(JSON.stringify(right.manifest.build_artifact_digests))],
    ['genesis_hash', left.manifest.genesis_hash, right.manifest.genesis_hash],
  ];
  const differences = fields
    .filter(([, a, b]) => a !== b)
    .map(([field, a, b]) => Object.freeze({ field, left: a, right: b }));
  const material = materialFreezeChange({
    protocol: { left: left.manifest.protocol_schema_hash, right: right.manifest.protocol_schema_hash },
    api: { left: left.apiFreeze.digest, right: right.apiFreeze.digest },
    deps: { left: left.manifest.dependency_lock_digests.combinedDigest, right: right.manifest.dependency_lock_digests.combinedDigest },
    artifacts: {
      left: sha256Text(JSON.stringify(left.manifest.build_artifact_digests)),
      right: sha256Text(JSON.stringify(right.manifest.build_artifact_digests)),
    },
    sourceCommit: { left: left.manifest.source_commit, right: right.manifest.source_commit },
  });
  return Object.freeze({
    left: left.manifest.rc_id,
    right: right.manifest.rc_id,
    materialChange: material,
    differences,
  });
}

export function supersedeReleaseCandidate(previous: SignedRcBundle, next: SignedRcBundle): {
  readonly previous: SignedRcBundle;
  readonly next: SignedRcBundle;
} {
  return Object.freeze({
    previous: Object.freeze({
      ...previous,
      manifest: Object.freeze({ ...previous.manifest, qualification_state: 'SUPERSEDED' as const }),
      supersededBy: next.manifest.rc_id,
    }),
    next,
  });
}

export function writeRcBundle(directory: string, bundle: SignedRcBundle): string {
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'rc-manifest.json');
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
  return path;
}

export function rcStatusPayload(bundle: SignedRcBundle): {
  readonly rcId: string;
  readonly status: string;
  readonly sourceCommit: string;
  readonly protocolVersion: string;
  readonly genesisHash: string;
  readonly mainnetReady: false;
  readonly banner: 'SUNREY TESTNET';
} {
  return Object.freeze({
    rcId: bundle.manifest.rc_id,
    status: bundle.manifest.qualification_state,
    sourceCommit: bundle.manifest.source_commit,
    protocolVersion: bundle.manifest.protocol_version,
    genesisHash: bundle.manifest.genesis_hash,
    mainnetReady: false,
    banner: 'SUNREY TESTNET',
  });
}
