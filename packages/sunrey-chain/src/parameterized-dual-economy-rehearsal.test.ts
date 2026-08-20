import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ENVIRONMENT,
  LIVE_BANKING_RAILS,
  LIVE_CRYPTO_ENABLED,
  LIVE_DATA_MARKET_ENABLED,
  LIVE_EXCHANGE_ENABLED,
  LIVE_EXTERNAL_BANK_CONNECTION,
  LIVE_EXTERNAL_KYC,
  LIVE_INVESTMENT_EXECUTION,
  LIVE_MONEY_ENABLED,
  LIVE_PAYMENTS_ENABLED,
  LIVE_TRADING_ENABLED,
} from '../../config/src/flags.ts';
import {
  classifyParameter,
  parameterManifestHash,
} from './economics/production-activation/index.ts';
import {
  PEVE_USED_AS_TOKEN_FORMULA,
} from './economics/human-contribution-bridge/index.ts';
import { GPUV_EQUALS_MOONREY_BY_DEFINITION } from './productive/policy-governance/value-settlement/index.ts';
import {
  REHEARSAL_PRODUCTIVE_CATEGORIES,
  detectCandidateOwners,
  evaluateFirewallAfterRehearsal,
  evaluateFirewallBeforeRehearsal,
  fixtureBlocked,
  hashParameterPackage,
  impossibleMaxSupplyPackage,
  noFixedPeg,
  productionRecordsFromPackage,
  rehearsalParameterPackageV1,
  rehearsalParameterPackageV2,
  rejectMaxSupplyTightening,
  runParameterizedDualEconomyRehearsal,
  validateRehearsalParameterPackage,
} from './economic-rehearsal/parameterized-candidate/index.ts';

describe('Chunk 147 parameterized dual-economy rehearsal', () => {
  it('1-3. complete fixture package uses production validators and cannot qualify the firewall', () => {
    const pkg = rehearsalParameterPackageV1();
    assert.equal(pkg.sourceClass, 'REHEARSAL_FIXTURE');
    assert.equal(pkg.fixture, true);
    assert.equal(pkg.rehearsalOnly, true);
    assert.equal(pkg.disclaimer.recommendedTokenomics, false);
    const validated = validateRehearsalParameterPackage(pkg);
    assert.equal(validated.ok, true);
    assert.equal(validated.typeValid, true);
    assert.equal(validated.dependenciesValid, true);
    assert.equal(validated.crossParameterValid, true);
    assert.equal(validated.genesisTotalsExact, true);
    assert.equal(validated.hiddenPremint, false);
    assert.equal(validated.faucetMigration, false);
    const records = productionRecordsFromPackage(pkg);
    assert.equal(records.length, 15);
    assert.equal(classifyParameter(records[0]!).id, 'SUNREY_MAXIMUM_SUPPLY');
    const hashA = parameterManifestHash(records);
    const hashB = parameterManifestHash(productionRecordsFromPackage(rehearsalParameterPackageV2()));
    assert.notEqual(hashA, hashB);
    assert.notEqual(hashParameterPackage(pkg), hashParameterPackage(rehearsalParameterPackageV2()));
    const owners = detectCandidateOwners();
    assert.equal(typeof owners.chunk144Present, 'boolean');
    const after = evaluateFirewallAfterRehearsal(pkg);
    assert.equal(fixtureBlocked(after), true);
    assert.equal(after.productionActivated, false);
  });

  it('4-9. SunRey and MoonRey V2 paths keep separate books and no peg', () => {
    const report = runParameterizedDualEconomyRehearsal();
    assert.equal(report.sunreyPathComplete, true);
    assert.equal(report.moonreyV2PathComplete, true);
    assert.equal(report.sunreySupply.assetId, 'SUNREY_COIN');
    assert.equal(report.moonreySupply.assetId, 'MOONREY_COIN');
    assert.notEqual(report.sunreySupply.assetId, report.moonreySupply.assetId);
    assert.deepEqual([...REHEARSAL_PRODUCTIVE_CATEGORIES], [
      'ENERGY',
      'COMPUTE',
      'MANUFACTURING',
      'LOGISTICS_TRANSPORTATION',
      'FOOD_AGRICULTURE',
      'WATER',
      'GOODS',
      'SERVICES',
    ]);
    assert.deepEqual(noFixedPeg(), { noPeg: true, noGuaranteedRatio: true });
    assert.equal(report.exchangePriceControlsIssuance, false);
    assert.equal(report.exchangeReconciled, true);
  });

  it('10-16. caps, concentration, oracle outage, and revoked HIN consent hold', () => {
    const report = runParameterizedDualEconomyRehearsal();
    const ids = report.stressScenarios.map((row) => row.scenarioId);
    assert.ok(ids.includes('REH-147-HUMAN-BURST'));
    assert.ok(ids.includes('REH-147-PROD-SURGE'));
    assert.ok(ids.includes('REH-147-CONTROLLER'));
    assert.ok(ids.includes('REH-147-CATEGORY'));
    assert.ok(ids.includes('REH-147-ORACLE-OUTAGE'));
    assert.ok(ids.includes('REH-147-HIN-OUTAGE'));
    for (const row of report.stressScenarios) {
      assert.equal(row.held, true, row.scenarioId);
      assert.equal(row.accountingPreserved, true, row.scenarioId);
    }
    assert.equal(report.stressFailures.length, 0);
  });

  it('17-23. policy upgrade, conversion change, max-supply tightening, and genesis totals', () => {
    const report = runParameterizedDualEconomyRehearsal();
    assert.equal(report.policyUpgradeResults.historicalReceiptsStable, true);
    assert.equal(report.policyUpgradeResults.retroactiveRecompute, false);
    assert.equal(report.policyUpgradeResults.conversionChangeNonRetroactive, true);
    assert.equal(report.policyUpgradeResults.maxSupplyTighteningRejected, true);
    assert.equal(report.policyUpgradeResults.existingBalancesUnburned, true);
    const pkg = rehearsalParameterPackageV1();
    const validated = validateRehearsalParameterPackage(pkg);
    assert.equal(validated.genesisTotalsExact, true);
    assert.equal(validated.hiddenPremint, false);
    assert.equal(validated.faucetMigration, false);
    const tightening = rejectMaxSupplyTightening(impossibleMaxSupplyPackage(pkg.sunreyGenesisSupply.value + 1n), {
      sunrey: pkg.sunreyGenesisSupply.value + 1n,
      moonrey: 0n,
    });
    assert.equal(tightening.rejected, true);
  });

  it('24-29. replay, correction, epoch reconciliation, and stress accounting', () => {
    const report = runParameterizedDualEconomyRehearsal();
    assert.equal(report.replayResults.humanReplayRejected, true);
    assert.equal(report.replayResults.productiveReplayRejected, true);
    assert.equal(report.replayResults.dvpReplayRejected, true);
    assert.equal(report.replayResults.doubleIssuance, false);
    assert.equal(report.correctionResults.silentRemint, false);
    assert.equal(report.correctionResults.arbitraryClawback, false);
    assert.equal(report.correctionResults.productiveRevaluationRequiresReview, true);
    assert.equal(report.sunreySupplyReconciled, true);
    assert.equal(report.moonreySupplyReconciled, true);
    for (const epoch of report.epochReconciliations) {
      assert.equal(epoch.sunreyReconciled, true);
      assert.equal(epoch.moonreyReconciled, true);
    }
    assert.equal(report.suppliesReconciled, true);
  });

  it('30-32. firewall remains production-blocked and LIVE flags stay false', () => {
    const before = evaluateFirewallBeforeRehearsal();
    const report = runParameterizedDualEconomyRehearsal();
    assert.equal(before.productionActivated, false);
    assert.equal(report.firewallBefore.productionActivated, false);
    assert.equal(report.firewallAfter.productionActivated, false);
    assert.equal(report.productionAuthorized, false);
    assert.equal(report.fixtureParameters, true);
    assert.equal(report.liveFlagsChanged, false);
    assert.equal(report.environment, 'simulation');
    assert.equal(report.productionActive, false);
    assert.equal(fixtureBlocked(report.firewallAfter), true);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_MONEY_ENABLED, false);
    assert.equal(LIVE_PAYMENTS_ENABLED, false);
    assert.equal(LIVE_BANKING_RAILS, false);
    assert.equal(LIVE_EXTERNAL_KYC, false);
    assert.equal(LIVE_EXTERNAL_BANK_CONNECTION, false);
    assert.equal(LIVE_TRADING_ENABLED, false);
    assert.equal(LIVE_CRYPTO_ENABLED, false);
    assert.equal(LIVE_EXCHANGE_ENABLED, false);
    assert.equal(LIVE_DATA_MARKET_ENABLED, false);
    assert.equal(LIVE_INVESTMENT_EXECUTION, false);
    assert.equal(PEVE_USED_AS_TOKEN_FORMULA, false);
    assert.equal(GPUV_EQUALS_MOONREY_BY_DEFINITION, false);
    assert.equal(report.peveUsedAsSunReyFormula, false);
    assert.equal(report.gpuvEqualsMoonRey, false);
  });
});
