import { FEATURE_INVENTORY } from './features.ts';
import { loadKnownSecurityLimitations } from './limitations.ts';
import type { QualificationEvidence } from './qualification.ts';
import type { RcReleaseNotes, TestnetReleaseCandidateManifest } from './types.ts';

export function generateReleaseNotes(
  root: string,
  manifest: TestnetReleaseCandidateManifest,
  evidence: QualificationEvidence,
): RcReleaseNotes {
  const knownLimitations = loadKnownSecurityLimitations(root);
  return Object.freeze({
    rcId: manifest.rc_id,
    banner: 'SUNREY TESTNET',
    mainnetReady: false,
    features: FEATURE_INVENTORY.filter((row) => row.state === 'FROZEN_IN_RC').map((row) => `${row.featureId}: ${row.title}`),
    protocolChanges: [
      `protocol_version=${manifest.protocol_version}`,
      `genesis_hash=${manifest.genesis_hash}`,
      'Network identity net_sunrey_testnet_1 / chn_sunrey_testnet_1 is unchanged unless genesis actually changes.',
    ],
    securityChanges: [
      'ReleaseAuthority signs the RC manifest, artifact digests, SBOM, provenance, and qualification report.',
      `Adversarial critical invariants: ${evidence.adversarial.ok ? 'held' : 'FAILED'}.`,
    ],
    pqcChanges: [
      `CryptoSuite policy ${manifest.crypto_suite_policy.policyId}`,
      `PQ provider ${manifest.crypto_suite_policy.pqProvider}@${manifest.crypto_suite_policy.pqProviderVersion}`,
      'Not production cryptographic approval. Not quantum-proof.',
      `Supported scope: ${evidence.pqc.supportedScope}`,
    ],
    knownLimitations,
    breakingChanges: FEATURE_INVENTORY.filter((row) => row.state === 'EXCLUDED_FROM_RC').map((row) => `${row.featureId} excluded`),
    migrationInstructions: [
      'Verify the RC bundle with `sunrey-release rc verify`.',
      'Perform the governed upgrade rehearsal before operator rollout.',
      'Do not treat a software RC as a network-identity change.',
    ],
    operatorInstructions: [
      'Keep Explorer/SDK/config banners as SUNREY TESTNET.',
      'Use seven-validator + multi-domain profiles from candidate artifacts.',
      'Restore from verified snapshots only. Never invent balancing journals.',
    ],
    sdkChanges: [
      `Public API ${manifest.api_version} remains frozen for this candidate.`,
      'Breaking API changes require a new RC id.',
    ],
  });
}
