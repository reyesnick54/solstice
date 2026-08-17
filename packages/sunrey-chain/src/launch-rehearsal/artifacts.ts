/**
 * Verify signed release artifacts for the rehearsal.
 *
 * Uses current release tooling. A software signature is not protocol
 * activation and is not Execution Authority.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildProvenance,
  buildReleaseRecord,
  buildTargetSbom,
  localTestReleaseAuthority,
  provenanceDigest,
  sbomDigest,
  signArtifact,
  verifyRelease,
  verifySignature,
} from '../supply-chain/release.ts';
import { sha256Text } from '../supply-chain/inventory.ts';
import { resolveSourceCommit } from '../release-candidate/identity.ts';
import { REHEARSAL_NETWORK_ID, REHEARSAL_PROTOCOL_VERSION } from './identity.ts';

export type RehearsalReleaseVerification = {
  readonly sourceCommit: string;
  readonly artifactDigest: string;
  readonly sbomDigest: string;
  readonly provenanceDigest: string;
  readonly signatureVerified: boolean;
  readonly protocolCompatible: boolean;
  readonly schemaCompatible: boolean;
  readonly ok: boolean;
};

export function verifyRehearsalReleaseArtifacts(root = process.cwd()): RehearsalReleaseVerification {
  const sourceCommit = resolveSourceCommit(root);
  const { authority } = localTestReleaseAuthority();
  const artifact = JSON.stringify({
    kind: 'SUNREY_MAINNET_REHEARSAL_RELEASE',
    sourceCommit,
    protocolVersion: REHEARSAL_PROTOCOL_VERSION,
    networkCompatibility: REHEARSAL_NETWORK_ID,
    environment: 'simulation',
    productionActivated: false,
  });
  const artifactDigest = sha256Text(artifact);
  const signed = signArtifact(Buffer.from(artifact, 'utf8'), authority);
  const sbom = buildTargetSbom(
    'sunrey-node',
    [
      {
        name: '@solstice/sunrey-chain',
        version: '0.1.0',
        source: 'first-party',
        integrity: artifactDigest,
        license: 'UNLICENSED',
        direct: true,
        role: 'runtime',
        ecosystem: 'first-party',
        criticality: 'consensus',
        classification: 'APPROVED',
      },
    ],
    artifactDigest,
  );
  const provenance = buildProvenance({
    sourceCommit,
    artifactName: 'sunrey-node',
    artifactDigest,
    packageLock: 'lock',
    cargoLockRust: 'lock',
    cargoLockNode: 'lock',
    builderId: 'sunrey-launch-rehearsal',
    protocolVersion: REHEARSAL_PROTOCOL_VERSION,
    networkCompatibility: REHEARSAL_NETWORK_ID,
    toolchain: 'node22+rust',
  });
  const manifest = buildReleaseRecord({
    releaseId: 'rel_sunrey_mainnet_rehearsal_1',
    sourceCommit,
    artifactDigest,
    sbom,
    provenance,
    authority,
    protocolCompatibility: REHEARSAL_PROTOCOL_VERSION,
    reproduced: 'NOT_ATTEMPTED',
  });
  const verification = verifyRelease({
    artifact,
    manifest,
    signature: signed,
    sbom,
    provenance,
    expectedCommit: sourceCommit,
    expectedToolchain: 'node22+rust',
    expectedProtocol: REHEARSAL_PROTOCOL_VERSION,
    expectedNetwork: REHEARSAL_NETWORK_ID,
    authority,
  });
  const rustSdk = existsSync(join(root, 'packages/sunrey-chain/rust/crates/sdk/src/lib.rs'));
  const tsSdk = existsSync(join(root, 'packages/sunrey-sdk/src/index.ts'));
  return Object.freeze({
    sourceCommit,
    artifactDigest,
    sbomDigest: sbomDigest(sbom),
    provenanceDigest: provenanceDigest(provenance),
    signatureVerified: verifySignature(Buffer.from(artifact, 'utf8'), signed, authority),
    protocolCompatible: verification.ok,
    schemaCompatible: tsSdk && rustSdk,
    ok: verification.ok,
  });
}
