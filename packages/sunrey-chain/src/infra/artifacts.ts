/**
 * Exact artifact digests from merged Chunks 61–65 and 59.
 * No free-form "completed" flags. External auditor/HSM/counsel slots
 * remain incomplete.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formalReportPayload, rangeReportPayload } from '../audit/bundle.ts';
import { SECURITY_CONTROLS } from '../audit/controls.ts';
import { KNOWN_SECURITY_LIMITATIONS } from '../audit/limitations.ts';
import { loadFormalModelRegistry } from '../formal/registry.ts';
import { buildFormalVerificationReport, publicAssuranceView } from '../formal/report.ts';
import { FIRST_RC_ID } from '../release-candidate/types.ts';
import { freezeApi, freezeProtocol } from '../release-candidate/freeze.ts';
import { collectSoftwareInventory } from '../supply-chain/inventory.ts';
import { buildProvenance, buildTargetSbom, provenanceDigest, sbomDigest } from '../supply-chain/release.ts';
import { runFullCeremonyRehearsal } from '../../../security/src/ceremony/rehearsal.ts';
import { IAC_MODULES } from './config.ts';
import { digestJson, infraSha256, stableJson } from './hash.ts';
import { INFRA_SCHEMA_VERSION, INFRA_TOOL_VERSION } from './types.ts';

export type ReadinessArtifactDigests = {
  readonly formalReportDigest: string;
  readonly formalRegistryDigest: string;
  readonly auditBundleDigest: string;
  readonly rcQualificationDigest: string;
  readonly rootOfTrustRehearsalDigest: string;
  readonly releaseProvenanceDigest: string;
  readonly sbomDigest: string;
  readonly infraControlPlaneDigest: string;
};

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

let cached: ReadinessArtifactDigests | null = null;

function formalRegistryFileDigest(root: string): string {
  const path = join(root, 'packages/sunrey-chain/formal/registry/formal-model-registry.json');
  return infraSha256(readFileSync(path));
}

function infraControlPlaneDigest(): string {
  return infraSha256(
    [
      INFRA_TOOL_VERSION,
      String(INFRA_SCHEMA_VERSION),
      ...IAC_MODULES.map((row) => `${row.moduleId}:${row.kind}:${row.path}`),
    ].join('|'),
  );
}

function formalRegistryFileDigest(): string {
  const path = join(REPO_ROOT, 'packages/sunrey-chain/formal/registry/formal-model-registry.json');
  return infraSha256(readFileSync(path));
}

function engineeringAuditBundleDigest(): string {
  return infraSha256(
    [
      stableJson(formalReportPayload()),
      stableJson(rangeReportPayload()),
      stableJson(SECURITY_CONTROLS),
      stableJson(KNOWN_SECURITY_LIMITATIONS),
    ].join(''),
  );
}

export function collectReadinessArtifactDigests(root = REPO_ROOT): ReadinessArtifactDigests {
  if (cached) {
    return cached;
  }
  const registry = loadFormalModelRegistry();
  const report = buildFormalVerificationReport('FORMAL_SMOKE');
  const formalReportDigest = digestJson(publicAssuranceView(report));
  const formalRegistryDigest = formalRegistryFileDigest(root);
  const formalRegistryDigest = formalRegistryFileDigest();
  const protocol = freezeProtocol(root);
  const api = freezeApi(root);
  const rcQualificationDigest = infraSha256(
    `${FIRST_RC_ID}:${protocol.combinedHash}:${api.digest}:${registry.claimLanguage}`,
  );
  const rehearsal = runFullCeremonyRehearsal({
    ceremonyId: 'cerm_rehearsal_chunk66_link',
    fixtureEnv: { SUNREY_FIXTURE_ENV: 'test' },
  });
  if (!rehearsal.ok) {
    throw new TypeError(`root-of-trust rehearsal failed: ${rehearsal.error.message}`);
  }
  const inventory = collectSoftwareInventory(root);
  const sbom = buildTargetSbom('sunrey-node', inventory, protocol.combinedHash);
  const provenance = buildProvenance({
    sourceCommit: 'chunk-66-readiness-link',
    artifactName: 'sunrey-production-candidate-infra',
    artifactDigest: protocol.combinedHash,
    packageLock: 'linked',
    cargoLockRust: 'linked',
    cargoLockNode: 'linked',
    builderId: 'sunrey-infra/readiness-link',
    protocolVersion: protocol.protocolVersion,
    networkCompatibility: 'net_sunrey_production_candidate_1',
    toolchain: 'node-22+rust-workspace',
  });
  cached = Object.freeze({
    formalReportDigest,
    formalRegistryDigest,
    auditBundleDigest: engineeringAuditBundleDigest(),
    rcQualificationDigest,
    rootOfTrustRehearsalDigest: rehearsal.value.transcriptHash,
    releaseProvenanceDigest: provenanceDigest(provenance),
    sbomDigest: sbomDigest(sbom),
    infraControlPlaneDigest: infraControlPlaneDigest(),
  });
  return cached;
}

export function resetArtifactDigestCache(): void {
  cached = null;
}
