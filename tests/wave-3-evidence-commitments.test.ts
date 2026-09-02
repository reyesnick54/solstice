import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  assertEvidenceBundle,
  assertEvidenceCommitment,
  assertReservedRootsUnset,
  buildEvidenceInclusionProof,
  commitmentRootsForBlock,
  computeEvidenceRoot,
  createEvidenceBundle,
  createEvidenceCommitment,
  createEvidenceStatusRecord,
  emptyMerkleRoot,
  evidenceCommitmentFromVaultRecord,
  latestStatusForCommitment,
  rootsToHex,
  scanForForbiddenBlockPayload,
  verifyEvidenceInclusionProof,
  verifyMembershipProof,
  ZERO_ROOT_HEX,
} from '../packages/sunrey-chain/src/evidence-commitments/index.ts';
import {
  decodeBlockHeader,
  encodeBlockHeader,
  encodeBlockHeaderV2,
  isBlockHeaderV2,
  PROTOCOL_CHAIN_ID,
  PROTOCOL_CODEC_ID,
  PROTOCOL_NETWORK_ID,
} from '../packages/sunrey-chain/src/protocol/index.ts';

const NOW = asUtcInstant('2026-09-02T08:00:00.000Z');

function sampleCommitment(seed: string) {
  return createEvidenceCommitment({
    evidenceId: `evidence-${seed}`,
    evidenceType: 'KERNEL_DECISION',
    contentHash: 'a'.repeat(64),
    provenanceHash: 'b'.repeat(64),
    issuerProvider: 'sunrey.kernel.simulation',
    temporalRef: NOW,
    verification: {
      verificationMethod: 'kernel-six-proofs',
      verificationState: 'SEALED',
      policyVersion: 'policy-v1',
      verifierRef: 'kernel:simulation',
    },
  });
}

function sampleClaim(economy: 'SUNREY' | 'MOONREY', suffix: string) {
  return Object.freeze({
    claimId: `claim-${suffix}`,
    economy,
    claimFingerprint: `${economy.toLowerCase()}-fp-${suffix}`,
  });
}

describe('Wave 3 — evidence commitments', () => {
  it('1. EvidenceCommitment is deterministic', () => {
    const input = {
      evidenceId: 'ev-1',
      evidenceType: 'KERNEL_DECISION',
      contentHash: 'c'.repeat(64),
      provenanceHash: 'd'.repeat(64),
      issuerProvider: 'issuer',
      temporalRef: NOW,
      verification: {
        verificationMethod: 'kernel-six-proofs',
        verificationState: 'SEALED',
        policyVersion: 'policy-v1',
        verifierRef: 'kernel:simulation',
      },
    };
    const left = createEvidenceCommitment(input);
    const right = createEvidenceCommitment(input);
    assert.equal(left.commitmentHash, right.commitmentHash);
    assert.equal(assertEvidenceCommitment(left), true);
  });

  it('2. changed evidence changes commitment hash', () => {
    const left = sampleCommitment('a');
    const right = createEvidenceCommitment({
      ...left,
      contentHash: 'f'.repeat(64),
    });
    assert.notEqual(left.commitmentHash, right.commitmentHash);
  });

  it('3. EvidenceRoot is deterministic and empty blocks have defined root', () => {
    const first = computeEvidenceRoot({ scopeHeight: 1n, bundles: [] });
    const second = computeEvidenceRoot({ scopeHeight: 1n, bundles: [] });
    assert.equal(first.rootHex, second.rootHex);
    assert.equal(first.rootHex, emptyMerkleRoot());
  });

  it('4. same evidence bundle yields same root regardless of entry order', () => {
    const c1 = sampleCommitment('1');
    const c2 = sampleCommitment('2');
    const claim = sampleClaim('SUNREY', 'order');
    const forward = createEvidenceBundle({
      claim,
      entries: [
        { commitment: c1, role: 'SUPPORTING' },
        { commitment: c2, role: 'SUPPORTING' },
      ],
    });
    const reverse = createEvidenceBundle({
      claim,
      entries: [
        { commitment: c2, role: 'SUPPORTING' },
        { commitment: c1, role: 'SUPPORTING' },
      ],
    });
    assert.equal(forward.bundleRoot, reverse.bundleRoot);
    assert.equal(assertEvidenceBundle(forward), true);
  });

  it('5. duplicate commitments do not double economic weight', () => {
    const commitment = sampleCommitment('dup');
    const bundle = createEvidenceBundle({
      claim: sampleClaim('MOONREY', 'dup'),
      entries: [
        { commitment, role: 'SUPPORTING' },
        { commitment, role: 'SUPPORTING' },
      ],
    });
    assert.equal(bundle.entries.length, 1);
    assert.equal(assertEvidenceBundle(bundle), true);
  });

  it('6. inclusion proof verifies end-to-end', () => {
    const c1 = sampleCommitment('proof-1');
    const c2 = sampleCommitment('proof-2');
    const bundle = createEvidenceBundle({
      claim: sampleClaim('SUNREY', 'proof'),
      entries: [
        { commitment: c1, role: 'SUPPORTING' },
        { commitment: c2, role: 'CONTRADICTING' },
      ],
    });
    const blockBundles = [bundle];
    const proof = buildEvidenceInclusionProof({
      commitment: c1,
      bundle,
      blockBundles,
      blockHeight: 42n,
    });
    assert.equal(verifyEvidenceInclusionProof(proof), true);
  });

  it('7. tampered inclusion proof is invalid', () => {
    const commitment = sampleCommitment('tamper');
    const bundle = createEvidenceBundle({
      claim: sampleClaim('SUNREY', 'tamper'),
      entries: [{ commitment, role: 'SUPPORTING' }],
    });
    const proof = buildEvidenceInclusionProof({
      commitment,
      bundle,
      blockBundles: [bundle],
      blockHeight: 7n,
    });
    const tampered = {
      ...proof,
      bundleMembership: {
        ...proof.bundleMembership,
        leafValueHex: 'f'.repeat(64),
      },
    };
    assert.equal(verifyEvidenceInclusionProof(tampered), false);
  });

  it('8. raw evidence is not serialized into block header', () => {
    const commitment = sampleCommitment('privacy');
    const bundle = createEvidenceBundle({
      claim: sampleClaim('SUNREY', 'privacy'),
      entries: [{ commitment, role: 'SUPPORTING' }],
    });
    const roots = commitmentRootsForBlock({ height: 9n, bundles: [bundle] });
    const header = Object.freeze({
      networkId: PROTOCOL_NETWORK_ID,
      chainId: PROTOCOL_CHAIN_ID,
      codecId: PROTOCOL_CODEC_ID,
      schemaVersion: 2 as const,
      height: 9n,
      previousBlockHash: new Uint8Array(32),
      appHash: new Uint8Array(32),
      transactionRoot: new Uint8Array(32),
      validatorSetHash: new Uint8Array(32),
      consensusParametersHash: new Uint8Array(32),
      timeUnixSeconds: 1_756_800_000n,
      commitmentRoots: roots,
    });
    const encoded = encodeBlockHeaderV2(header);
    const decoded = decodeBlockHeader(encoded);
    assert.equal(isBlockHeaderV2(decoded), true);
    const raw = Buffer.from(encoded).toString('utf8');
    assert.equal(raw.includes('raw health'), false);
    assert.equal(raw.includes(commitment.evidenceId), false);
    assert.equal(scanForForbiddenBlockPayload({ healthRecord: 'secret' }).length > 0, true);
  });

  it('9. restart preserves evidence references via vault bridge', () => {
    const vault = new EvidenceVault(new FrozenClock(NOW));
    const sealed = vault.seal('KERNEL_ALLOW', { decision: 'ALLOW', action: 'openAccount' });
    const reloaded = new EvidenceVault(new FrozenClock(NOW));
    reloaded.hydrateFromPersisted(vault.list());
    const commitment = evidenceCommitmentFromVaultRecord(reloaded.list()[0]!, {
      evidenceType: 'KERNEL_DECISION',
      provenanceHash: sealed.recordSha256,
      issuerProvider: 'sunrey.kernel.simulation',
      verification: {
        verificationMethod: 'kernel-six-proofs',
        verificationState: 'SEALED',
        policyVersion: 'policy-v1',
        verifierRef: 'kernel:simulation',
      },
    });
    assert.equal(commitment.contentHash, sealed.payloadSha256);
    assert.equal(assertEvidenceCommitment(commitment), true);
  });

  it('10. historical evidence root remains immutable under status overlay', () => {
    const commitment = sampleCommitment('history');
    const bundle = createEvidenceBundle({
      claim: sampleClaim('SUNREY', 'history'),
      entries: [{ commitment, role: 'SUPPORTING' }],
    });
    const historicalRoot = computeEvidenceRoot({ scopeHeight: 100n, bundles: [bundle] });
    const status = createEvidenceStatusRecord({
      priorCommitment: commitment,
      status: 'REVOKED',
      effectiveAt: asUtcInstant('2026-09-03T00:00:00.000Z'),
      reasonCode: 'CHALLENGE_UPHELD',
    });
    assert.equal(latestStatusForCommitment([status], commitment.commitmentHash)?.status, 'REVOKED');
    const replayed = computeEvidenceRoot({ scopeHeight: 100n, bundles: [bundle] });
    assert.equal(replayed.rootHex, historicalRoot.rootHex);
  });

  it('11. SunRey and MoonRey claims share infrastructure without sharing meaning', () => {
    const commitment = sampleCommitment('shared');
    const sunreyBundle = createEvidenceBundle({
      claim: sampleClaim('SUNREY', 'shared'),
      entries: [{ commitment, role: 'SUPPORTING' }],
    });
    const moonreyBundle = createEvidenceBundle({
      claim: sampleClaim('MOONREY', 'shared'),
      entries: [{ commitment, role: 'SUPPORTING' }],
    });
    assert.notEqual(sunreyBundle.bundleId, moonreyBundle.bundleId);
    assert.notEqual(sunreyBundle.bundleRoot, moonreyBundle.bundleRoot);
  });

  it('12. block integration uses reserved zero roots and stable V1 compatibility', () => {
    const v1 = Object.freeze({
      networkId: PROTOCOL_NETWORK_ID,
      chainId: PROTOCOL_CHAIN_ID,
      codecId: PROTOCOL_CODEC_ID,
      schemaVersion: 1 as const,
      height: 1n,
      previousBlockHash: new Uint8Array(32),
      appHash: new Uint8Array(32),
      transactionRoot: new Uint8Array(32),
      validatorSetHash: new Uint8Array(32),
      consensusParametersHash: new Uint8Array(32),
      timeUnixSeconds: 1n,
    });
    const roundTripV1 = decodeBlockHeader(encodeBlockHeader(v1));
    assert.equal(roundTripV1.schemaVersion, 1);

    const roots = commitmentRootsForBlock({ height: 2n, bundles: [] });
    assert.equal(assertReservedRootsUnset(roots), true);
    assert.equal(rootsToHex(roots).rightsRootHex, ZERO_ROOT_HEX);
    assert.equal(rootsToHex(roots).policyRootHex, ZERO_ROOT_HEX);
  });

  it('13. changed bundle membership changes block evidence root', () => {
    const c1 = sampleCommitment('root-a');
    const c2 = sampleCommitment('root-b');
    const bundleA = createEvidenceBundle({
      claim: sampleClaim('SUNREY', 'root'),
      entries: [{ commitment: c1, role: 'SUPPORTING' }],
    });
    const bundleB = createEvidenceBundle({
      claim: sampleClaim('SUNREY', 'root'),
      entries: [{ commitment: c2, role: 'SUPPORTING' }],
    });
    const left = computeEvidenceRoot({ scopeHeight: 3n, bundles: [bundleA] });
    const right = computeEvidenceRoot({ scopeHeight: 3n, bundles: [bundleB] });
    assert.notEqual(left.rootHex, right.rootHex);
    assert.equal(verifyMembershipProof(left.rootHex, {
      leafKey: bundleA.bundleId,
      leafValueHex: bundleA.bundleRoot,
      leafIndex: 0,
      siblings: [],
      leafCount: 1,
    }), true);
  });
});
