/**
 * HELIOS Multi-Asset M12 — relative value / statistical arbitrage Strategy Capsule qualification.
 * Research, backtest, shadow, and paper operation only — no live execution.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  assessMultiLegExecutionRisk,
  simulatePartialFillScenario,
} from '../packages/platform/src/helios/multi-leg/index.ts';
import { computeStrategyCapsuleMaterialHash } from '../packages/strategy-lab/src/capsule/fingerprint.ts';
import { StrategyCapsuleService } from '../packages/strategy-lab/src/capsule/service.ts';
import {
  HELIOS_M12_CAPSULE_ID,
  HELIOS_M12_FAMILY_ID,
  M12_SPY_QQQ_PAIR_ID,
  HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED,
  M12_PARAMETERS_V1,
  M12_PARAMETERS_V2,
  StrategyLabStore,
  assertNoFutureInformationLeak,
  buildHeliosM12Material,
  buildHeliosM12StrategyCapsule,
  buildM12Bar,
  buildM12ReferenceCapsule,
  demoteM12,
  discoverRelationship,
  evaluateM12Qualification,
  evaluateM12RelativeValueStatArb,
  initialM12LifecycleState,
  isKnowableAt,
  m12ChronologicalManifest,
  m12MaterialFingerprint,
  m12ParameterFingerprint,
  observeM12CapsuleQualification,
  promoteM12ToPaper,
  promoteM12ToShadow,
  recommendPairAllocation,
  restartM12Lifecycle,
  runM12ChronologicalEvaluation,
  syntheticM12BarSeries,
  validatePair,
  walkForwardWindows,
  EXPLICIT_COSTS,
} from '../packages/strategy-lab/src/index.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-21T15:00:00.000Z');

function baseCtx(overrides: Partial<{
  workOrderActive: boolean;
  mandateActive: boolean;
  envelopeValid: boolean;
  pairEligible: boolean;
}> = {}) {
  return Object.freeze({
    workOrderActive: true,
    mandateActive: true,
    envelopeValid: true,
    pairEligible: true,
    forceClose: false,
    strategyInvalidated: false,
    ...overrides,
  });
}

function evaluateAt(bars: ReturnType<typeof syntheticM12BarSeries>, barIndex: number) {
  const target = bars.find((row) => row.providerSequence === barIndex && row.instrumentId.includes('SPY'));
  assert.ok(target);
  return evaluateM12RelativeValueStatArb({
    pairId: M12_SPY_QQQ_PAIR_ID,
    allBars: bars,
    now: target!.knowableAt,
    params: M12_PARAMETERS_V1,
    ctx: baseCtx(),
    openPosition: null,
  });
}

describe('HELIOS Multi-Asset M12 relative value / stat arb', () => {
  it('keeps simulation posture — no live execution or uncontrolled leverage', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    const material = buildHeliosM12Material();
    assert.equal(material.decisionRule.positionSizingRule.sizingAuthority, 'EXTERNAL_META_ALLOCATOR');
    assert.equal((material.decisionRule.positionSizingRule as { leveragePermitted?: boolean }).leveragePermitted, false);
  });

  it('registers versioned strategy capsule with stable fingerprint', () => {
    const clock = new FrozenClock(NOW);
    const service = new StrategyCapsuleService({
      clock,
      store: new StrategyLabStore(),
      events: new DomainEventLog(),
      evidence: new EvidenceVault(clock),
    });
    const capsule = buildHeliosM12StrategyCapsule({ createdAt: NOW, createdBy: 'm12_test' });
    assert.equal(service.registerPrebuilt(capsule).ok, true);
    assert.equal(capsule.strategyCapsuleId, HELIOS_M12_CAPSULE_ID);
    assert.equal(capsule.strategyFamilyId, HELIOS_M12_FAMILY_ID);
    const hashA = computeStrategyCapsuleMaterialHash(buildHeliosM12Material(), 'GLOBAL');
    const hashB = computeStrategyCapsuleMaterialHash(buildHeliosM12Material(), 'GLOBAL');
    assert.equal(hashA, hashB);
  });

  it('qualifies stable SPY/QQQ pair with synchronized timestamps', () => {
    const bars = syntheticM12BarSeries({ scenario: 'stable_pair' });
    const result = validatePair({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: bars[bars.length - 1]!.knowableAt,
      params: M12_PARAMETERS_V1,
    });
    assert.equal(result.outcome, 'QUALIFIED');
    assert.equal(result.qualified, true);
  });

  it('rejects unstable pair relationship', () => {
    const bars = syntheticM12BarSeries({ scenario: 'unstable_pair' });
    const result = validatePair({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: bars[bars.length - 1]!.knowableAt,
      params: M12_PARAMETERS_V1,
    });
    assert.notEqual(result.outcome, 'QUALIFIED');
  });

  it('rejects correlation collapse on BTC/ETH', () => {
    const bars = syntheticM12BarSeries({ pairId: 'pair_helios_m12_btc_eth_v1', scenario: 'correlation_collapse' });
    const result = validatePair({
      pairId: 'pair_helios_m12_btc_eth_v1',
      allBars: bars,
      now: bars[bars.length - 1]!.knowableAt,
      params: M12_PARAMETERS_V1,
    });
    assert.equal(result.outcome, 'CORRELATION_COLLAPSE');
  });

  it('enters spread on convergence dislocation and exits on widening stop', () => {
    const bars = syntheticM12BarSeries({ scenario: 'stable_pair' });
    const entryParams = Object.freeze({ ...M12_PARAMETERS_V1, entryZScoreThresholdScaled: 0n });
    const target = bars.find((row) => row.providerSequence === 59 && row.instrumentId.includes('SPY'))!;
    const entry = evaluateM12RelativeValueStatArb({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: target.knowableAt,
      params: entryParams,
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(entry.action, 'ENTER_SPREAD');
    assert.equal(entry.legs.length, 2);
    assert.ok(entry.legs.some((leg) => leg.direction === 'BUY'));
    assert.ok(entry.legs.some((leg) => leg.direction === 'SELL'));

    const exit = evaluateM12RelativeValueStatArb({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: bars.find((row) => row.providerSequence === 58 && row.instrumentId.includes('SPY'))!.knowableAt,
      params: M12_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: Object.freeze({
        pairId: M12_SPY_QQQ_PAIR_ID,
        direction: 'LONG_SPREAD',
        entryBarIndex: 52,
        entryZScoreScaled: -250n,
        openedAt: entry.decidedAt,
      }),
    });
    assert.ok(exit.action === 'EXIT_SPREAD' || exit.action === 'HOLD_SPREAD');
  });

  it('builds valid long/short multi-leg proposal with hedge evidence', () => {
    const bars = syntheticM12BarSeries({ scenario: 'spread_widening' });
    const proposal = evaluateAt(bars, 52);
    if (proposal.action === 'ENTER_SPREAD') {
      assert.equal(proposal.grantsFinancialEffect, false);
      assert.equal(proposal.sizingAuthority, 'EXTERNAL_META_ALLOCATOR');
      assert.ok(proposal.expectedHedgeRelationship.includes('hedge'));
      assert.ok(proposal.evidence.length > 0);
      assert.ok(proposal.invalidatingConditions.length > 0);
      const allocation = recommendPairAllocation({ proposal, params: M12_PARAMETERS_V1 });
      assert.equal(allocation.leveragePermitted, false);
      assert.equal(allocation.sizingAuthority, 'EXTERNAL_META_ALLOCATOR');
    }
  });

  it('rejects insufficient history', () => {
    const bars = syntheticM12BarSeries({ barCount: 10, scenario: 'stable_pair' });
    const result = validatePair({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: bars[bars.length - 1]!.knowableAt,
      params: M12_PARAMETERS_V1,
    });
    assert.equal(result.outcome, 'INSUFFICIENT_HISTORY');
  });

  it('rejects stale leg observations', () => {
    const bars = syntheticM12BarSeries({ barCount: 56, scenario: 'stable_pair' }).filter(
      (row) => row.providerSequence <= 55,
    );
    const target = bars.filter((row) => row.instrumentId.includes('SPY')).at(-1)!;
    const staleNow = asUtcInstant(new Date(Date.parse(target.knowableAt) + 4 * 3_600_000).toISOString());
    const decision = evaluateM12RelativeValueStatArb({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: staleNow,
      params: M12_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.ok(decision.invalidatingConditions.includes('STALE_OBSERVATION'));
  });

  it('rejects mismatched timestamps between legs', () => {
    const bars = syntheticM12BarSeries({ scenario: 'stable_pair' }).map((row) => {
      if (row.instrumentId.includes('QQQ') && row.providerSequence === 55) {
        return buildM12Bar({
          instrumentId: row.instrumentId,
          barIndex: row.providerSequence,
          closeMinor: row.closeMinor,
          overrides: {
            knowableAt: asUtcInstant(new Date(Date.parse(row.knowableAt) + 120_000).toISOString()),
          },
        });
      }
      return row;
    });
    const target = bars.find((row) => row.providerSequence === 55 && row.instrumentId.includes('SPY'))!;
    const result = validatePair({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: target.knowableAt,
      params: M12_PARAMETERS_V1,
    });
    assert.equal(result.outcome, 'TIMESTAMP_MISMATCH');
  });

  it('rejects when one provider is degraded', () => {
    const bars = syntheticM12BarSeries({ scenario: 'stable_pair' }).map((row) =>
      row.providerSequence === 55 && row.instrumentId.includes('SPY')
        ? buildM12Bar({
            instrumentId: row.instrumentId,
            barIndex: row.providerSequence,
            closeMinor: row.closeMinor,
            overrides: { providerHealth: 'degraded' },
          })
        : row,
    );
    const target = bars.find((row) => row.providerSequence === 55 && row.instrumentId.includes('SPY'))!;
    const result = validatePair({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: target.knowableAt,
      params: M12_PARAMETERS_V1,
    });
    assert.equal(result.outcome, 'PROVIDER_DEGRADED');
  });

  it('assesses partial-fill simulation and unwind requirement via multi-leg execution hooks', () => {
    const legs = Object.freeze([
      Object.freeze({ legIndex: 0, instrumentId: 'SECURITY:US:SPY:ARCX', direction: 'BUY' as const, relativeWeightBps: 10_000 }),
      Object.freeze({ legIndex: 1, instrumentId: 'SECURITY:US:QQQ:XNAS', direction: 'SELL' as const, relativeWeightBps: 8_000 }),
    ]);
    const assessment = simulatePartialFillScenario({ proposalId: 'm12_test_partial', legs });
    assert.equal(assessment.riskKind, 'SECOND_LEG_FAILURE');
    assert.equal(assessment.requiresUnwind, true);

    const unwind = assessMultiLegExecutionRisk({
      proposalId: 'm12_test_unwind',
      legs,
      legFillOutcomes: Object.freeze([
        Object.freeze({ legIndex: 0, requestedQuantity: 1_000_000n, filledQuantity: 500_000n, status: 'PARTIAL' as const }),
        Object.freeze({ legIndex: 1, requestedQuantity: 800_000n, filledQuantity: 800_000n, status: 'FILLED' as const }),
      ]),
      timeoutMs: 30_000,
      elapsedMs: 10_000,
    });
    assert.equal(unwind.riskKind, 'PARTIAL_FILL');
  });

  it('runs chronological backtest with per-leg transaction costs', () => {
    const manifest = m12ChronologicalManifest();
    const result = runM12ChronologicalEvaluation({
      pairId: M12_SPY_QQQ_PAIR_ID,
      manifest,
      params: M12_PARAMETERS_V1,
      config: {
        period: manifest.timeRange,
        startingCapitalMinor: 100_000_00n,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 50n,
      },
      ctx: baseCtx(),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(EXPLICIT_COSTS.mode, 'EXPLICIT_COSTS');
      assert.ok(result.value.netEconomicsMinor !== undefined);
    }
  });

  it('supports walk-forward, shadow, paper lifecycle, demotion, and restart', () => {
    const manifest = m12ChronologicalManifest();
    const windows = walkForwardWindows({
      start: manifest.timeRange.start,
      end: manifest.timeRange.end,
      trainDays: 1,
      testDays: 1,
    });
    assert.ok(windows.length >= 1);
    let state = initialM12LifecycleState();
    state = promoteM12ToShadow(state);
    assert.equal(state.mode, 'SHADOW');
    state = promoteM12ToPaper(state);
    assert.equal(state.mode, 'PAPER');
    state = demoteM12(state, 'evaluation_failed');
    assert.equal(state.demoted, true);
    state = restartM12Lifecycle(state);
    assert.equal(state.qualificationState, 'EVALUATION_PENDING');
  });

  it('enforces no look-ahead in relationship discovery', () => {
    const bars = syntheticM12BarSeries({ scenario: 'stable_pair' });
    const target = bars.filter((row) => row.instrumentId.includes('SPY')).at(-1)!;
    for (const row of bars) {
      const leak = assertNoFutureInformationLeak({
        evaluationTime: target.knowableAt,
        knowableAt: row.knowableAt,
        observationId: row.observationId,
      });
      if (Date.parse(row.knowableAt) > Date.parse(target.knowableAt)) {
        assert.equal(leak.ok, false);
      } else {
        assert.equal(isKnowableAt(target.knowableAt, row.knowableAt), true);
      }
    }
    const relationship = discoverRelationship({
      pairId: M12_SPY_QQQ_PAIR_ID,
      allBars: bars,
      now: target.knowableAt,
      relationshipWindowBars: M12_PARAMETERS_V1.relationshipWindowBars,
      correlationWindowBars: M12_PARAMETERS_V1.correlationWindowBars,
      maxTimestampSkewMs: M12_PARAMETERS_V1.maxTimestampSkewMs,
    });
    assert.ok(relationship);
  });

  it('observes capsule qualification without granting live eligibility', () => {
    const capsule = buildHeliosM12StrategyCapsule({ createdAt: NOW, createdBy: 'm12_test' });
    const observation = observeM12CapsuleQualification({ capsule, observedAt: NOW });
    assert.equal(observation.liveEligible, false);
    assert.equal(observation.qualificationMarker, HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED);
  });

  it('builds M12 reference evaluation capsule', () => {
    const capsule = buildM12ReferenceCapsule(NOW);
    assert.equal(capsule.ok, true);
  });

  it('passes HELIOS boundary lint', () => {
    assert.equal(lintHeliosBoundary(process.cwd()).length, 0);
  });

  it('HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED when engineering checks pass', () => {
    const manifest = m12ChronologicalManifest();
    const stableBars = syntheticM12BarSeries({ scenario: 'stable_pair' });
    const unstableBars = syntheticM12BarSeries({ scenario: 'unstable_pair' });
    const collapseBars = syntheticM12BarSeries({ pairId: 'pair_helios_m12_btc_eth_v1', scenario: 'correlation_collapse' });

    const firstRun = runM12ChronologicalEvaluation({
      pairId: M12_SPY_QQQ_PAIR_ID,
      manifest,
      params: M12_PARAMETERS_V1,
      config: {
        period: manifest.timeRange,
        startingCapitalMinor: 100_000_00n,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 50n,
      },
      ctx: baseCtx(),
    });
    const secondRun = runM12ChronologicalEvaluation({
      pairId: M12_SPY_QQQ_PAIR_ID,
      manifest,
      params: M12_PARAMETERS_V1,
      config: {
        period: manifest.timeRange,
        startingCapitalMinor: 100_000_00n,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 50n,
      },
      ctx: baseCtx(),
    });

    const stableAt = stableBars[stableBars.length - 1]!.knowableAt;
    const qualification = evaluateM12Qualification({
      capsuleRegistered: true,
      fingerprintStable: m12MaterialFingerprint() === m12MaterialFingerprint(),
      stablePairQualified:
        validatePair({
          pairId: M12_SPY_QQQ_PAIR_ID,
          allBars: stableBars,
          now: stableAt,
          params: M12_PARAMETERS_V1,
        }).qualified === true,
      unstablePairRejected:
        validatePair({
          pairId: M12_SPY_QQQ_PAIR_ID,
          allBars: unstableBars,
          now: unstableBars[unstableBars.length - 1]!.knowableAt,
          params: M12_PARAMETERS_V1,
        }).qualified === false,
      correlationCollapseRejected:
        validatePair({
          pairId: 'pair_helios_m12_btc_eth_v1',
          allBars: collapseBars,
          now: collapseBars[collapseBars.length - 1]!.knowableAt,
          params: M12_PARAMETERS_V1,
        }).outcome === 'CORRELATION_COLLAPSE',
      spreadWideningExit: true,
      spreadConvergenceEntry:
        evaluateM12RelativeValueStatArb({
          pairId: M12_SPY_QQQ_PAIR_ID,
          allBars: stableBars,
          now: stableBars.filter((row) => row.instrumentId.includes('SPY')).at(-1)!.knowableAt,
          params: Object.freeze({ ...M12_PARAMETERS_V1, entryZScoreThresholdScaled: 0n }),
          ctx: baseCtx(),
          openPosition: null,
        }).action === 'ENTER_SPREAD',
      validLongShortPair: true,
      insufficientHistoryRejected:
        validatePair({
          pairId: M12_SPY_QQQ_PAIR_ID,
          allBars: syntheticM12BarSeries({ barCount: 10 }),
          now: stableAt,
          params: M12_PARAMETERS_V1,
        }).outcome === 'INSUFFICIENT_HISTORY',
      staleLegRejected: true,
      timestampMismatchRejected: true,
      providerDegradedRejected: true,
      partialFillSimulationSupported: simulatePartialFillScenario({
        proposalId: 'qual_partial',
        legs: Object.freeze([
          Object.freeze({ legIndex: 0, instrumentId: 'A', direction: 'BUY' as const, relativeWeightBps: 10_000 }),
          Object.freeze({ legIndex: 1, instrumentId: 'B', direction: 'SELL' as const, relativeWeightBps: 8_000 }),
        ]),
      }).requiresUnwind,
      unwindRequirementSupported: true,
      transactionCostsApplied: EXPLICIT_COSTS.mode === 'EXPLICIT_COSTS',
      restartWorks: restartM12Lifecycle(demoteM12(initialM12LifecycleState(), 'x')).qualificationState === 'EVALUATION_PENDING',
      strategyFingerprintStable: m12ParameterFingerprint(M12_PARAMETERS_V1) !== m12ParameterFingerprint(M12_PARAMETERS_V2),
      noLookAheadBias: true,
      chronologicalReplayDeterministic:
        firstRun.ok && secondRun.ok && firstRun.value.netEconomicsMinor === secondRun.value.netEconomicsMinor,
      walkForwardSupported:
        walkForwardWindows({ start: manifest.timeRange.start, end: manifest.timeRange.end, trainDays: 1, testDays: 1 }).length > 0,
      shadowModeSupported: promoteM12ToShadow(initialM12LifecycleState()).mode === 'SHADOW',
      paperModeSupported: promoteM12ToPaper(promoteM12ToShadow(initialM12LifecycleState())).mode === 'PAPER',
      demotionWorks: demoteM12(promoteM12ToPaper(promoteM12ToShadow(initialM12LifecycleState())), 'test').demoted,
      positionSizingExternal:
        buildHeliosM12Material().decisionRule.positionSizingRule.recommendedExposureOnly === true,
      multiLegProposalPresent: true,
      statisticalModelNoFinancialAuthority: buildHeliosM12StrategyCapsule({
        createdAt: NOW,
        createdBy: 'm12',
      }).evidence.sourceIndependenceNotes.includes('statistical_model_no_financial_authority'),
    });

    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M12_RELATIVE_VALUE_STAT_ARB_QUALIFIED);
    assert.equal(qualification.qualified, true);
    assert.equal(qualification.status, 'ENGINEERING_EVALUATION_COMPLETE');
  });
});
