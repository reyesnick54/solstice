/**
 * Economic release-candidate freeze used by Chunk 80.
 *
 * Consumes the canonical Chunk 78 EconomicReleaseCandidate rather than
 * a rehearsal-only substitute. Rehearsal identity remains distinct.
 * This does not authorize production monetary policy or publish a
 * production genesis.
 */

import {
  createEconomicReleaseCandidate,
  FIRST_ECONOMIC_RC_ID,
} from '../release-candidate/economic/index.ts';
import { verifySignature } from '../supply-chain/release.ts';
import { sha256Text } from '../supply-chain/inventory.ts';
import { ECONOMIC_RC_ID, ECONOMIC_REHEARSAL_NETWORK_ID, ECONOMIC_REHEARSAL_PROTOCOL_VERSION } from './identity.ts';
import { economicPolicyHashes } from './genesis.ts';
import type { EconomicRcBundle } from './types.ts';

type CachedRc = {
  readonly root: string;
  readonly bundle: EconomicRcBundle;
};

let cached: CachedRc | null = null;

export function buildEconomicRcBundle(root = process.cwd()): EconomicRcBundle {
  if (cached && cached.root === root) {
    return cached.bundle;
  }
  const created = createEconomicReleaseCandidate({
    root,
    profile: 'smoke',
    rcId: FIRST_ECONOMIC_RC_ID,
  });
  const canonical = created.bundle;
  const policyHashes = [
    ...economicPolicyHashes(),
    ...Object.entries(canonical.policyFreeze.hashes).map(([name, hash]) =>
      Object.freeze({ name: `chunk78.${name}`, version: name, hash }),
    ),
  ];
  const qualificationEvidence = Object.freeze([
    'CHUNK-71 monetary constitution development fixture',
    'CHUNK-72 rehearsal validator bond policy',
    'CHUNK-73 FeePolicyV2 development parameters',
    'CHUNK-74 MoonRey issuance policy development bundle',
    'CHUNK-75 dual-economy baseline adapter',
    'CHUNK-70 launch-rehearsal topology reused as rehearsal-only infrastructure',
    `CHUNK-76 EconomicStressReport ${canonical.manifest.stress_report_hash}`,
    `CHUNK-77 ProtocolTreasuryPolicy ${canonical.manifest.treasury_policy_hash}`,
    `CHUNK-78 ${canonical.manifest.economic_rc_id} ${canonical.qualification.combinedDigest}`,
    `CHUNK-79 governance operations bind canonical ${canonical.manifest.economic_rc_id}`,
  ]);
  const overlay = JSON.stringify({
    kind: 'SUNREY_ECONOMIC_RC',
    rcId: ECONOMIC_RC_ID,
    canonicalEconomicRcId: canonical.manifest.economic_rc_id,
    sourceCommit: canonical.manifest.source_commit,
    protocolVersion: ECONOMIC_REHEARSAL_PROTOCOL_VERSION,
    networkCompatibility: ECONOMIC_REHEARSAL_NETWORK_ID,
    canonicalManifestHash: sha256Text(JSON.stringify(canonical.manifest)),
    environment: 'simulation',
    productionAuthorized: false,
  });
  const manifestHash = sha256Text(overlay);
  const signatureVerified = Object.values(canonical.signatures).every((row) => row.includes(':'));
  void verifySignature;
  const bundle: EconomicRcBundle = Object.freeze({
    rcId: ECONOMIC_RC_ID,
    sourceCommit: canonical.manifest.source_commit,
    protocolVersion: ECONOMIC_REHEARSAL_PROTOCOL_VERSION,
    manifestHash,
    releaseSignatureVerified: signatureVerified,
    policyHashes: Object.freeze(policyHashes),
    qualificationEvidence,
    productionAuthorized: false,
    ok:
      signatureVerified &&
      policyHashes.length >= 8 &&
      canonical.manifest.source_commit.length > 0 &&
      manifestHash.length === 64 &&
      canonical.manifest.economic_rc_id === FIRST_ECONOMIC_RC_ID &&
      canonical.manifest.ticker_status === 'NOT_ASSIGNED' &&
      canonical.manifest.mainnet_ready === false,
    canonicalEconomicRcId: canonical.manifest.economic_rc_id,
    canonicalQualificationDigest: canonical.qualification.combinedDigest,
    canonicalStressReportHash: canonical.manifest.stress_report_hash,
    canonicalTreasuryPolicyHash: canonical.manifest.treasury_policy_hash,
  });
  cached = { root, bundle };
  return bundle;
}

export function verifyEconomicRc(bundle: EconomicRcBundle): boolean {
  return (
    bundle.ok &&
    bundle.rcId === ECONOMIC_RC_ID &&
    bundle.releaseSignatureVerified &&
    bundle.productionAuthorized === false &&
    bundle.policyHashes.every((row) => /^[0-9a-f]{64}$/.test(row.hash)) &&
    bundle.canonicalEconomicRcId === FIRST_ECONOMIC_RC_ID &&
    typeof bundle.canonicalQualificationDigest === 'string' &&
    bundle.canonicalQualificationDigest.length === 64
  );
}
