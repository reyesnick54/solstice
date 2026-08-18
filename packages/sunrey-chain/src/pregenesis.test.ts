import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { PRODUCTION_ADDRESS_HRP } from './mainnet/identity.ts';
import { CANDIDATE_V2_CHAIN_ID, CANDIDATE_V2_NETWORK_ID } from './mainnet/candidate-v2/identity.ts';
import { buildGenesisCandidate } from './mainnet/genesis-candidate.ts';
import { FIRST_MAINNET_RC_ID } from './release-candidate/mainnet/types.ts';
import { rejectFixtureTestnetRehearsalKeys } from './production-ceremony/keys.ts';
import { rejectShadowNetworkAsProduction } from './production-ceremony/eligibility.ts';
import {
  PREGENESIS_ADDRESS_HRP,
  PREGENESIS_CHAIN_ID,
  PREGENESIS_NETWORK_ID,
  accountUnexpectedVariance,
  assertPregenesisIdentity,
  bindQualificationArtifacts,
  buildShadowGenesis,
  compareShadowConfiguration,
  createPregenesisNetwork,
  createPregenesisQualificationPlan,
  detectBackupCorruption,
  detectSignerFencingViolation,
  rejectConflictingFinalityAttempt,
  rejectFakeElapsedDurationClaim,
  rejectSecretInLog,
  rejectShadowAsProductionAuthorization,
  rejectShadowGenesisAsProduction,
  rejectUnaccountedConfigurationVariance,
  rejectWrongCandidateV2,
  rejectWrongMainnetRc,
  runPregenesisCommand,
  sevenShadowValidators,
  shadowTopology,
  qualifyPregenesisNetwork,
} from './pregenesis/index.ts';

describe('Chunk 87 pre-genesis shadow network', () => {
  it('uses an isolated identity', () => {
    assertPregenesisIdentity(PREGENESIS_NETWORK_ID, PREGENESIS_CHAIN_ID, PREGENESIS_ADDRESS_HRP);
    assert.notEqual(PREGENESIS_NETWORK_ID, CANDIDATE_V2_NETWORK_ID);
    assert.notEqual(PREGENESIS_CHAIN_ID, CANDIDATE_V2_CHAIN_ID);
    assert.notEqual(PREGENESIS_ADDRESS_HRP, PRODUCTION_ADDRESS_HRP);
    assert.throws(() => assertPregenesisIdentity(CANDIDATE_V2_NETWORK_ID, PREGENESIS_CHAIN_ID, PREGENESIS_ADDRESS_HRP));
    assert.throws(() => rejectShadowAsProductionAuthorization(PREGENESIS_NETWORK_ID), /production authorization/);
  });

  it('rejects shadow keys and genesis from production', () => {
    const shadow = buildShadowGenesis();
    const production = buildGenesisCandidate();
    assert.notEqual(shadow.genesisHash, production.genesisHash);
    assert.throws(() => rejectShadowGenesisAsProduction(shadow.genesisHash, production.genesisHash), /shadow genesis rejected/);
    assert.throws(() => rejectShadowNetworkAsProduction(PREGENESIS_NETWORK_ID), /shadow genesis rejected/);
    assert.throws(
      () =>
        rejectFixtureTestnetRehearsalKeys(
          sevenShadowValidators().map((row) => ({
            publicKeyHex: row.consensusPublicKeyHex,
            label: row.consensusKeyLabel,
          })),
        ),
      /rejected/,
    );
  });

  it('instantiates the Candidate V2 topology with shadow identities', () => {
    const network = createPregenesisNetwork();
    const topology = shadowTopology();
    assert.equal(network.definition.mainnetEnabled, false);
    assert.equal(topology.validators.length, 7);
    assert.equal(topology.sentries.length, 7);
    assert.equal(topology.remoteSigners.length, 7);
    assert.equal(topology.rpc.length, 1);
    assert.equal(topology.explorer.length, 1);
    assert.equal(topology.monitoring.length, 1);
    assert.equal(topology.backup.length, 1);
    assert.equal(topology.oracleCollectors.length, 1);
    assert.equal(topology.database.length, 1);
    assert.equal(topology.exchangeSandbox.length, 1);
    assert.equal(topology.custodySandbox.length, 1);
    assert.equal(topology.failureDomains.length, 3);
    assert.equal(topology.sentries.every((row) => row.canSign === false), true);
  });

  it('fails qualification on unaccounted configuration variance', () => {
    const rows = compareShadowConfiguration();
    rejectUnaccountedConfigurationVariance(rows);
    assert.throws(
      () => rejectUnaccountedConfigurationVariance([...rows, accountUnexpectedVariance('hidden.flag', 'false', 'true')]),
      /unaccounted configuration variance/,
    );
  });

  it('rejects wrong RC, wrong Candidate V2, secrets, and fake duration', () => {
    const bindings = bindQualificationArtifacts();
    const plan = createPregenesisQualificationPlan(bindings);
    assert.equal(bindings.mainnetRcId, FIRST_MAINNET_RC_ID);
    assert.equal(plan.mainnetEnabled, false);
    assert.throws(() => rejectWrongMainnetRc(bindings, 'SUNREY_MAINNET_RC_999', bindings.mainnetRcHash), /wrong RC/);
    assert.throws(() => rejectWrongCandidateV2(bindings, 'WRONG_CANDIDATE', '00'.repeat(32)), /wrong Candidate V2/);
    assert.throws(() => rejectSecretInLog('{"privateKey":"abc"}'), /secret in log/);
    assert.throws(() => rejectFakeElapsedDurationClaim({ claimedMs: '86400000' }), /fake elapsed-duration/);
    assert.throws(() => rejectConflictingFinalityAttempt('a', 'b'), /conflicting-finality/);
    assert.throws(() => detectSignerFencingViolation(), /two active signers rejected/);
    assert.doesNotThrow(() => detectBackupCorruption());
  });

  it('qualifies the bounded shadow network without launching mainnet', () => {
    const session = qualifyPregenesisNetwork({ profile: 'bounded' });
    assert.equal(session.report.network.networkId, PREGENESIS_NETWORK_ID);
    assert.equal(session.report.topology.validators, 7);
    assert.equal(session.report.consensus.converged, true);
    assert.equal(session.report.consensus.noConflictingFinality, true);
    assert.equal(session.report.signers.every((row) => row.shadowKeysOnly), true);
    assert.equal(session.report.storage.engine, 'redb');
    assert.equal(session.report.database.tls, true);
    assert.equal(session.report.database.blockchainAuthority, false);
    assert.equal(session.report.oracle.sandboxOnly, true);
    assert.equal(session.report.economics.realEconomicValue, false);
    assert.equal(session.report.exchangeCustody.sandboxMode, true);
    assert.equal(session.report.exchangeCustody.productionActivated, false);
    assert.equal(session.report.performance.guarantee, false);
    assert.equal(session.report.burnIn.durationClaimedWithoutExecution, false);
    assert.equal(session.report.operatorEvidence.legalCertification, false);
    assert.equal(session.report.securityReview.openBlockersRemainVisible, true);
    assert.equal(session.report.readiness.engineeringStatus, 'ENGINEERING_VERIFIED');
    assert.equal(session.report.readiness.humanStatus, 'NOT_PROVIDED');
    assert.equal(session.report.readiness.authorizesMainnet, false);
    assert.equal(session.report.mainnetEnabled, false);
    assert.equal(session.report.productionAuthorized, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.match(session.report.classification, /PREGENESIS_/);
  });

  it('exposes the sunrey-ops pregenesis CLI', () => {
    const created = runPregenesisCommand(['create']);
    assert.equal(created.ok, true);
    const qualified = runPregenesisCommand(['qualify']);
    assert.equal(qualified.ok, true);
    const verified = runPregenesisCommand(['verify']);
    assert.equal(verified.ok, true);
    const burnIn = runPregenesisCommand(['burn-in', '--claim-duration', '86400000']);
    assert.equal(burnIn.ok, true);
    assert.equal((burnIn.payload as { rejected: boolean }).rejected, true);
  });
});
