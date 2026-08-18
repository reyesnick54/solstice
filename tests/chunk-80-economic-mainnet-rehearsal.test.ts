import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ECONOMIC_REHEARSAL_ADDRESS_HRP,
  ECONOMIC_REHEARSAL_CHAIN_ID,
  ECONOMIC_REHEARSAL_DISPLAY_NAME,
  ECONOMIC_REHEARSAL_NETWORK_ID,
  ECONOMIC_RC_ID,
  buildEconomicGenesis,
  economicGenesisHashOf,
  defaultEconomicGenesisInput,
  productionCandidateAllocationUnchanged,
  runEconomicLaunchCommand,
  runEconomicRehearsal,
  runEconomicTraceConformance,
  verifyEconomicRc,
  buildEconomicRcBundle,
} from '../packages/sunrey-chain/src/economic-rehearsal/index.ts';
import { emptyAllocationManifest } from '../packages/sunrey-chain/src/mainnet/allocation.ts';
import { PRODUCTION_CANDIDATE_CHAIN_ID, PRODUCTION_CANDIDATE_NETWORK_ID } from '../packages/sunrey-chain/src/mainnet/identity.ts';
import { REHEARSAL_CHAIN_ID, REHEARSAL_NETWORK_ID } from '../packages/sunrey-chain/src/launch-rehearsal/identity.ts';

const ROOT = join(import.meta.dirname, '..');

describe('Chunk 80 economic mainnet rehearsal', () => {
  it('uses a distinct rehearsal identity and leaves production candidate zero', () => {
    assert.equal(ECONOMIC_REHEARSAL_DISPLAY_NAME, 'SunRey Economic Mainnet Rehearsal 1');
    assert.notEqual(ECONOMIC_REHEARSAL_NETWORK_ID, PRODUCTION_CANDIDATE_NETWORK_ID);
    assert.notEqual(ECONOMIC_REHEARSAL_CHAIN_ID, PRODUCTION_CANDIDATE_CHAIN_ID);
    assert.notEqual(ECONOMIC_REHEARSAL_NETWORK_ID, REHEARSAL_NETWORK_ID);
    assert.notEqual(ECONOMIC_REHEARSAL_CHAIN_ID, REHEARSAL_CHAIN_ID);
    assert.equal(ECONOMIC_REHEARSAL_ADDRESS_HRP, 'srecr');
    assert.equal(productionCandidateAllocationUnchanged(), true);
    const candidate = emptyAllocationManifest();
    assert.equal(candidate.totalByAsset.SUNREY_COIN, 0n);
    assert.equal(candidate.totalByAsset.MOONREY_COIN, 0n);
  });

  it('builds a deterministic economic genesis bound to the economic RC', () => {
    const first = buildEconomicGenesis();
    const second = buildEconomicGenesis(defaultEconomicGenesisInput());
    assert.equal(first.genesisHash, second.genesisHash);
    assert.match(first.genesisHash, /^[0-9a-f]{64}$/);
    assert.equal(first.verification.ok, true);
    assert.equal(economicGenesisHashOf(defaultEconomicGenesisInput()), first.genesisHash);
    assert.equal(first.policyHashes.some((row) => row.name === 'economic-rc' && row.version === ECONOMIC_RC_ID), true);
  });

  it('verifies the economic RC before rehearsal', () => {
    const rc = buildEconomicRcBundle(ROOT);
    assert.equal(rc.rcId, ECONOMIC_RC_ID);
    assert.equal(verifyEconomicRc(rc), true);
    assert.equal(rc.productionAuthorized, false);
  });

  it('runs the complete economic rehearsal without authorizing production', () => {
    const session = runEconomicRehearsal(ROOT);
    assert.equal(session.report.productionAuthorized, false);
    assert.equal(session.report.liveFlagsRemainDisabled, true);
    assert.equal(session.report.tickersAssigned, false);
    assert.equal(session.report.validatorCount, 7);
    assert.equal(session.report.sentryCount, 14);
    assert.equal(session.report.sunreySupply.exact, true);
    assert.equal(session.report.moonreySupply.exact, true);
    assert.equal(session.report.fees.dispositionExact, true);
    assert.equal(session.report.treasury.reconciled, true);
    assert.equal(session.report.exchange.reconciled, true);
    assert.equal(session.report.exchange.noPeg, true);
    assert.equal(session.report.validatorEconomics.bondedValidators, 7);
    assert.equal(session.report.moonreyIssuance.duplicateRejected, true);
    assert.equal(session.report.stress.accountingSafe, true);
    assert.equal(session.report.recoveries.every((row) => row.safetyHolds), true);
    assert.equal(session.report.formal.every((row) => row.aligned), true);
    assert.equal(session.report.productionCandidateAllocationUnchanged, true);
    assert.equal(session.evidence.productionAuthorized, false);
  });

  it('exposes economic CLI commands on sunrey-launch', () => {
    const verify = runEconomicLaunchCommand(['economic-verify'], ROOT);
    assert.equal(verify.ok, true);
    const audit = runEconomicLaunchCommand(['economic-audit'], ROOT);
    assert.equal(audit.ok, true);
  });

  it('exports formal traces that conform', () => {
    const results = runEconomicTraceConformance();
    assert.equal(results.length > 0, true);
    assert.equal(results.every((row) => row.aligned), true);
  });

  it('publishes the required documentation and forbids competing packages', () => {
    for (const relative of [
      'docs/mainnet/chunk-80-economic-mainnet-rehearsal.md',
      'docs/mainnet/economic-genesis-rehearsal.md',
      'docs/mainnet/economic-control-room.md',
      'docs/mainnet/economic-activation-evidence.md',
      'docs/mainnet/economic-rehearsal-findings.md',
      'docs/runbooks/economic-mainnet-rehearsal.md',
      'docs/architecture/chunk-80-economic-mainnet-rehearsal.md',
      'docs/architecture/chunks/chunk-80-economic-mainnet-rehearsal.json',
    ]) {
      assert.equal(existsSync(join(ROOT, relative)), true, relative);
    }
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-economic-rehearsal')), false);
    assert.equal(existsSync(join(ROOT, 'packages/economic-mainnet')), false);
    assert.equal(existsSync(join(ROOT, 'packages/economic-rehearsal')), false);
    assert.equal(existsSync(join(ROOT, 'packages/sunrey-economic-mainnet')), false);
  });
});
