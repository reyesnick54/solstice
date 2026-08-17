import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyzeReport } from './analysis.ts';
import { runAdversarialSmoke } from './adversarial.ts';
import { benchmarkSimulator } from './benchmark.ts';
import { runEconomicsCommand } from './cli.ts';
import { compareScenarios, runMonteCarlo } from './compare.ts';
import { DualEconomySimulationEngine, simulateScenario } from './engine.ts';
import { FORBIDDEN_PRICE_LABELS, SCENARIO_IDS, SIMULATION_LABEL } from './ids.ts';
import { allPropertiesHold, propertyChecks } from './properties.ts';
import { dualEconomyReadiness } from './readiness.ts';
import { catalogScenarios, requiredCatalogComplete } from './scenarios.ts';

describe('Chunk 75 dual-economy simulator', () => {
  it('keeps a complete versioned scenario catalog', () => {
    assert.equal(requiredCatalogComplete(), true);
    assert.equal(catalogScenarios().length >= SCENARIO_IDS.length, true);
  });

  it('runs the baseline economy deterministically', () => {
    const left = simulateScenario('baseline', { epochs: 3, seed: 75 });
    const right = simulateScenario('baseline', { epochs: 3, seed: 75 });
    assert.equal(left.simulationLabel, SIMULATION_LABEL);
    assert.equal(left.seed, 75);
    assert.equal(left.sunrey.circulating, right.sunrey.circulating);
    assert.equal(left.moonrey.circulating, right.moonrey.circulating);
    assert.equal(left.human.totalActivity, right.human.totalActivity);
    assert.equal(left.productive.totalOutput, right.productive.totalOutput);
    assert.equal(left.market.lastPriceUnits, right.market.lastPriceUnits);
    assert.equal(left.productionActivation.moonreyIssuanceActivated, false);
    assert.equal(left.productionActivation.becomesProductionPolicy, false);
    assert.equal(left.sunrey.assetId, 'SUNREY_COIN');
    assert.equal(left.moonrey.assetId, 'MOONREY_COIN');
    assert.equal(left.bridge.intrinsicExchangeRatio, null);
    assert.equal(left.bridge.policy.algorithmicPeg, false);
  });

  it('reconciles supplies, fees, DVP, and mandates', () => {
    const snapshot = propertyChecks('baseline', 75, 3);
    assert.equal(allPropertiesHold(snapshot), true);
  });

  it('does not merge SunRey and MoonRey supplies', () => {
    const report = simulateScenario('baseline', { epochs: 2, seed: 11 });
    assert.notEqual(report.sunrey.issued, report.moonrey.issued);
    assert.equal(report.sunrey.genesis > 0n, true);
    assert.equal(report.moonrey.genesis, 0n);
  });

  it('forms Exchange prices from order flow rather than a peg', () => {
    const report = simulateScenario('market-volatility', { epochs: 3, seed: 9 });
    assert.equal(report.market.priceDiscovery, 'SIMULATION_ORDER_FLOW_ONLY');
    assert.equal(report.market.marketId, 'market:sunrey-coin-moonrey-coin-native');
    assert.equal(
      FORBIDDEN_PRICE_LABELS.some((label) =>
        JSON.stringify(report, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
          .toLowerCase()
          .includes(label),
      ),
      false,
    );
  });

  it('fail-closes MoonRey issuance under oracle degradation', () => {
    const healthy = simulateScenario('baseline', { epochs: 2, seed: 3 });
    const degraded = simulateScenario('oracle-degradation', { epochs: 2, seed: 3 });
    assert.equal(degraded.oracle.failClosed, true);
    assert.equal(degraded.moonrey.issued <= healthy.moonrey.issued, true);
    assert.equal(degraded.stability.signals.includes('ORACLE_DEPENDENCY'), true);
  });

  it('warns on concentrated productive operators', () => {
    const concentrated = simulateScenario('high-concentration', { epochs: 2, seed: 4 });
    const distributed = simulateScenario('decentralized-productive', { epochs: 2, seed: 4 });
    assert.equal(concentrated.concentration.warnings.length > 0, true);
    assert.equal(concentrated.concentration.productiveOutputHhi > distributed.concentration.productiveOutputHhi, true);
  });

  it('observes rapid automation and energy scarcity against baseline', () => {
    const engine = new DualEconomySimulationEngine();
    const baseline = engine.simulate(catalogScenarios().find((row) => row.scenarioId === 'baseline')!);
    const rapid = simulateScenario('rapid-automation', { epochs: 3, seed: 75 });
    const energy = simulateScenario('energy-scarcity', { epochs: 3, seed: 75 });
    assert.equal(rapid.automation.intensityIndex > baseline.automation.intensityIndex, true);
    assert.equal(energy.productive.availability.ENERGY < baseline.productive.availability.ENERGY, true);
    assert.equal(baseline.properties.sunreySupplyReconciles, true);
  });

  it('compares scenarios and records Monte Carlo seeds', () => {
    const comparison = compareScenarios('baseline', 'rapid-automation', 2);
    assert.equal(comparison.notAForecast, true);
    assert.equal(comparison.leftId, 'baseline');
    const batch = runMonteCarlo('baseline', [1, 2], 2);
    assert.deepEqual(batch.seeds, [1, 2]);
    assert.equal(batch.notAFinancialPrediction, true);
    assert.equal(batch.reports[0]?.seed, 1);
  });

  it('exposes CLI planes and a SIMULATION dashboard', () => {
    const listed = runEconomicsCommand(['dual', 'scenario', '--list']);
    assert.match(listed, /baseline/);
    const stability = runEconomicsCommand(['dual', 'stability', '--scenario', 'baseline']);
    assert.match(stability, /engineeringClassification/);
    const analysis = analyzeReport(simulateScenario('baseline', { epochs: 1, seed: 1 }));
    assert.equal(analysis.canAlterActiveProtocolPolicy, false);
  });

  it('records DUAL_ECONOMY_MODELING evidence without production authorization', () => {
    const evidence = dualEconomyReadiness();
    assert.equal(evidence.dimension, 'DUAL_ECONOMY_MODELING');
    assert.equal(evidence.productionAuthorization, false);
    assert.equal(evidence.tracks.humanApproval, 'NOT_PROVIDED');
    assert.equal(evidence.tracks.simulatorImplemented, 'ENGINEERING_VERIFIED');
  });

  it('benchmarks simulator throughput without touching consensus', () => {
    const bench = benchmarkSimulator(2);
    assert.equal(bench.consensusUntouched, true);
    assert.equal(bench.epochs, 2);
  });

  it('integrates selected Chunk 57 adversarial smokes', () => {
    const smoke = runAdversarialSmoke();
    assert.equal(smoke.scenarioIds.includes('ORACLE-STALE-REPLAY'), true);
    assert.equal(smoke.scenarioIds.includes('MOONREY-DUPLICATE-CLAIM'), true);
    assert.equal(smoke.scenarioIds.includes('MACHINE-OVERSPEND'), true);
    assert.equal(smoke.failed, 0);
  });
});
