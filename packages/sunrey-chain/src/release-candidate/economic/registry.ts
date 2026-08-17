import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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
import { freezeArtifacts, freezeDependencies, testnetIdentityFreeze } from '../freeze.ts';
import { TESTNET_PROTOCOL_VERSION } from '../../testnet/identity.ts';
import { bindEconomicSource, economicMaterialChange, economicSchemaChange, freezeEconomicPolicies, freezeEconomicSchemas } from './freeze.ts';
import { economicUtcNow, nextEconomicReleaseCandidateId, resolveEconomicSourceCommit } from './identity.ts';
import { loadEconomicKnownLimitations } from './limitations.ts';
import { deriveEconomicRcStatus, qualifyEconomicReleaseCandidate } from './qualify.ts';
import { buildEconomicQualificationReport } from './report.ts';
import {
  FIRST_ECONOMIC_RC_ID,
  type EconomicQualificationEvidence,
  type EconomicQualificationProfile,
  type EconomicQualificationReport,
  type EconomicRcVerifyReport,
  type EconomicReleaseComparison,
  type SignedEconomicRcBundle,
} from './types.ts';

export type CreatedEconomicCandidate = {
  readonly bundle: SignedEconomicRcBundle;
  readonly report: EconomicQualificationReport;
  readonly evidence: EconomicQualificationEvidence;
};

function signText(value: string, authorityId: string): string {
  const { authority } = localTestReleaseAuthority();
  const signed = signArtifact(Buffer.from(value), authority);
  return `${authorityId}:${signed.signatureHex}`;
}

export function createEconomicReleaseCandidate(input: {
  readonly root: string;
  readonly sourceCommit?: string;
  readonly rcId?: string;
  readonly profile?: EconomicQualificationProfile;
  readonly previous?: SignedEconomicRcBundle | null;
}): CreatedEconomicCandidate {
  const sourceCommit = resolveEconomicSourceCommit(input.root, input.sourceCommit);
  const rcId = input.rcId ?? (input.previous ? nextEconomicReleaseCandidateId(input.previous.manifest.economic_rc_id) : FIRST_ECONOMIC_RC_ID);
  const identity = testnetIdentityFreeze();
  const policy = freezeEconomicPolicies(input.root);
  const schema = freezeEconomicSchemas(input.root);
  const artifacts = freezeArtifacts(input.root);
  const deps = freezeDependencies(input.root);
  const inventory = collectSoftwareInventory(input.root);
  const sbom = buildTargetSbom('sunrey-node', inventory, artifacts.combinedDigest);
  const provenance = buildProvenance({
    sourceCommit,
    artifactName: 'sunrey-economic-testnet-rc',
    artifactDigest: artifacts.combinedDigest,
    packageLock: deps.npmLockDigest,
    cargoLockRust: deps.cargoLockRustDigest,
    cargoLockNode: deps.cargoLockNodeDigest,
    builderId: 'sunrey-release/economic-rc-local-test',
    protocolVersion: TESTNET_PROTOCOL_VERSION,
    networkCompatibility: identity.networkId,
    toolchain: `${deps.toolchain.rust}+node-${deps.toolchain.node}`,
  });
  const evidence = qualifyEconomicReleaseCandidate({
    root: input.root,
    rcId,
    sourceCommit,
    profile: input.profile ?? 'smoke',
  });
  const status = deriveEconomicRcStatus(evidence.matrix);
  const sourceBinding = bindEconomicSource({
    root: input.root,
    sourceCommit,
    policy,
    schema,
    formalDigest: evidence.formal.digest,
    stressDigest: evidence.stress.digest,
    supplyChainDigest: deps.combinedDigest,
  });
  const manifest = Object.freeze({
    schemaVersion: 1 as const,
    economic_rc_id: rcId,
    source_commit: sourceCommit,
    protocol_version: TESTNET_PROTOCOL_VERSION,
    api_version: 'v1' as const,
    network_id: identity.networkId,
    chain_id: identity.chainId,
    monetary_policy_hashes: Object.freeze({
      sunrey: policy.hashes.sunreyMonetaryPolicy,
      moonrey: policy.hashes.moonreyMonetaryPolicy,
    }),
    fee_policy_hash: policy.hashes.feePolicyV2,
    validator_economics_hash: sha256Text(`${policy.hashes.validatorBondPolicy}|${policy.hashes.validatorRewardPolicy}|${policy.hashes.validatorPenaltyPolicy}`),
    moonrey_policy_hash: policy.hashes.moonreyProductivePolicy,
    treasury_policy_hash: policy.hashes.protocolTreasuryPolicy,
    formal_report_hash: evidence.formal.digest,
    stress_report_hash: evidence.stress.digest,
    simulation_report_hash: evidence.simulation.digest,
    sbom_digest: sbomDigest(sbom),
    release_provenance_digest: provenanceDigest(provenance),
    qualification_result: status,
    environment: 'simulation' as const,
    ticker_status: 'NOT_ASSIGNED' as const,
    mainnet_ready: false as const,
    production_financial_services: false as const,
    signing_activates_policy: false as const,
    created_at_utc: economicUtcNow(),
  });
  const { authority } = localTestReleaseAuthority();
  const limitations = loadEconomicKnownLimitations(input.root);
  const bundle: SignedEconomicRcBundle = Object.freeze({
    manifest,
    sourceBinding,
    policyFreeze: policy,
    schemaFreeze: schema,
    qualification: evidence.matrix,
    evidence,
    limitations,
    signatures: Object.freeze({
      manifest: signText(JSON.stringify(manifest), authority.authorityId),
      policyBundle: signText(policy.combinedHash, authority.authorityId),
      qualification: signText(evidence.matrix.combinedDigest, authority.authorityId),
      formal: signText(evidence.formal.digest, authority.authorityId),
      stress: signText(evidence.stress.digest, authority.authorityId),
      sbom: signText(manifest.sbom_digest, authority.authorityId),
      provenance: signText(manifest.release_provenance_digest, authority.authorityId),
    }),
    authorityId: authority.authorityId,
    supersededBy: null,
  });
  return Object.freeze({
    bundle,
    report: buildEconomicQualificationReport(bundle),
    evidence,
  });
}

export function verifyEconomicReleaseCandidate(bundle: SignedEconomicRcBundle, expectedCommit?: string, root?: string): EconomicRcVerifyReport {
  const { authority } = localTestReleaseAuthority();
  const recomputedPolicy = root ? freezeEconomicPolicies(root) : null;
  const recomputedSchema = root ? freezeEconomicSchemas(root) : null;
  const expectedQualification = sha256Text(bundle.qualification.cells.map((row) => `${row.category}:${row.state}:${row.evidenceDigest}`).join('|'));
  const checks = [
    { id: 'not-mainnet', ok: bundle.manifest.mainnet_ready === false, detail: 'no mainnet implication' },
    { id: 'tickers', ok: bundle.manifest.ticker_status === 'NOT_ASSIGNED', detail: 'NOT_ASSIGNED' },
    { id: 'environment', ok: bundle.manifest.environment === 'simulation', detail: 'simulation' },
    { id: 'signing-does-not-activate', ok: bundle.manifest.signing_activates_policy === false, detail: 'ReleaseAuthority does not activate policy' },
    { id: 'network-identity', ok: bundle.manifest.network_id === 'net_sunrey_testnet_1', detail: bundle.manifest.network_id },
    { id: 'commit', ok: expectedCommit === undefined || bundle.manifest.source_commit === expectedCommit, detail: bundle.manifest.source_commit },
    { id: 'qualification-commit', ok: bundle.qualification.cells.every((row) => row.sourceCommit === bundle.manifest.source_commit), detail: 'all cells reference RC commit' },
    { id: 'matrix-complete', ok: bundle.qualification.cells.length === 21, detail: `${bundle.qualification.cells.length} categories` },
    { id: 'not-regulatory', ok: bundle.qualification.notRegulatoryApproval === true, detail: 'qualification is not regulatory approval' },
    { id: 'limitations-visible', ok: bundle.limitations.length > 0 && bundle.limitations.every((row) => row.hiddenFromReleaseNotes === false), detail: `${bundle.limitations.length} limitations` },
    { id: 'unconfigured-visible', ok: bundle.policyFreeze.unconfiguredProductionValues.every((row) => row.value === 'UNCONFIGURED'), detail: `${bundle.policyFreeze.unconfiguredProductionValues.length} unconfigured values` },
    { id: 'stress-not-hidden', ok: bundle.evidence.stress.hiddenFailures === false, detail: `${bundle.evidence.stress.criticalFailures.length} critical failures disclosed` },
    { id: 'extended-not-claimed', ok: bundle.evidence.extended.claimedDurationCompleted === false, detail: 'no invented extended duration' },
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
    { id: 'policy-digest', ok: recomputedPolicy === null || recomputedPolicy.combinedHash === bundle.policyFreeze.combinedHash, detail: bundle.policyFreeze.combinedHash },
    { id: 'schema-digest', ok: recomputedSchema === null || recomputedSchema.combinedHash === bundle.schemaFreeze.combinedHash, detail: bundle.schemaFreeze.combinedHash },
    { id: 'artifact-digest', ok: !root || freezeArtifacts(root).combinedDigest === bundle.sourceBinding.releaseArtifactDigest, detail: bundle.sourceBinding.releaseArtifactDigest },
    { id: 'qualification-digest', ok: expectedQualification === bundle.qualification.combinedDigest, detail: bundle.qualification.combinedDigest },
    { id: 'formal-binding', ok: bundle.manifest.formal_report_hash === bundle.evidence.formal.digest, detail: bundle.manifest.formal_report_hash },
    { id: 'stress-binding', ok: bundle.manifest.stress_report_hash === bundle.evidence.stress.digest, detail: bundle.manifest.stress_report_hash },
    { id: 'status-supersede', ok: bundle.manifest.qualification_result !== 'SUPERSEDED' || bundle.supersededBy !== null, detail: bundle.manifest.qualification_result },
  ];
  return Object.freeze({
    ok: checks.every((row) => row.ok),
    rcId: bundle.manifest.economic_rc_id,
    sourceCommit: bundle.manifest.source_commit,
    checks,
  });
}

export function compareEconomicReleaseCandidates(left: SignedEconomicRcBundle, right: SignedEconomicRcBundle): EconomicReleaseComparison {
  const policyChanges = Object.entries(left.policyFreeze.hashes)
    .filter(([key, value]) => value !== right.policyFreeze.hashes[key as keyof typeof right.policyFreeze.hashes])
    .map(([field, value]) => Object.freeze({ field, left: value, right: right.policyFreeze.hashes[field as keyof typeof right.policyFreeze.hashes] }));
  const schemaChanges = Object.entries(left.schemaFreeze.hashes)
    .filter(([key, value]) => value !== right.schemaFreeze.hashes[key as keyof typeof right.schemaFreeze.hashes])
    .map(([field, value]) => Object.freeze({ field, left: value, right: right.schemaFreeze.hashes[field as keyof typeof right.schemaFreeze.hashes] }));
  const parameterChanges = [
    ['source_commit', left.manifest.source_commit, right.manifest.source_commit],
    ['qualification_result', left.manifest.qualification_result, right.manifest.qualification_result],
  ]
    .filter(([, a, b]) => a !== b)
    .map(([field, a, b]) => Object.freeze({ field, left: a, right: b }));
  const formalChanges = left.evidence.formal.digest === right.evidence.formal.digest
    ? []
    : [Object.freeze({ field: 'formal_digest', left: left.evidence.formal.digest, right: right.evidence.formal.digest })];
  const stressChanges = left.evidence.stress.digest === right.evidence.stress.digest
    ? []
    : [Object.freeze({ field: 'stress_digest', left: left.evidence.stress.digest, right: right.evidence.stress.digest })];
  const supplyBehaviorChanges = left.evidence.supply.digest === right.evidence.supply.digest
    ? []
    : [Object.freeze({ field: 'supply_digest', left: left.evidence.supply.digest, right: right.evidence.supply.digest })];
  const material = economicMaterialChange(left.policyFreeze, right.policyFreeze)
    || economicSchemaChange(left.schemaFreeze, right.schemaFreeze)
    || left.manifest.source_commit !== right.manifest.source_commit
    || left.qualification.combinedDigest !== right.qualification.combinedDigest;
  const compatibilityStatus = material
    ? (schemaChanges.length > 0 || policyChanges.length > 0 ? 'BREAKING' : 'COMPATIBLE')
    : 'IDENTICAL';
  return Object.freeze({
    left: left.manifest.economic_rc_id,
    right: right.manifest.economic_rc_id,
    materialChange: material,
    policyChanges: Object.freeze(policyChanges),
    schemaChanges: Object.freeze(schemaChanges),
    parameterChanges: Object.freeze(parameterChanges),
    formalChanges: Object.freeze(formalChanges),
    stressChanges: Object.freeze(stressChanges),
    supplyBehaviorChanges: Object.freeze(supplyBehaviorChanges),
    compatibilityStatus,
  });
}

export function supersedeEconomicReleaseCandidate(previous: SignedEconomicRcBundle, next: SignedEconomicRcBundle): {
  readonly previous: SignedEconomicRcBundle;
  readonly next: SignedEconomicRcBundle;
} {
  return Object.freeze({
    previous: Object.freeze({
      ...previous,
      manifest: Object.freeze({ ...previous.manifest, qualification_result: 'SUPERSEDED' as const }),
      supersededBy: next.manifest.economic_rc_id,
    }),
    next,
  });
}

export function writeEconomicRcBundle(directory: string, bundle: SignedEconomicRcBundle): string {
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'economic-rc-manifest.json');
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
  return path;
}

export function economicRcStatusPayload(bundle: SignedEconomicRcBundle): {
  readonly rcId: string;
  readonly status: string;
  readonly sourceCommit: string;
  readonly protocolVersion: string;
  readonly mainnetReady: false;
  readonly banner: 'SUNREY ECONOMIC TESTNET RC';
} {
  return Object.freeze({
    rcId: bundle.manifest.economic_rc_id,
    status: bundle.manifest.qualification_result,
    sourceCommit: bundle.manifest.source_commit,
    protocolVersion: bundle.manifest.protocol_version,
    mainnetReady: false,
    banner: 'SUNREY ECONOMIC TESTNET RC',
  });
}

export function invalidateEconomicBundle(bundle: SignedEconomicRcBundle, field: 'policy' | 'schema' | 'artifact' | 'evidence' | 'qualification'): SignedEconomicRcBundle {
  if (field === 'policy') {
    return Object.freeze({
      ...bundle,
      policyFreeze: Object.freeze({ ...bundle.policyFreeze, combinedHash: sha256Text(`tamper:${bundle.policyFreeze.combinedHash}`) }),
    });
  }
  if (field === 'schema') {
    return Object.freeze({
      ...bundle,
      schemaFreeze: Object.freeze({ ...bundle.schemaFreeze, combinedHash: sha256Text(`tamper:${bundle.schemaFreeze.combinedHash}`) }),
    });
  }
  if (field === 'artifact') {
    return Object.freeze({
      ...bundle,
      sourceBinding: Object.freeze({ ...bundle.sourceBinding, releaseArtifactDigest: sha256Text('tamper-artifact') }),
    });
  }
  if (field === 'evidence') {
    return Object.freeze({
      ...bundle,
      evidence: Object.freeze({
        ...bundle.evidence,
        formal: Object.freeze({ ...bundle.evidence.formal, digest: sha256Text('tamper-formal') }),
      }),
    });
  }
  return Object.freeze({
    ...bundle,
    qualification: Object.freeze({ ...bundle.qualification, combinedDigest: sha256Text('tamper-qualification') }),
  });
}
