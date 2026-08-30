/**
 * ACCESS-22 Dual-Economy Access Stress Laboratory tests.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_MONEY_ENABLED, SIMULATION_MODE } from '../../../config/src/flags.ts';
import {
  ACCESS_22_CATALOG,
  ACCESS_22_INVARIANT_IDS,
  ACCESS_22_SCENARIO_IDS,
  ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED,
  access22CatalogComplete,
  allocationInvariantToPrice,
  benchmarkTestsPassed,
  computeDualEconomyAccessAllocation,
  qualifyDualEconomyAccess,
  runAccess22Campaign,
  runAccess22Scenario,
  runBenchmarkSuite,
  runMonteCarloStream,
  runPostScarcityTest,
} from './index.ts';
import { benchmarkParticipant } from './participants.ts';

describe('ACCESS-22 catalog and identifiers', () => {
  it('defines exactly 45 stress scenarios', () => {
    assert.equal(ACCESS_22_SCENARIO_IDS.length, 45);
    assert.equal(ACCESS_22_CATALOG.length, 45);
    assert.equal(access22CatalogComplete(), true);
  });

  it('defines 17 formal property invariants', () => {
    assert.equal(ACCESS_22_INVARIANT_IDS.length, 17);
  });
});

describe('ACCESS-22 allocation mechanics', () => {
  it('keeps price path out of allocation weight', () => {
    const participant = benchmarkParticipant();
    const priceA = Object.freeze({
      srPriceBps: 10_000n,
      mrPriceBps: 10_000n,
      srPriceChangeBps: 0n,
      mrPriceChangeBps: 0n,
    });
    const priceB = Object.freeze({
      srPriceBps: 60_000n,
      mrPriceBps: 60_000n,
      srPriceChangeBps: 50_000n,
      mrPriceChangeBps: 50_000n,
    });
    assert.equal(
      allocationInvariantToPrice([participant], 10_000n, priceA, priceB, 22022),
      true,
    );
  });

  it('never allocates more than allocatable capacity', () => {
    const participants = Array.from({ length: 100 }, (_, index) =>
      Object.freeze({
        subjectId: `subj.${index}`,
        sunreyMinor: BigInt(50 + index),
        moonreyMinor: BigInt(50 + index),
        dualHolder: true,
        dataContributionUnits: 1n,
        productiveContributionUnits: 1n,
        sybilClusterId: null,
      }),
    );
    const result = computeDualEconomyAccessAllocation({
      participants,
      allocatableUnits: 5_000n,
      tokenPricePath: {
        srPriceBps: 10_000n,
        mrPriceBps: 10_000n,
        srPriceChangeBps: 0n,
        mrPriceChangeBps: 0n,
      },
      seed: 42,
    });
    assert.equal(result.totalAllocatedUnits <= 5_000n, true);
    assert.equal(result.priceInfluencedAllocation, false);
  });
});

describe('ACCESS-22 scenario execution', () => {
  it('runs baseline scenario deterministically', () => {
    const a = runAccess22Scenario('ACCESS22-01-baseline-balanced-economy', { seed: 22001 });
    const b = runAccess22Scenario('ACCESS22-01-baseline-balanced-economy', { seed: 22001 });
    assert.equal(a.resultDigestSha256, b.resultDigestSha256);
    assert.equal(a.allInvariantsHeld, true);
  });

  it('runs smoke campaign without invariant violations', () => {
    const campaign = runAccess22Campaign({ smoke: true, seed: 22022 });
    assert.equal(campaign.failed, 0);
    assert.equal(campaign.violations, 0);
  });
});

describe('ACCESS-22 qualification', () => {
  it('qualifies full dual-economy access stress laboratory', () => {
    const report = qualifyDualEconomyAccess({ seed: 22022, monteCarloRuns: 20 });
    assert.equal(report.scenarioCount, 45);
    assert.equal(report.scenariosFailed, 0);
    assert.equal(report.allInvariantsHeld, true);
    assert.equal(report.mechanismTestsPassed, true);
    assert.equal(report.benchmarkTestsPassed, true);
    assert.equal(report.agentStressPassed, true);
    assert.equal(report.postScarcityPassed, true);
    assert.equal(report.monteCarloViolations, 0);
    assert.equal(report.qualificationState, ACCESS_DUAL_ECONOMY_ENGINEERING_QUALIFIED);
  });

  it('does not change production posture', () => {
    const report = qualifyDualEconomyAccess({ seed: 22022, monteCarloRuns: 10 });
    assert.equal(report.productionPosture.PRODUCTION_READY, false);
    assert.equal(report.productionPosture.LIVE_CONNECTIVITY_ENABLED, false);
    assert.equal(report.productionPosture.PRODUCTION_ACTIVE, false);
    assert.equal(report.productionPosture.changedByThisRun, false);
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(SIMULATION_MODE, true);
    assert.equal(LIVE_MONEY_ENABLED, false);
  });
});

describe('ACCESS-22 benchmark and post-scarcity', () => {
  it('shows 100 SR + 100 MR benchmark is price-invariant', () => {
    const runs = runBenchmarkSuite();
    assert.equal(benchmarkTestsPassed(runs), true);
    const priceShocks = runs.filter((row) => row.priceChanged);
    assert.ok(priceShocks.length >= 2);
    for (const row of priceShocks) {
      assert.equal(row.allocationUnchangedByPrice, true, `${row.scenarioId} changed by price alone`);
    }
  });

  it('raises allocatable access in post-scarcity without minting', () => {
    const postScarcity = runPostScarcityTest();
    assert.equal(postScarcity.passed, true);
    assert.equal(postScarcity.nativeSunreyIssued, 0n);
    assert.equal(postScarcity.nativeMoonreyIssued, 0n);
    assert.equal(postScarcity.accessMoneyPrinted, false);
    assert.equal(postScarcity.fixedPriceGuarantee, false);
  });
});

describe('ACCESS-22 Monte Carlo', () => {
  it('holds price-invariance across seeded stream', () => {
    const result = runMonteCarloStream(30, 22022);
    assert.equal(result.violations, 0);
  });
});
