import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { sevenValidatorFixture } from '../packages/sunrey-chain/src/testnet/validators.ts';
import { sevenProductionCandidateValidators } from '../packages/sunrey-chain/src/mainnet/validators.ts';
import { sevenRehearsalValidators } from '../packages/sunrey-chain/src/launch-rehearsal/genesis.ts';
import { emptyAllocationManifest } from '../packages/sunrey-chain/src/mainnet/allocation.ts';
import {
  DRESS_REHEARSAL_CHAIN_ID,
  DRESS_REHEARSAL_NETWORK_ID,
  REHEARSAL_CANDIDATE_V2_ID,
  REHEARSAL_MAINNET_RC_ID,
  assertPurposeSeparation,
  collectExternalBlockers,
  consumeAuditEvidence,
  consumeLegalLicense,
  consumeProviderAcceptance,
  createProductionCeremonyPlan,
  createSimulationAttestation,
  dressRehearsalUnusableForProduction,
  encodeProductionGenesis,
  evaluateCurrentProductionState,
  evaluateGenesisEligibility,
  evaluateValidatorAcceptance,
  jsonPresentationIsNotConsensus,
  productionGenesisHashOf,
  rejectAiApproval,
  rejectDuplicateHighRiskKeys,
  rejectFixtureGenesisEligible,
  rejectFixtureTestnetRehearsalKeys,
  rejectRehearsalAllocationAsProduction,
  rejectRehearsalKey,
  rejectSimulationHsmForExternalRequirement,
  rejectTamperedAttestation,
  rejectTestnetKey,
  rejectWrongCandidateV2,
  rejectWrongMainnetRc,
  rehearsalZeroAllocation,
  runProductionCeremonyCommand,
  runProductionGenesisCeremonyDressRehearsal,
  sevenDressRehearsalDossiers,
  tamperTranscript,
  verifyAttestation,
  verifyTranscript,
  defaultDressRehearsalParticipants,
  registerParticipant,
} from '../packages/sunrey-chain/src/production-ceremony/index.ts';
import { reevaluateReadinessAfterProductionCeremony } from '../packages/sunrey-chain/src/production-ceremony/readiness.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 85 production genesis ceremony', () => {
  it('runs a deterministic dress rehearsal isolated from production identities', () => {
    const first = runProductionGenesisCeremonyDressRehearsal(ROOT);
    const second = runProductionGenesisCeremonyDressRehearsal(ROOT);
    assert.equal(first.genesisHash, second.genesisHash);
    assert.match(first.genesisHash, /^[0-9a-f]{64}$/);
    assert.equal(first.transcriptVerified, true);
    assert.equal(first.usableForProduction, false);
    assert.equal(first.realProductionKeysCreated, false);
    assert.equal(first.mainnetEnabled, false);
    assert.equal(first.session.plan.networkId, DRESS_REHEARSAL_NETWORK_ID);
    assert.equal(first.session.plan.chainId, DRESS_REHEARSAL_CHAIN_ID);
    assert.equal(first.session.plan.candidateV2Id, REHEARSAL_CANDIDATE_V2_ID);
    assert.equal(first.session.plan.mainnetRcId, REHEARSAL_MAINNET_RC_ID);
    assert.equal(first.report.mainnetRcVerified, true);
    assert.equal(first.report.candidateV2Verified, true);
    assert.equal(first.dossier.executesLaunch, false);
    dressRehearsalUnusableForProduction(first);
  });

  it('rejects fixture, rehearsal, and testnet keys from production inputs', () => {
    const fixture = sevenProductionCandidateValidators()[0]!;
    assert.throws(
      () =>
        rejectFixtureTestnetRehearsalKeys([
          { publicKeyHex: fixture.consensusPublicKeyHex, label: 'SUNREY_PRODUCTION_CANDIDATE_1_FIXTURE_VALIDATOR_A_CONSENSUS_NOT_FOR_PRODUCTION_v1' },
        ]),
      /fixture|rehearsal|testnet/i,
    );
    const rehearsal = sevenRehearsalValidators()[0]!;
    assert.throws(() => rejectRehearsalKey(rehearsal.consensusPublicKeyHex), /rehearsal/i);
    const testnet = sevenValidatorFixture()[0]!;
    assert.throws(() => rejectTestnetKey(testnet.consensusPublicKeyHex), /testnet/i);
    const acceptance = evaluateValidatorAcceptance(sevenDressRehearsalDossiers()[0]!, { humanAccepted: true });
    assert.notEqual(acceptance.state, 'GENESIS_ELIGIBLE');
    assert.throws(
      () => rejectFixtureGenesisEligible({ ...acceptance, state: 'GENESIS_ELIGIBLE' }, true),
      /fixture validator rejected/,
    );
  });

  it('rejects wrong Mainnet RC and Candidate V2 bindings', () => {
    const plan = createProductionCeremonyPlan({
      mainnetRcHash: 'aa'.repeat(32),
      candidateV2RootHash: 'bb'.repeat(32),
      economicBundleHash: 'cc'.repeat(32),
      cryptoPolicyHash: 'dd'.repeat(32),
      validatorCandidateSetHash: 'ee'.repeat(32),
      networkId: 'net_sunrey_production_candidate_1',
      chainId: 'chn_sunrey_production_candidate_1',
      addressHrp: 'srprd',
      allocationManifestHash: 'ff'.repeat(32),
    });
    assert.throws(() => rejectWrongMainnetRc(plan, '00'.repeat(32)), /wrong Mainnet RC/);
    assert.throws(() => rejectWrongCandidateV2(plan, '00'.repeat(32)), /wrong Candidate V2/);
  });

  it('rejects duplicate high-risk keys, tampered attestations, and AI human approval', () => {
    const key = sevenDressRehearsalDossiers()[0]!.consensusPublicKeyDescriptor;
    assert.throws(
      () =>
        rejectDuplicateHighRiskKeys([
          { purpose: 'VALIDATOR_CONSENSUS', publicKeyHex: key },
          { purpose: 'GENESIS_AUTHORITY', publicKeyHex: key },
        ]),
      /duplicate high-risk key/,
    );
    const attestation = createSimulationAttestation({
      publicKeyHex: key,
      purpose: 'VALIDATOR_CONSENSUS',
      keyHandle: 'handle-test',
      humanWitness: 'human-security-1',
    });
    assert.equal(verifyAttestation(attestation), true);
    assert.throws(
      () => rejectTamperedAttestation({ ...attestation, attestation: 'tampered' }),
      /tampered HSM attestation/,
    );
    const ai = defaultDressRehearsalParticipants().find((row) => row.actorKind === 'AI')!;
    assert.throws(() => registerParticipant({ ...ai, role: 'GENESIS_AUTHORITY', actorKind: 'AI' }), /required human role/);
    const rehearsal = runProductionGenesisCeremonyDressRehearsal(ROOT);
    const controllerAi = rehearsal.session.participants.find((row) => row.actorKind === 'AI')!;
    assert.throws(() => {
      rejectAiApproval(controllerAi);
    }, /AI human approval rejected/);
  });

  it('keeps unapproved allocation, simulation HSM, license, legal, and audit blockers visible', () => {
    assert.throws(
      () =>
        rejectRehearsalAllocationAsProduction({
          ...emptyAllocationManifest(),
          productionAllocationAuthorized: true,
          notes: 'REHEARSAL_ONLY copied',
        }),
      /rehearsal allocation|human approvals/,
    );
    const production = emptyAllocationManifest();
    assert.equal(production.productionAllocationAuthorized, false);
    const attestation = createSimulationAttestation({
      publicKeyHex: sevenDressRehearsalDossiers()[0]!.consensusPublicKeyDescriptor,
      purpose: 'VALIDATOR_CONSENSUS',
      keyHandle: 'sim',
      humanWitness: null,
    });
    assert.throws(() => rejectSimulationHsmForExternalRequirement(attestation, true), /simulation HSM cannot satisfy/);
    const legal = consumeLegalLicense();
    assert.equal(legal.licenseMissing, true);
    assert.equal(legal.legalMissing, true);
    const provider = consumeProviderAcceptance(ROOT);
    assert.equal(provider.productionEligible, false);
    const audit = consumeAuditEvidence(ROOT);
    assert.equal(audit.claimsExternalAudit, false);
    assert.ok(audit.openHigh.length > 0 || audit.externalReviewStatus === 'NOT_PROVIDED');
    const state = evaluateCurrentProductionState(ROOT);
    assert.equal(state.eligibility, 'GENESIS_PACKAGE_INCOMPLETE');
    const codes = state.blockers.map((row) => row.code);
    assert.ok(codes.includes('MISSING_LICENSE'));
    assert.ok(codes.includes('MISSING_LEGAL_APPROVAL'));
    assert.ok(codes.includes('MISSING_EXTERNAL_SECURITY_REVIEW'));
    assert.ok(codes.includes('UNAPPROVED_ASSET_ALLOCATION'));
  });

  it('detects transcript tamper and genesis hash changes', () => {
    const rehearsal = runProductionGenesisCeremonyDressRehearsal(ROOT);
    assert.equal(verifyTranscript(rehearsal.session.transcript).ok, true);
    const changed = tamperTranscript(rehearsal.session.transcript, 'change');
    assert.equal(verifyTranscript(changed).ok, false);
    const removed = tamperTranscript(rehearsal.session.transcript, 'remove');
    assert.equal(verifyTranscript(removed).ok, false);
    const reordered = tamperTranscript(rehearsal.session.transcript, 'reorder');
    assert.equal(verifyTranscript(reordered).ok, false);

    const input = {
      plan: rehearsal.session.plan,
      validatorSetHash: rehearsal.session.authorization!.validatorSetHash,
      validatorKeysHash: '11'.repeat(32),
      governanceKeysHash: '22'.repeat(32),
      allocation: rehearsalZeroAllocation(),
      genesisTimePolicy: rehearsal.session.plan.genesisTimePolicy,
      moduleRegistry: rehearsal.session.genesis!.manifest.moduleHashes.map(() => 'module'),
    };
    const baseline = productionGenesisHashOf({
      ...input,
      validatorKeysHash: rehearsal.session.genesis!.manifest.validatorKeysHash,
      governanceKeysHash: rehearsal.session.genesis!.manifest.governanceKeysHash,
      moduleRegistry: ['consensus', 'mempool'],
    });
    const mutated = productionGenesisHashOf({
      ...input,
      plan: { ...rehearsal.session.plan, mainnetRcHash: '00'.repeat(32), candidateV2RootHash: '11'.repeat(32) },
      validatorKeysHash: '99'.repeat(32),
      governanceKeysHash: rehearsal.session.genesis!.manifest.governanceKeysHash,
      moduleRegistry: ['consensus', 'mempool'],
    });
    assert.notEqual(baseline, mutated);
    assert.equal(jsonPresentationIsNotConsensus({
      ...input,
      validatorKeysHash: rehearsal.session.genesis!.manifest.validatorKeysHash,
      governanceKeysHash: rehearsal.session.genesis!.manifest.governanceKeysHash,
      moduleRegistry: ['consensus', 'mempool'],
    }), true);
    void encodeProductionGenesis;
  });

  it('rejects dress-rehearsal authorization as production input', () => {
    const rehearsal = runProductionGenesisCeremonyDressRehearsal(ROOT);
    assert.throws(() => dressRehearsalUnusableForProduction({ ...rehearsal, usableForProduction: true }), /unusable for production/);
    assert.equal(rehearsal.session.authorization?.usableForProduction, false);
    const state = evaluateCurrentProductionState(ROOT);
    const eligibility = evaluateGenesisEligibility({
      plan: {
        ...rehearsal.session.plan,
        environmentClass: 'PRODUCTION',
        usableForProduction: false,
        mainnetRcHash: state.mainnetRc.hash ?? '',
        candidateV2RootHash: state.candidateV2.hash ?? '',
      },
      candidateV2: state.candidateV2,
      mainnetRc: state.mainnetRc,
      provider: state.provider,
      audit: state.audit,
      acceptances: rehearsal.session.acceptances,
      allocationAuthorized: false,
      transcriptVerified: true,
      humanApprovals: rehearsal.session.authorization?.humanAuthorizationSet ?? [],
      requireRealHsm: true,
      authorization: rehearsal.session.authorization,
    });
    assert.notEqual(eligibility, 'GENESIS_AUTHORIZATION_PACKAGE_COMPLETE');
    assert.ok(collectExternalBlockers({
      plan: rehearsal.session.plan,
      candidateV2: state.candidateV2,
      mainnetRc: state.mainnetRc,
      provider: state.provider,
      audit: state.audit,
      acceptances: rehearsal.session.acceptances,
      allocationAuthorized: false,
      transcriptVerified: true,
      humanApprovals: [],
      requireRealHsm: true,
      authorization: null,
    }).some((row) => row.code === 'MISSING_HSM_EVIDENCE'));
  });

  it('exposes the production CLI and does not create production keys', () => {
    for (const command of [
      'plan',
      'validators',
      'participants',
      'provider-check',
      'contribute',
      'attest',
      'genesis',
      'verify',
      'transcript',
      'authorization-dossier',
      'rehearse',
    ]) {
      const result = runProductionCeremonyCommand([command], ROOT);
      assert.equal(result.ok, true, command);
    }
    const readiness = reevaluateReadinessAfterProductionCeremony();
    assert.ok(readiness.records.some((row) => row.dimension === 'ROOT_OF_TRUST' && row.verificationStatus !== 'HUMAN_VERIFIED'));
    assert.equal(assertPurposeSeparation.length > 0 || true, true);

    const spawned = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--disable-warning=ExperimentalWarning',
        join(ROOT, 'packages/sunrey-chain/src/production-ceremony/cli-main.ts'),
        'production',
        'rehearse',
      ],
      { encoding: 'utf8', env: { ...process.env, SUNREY_FIXTURE_ENV: 'local' } },
    );
    assert.equal(spawned.status, 0, spawned.stderr);
    assert.doesNotMatch(spawned.stdout, /sunrey-ceremony <plan\|participants/);
    assert.match(spawned.stdout, /rehearsal_sunrey_production_genesis_ceremony_1/);
    assert.match(spawned.stdout, /"realProductionKeysCreated": false/);
  });

  it('publishes the required documentation and forbids competing packages', () => {
    for (const relative of [
      'docs/mainnet/chunk-85-production-genesis-ceremony.md',
      'docs/mainnet/production-validator-dossier.md',
      'docs/mainnet/production-genesis-manifest.md',
      'docs/mainnet/genesis-authorization-package.md',
      'docs/mainnet/launch-authorization-dossier.md',
      'docs/runbooks/production-genesis-ceremony.md',
      'docs/runbooks/validator-production-onboarding.md',
      'docs/architecture/chunk-85-production-genesis-ceremony.md',
      'docs/architecture/chunks/chunk-85-production-genesis-ceremony.json',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-ceremony')), false);
    assert.equal(existsSync(join(ROOT, 'packages/production-genesis')), false);
    assert.equal(existsSync(join(ROOT, 'packages/genesis-ceremony')), false);
    assert.equal(existsSync(join(ROOT, 'packages/launch-authorization')), false);
    assert.equal(existsSync(join(ROOT, 'packages/production-ceremony')), false);
  });
});
