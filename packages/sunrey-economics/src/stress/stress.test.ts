import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runStressCommand } from './cli.ts';
import { catalogScenarioIds, requiredCatalogComplete, STRESS_CAMPAIGNS } from './catalog.ts';
import { runSmokeStressCampaign, runStressCampaign } from './campaign.ts';
import { compareStressScenarios } from './compare.ts';
import { runEconomicStressScenario } from './engine.ts';
import { ECONOMIC_INVARIANT_IDS } from './ids.ts';
import { runPropertyStream } from './property.ts';
import { replayStressScenario } from './replay.ts';

describe('Chunk 76 economic stress laboratory', () => {
  it('keeps at least 60 unique deterministic scenarios', () => {
    assert.equal(requiredCatalogComplete(), true);
    assert.equal(catalogScenarioIds().length >= 60, true);
    assert.equal(new Set(catalogScenarioIds()).size, catalogScenarioIds().length);
  });

  it('covers every required invariant', () => {
    assert.equal(ECONOMIC_INVARIANT_IDS.length, 14);
    const smoke = runEconomicStressScenario('ECON-LIQ-001');
    assert.deepEqual(
      smoke.invariants.map((row) => row.invariant),
      [...ECONOMIC_INVARIANT_IDS],
    );
  });

  it('reproduces a scenario from id and seed', () => {
    const first = runEconomicStressScenario('ECON-DUP-001', { seed: 7631 });
    const replayed = replayStressScenario({
      scenarioId: 'ECON-DUP-001',
      seed: 7631,
      expectedFixtureHash: first.inputFixtureHash,
    });
    assert.equal(replayed.inputFixtureHash, first.inputFixtureHash);
    assert.equal(replayed.preservedInvariants, first.preservedInvariants);
  });

  it('fail-closes MoonRey issuance under oracle staleness', () => {
    const result = runEconomicStressScenario('ECON-ORACLE-002');
    assert.equal(result.failClosed, true);
    assert.equal(result.preservedInvariants, true);
  });

  it('does not invent accounting without finality', () => {
    const result = runEconomicStressScenario('ECON-NQ-001');
    assert.equal(result.degradedAvailability, true);
    assert.equal(result.pendingOperations > 0, true);
    assert.equal(result.preservedInvariants, true);
  });

  it('keeps customer holdings isolated under validator penalty', () => {
    const result = runEconomicStressScenario('ECON-VAL-004');
    assert.equal(result.preservedInvariants, true);
  });

  it('runs the smoke campaign without open critical findings', () => {
    const report = runSmokeStressCampaign();
    assert.equal(report.scenarioCount, STRESS_CAMPAIGNS[0]!.scenarioIds.length);
    assert.equal(report.productionAuthorization, false);
    assert.equal(report.openFindings.every((finding) => finding.severity !== 'CRITICAL'), true);
    assert.equal(report.performanceContext.protocolChecksWeakened, false);
  });

  it('holds mixed-stream properties', () => {
    const stream = runPropertyStream(76, 10);
    assert.equal(stream.held, true);
  });

  it('compares compound stress against a liquidity scenario', () => {
    const compared = compareStressScenarios('ECON-LIQ-001', 'ECON-COMP-001');
    assert.equal(compared.leftPreserved, true);
    assert.equal(compared.rightPreserved, true);
  });

  it('exposes the stress CLI', () => {
    const listed = runStressCommand(['scenario', '--list']);
    assert.equal(listed.includes('ECON-LIQ-001'), true);
    const usage = runStressCommand([]);
    assert.equal(usage.includes('sunrey-economics stress run'), true);
  });

  it('refuses extended campaigns in ordinary workflows', () => {
    assert.throws(() => runStressCampaign('extended-120'), /extended workflow/);
  });
});
