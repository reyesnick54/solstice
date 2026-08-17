import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_EXCHANGE_ENABLED, LIVE_MONEY_ENABLED } from '../../config/src/flags.ts';
import { PRODUCTION_ADDRESS_HRP, PRODUCTION_CANDIDATE_CHAIN_ID, PRODUCTION_CANDIDATE_NETWORK_ID } from './mainnet/identity.ts';
import { buildGenesisCandidate } from './mainnet/genesis-candidate.ts';
import {
  REHEARSAL_ADDRESS_HRP,
  REHEARSAL_BANNER,
  REHEARSAL_CHAIN_ID,
  REHEARSAL_DISPLAY_NAME,
  REHEARSAL_NETWORK_ID,
  assertRehearsalIdentity,
  buildRehearsalGenesis,
  rehearsalTopology,
  runLaunchCommand,
  runLaunchRehearsal,
  sevenRehearsalValidators,
} from './launch-rehearsal/index.ts';

describe('Chunk 70 SunRey mainnet launch rehearsal', () => {
  it('uses a distinct rehearsal identity and genesis', () => {
    assert.equal(REHEARSAL_DISPLAY_NAME, 'SunRey Mainnet Rehearsal 1');
    assert.notEqual(REHEARSAL_NETWORK_ID, PRODUCTION_CANDIDATE_NETWORK_ID);
    assert.notEqual(REHEARSAL_CHAIN_ID, PRODUCTION_CANDIDATE_CHAIN_ID);
    assert.notEqual(REHEARSAL_ADDRESS_HRP, PRODUCTION_ADDRESS_HRP);
    assertRehearsalIdentity(REHEARSAL_NETWORK_ID, REHEARSAL_CHAIN_ID, REHEARSAL_ADDRESS_HRP);
    assert.throws(() => assertRehearsalIdentity(PRODUCTION_CANDIDATE_NETWORK_ID, REHEARSAL_CHAIN_ID, REHEARSAL_ADDRESS_HRP));
    const rehearsal = buildRehearsalGenesis();
    const candidate = buildGenesisCandidate();
    assert.notEqual(rehearsal.genesisHash, candidate.genesisHash);
    assert.match(rehearsal.genesisHash, /^[0-9a-f]{64}$/);
    assert.equal(rehearsal.verification.ok, true);
  });

  it('provisions seven validators and fourteen sentries across three domains', () => {
    const validators = sevenRehearsalValidators();
    const topology = rehearsalTopology();
    assert.equal(validators.length, 7);
    assert.equal(topology.sentries.length, 14);
    assert.equal(topology.failureDomains.length, 3);
    assert.equal(topology.sentries.every((row) => row.canSign === false), true);
    assert.equal(topology.services.some((row) => row.role === 'EXCHANGE_SANDBOX'), true);
    assert.equal(topology.services.some((row) => row.role === 'CUSTODY_SANDBOX'), true);
  });

  it('executes the full rehearsal without launching production', () => {
    const session = runLaunchRehearsal();
    assert.equal(session.report.displayName, 'SunRey Mainnet Rehearsal 1');
    assert.equal(session.report.validatorCount, 7);
    assert.equal(session.report.sentryCount, 14);
    assert.equal(session.report.firstBlock.healthyValidatorAgreement, true);
    assert.equal(session.report.explorer.banner, REHEARSAL_BANNER);
    assert.equal(session.report.productionAuthorized, false);
    assert.equal(session.report.liveFlagsRemainDisabled, true);
    assert.equal(session.report.nativeAssets.productionValueClaim, false);
    assert.equal(session.report.validatorEconomics.bondedValidators, 7);
    assert.equal(session.report.validatorEconomics.healthyRewardEpoch, true);
    assert.equal(session.report.validatorEconomics.jailedValidator, true);
    assert.equal(session.report.validatorEconomics.evidencePenalty, true);
    assert.equal(session.report.validatorEconomics.unbondDelayHonored, true);
    assert.equal(session.report.validatorEconomics.supplyReconciled, true);
    assert.equal(session.report.validatorEconomics.units, 'REHEARSAL_ONLY');
    assert.equal(session.report.validatorEconomics.productionBondAsset, 'UNCONFIGURED');
    assert.equal(session.report.exchangeCustodySandbox.productionExchangeActivated, false);
    assert.equal(session.report.interop.productionBridgeActivated, false);
    assert.equal(session.report.oracleStatus.fabricatedFact, false);
    assert.equal(session.report.moonreyPolicy.productionAuthorized, false);
    assert.equal(session.report.moonreyPolicy.issuance, true);
    assert.equal(session.report.moonreyPolicy.antiDoubleCount, true);
    assert.equal(session.report.moonreyPolicy.supplyReconciled, true);
    assert.equal(session.report.recoveryResults.every((row) => row.safetyHolds), true);
    assert.equal(session.plan.executes, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.ok(
      session.report.classification === 'ENGINEERING_REHEARSAL_QUALIFIED'
        || session.report.classification === 'REHEARSAL_COMPLETED_WITH_FINDINGS',
    );
  });

  it('exposes the sunrey-launch CLI', () => {
    const rehearse = runLaunchCommand(['rehearse']);
    assert.equal(rehearse.ok, true);
    const status = runLaunchCommand(['status']);
    assert.equal(status.ok, true);
    const verify = runLaunchCommand(['verify']);
    assert.equal(verify.ok, true);
    const findings = runLaunchCommand(['findings']);
    assert.equal(findings.ok, true);
    const plan = runLaunchCommand(['activation-plan']);
    assert.equal(plan.ok, true);
  });
});
