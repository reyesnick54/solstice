/**
 * HELIOS Forward Alpha — ALPHA05 benchmark, baseline, and attribution qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { ratioFromUnits } from '../packages/risk/src/arithmetic.ts';
import {
  ALPHA_DECOMPOSITION_BUCKETS,
  FORWARD_BENCHMARK_KINDS,
  HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED,
  buildAlphaAttribution,
  buildAlphaDecomposition,
  buildBenchmarkComparison,
  buildBenchmarkPortfolio,
  evaluateAlpha05BenchmarkAttributionQualification,
  sealForwardBenchmark,
  validateForwardBenchmarkSelectionTiming,
} from '../packages/platform/src/helios/forward-alpha/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const ROOT = process.cwd();
const T0 = asUtcInstant('2026-10-01T00:00:00.000Z');
const T1 = asUtcInstant('2026-10-02T00:00:00.000Z');
const T2 = asUtcInstant('2026-10-03T00:00:00.000Z');
const CAMPAIGN_START = asUtcInstant('2026-10-15T00:00:00.000Z');
const BENCHMARK_FROZEN = asUtcInstant('2026-10-10T00:00:00.000Z');
const NOW = asUtcInstant('2026-11-08T00:00:00.000Z');

const INSTRUMENT = 'SIM-ETF-1';

const OBS = Object.freeze([
  { at: T0, instrumentId: INSTRUMENT, closeMinor: 10_000n },
  { at: T1, instrumentId: INSTRUMENT, closeMinor: 10_500n },
  { at: T2, instrumentId: INSTRUMENT, closeMinor: 10_200n },
]);

describe('HELIOS ALPHA05 — benchmark and attribution', () => {
  it('architecture guard: forward-alpha stays inside helios boundary', () => {
    const findings = lintHeliosBoundary(ROOT).filter((row) => row.file.includes('helios/forward-alpha'));
    assert.equal(findings.length, 0, JSON.stringify(findings));
  });

  it('simulation only', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
  });

  it('enumerates benchmark kinds and decomposition buckets', () => {
    assert.equal(FORWARD_BENCHMARK_KINDS.length, 10);
    assert.ok(FORWARD_BENCHMARK_KINDS.includes('INCUMBENT_CHAMPION'));
    assert.equal(ALPHA_DECOMPOSITION_BUCKETS.length, 8);
  });

  it('rejects benchmark frozen after campaign start or post-hoc selection', () => {
    assert.ok(
      validateForwardBenchmarkSelectionTiming({
        campaignId: 'camp-a',
        kind: 'CASH',
        methodology: 'cash',
        selectedBeforeCampaignAt: CAMPAIGN_START,
        campaignStartsAt: CAMPAIGN_START,
      }) !== null,
    );
    const postHoc = sealForwardBenchmark({
      campaignId: 'camp-b',
      kind: 'BUY_AND_HOLD',
      methodology: 'buy-hold',
      selectedBeforeCampaignAt: BENCHMARK_FROZEN,
      campaignStartsAt: CAMPAIGN_START,
      observedOutcomesUsedForSelection: true,
    });
    assert.equal(postHoc.ok, false);
  });

  it('runs forward benchmark → comparison → attribution → decomposition pipeline', () => {
    const sealed = sealForwardBenchmark({
      campaignId: 'alpha05-fixture',
      kind: 'CASH',
      methodology: 'cash-no-action',
      referenceId: null,
      selectedBeforeCampaignAt: BENCHMARK_FROZEN,
      campaignStartsAt: CAMPAIGN_START,
    });
    assert.equal(sealed.ok, true);
    if (!sealed.ok) {
      return;
    }

    const startingCapitalMinor = 100_000n;
    const strategyEquity = [
      { at: T0, totalMinor: startingCapitalMinor },
      { at: T1, totalMinor: 102_000n },
      { at: T2, totalMinor: 101_000n },
    ];

    const benchmarkPortfolio = buildBenchmarkPortfolio({
      forwardBenchmark: sealed.value,
      currency: 'USD',
      startingCapitalMinor,
      period: { start: T0, end: T2 },
      observations: OBS,
    });
    assert.ok(benchmarkPortfolio);
    assert.equal(benchmarkPortfolio!.endingCapitalMinor, startingCapitalMinor);

    const comparison = buildBenchmarkComparison({
      forwardBenchmark: sealed.value,
      benchmarkPortfolio: benchmarkPortfolio!,
      strategyEquity,
      methodology: 'fixture-alpha05',
      computedAt: NOW,
    });
    assert.ok(comparison.metrics.absoluteReturn);
    assert.ok(comparison.metrics.benchmarkReturn);
    assert.ok(comparison.metrics.activeReturn);
    assert.ok(comparison.metrics.trackingError);
    assert.ok(comparison.metrics.informationRatio);

    const attribution = buildAlphaAttribution({ comparison, computedAt: NOW });
    assert.equal(attribution.rules.BENCHMARK_MUST_BE_FROZEN_BEFORE_CAMPAIGN, true);

    const active = comparison.metrics.activeReturn.units;
    const lines = ALPHA_DECOMPOSITION_BUCKETS.map((bucket) => {
      let contribution = 0n;
      if (bucket === 'ASSET_SELECTION') {
        contribution = active / 4n;
      } else if (bucket === 'TIMING') {
        contribution = active / 4n;
      } else if (bucket === 'MARKET_BETA') {
        contribution = active / 8n;
      } else if (bucket === 'FACTOR_EXPOSURE') {
        contribution = active / 8n;
      } else if (bucket === 'POSITION_SIZING') {
        contribution = active / 8n;
      } else if (bucket === 'EXECUTION') {
        contribution = active / 8n;
      } else if (bucket === 'CASH') {
        contribution = 0n;
      } else if (bucket === 'FEES') {
        contribution = 0n;
      }
      return {
        bucket,
        contribution: ratioFromUnits(contribution),
        ...(bucket === 'POSITION_SIZING' ? { leverageDriven: true } : {}),
        ...(bucket === 'FACTOR_EXPOSURE'
          ? { sectorConcentrationDriven: true, cryptoBetaDriven: false }
          : {}),
      };
    });

    const decomposition = buildAlphaDecomposition({
      attribution,
      lines,
      computedAt: NOW,
    });
    assert.notEqual(decomposition.skillAlpha.units, 0n);
    assert.equal(decomposition.rules.MARKET_BETA_IS_NOT_ALPHA, true);
    const betaLine = decomposition.lines.find((row) => row.bucket === 'MARKET_BETA');
    assert.equal(betaLine?.countsAsSkillAlpha, false);
    const sizingLine = decomposition.lines.find((row) => row.bucket === 'POSITION_SIZING');
    assert.equal(sizingLine?.countsAsSkillAlpha, false);
    assert.ok(decomposition.attribution.attributableSkillAlpha.units <= attribution.metrics.activeReturn.units);
  });

  it('each forward benchmark kind can materialize a portfolio path', () => {
    for (const kind of FORWARD_BENCHMARK_KINDS) {
      const sealed = sealForwardBenchmark({
        campaignId: `camp-${kind}`,
        kind,
        methodology: `fixture-${kind}`,
        referenceId: kind === 'CASH' ? null : INSTRUMENT,
        selectedBeforeCampaignAt: BENCHMARK_FROZEN,
        campaignStartsAt: CAMPAIGN_START,
      });
      assert.equal(sealed.ok, true);
      if (!sealed.ok) {
        continue;
      }
      const suppliedEquity =
        kind === 'INCUMBENT_CHAMPION' ||
        kind === 'STRATEGY_FAMILY_BASELINE' ||
        kind === 'RISK_MATCHED'
          ? [
              { at: T0, totalMinor: 100_000n },
              { at: T1, totalMinor: 101_000n },
              { at: T2, totalMinor: 100_800n },
            ]
          : undefined;
      const portfolio = buildBenchmarkPortfolio({
        forwardBenchmark: sealed.value,
        currency: 'USD',
        startingCapitalMinor: 100_000n,
        period: { start: T0, end: T2 },
        observations: OBS,
        primaryInstrumentId: INSTRUMENT,
        equalWeightInstrumentIds: [INSTRUMENT],
        suppliedEquity,
        riskMatchScaleNumerator: 8n,
        riskMatchScaleDenominator: 10n,
      });
      assert.ok(portfolio, `portfolio required for kind ${kind}`);
    }
  });

  it('qualifies ALPHA05 benchmark attribution module', () => {
    const result = evaluateAlpha05BenchmarkAttributionQualification({
      root: ROOT,
      gitSha: 'alpha05_test_sha',
      evaluatedAt: NOW,
    });
    assert.equal(
      result.marker,
      HELIOS_ALPHA05_BENCHMARK_ATTRIBUTION_QUALIFIED,
      result.blockers.join('; '),
    );
    assert.equal(result.qualified, true);
  });
});
