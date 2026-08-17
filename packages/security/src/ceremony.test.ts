import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertNoPrivateKeyMaterial } from './crypto-leakage.ts';
import { SUITE_SUNREY_ED25519_V1 } from './crypto-suite.ts';
import { sha256Hex } from './hash.ts';
import {
  AUTHORITY_PURPOSE,
  CeremonySession,
  KEY_PURPOSE_MATRIX,
  ROOT_OF_TRUST_AUTHORITIES,
  assertAuthoritySeparation,
  createCeremonySimulationHsm,
  createDefaultCeremonyPlan,
  runFullCeremonyRehearsal,
  runSunreyCeremony,
  verifyOfflinePackage,
} from './ceremony/index.ts';

function setupSession() {
  const plan = createDefaultCeremonyPlan({ ceremonyId: 'cerm_test', requiredApprovals: 2 });
  const session = new CeremonySession(plan, { clock: () => '2026-08-17T00:00:00.000Z' });
  const hsm = createCeremonySimulationHsm({ fixtureEnv: { SUNREY_FIXTURE_ENV: 'test' } });
  for (const role of plan.participantRoles) {
    session.registerParticipant({
      participantId: role.toLowerCase(),
      displayName: role,
      role,
      actorKind: 'HUMAN',
    });
  }
  session.registerParticipant({
    participantId: 'sec-2',
    displayName: 'second-officer',
    role: 'SECURITY_OFFICER',
    actorKind: 'HUMAN',
  });
  session.verifyParticipants();
  session.verifyProvider(hsm);
  for (const participant of session.listParticipants()) {
    session.issueIdentityKey(participant.participantId);
  }
  return { session, hsm };
}

describe('Chunk 64 root-of-trust ceremony', () => {
  it('maps every authority class onto a canonical key purpose', () => {
    assert.equal(ROOT_OF_TRUST_AUTHORITIES.length, 10);
    assert.equal(AUTHORITY_PURPOSE.RELEASE_AUTHORITY, 'RELEASE_SIGNING');
    assert.equal(AUTHORITY_PURPOSE.VALIDATOR_CONSENSUS_AUTHORITY, 'VALIDATOR_CONSENSUS_SIGNING');
    assert.equal(AUTHORITY_PURPOSE.CUSTODY_SIGNING_AUTHORITY, 'WALLET_SIGNING');
    assert.ok(KEY_PURPOSE_MATRIX.some((row) => row.allowedAuthority === 'GENESIS_AUTHORITY'));
    assert.ok(KEY_PURPOSE_MATRIX.every((row) => row.productionEligibility === 'SIMULATION_ONLY'));
  });

  it('refuses private-key extraction on the ceremony HSM', () => {
    const hsm = createCeremonySimulationHsm({ fixtureEnv: { SUNREY_FIXTURE_ENV: 'test' } });
    const generated = hsm.generateKey({ purpose: 'GENESIS_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    assert.equal(generated.ok, true);
    if (!generated.ok) {
      throw new Error('generate failed');
    }
    assert.equal(generated.value.exportable, false);
    assert.equal('extractPrivateKey' in hsm, false);
    assert.equal('exportKey' in hsm, false);
    assert.equal(hsm.capabilities().privateMaterialExportSupported, false);
    assert.equal(hsm.capabilities().simulationClass, 'SIMULATION');
    const descriptor = hsm.getPublicDescriptor(generated.value);
    assert.equal(descriptor.ok, true);
    if (descriptor.ok) {
      assert.equal(assertNoPrivateKeyMaterial(descriptor.value, 'public-descriptor').ok, true);
    }
  });

  it('rejects fixture keys outside a permitted development/test context', () => {
    const hsm = createCeremonySimulationHsm({ fixtureEnv: { NODE_ENV: 'production' } });
    const generated = hsm.generateKey({ purpose: 'RELEASE_SIGNING', suiteId: SUITE_SUNREY_ED25519_V1 });
    assert.equal(generated.ok, false);
    if (generated.ok) {
      throw new Error('fixture must fail');
    }
    assert.equal(generated.error.code, 'CEREMONY_FIXTURE_REJECTED');
  });

  it('rejects a valid signature from the wrong authority purpose', () => {
    const { session } = setupSession();
    const consensus = session.generateAuthorityKey({
      ownerParticipantId: 'validator_operator',
      authority: 'VALIDATOR_CONSENSUS_AUTHORITY',
    });
    const release = session.generateAuthorityKey({
      ownerParticipantId: 'release_signer',
      authority: 'RELEASE_AUTHORITY',
    });
    assert.equal(consensus.ok && release.ok, true);
    if (!consensus.ok || !release.ok) {
      throw new Error('keys');
    }
    const digest = sha256Hex('release-artifact');
    const wrong = session.authorizeWithKey(consensus.value.keyId, 'RELEASE_AUTHORITY', digest);
    assert.equal(wrong.ok, false);
    if (wrong.ok) {
      throw new Error('wrong purpose must fail');
    }
    assert.equal(wrong.error.code, 'AUTHORITY_SEPARATION');
    const wrongSign = session.signWithKey(consensus.value.keyId, 'RELEASE_SIGNING', digest);
    assert.equal(wrongSign.ok, false);
    const right = session.authorizeWithKey(release.value.keyId, 'RELEASE_AUTHORITY', digest);
    assert.equal(right.ok, true);
  });

  it('rejects the same fingerprint on incompatible high-risk authorities', () => {
    const { session } = setupSession();
    const first = session.generateAuthorityKey({
      ownerParticipantId: 'release_signer',
      authority: 'RELEASE_AUTHORITY',
    });
    assert.equal(first.ok, true);
    if (!first.ok) {
      throw new Error('first');
    }
    const conflict = session.listKeys();
    const rejected = assertAuthoritySeparation(
      first.value.fingerprint,
      'VALIDATOR_CONSENSUS_AUTHORITY',
      conflict,
    );
    assert.equal(rejected.ok, false);
    if (rejected.ok) {
      throw new Error('duplicate must fail');
    }
    assert.equal(rejected.error.code, 'AUTHORITY_SEPARATION');
  });

  it('rejects AI approval and AI governance possession', () => {
    const { session } = setupSession();
    session.registerParticipant({
      participantId: 'ai-1',
      displayName: 'assistant',
      role: 'WITNESS',
      actorKind: 'AI',
    });
    const aiGov = session.generateAuthorityKey({
      ownerParticipantId: 'ai-1',
      authority: 'PROTOCOL_GOVERNANCE_AUTHORITY',
    });
    assert.equal(aiGov.ok, false);
    if (aiGov.ok) {
      throw new Error('AI governance must fail');
    }
    assert.equal(aiGov.error.code, 'AI_ROLE_FORBIDDEN');
    const approval = session.approve({
      actorParticipantId: 'ai-1',
      operation: 'CREATE_ROOT_GOVERNANCE_KEY',
    });
    assert.equal(approval.ok, false);
    if (approval.ok) {
      throw new Error('AI approval must fail');
    }
    assert.equal(approval.error.code, 'AI_ROLE_FORBIDDEN');
  });

  it('rejects tampered contribution, attestation, genesis, approval, and transcript', () => {
    const { session } = setupSession();
    const genesis = session.generateAuthorityKey({
      ownerParticipantId: 'governance_signer',
      authority: 'GENESIS_AUTHORITY',
    });
    const consensus = session.generateAuthorityKey({
      ownerParticipantId: 'validator_operator',
      authority: 'VALIDATOR_CONSENSUS_AUTHORITY',
    });
    assert.equal(genesis.ok && consensus.ok, true);
    if (!genesis.ok || !consensus.ok) {
      throw new Error('keys');
    }
    const contribution = session.contributePublicKeys({
      operatorParticipantId: 'validator_operator',
      validatorId: 'val_01',
      consensusKeyId: consensus.value.keyId,
    });
    const attestation = session.attestKey(consensus.value.keyId, 'security_officer');
    session.approve({ actorParticipantId: 'security_officer', operation: 'ACTIVATE_GENESIS_SIGNING_SESSION' });
    session.approve({ actorParticipantId: 'sec-2', operation: 'ACTIVATE_GENESIS_SIGNING_SESSION' });
    const bound = session.bindGenesisCandidate({
      actorParticipantId: 'governance_signer',
      genesisCandidateHash: sha256Hex('placeholder-genesis'),
      networkId: 'net_sunrey_rehearsal_1',
      chainId: 'chn_sunrey_rehearsal_1',
      protocolVersion: 'sunrey-protocol-0',
      validatorSetHash: sha256Hex('vals'),
      assetAllocationManifestHash: sha256Hex('assets'),
      cryptoPolicyHash: sha256Hex('policy'),
      moduleHashes: [sha256Hex('mod')],
    });
    assert.equal(contribution.ok && attestation.ok && bound.ok, true);
    if (!contribution.ok || !attestation.ok || !bound.ok) {
      throw new Error('setup');
    }
    session.finalizeTranscript('witness');

    const tamperedContribution = { ...contribution.value, consensusPublicKeyHex: '00'.repeat(32) };
    const contributionCheck = session.verifyPublicArtifacts({ contribution: tamperedContribution });
    assert.equal(contributionCheck.ok, false);

    const tamperedAttestation = { ...attestation.value, publicKeyFingerprint: 'ff'.repeat(32) };
    const attestationCheck = session.verifyPublicArtifacts({ attestation: tamperedAttestation });
    assert.equal(attestationCheck.ok, false);

    const tamperedGenesis = { ...bound.value, genesisCandidateHash: sha256Hex('mutated') };
    const genesisCheck = session.verifyPublicArtifacts({ genesis: tamperedGenesis });
    assert.equal(genesisCheck.ok, false);

    const approval = session.listApprovals()[0];
    assert.ok(approval);
    const tamperedApproval = { ...approval, payloadHash: sha256Hex('mutated-approval') };
    const approvalCheck = session.verifyPublicArtifacts({ approval: tamperedApproval });
    assert.equal(approvalCheck.ok, false);

    const transcript = session.getTranscript();
    const mutated = {
      ...transcript,
      entries: transcript.entries.map((entry, index) =>
        index === 0 ? { ...entry, actionType: 'TAMPERED' } : entry,
      ),
    };
    const transcriptCheck = session.verifyIndependently(mutated);
    assert.equal(transcriptCheck.ok, false);
    if (transcriptCheck.ok) {
      throw new Error('tamper must fail');
    }
    assert.equal(transcriptCheck.error.code, 'CEREMONY_TRANSCRIPT_TAMPERED');
  });

  it('retains historical verification after rotation and records compromise without erasing history', () => {
    const { session } = setupSession();
    const current = session.generateAuthorityKey({
      ownerParticipantId: 'release_signer',
      authority: 'RELEASE_AUTHORITY',
    });
    assert.equal(current.ok, true);
    if (!current.ok) {
      throw new Error('current');
    }
    const digest = sha256Hex('historical-artifact');
    const signature = session.signWithKey(current.value.keyId, 'RELEASE_SIGNING', digest);
    assert.equal(signature.ok, true);
    if (!signature.ok) {
      throw new Error('sign');
    }
    const rotated = session.rotateAuthorityKey({
      currentKeyId: current.value.keyId,
      ownerParticipantId: 'release_signer',
      effectiveHeight: 100,
    });
    assert.equal(rotated.ok, true);
    const historical = session.verifyHistoricalSignature(current.value.keyId, digest, signature.value);
    assert.equal(historical.ok, true);
    const retired = session.listKeys().find((key) => key.keyId === current.value.keyId);
    assert.equal(retired?.state, 'RETIRED_FOR_NEW_USE');
    assert.equal(retired?.historical, true);

    const compromise = session.recordCompromise({
      suspectedKeyId: rotated.ok ? rotated.value.futureKeyId : current.value.keyId,
      changeRequest: 'validator/governance replacement after suspected compromise',
      replacementOwnerParticipantId: 'release_signer',
    });
    assert.equal(compromise.ok, true);
    if (compromise.ok) {
      assert.equal(compromise.value.historyErased, false);
    }
    const destroyed = session.markDestroyed(current.value.keyId, false);
    assert.equal(destroyed.ok, false);
  });

  it('keeps recovery authority from becoming protocol governance', () => {
    const { session } = setupSession();
    const refused = session.refuseAuthorityPromotion('RECOVERY_AUTHORITY', 'PROTOCOL_GOVERNANCE_AUTHORITY');
    assert.equal(refused.ok, false);
    if (refused.ok) {
      throw new Error('promotion must fail');
    }
    assert.equal(refused.error.code, 'AUTHORITY_SEPARATION');
  });

  it('builds a signed offline package without private keys', () => {
    const { session, hsm } = setupSession();
    const pkg = session.buildOfflinePackage(
      'GENESIS_CANDIDATE_HASHES',
      { genesisCandidateHash: sha256Hex('offline') },
      'security_officer',
    );
    assert.equal(pkg.ok, true);
    if (!pkg.ok) {
      throw new Error('package');
    }
    assert.equal(pkg.value.containsPrivateKeys, false);
    const verified = verifyOfflinePackage(pkg.value, (publicKey, digest, signature) =>
      hsm.verifyDigest(publicKey, digest, signature),
    );
    assert.equal(verified.ok, true);
    const leaked = session.buildOfflinePackage('PUBLIC_KEYS', { privateKey: '00'.repeat(32) });
    assert.equal(leaked.ok, false);
  });

  it('runs the seven-validator rehearsal and public report', () => {
    const rehearsal = runFullCeremonyRehearsal({ fixtureEnv: { SUNREY_FIXTURE_ENV: 'test' } });
    assert.equal(rehearsal.ok, true);
    if (!rehearsal.ok) {
      throw new Error('ceremony rehearsal failed');
    }
    assert.equal(rehearsal.value.validatorCount, 7);
    assert.equal(rehearsal.value.state, 'REHEARSAL_COMPLETE');
    assert.equal(rehearsal.value.productionAuthorityActive, false);
    assert.equal(rehearsal.value.pqHardwareReadiness, 'HARDWARE_PROVIDER_UNCONFIRMED');
    assert.match(rehearsal.value.transcriptHash, /^[0-9a-f]{64}$/);
    assert.equal(rehearsal.value.report.simulation, true);
    assert.equal(rehearsal.value.report.productionAuthorityActive, false);
    assert.ok(rehearsal.value.report.publicFingerprints.length >= 7 * 3);
    assert.equal(assertNoPrivateKeyMaterial(rehearsal.value.report, 'public-report').ok, true);
  });

  it('exposes the sunrey-ceremony CLI commands', () => {
    for (const command of [
      'plan',
      'participants',
      'provider-check',
      'generate',
      'contribute',
      'attest',
      'approve',
      'transcript',
      'verify',
      'rehearse',
    ]) {
      const result = runSunreyCeremony([command]);
      assert.equal(result.ok, true, command);
      assert.equal(assertNoPrivateKeyMaterial(result.payload, `cli-${command}`).ok, true);
    }
  });
});
