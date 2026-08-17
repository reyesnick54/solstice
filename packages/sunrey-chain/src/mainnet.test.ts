import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { encodeFromPublicKey } from './wallet/address.ts';
import { publicDescriptorFromSeed, seedFromLabel } from './wallet/index.ts';
import { fixtureGenesisHash } from './testnet/genesis.ts';
import { sevenValidatorFixture } from './testnet/validators.ts';
import { runTestnetCommand } from './testnet/cli.ts';
import { developmentMigrationFixture, assertMigrationNotExecuted } from './native-assets/migration.ts';
import {
  applyEngineeringVerification,
  applyHumanVerification,
  defaultDimensionCatalog,
  recordHumanAuthorization,
  emptyAllocationManifest,
  rejectUnapprovedAllocation,
  allocationManifestHash,
  sevenProductionCandidateValidators,
  rejectTestnetKeys,
  simulationHsmSatisfiesRealProvider,
  evaluateConcentration,
  productionCandidateCryptoPolicy,
  rejectUnsupportedPqHsmRequirement,
  buildGenesisCandidate,
  defaultGenesisCandidateInput,
  genesisCandidateHashOf,
  jsonPresentationIsNotConsensus,
  evaluateReadiness,
  DEFAULT_PRODUCTION_POLICY,
  ENGINEERING_ONLY_POLICY,
  missingSecurityReportAppearsVerified,
  missingHumanAuthorizationAppearsAuthorized,
  generateActivationPlan,
  activationPlanDoesNotEnableLiveFlags,
  signReadinessBundle,
  tamperedEvidenceRejected,
  runMainnetCandidateRehearsal,
  runMainnetCommand,
  assembleReadinessRegistry,
  rejectWrongReleaseArtifact,
  developmentOracleFixturesAreProductionFeeds,
  softwareExchangeIsLicensedExchange,
  softwareCustodyIsLicensedCustody,
  exchangeReadiness,
  custodyReadiness,
  oracleReadiness,
  interopReadiness,
  privacyReadiness,
  READINESS_DIMENSIONS,
  ACTIVATION_DOMAINS,
  PRODUCTION_CANDIDATE_NETWORK_ID,
  PRODUCTION_CANDIDATE_CHAIN_ID,
  PRODUCTION_ADDRESS_HRP,
  type GenesisAllocationLine,
  type GenesisAssetAllocationManifest,
  type CryptographicPolicyManifest,
} from './mainnet/index.ts';

describe('Chunk 65 SunRey mainnet readiness', () => {
  it('covers every required dimension and activation domain', () => {
    const records = defaultDimensionCatalog();
    for (const dimension of READINESS_DIMENSIONS) {
      assert.equal(records.some((row) => row.dimension === dimension), true, dimension);
    }
    assert.equal(ACTIVATION_DOMAINS.length, 12);
  });

  it('rehearses a zero-allocation candidate without activating production', () => {
    const rehearsal = runMainnetCandidateRehearsal();
    assert.equal(rehearsal.validatorCount, 7);
    assert.equal(rehearsal.deterministic, true);
    assert.equal(rehearsal.evidenceIncomplete, true);
    assert.equal(rehearsal.humanAuthorizationAbsent, true);
    assert.equal(rehearsal.productionServicesActivated, false);
    assert.equal(rehearsal.status, 'AWAITING_EXTERNAL_EVIDENCE');
    assert.equal(rehearsal.report.liveFlagsRemainDisabled, true);
    assert.equal(rehearsal.unlicensedUnavailable, true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.match(rehearsal.genesisHash, /^[0-9a-f]{64}$/);
    assert.notEqual(rehearsal.genesisHash, fixtureGenesisHash());
    const pinned = readFileSync(
      join(import.meta.dirname, '../fixtures/mainnet/genesis-candidate-hash.txt'),
      'utf8',
    ).trim();
    assert.equal(rehearsal.genesisHash, pinned);
  });

  it('produces a deterministic genesis candidate hash', () => {
    const input = defaultGenesisCandidateInput();
    const first = genesisCandidateHashOf(input);
    const second = genesisCandidateHashOf(input);
    assert.equal(first, second);
    const bundle = buildGenesisCandidate(input);
    assert.equal(bundle.genesisHash, first);
    assert.equal(bundle.candidate.networkId, PRODUCTION_CANDIDATE_NETWORK_ID);
    assert.equal(bundle.candidate.chainId, PRODUCTION_CANDIDATE_CHAIN_ID);
    assert.equal(bundle.candidate.productionAddressHrp, PRODUCTION_ADDRESS_HRP);
    assert.equal(bundle.candidate.mainnetEnabled, false);
    assert.equal(
      jsonPresentationIsNotConsensus(JSON.stringify(bundle.manifest), bundle.canonicalBytesHex),
      true,
    );
  });

  it('uses the reserved production HRP for candidate addresses', () => {
    const descriptor = publicDescriptorFromSeed('candidate-a', seedFromLabel('production-candidate-a'));
    const address = encodeFromPublicKey(PRODUCTION_CANDIDATE_NETWORK_ID, 'SINGLE_KEY_ACCOUNT', descriptor);
    assert.equal(address.networkClass, 'RESERVED_PRODUCTION');
    assert.equal(address.text.startsWith('srprd1'), true);
  });

  it('rejects a missing security report appearing verified', () => {
    const records = defaultDimensionCatalog();
    assert.equal(missingSecurityReportAppearsVerified(records), false);
    const review = records.find((row) => row.dimension === 'EXTERNAL_SECURITY_REVIEW');
    assert.ok(review);
    assert.equal(review.verificationStatus, 'NOT_PROVIDED');
    assert.equal(review.evidenceHash, null);
    assert.throws(() => applyEngineeringVerification(review, 'HUMAN_VERIFIED'));
  });

  it('rejects missing human authorization appearing authorized', () => {
    const records = defaultDimensionCatalog();
    const status = evaluateReadiness(records, [], DEFAULT_PRODUCTION_POLICY);
    assert.equal(missingHumanAuthorizationAppearsAuthorized(status, []), false);
    assert.notEqual(status, 'AUTHORIZED_CANDIDATE');
  });

  it('rejects AI authorization', () => {
    const rejected = recordHumanAuthorization({
      actorKind: 'AI',
      actorId: 'ai-preparer',
      role: 'PROTOCOL_AUTHORITY',
      statement: 'authorize candidate',
      signedAtUtc: '2026-01-01T00:00:00.000Z',
      signatureHex: '00'.repeat(32),
    });
    assert.equal(rejected.accepted, false);
    assert.match(rejected.rejectionReason ?? '', /AI cannot sign/);
  });

  it('rejects simulation HSM as real-provider evidence', () => {
    const validators = sevenProductionCandidateValidators();
    assert.equal(simulationHsmSatisfiesRealProvider(validators), false);
    assert.equal(
      validators.every((row) => row.hsmEvidenceClass === 'SIMULATION_HSM'),
      true,
    );
  });

  it('rejects testnet keys as production candidate keys', () => {
    const testnet = sevenValidatorFixture();
    const first = testnet[0];
    assert.ok(first);
    const infiltrated = sevenProductionCandidateValidators().map((row, index) =>
      index === 0
        ? {
            ...row,
            consensusPublicKeyHex: first.consensusPublicKeyHex,
          }
        : row,
    );
    assert.throws(() => rejectTestnetKeys(infiltrated), /testnet key/);
  });

  it('rejects testnet genesis as production genesis', () => {
    const candidate = buildGenesisCandidate();
    assert.notEqual(candidate.genesisHash, fixtureGenesisHash());
    assert.equal(
      candidate.verification.checks.some((check) => check.id === 'testnet-genesis-not-reused' && check.ok),
      true,
    );
  });

  it('refuses automatic ledger-balance migration', () => {
    const fixture = developmentMigrationFixture();
    assert.equal(fixture.productionMigrationPerformed, false);
    assertMigrationNotExecuted(fixture);
    const allocation = emptyAllocationManifest();
    assert.equal(allocation.migratedApplicationLedgerBalances, false);
    assert.equal(allocation.inheritedTestnetFaucet, false);
    assert.equal(allocation.totalByAsset.SUNREY_COIN, 0n);
  });

  it('rejects unapproved token allocation', () => {
    const line: GenesisAllocationLine = {
      asset: 'SUNREY_COIN',
      recipientAccount: 'acct.unapproved',
      quantityMinorUnits: 1n,
      purposeCategory: 'PROTOCOL_RESERVE',
      authorizationEvidence: null,
    };
    const bad: GenesisAssetAllocationManifest = {
      ...emptyAllocationManifest(),
      lines: [line],
      totalByAsset: { SUNREY_COIN: 1n, MOONREY_COIN: 0n },
    };
    assert.throws(() => rejectUnapprovedAllocation(bad), /unapproved token allocation/);
  });

  it('rejects a wrong validator key in genesis verification', () => {
    const input = defaultGenesisCandidateInput();
    const mutated = {
      ...input,
      validators: input.validators.map((row, index) =>
        index === 0 ? { ...row, consensusPublicKeyHex: 'ff'.repeat(32) } : row,
      ),
    };
    const expected = genesisCandidateHashOf(input);
    const verification = buildGenesisCandidate(mutated).verification;
    assert.equal(verification.checks.find((check) => check.id === 'genesis-hash')?.ok, true);
    assert.notEqual(genesisCandidateHashOf(mutated), expected);
  });

  it('rejects a wrong release artifact by invalidating the readiness bundle', () => {
    const records = defaultDimensionCatalog();
    const report = runMainnetCandidateRehearsal().report;
    const bundle = signReadinessBundle(records, report);
    const tampered = records.map((row, index) =>
      index === 0 ? { ...row, notes: `${row.notes} tampered` } : row,
    );
    assert.equal(tamperedEvidenceRejected(records, tampered, bundle), true);
    assert.throws(() => rejectWrongReleaseArtifact('aa'.repeat(32), 'bb'.repeat(32)), /wrong release artifact/);
    rejectWrongReleaseArtifact(bundle.bundleHash, bundle.bundleHash);
  });

  it('tracks exchange, custody, oracle, interop, and privacy separately', () => {
    const report = runMainnetCandidateRehearsal().report;
    assert.equal(report.exchangeReadiness.softwareImplementationSufficient, false);
    assert.equal(report.custodyReadiness.simulationHsmSatisfiesRealProvider, false);
    assert.equal(report.oracleReadiness.developmentFixturesAreProductionFeeds, false);
    assert.equal(report.interopReadiness.wrappedFiat, false);
    assert.equal(report.interopReadiness.separatelyControlled, true);
    assert.equal(report.privacyReadiness.jurisdictionalPrivacyAnalysis, 'NOT_PROVIDED');
    assert.equal(softwareExchangeIsLicensedExchange(), false);
    assert.equal(softwareCustodyIsLicensedCustody(), false);
    assert.equal(developmentOracleFixturesAreProductionFeeds(), false);
    assert.equal(exchangeReadiness().licensingOrRegistration, 'NOT_PROVIDED');
    assert.equal(custodyReadiness().realHsmOrProvider, 'NOT_PROVIDED');
    assert.equal(oracleReadiness().realProviderAgreements, 'NOT_PROVIDED');
    assert.equal(oracleReadiness().technicalImplementation, 'ENGINEERING_VERIFIED');
    assert.equal(oracleReadiness().providerConfigured, 'ENGINEERING_VERIFIED');
    assert.equal(oracleReadiness().providerAgreementEvidence, 'NOT_PROVIDED');
    assert.equal(oracleReadiness().productionEligible, 'NOT_PROVIDED');
    assert.equal(interopReadiness().legalComplianceReview, 'NOT_PROVIDED');
    assert.equal(privacyReadiness().humanLegalReview, 'NOT_PROVIDED');
  });

  it('keeps unlicensed capabilities unavailable', () => {
    const matrix = assembleReadinessRegistry().capabilities;
    assert.equal(
      matrix.every((row) => row.runtime_enabled === false && row.genesis_enabled === false),
      true,
    );
    assert.equal(
      matrix.every((row) => row.legal_ready === false && row.license_or_partner_ready === false),
      true,
    );
  });

  it('can reach AUTHORIZED_CANDIDATE only under an explicit narrow policy with humans', () => {
    const humans = [
      recordHumanAuthorization({
        actorKind: 'HUMAN',
        actorId: 'human.protocol.1',
        role: 'PROTOCOL_AUTHORITY',
        statement: 'engineering candidate review',
        signedAtUtc: '2026-01-01T00:00:00.000Z',
        signatureHex: 'aa'.repeat(32),
      }),
      recordHumanAuthorization({
        actorKind: 'HUMAN',
        actorId: 'human.security.1',
        role: 'SECURITY_AUTHORITY',
        statement: 'engineering candidate review',
        signedAtUtc: '2026-01-01T00:00:00.000Z',
        signatureHex: 'bb'.repeat(32),
      }),
      recordHumanAuthorization({
        actorKind: 'HUMAN',
        actorId: 'human.operations.1',
        role: 'OPERATIONS_AUTHORITY',
        statement: 'engineering candidate review',
        signedAtUtc: '2026-01-01T00:00:00.000Z',
        signatureHex: 'cc'.repeat(32),
      }),
      recordHumanAuthorization({
        actorKind: 'HUMAN',
        actorId: 'human.release.1',
        role: 'RELEASE_AUTHORITY',
        statement: 'engineering candidate review',
        signedAtUtc: '2026-01-01T00:00:00.000Z',
        signatureHex: 'dd'.repeat(32),
      }),
    ];
    assert.equal(humans.every((row) => row.accepted), true);
    const records = defaultDimensionCatalog();
    assert.equal(evaluateReadiness(records, humans, DEFAULT_PRODUCTION_POLICY), 'AWAITING_EXTERNAL_EVIDENCE');
    assert.equal(evaluateReadiness(records, humans, ENGINEERING_ONLY_POLICY), 'AUTHORIZED_CANDIDATE');
    assert.equal(evaluateReadiness(records, [], ENGINEERING_ONLY_POLICY), 'AWAITING_HUMAN_AUTHORIZATION');
  });

  it('emits concentration warnings without claiming independence', () => {
    const report = evaluateConcentration(sevenProductionCandidateValidators());
    assert.equal(report.organizationalIndependenceClaimed, false);
    assert.equal(report.votingPowerWarnings.length > 0, true);
  });

  it('does not require unsupported PQ/HSM for production consensus', () => {
    const policy = productionCandidateCryptoPolicy();
    rejectUnsupportedPqHsmRequirement(policy);
    assert.equal(policy.pqRequiredForConsensus, false);
    assert.equal(policy.hsmRequiredForConsensus, false);
    const illegal = { ...policy, pqRequiredForConsensus: true } as unknown as CryptographicPolicyManifest;
    assert.throws(() => rejectUnsupportedPqHsmRequirement(illegal));
  });

  it('generates an activation plan without executing it', () => {
    const plan = generateActivationPlan(defaultDimensionCatalog());
    assert.equal(activationPlanDoesNotEnableLiveFlags(plan), true);
    assert.equal(plan.steps.length >= 9, true);
    assert.equal(plan.incompleteEvidence.length > 0, true);
  });

  it('exposes CLI commands while evidence is incomplete', () => {
    for (const command of [
      'readiness',
      'evidence',
      'capabilities',
      'validator-candidates',
      'genesis-candidate',
      'verify',
      'activation-plan',
    ]) {
      const result = runMainnetCommand([command]);
      assert.equal(result.ok, true, command);
    }
    const genesis = runTestnetCommand(['candidate']);
    assert.equal(genesis.ok, true);
    const verify = runTestnetCommand(['candidate', 'verify']);
    assert.equal(verify.ok, true);
  });

  it('refuses software conversion of external evidence to HUMAN_VERIFIED', () => {
    const legal = defaultDimensionCatalog().find((row) => row.dimension === 'LEGAL');
    assert.ok(legal);
    assert.throws(() => applyEngineeringVerification(legal, 'HUMAN_VERIFIED'));
    const human = recordHumanAuthorization({
      actorKind: 'HUMAN',
      actorId: 'human.legal.1',
      role: 'LEGAL_AUTHORITY',
      statement: 'no counsel opinion is present; this only tests the workflow',
      signedAtUtc: '2026-01-01T00:00:00.000Z',
      signatureHex: 'ee'.repeat(32),
    });
    const verified = applyHumanVerification(legal, human);
    assert.equal(verified.verificationStatus, 'HUMAN_VERIFIED');
  });

  it('hashes allocations deterministically and keeps them empty by default', () => {
    const first = allocationManifestHash(emptyAllocationManifest());
    const second = allocationManifestHash(emptyAllocationManifest());
    assert.equal(first, second);
  });
});
