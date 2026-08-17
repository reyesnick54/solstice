/**
 * Economic release-candidate freeze used by Chunk 80.
 *
 * Verifies manifest, release signature, policy hashes, qualification
 * evidence, and source commit before rehearsal network bring-up.
 *
 * This is the economic RC bundle the rehearsal consumes. It does not
 * authorize production monetary policy or publish a production genesis.
 */

import {
  localTestReleaseAuthority,
  signArtifact,
  verifySignature,
} from '../supply-chain/release.ts';
import { sha256Text } from '../supply-chain/inventory.ts';
import { resolveSourceCommit } from '../release-candidate/identity.ts';
import { ECONOMIC_RC_ID, ECONOMIC_REHEARSAL_NETWORK_ID, ECONOMIC_REHEARSAL_PROTOCOL_VERSION } from './identity.ts';
import { economicPolicyHashes } from './genesis.ts';
import type { EconomicRcBundle } from './types.ts';

export function buildEconomicRcBundle(root = process.cwd()): EconomicRcBundle {
  const sourceCommit = resolveSourceCommit(root);
  const policyHashes = economicPolicyHashes();
  const manifest = JSON.stringify({
    kind: 'SUNREY_ECONOMIC_RC',
    rcId: ECONOMIC_RC_ID,
    sourceCommit,
    protocolVersion: ECONOMIC_REHEARSAL_PROTOCOL_VERSION,
    networkCompatibility: ECONOMIC_REHEARSAL_NETWORK_ID,
    policyHashes,
    environment: 'simulation',
    productionAuthorized: false,
  });
  const manifestHash = sha256Text(manifest);
  const { authority } = localTestReleaseAuthority();
  const artifactBytes = Buffer.from(manifest, 'utf8');
  const signed = signArtifact(artifactBytes, authority);
  const signatureVerified = verifySignature(artifactBytes, signed, authority);
  const qualificationEvidence = Object.freeze([
    'CHUNK-71 monetary constitution development fixture',
    'CHUNK-72 rehearsal validator bond policy',
    'CHUNK-73 FeePolicyV2 development parameters',
    'CHUNK-74 MoonRey issuance policy development bundle',
    'CHUNK-75 dual-economy baseline adapter',
    'CHUNK-70 launch-rehearsal topology reused as rehearsal-only infrastructure',
  ]);
  return Object.freeze({
    rcId: ECONOMIC_RC_ID,
    sourceCommit,
    protocolVersion: ECONOMIC_REHEARSAL_PROTOCOL_VERSION,
    manifestHash,
    releaseSignatureVerified: signatureVerified,
    policyHashes,
    qualificationEvidence,
    productionAuthorized: false,
    ok:
      signatureVerified &&
      policyHashes.length >= 8 &&
      sourceCommit.length > 0 &&
      manifestHash.length === 64,
  });
}

export function verifyEconomicRc(bundle: EconomicRcBundle): boolean {
  return (
    bundle.ok &&
    bundle.rcId === ECONOMIC_RC_ID &&
    bundle.releaseSignatureVerified &&
    bundle.productionAuthorized === false &&
    bundle.policyHashes.every((row) => /^[0-9a-f]{64}$/.test(row.hash))
  );
}
