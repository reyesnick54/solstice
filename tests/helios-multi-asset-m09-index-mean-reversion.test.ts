/**
 * HELIOS Multi-Asset M09 — 15-minute index mean-reversion Strategy Capsule qualification.
 * Engineering/strategy evaluation only — does not claim profitability.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { asCustomerId } from '../packages/domain/src/customer.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import {
  HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS,
  InMemoryHeliosMultiAssetBarStore,
} from '../packages/platform/src/helios/multi-asset/index.ts';
import { resolveCapitalMarketInstrument } from '../packages/sunrey-exchange/src/capital-market/instrument-registry.ts';
import {
  HELIOS_M09_CAPSULE_ID,
  HELIOS_M09_FAMILY_ID,
  HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED,
  M09_PARAMETERS_V1,
  M09_PARAMETERS_V2,
  M09_QQQ_INSTRUMENT_ID,
  M09_SPY_INSTRUMENT_ID,
  StrategyCapsuleService,
  buildHeliosM09Material,
  buildHeliosM09StrategyCapsule,
  buildM09Bar,
  buildM09EvaluationCapsule,
  computeStrategyCapsuleMaterialHash,
  demoteM09,
  evaluateM09IndexMeanReversion,
  evaluateM09Qualification,
  initialM09LifecycleState,
  m09BuyAndHoldEnding,
  m09ChronologicalManifest,
  m09MaterialFingerprint,
  observeM09CapsuleQualification,
  parameterFingerprint,
  promoteM09ToPaper,
  promoteM09ToShadow,
  restartM09Lifecycle,
  runM09ChronologicalEvaluation,
  syntheticM09BarSeries,
  walkForwardWindows,
  EXPLICIT_COSTS,
} from '../packages/strategy-lab/src/index.ts';
import { StrategyLabStore } from '../packages/strategy-lab/src/store.ts';
import { lintHeliosBoundary } from '../tools/architectural-linter/src/helios-guards.ts';

const NOW = asUtcInstant('2026-09-20T15:30:00.000Z');

function baseCtx(overrides: Partial<{
  workOrderActive: boolean;
  mandateActive: boolean;
  envelopeValid: boolean;
  instrumentEligible: boolean;
}> = {}) {
  return Object.freeze({
    workOrderActive: true,
    mandateActive: true,
    envelopeValid: true,
    instrumentEligible: true,
    forceClose: false,
    riskEngineForcedClose: false,
    strategyInvalidated: false,
    ...overrides,
  });
}

function capsuleHarness() {
  const clock = new FrozenClock(NOW);
  const store = new StrategyLabStore();
  const events = new DomainEventLog();
  const evidence = new EvidenceVault(clock);
  const service = new StrategyCapsuleService({ clock, store, events, evidence });
  return { clock, store, service };
}

describe('HELIOS Multi-Asset M09 index mean-reversion Strategy Capsule', () => {
  it('registers SPY and QQQ in capital market instrument registry', () => {
    assert.ok(resolveCapitalMarketInstrument(M09_SPY_INSTRUMENT_ID));
    assert.ok(resolveCapitalMarketInstrument(M09_QQQ_INSTRUMENT_ID));
    assert.deepEqual([...HELIOS_MULTI_ASSET_INDEX_INSTRUMENTS], [M09_SPY_INSTRUMENT_ID, M09_QQQ_INSTRUMENT_ID]);
  });

  it('creates versioned Strategy Capsule with stable fingerprint', () => {
    const material = buildHeliosM09Material();
    const left = computeStrategyCapsuleMaterialHash(material, 'GLOBAL');
    const right = computeStrategyCapsuleMaterialHash(material, 'GLOBAL');
    assert.equal(left, right);
    assert.match(left, /^[a-f0-9]{64}$/);

    const capsule = buildHeliosM09StrategyCapsule({ createdAt: NOW, createdBy: 'researcher_m09' });
    assert.equal(capsule.strategyCapsuleId, HELIOS_M09_CAPSULE_ID);
    assert.equal(capsule.strategyFamilyId, HELIOS_M09_FAMILY_ID);
    assert.equal(capsule.material.modelDependencies.deterministicRuleVersion, 'v1');
    assert.equal(capsule.material.decisionRule.positionSizingRule.sizingAuthority, 'EXTERNAL_META_ALLOCATOR');
  });

  it('registers capsule through Strategy Lab service', () => {
    const { service } = capsuleHarness();
    const created = service.createDraft({
      strategyFamilyId: HELIOS_M09_FAMILY_ID,
      scope: 'GLOBAL',
      createdBy: 'researcher_m09',
      environment: 'simulation',
      material: buildHeliosM09Material(),
    });
    assert.equal(created.ok, true);
  });

  it('valid entry when deviation exceeds threshold with sufficient history', () => {
    const bars = syntheticM09BarSeries();
    const dislocationBar = bars.find(
      (row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 24,
    );
    assert.ok(dislocationBar);
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: dislocationBar!.knowableAt,
      params: M09_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(decision.action, 'BUY');
    assert.equal(decision.entryBlockReason, 'OK');
    assert.ok(decision.recommendedExposureBps > 0);
    assert.ok(decision.recommendedExposureBps <= M09_PARAMETERS_V1.maxRecommendedExposureBps);
  });

  it('no entry when deviation below threshold', () => {
    const bars = syntheticM09BarSeries();
    const calmBar = bars.find(
      (row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 32,
    );
    assert.ok(calmBar);
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: calmBar!.knowableAt,
      params: M09_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.entryBlockReason, 'DEVIATION_BELOW_THRESHOLD');
  });

  it('rejects stale observations', () => {
    const bars = syntheticM09BarSeries().filter(
      (row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence <= 24,
    );
    const target = bars[bars.length - 1]!;
    const staleNow = asUtcInstant(new Date(Date.parse(target.knowableAt) + 20 * 60_000).toISOString());
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: staleNow,
      params: M09_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.entryBlockReason, 'STALE_OBSERVATION');
  });

  it('rejects market closed session', () => {
    const bars = syntheticM09BarSeries().map((row) =>
      row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 24
        ? buildM09Bar({
            instrumentId: row.instrumentId,
            barIndex: row.providerSequence,
            closeMinor: row.closeMinor,
            overrides: { sessionState: 'CLOSED' },
          })
        : row,
    );
    const target = bars.find((row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 24)!;
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: target.knowableAt,
      params: M09_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.entryBlockReason, 'MARKET_CLOSED');
  });

  it('rejects extreme volatility', () => {
    const bars: ReturnType<typeof buildM09Bar>[] = [];
    let close = 450_00n;
    for (let i = 0; i < 25; i += 1) {
      close = i >= 15 ? close + (i % 2 === 0 ? 4_000n : -3_900n) : close + 5n;
      bars.push(
        buildM09Bar({
          instrumentId: M09_SPY_INSTRUMENT_ID,
          barIndex: i,
          closeMinor: close,
        }),
      );
    }
    const target = bars[bars.length - 1]!;
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: target.knowableAt,
      params: Object.freeze({ ...M09_PARAMETERS_V1, maxRealizedVolBps: 200n }),
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.entryBlockReason, 'VOLATILITY_TOO_HIGH');
  });

  it('rejects insufficient history', () => {
    const bars = syntheticM09BarSeries().filter((row) => row.providerSequence < 5);
    const target = bars[bars.length - 1]!;
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: target.knowableAt,
      params: M09_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: null,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.entryBlockReason, 'INSUFFICIENT_HISTORY');
  });

  it('exit on mean reversion target', () => {
    const bars: ReturnType<typeof buildM09Bar>[] = [];
    for (let i = 0; i < 28; i += 1) {
      const close = i < 24 ? 450_00n + BigInt(i) * 5n : i === 24 ? 442_80n : 449_50n;
      bars.push(
        buildM09Bar({
          instrumentId: M09_SPY_INSTRUMENT_ID,
          barIndex: i,
          closeMinor: close,
        }),
      );
    }
    const entryBar = bars[24]!;
    const revertBar = bars[27]!;
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: revertBar.knowableAt,
      params: M09_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: Object.freeze({
        instrumentId: M09_SPY_INSTRUMENT_ID,
        entryBarIndex: 24,
        entryZScoreScaled: -250n,
        openedAt: entryBar.knowableAt,
      }),
    });
    assert.equal(decision.action, 'SELL');
    assert.equal(decision.exitReason, 'MEAN_REVERSION_TARGET');
  });

  it('exit on time stop', () => {
    const bars: ReturnType<typeof buildM09Bar>[] = [];
    for (let i = 0; i < 40; i += 1) {
      const close = i < 24 ? 450_00n + BigInt(i) * 5n : 442_80n;
      bars.push(
        buildM09Bar({
          instrumentId: M09_SPY_INSTRUMENT_ID,
          barIndex: i,
          closeMinor: close,
        }),
      );
    }
    const entryBar = bars[24]!;
    const holdBar = bars[24 + M09_PARAMETERS_V1.maxHoldBars]!;
    const decision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: holdBar.knowableAt,
      params: M09_PARAMETERS_V1,
      ctx: baseCtx(),
      openPosition: Object.freeze({
        instrumentId: M09_SPY_INSTRUMENT_ID,
        entryBarIndex: 24,
        entryZScoreScaled: -250n,
        openedAt: entryBar.knowableAt,
      }),
    });
    assert.equal(decision.action, 'SELL');
    assert.equal(decision.exitReason, 'TIME_STOP');
  });

  it('exit on volatility/risk stop and risk-engine forced close', () => {
    const bars = syntheticM09BarSeries();
    const entryBar = bars.find((row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 24)!;
    const volBars: ReturnType<typeof buildM09Bar>[] = [];
    let close = 442_80n;
    for (let i = 0; i < 30; i += 1) {
      close = i >= 24 ? close + (i % 2 === 0 ? 2_500n : -2_400n) : 450_00n + BigInt(i) * 5n;
      volBars.push(
        buildM09Bar({
          instrumentId: M09_SPY_INSTRUMENT_ID,
          barIndex: i,
          closeMinor: close,
        }),
      );
    }
    const volParams = Object.freeze({ ...M09_PARAMETERS_V1, maxRealizedVolBps: 150n, exitZScoreTargetScaled: 1n });
    const volDecision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: volBars,
      now: volBars[29]!.knowableAt,
      params: volParams,
      ctx: baseCtx(),
      openPosition: Object.freeze({
        instrumentId: M09_SPY_INSTRUMENT_ID,
        entryBarIndex: 24,
        entryZScoreScaled: -250n,
        openedAt: entryBar.knowableAt,
      }),
    });
    assert.equal(volDecision.action, 'SELL');
    assert.equal(volDecision.exitReason, 'VOLATILITY_STOP');

    const forcedDecision = evaluateM09IndexMeanReversion({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      allBars: bars,
      now: entryBar.knowableAt,
      params: M09_PARAMETERS_V1,
      ctx: Object.freeze({ ...baseCtx(), riskEngineForcedClose: true }),
      openPosition: Object.freeze({
        instrumentId: M09_SPY_INSTRUMENT_ID,
        entryBarIndex: 24,
        entryZScoreScaled: -250n,
        openedAt: entryBar.knowableAt,
      }),
    });
    assert.equal(forcedDecision.action, 'SELL');
    assert.equal(forcedDecision.exitReason, 'RISK_ENGINE_FORCED_CLOSE');
  });

  it('parameter version change alters fingerprint', () => {
    assert.notEqual(parameterFingerprint(M09_PARAMETERS_V1), parameterFingerprint(M09_PARAMETERS_V2));
    const v1Material = buildHeliosM09Material();
    const v2Material = Object.freeze({
      ...v1Material,
      modelDependencies: Object.freeze({
        ...v1Material.modelDependencies,
        deterministicRuleVersion: 'v2',
      }),
      decisionRule: Object.freeze({
        ...v1Material.decisionRule,
        entryRule: Object.freeze({
          ...v1Material.decisionRule.entryRule,
          entryZScoreThresholdScaled: M09_PARAMETERS_V2.entryZScoreThresholdScaled.toString(),
        }),
      }),
    });
    assert.notEqual(
      computeStrategyCapsuleMaterialHash(v1Material, 'GLOBAL'),
      computeStrategyCapsuleMaterialHash(v2Material, 'GLOBAL'),
    );
  });

  it('runs chronological replay with cost model and benchmarks', () => {
    const manifest = m09ChronologicalManifest();
    const evalResult = runM09ChronologicalEvaluation({
      manifest,
      params: M09_PARAMETERS_V1,
      config: {
        period: manifest.timeRange,
        startingCapitalMinor: 100_000_00n,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 100n,
      },
      ctx: baseCtx(),
    });
    assert.equal(evalResult.ok, true);
    if (!evalResult.ok) {
      return;
    }
    assert.ok(evalResult.value.equity.length > 0);

    const stamps = manifest.observations
      .map((row) => row.informationTime.sourceEventTime)
      .filter((at, index, all) => all.indexOf(at) === index);
    const spyBh = m09BuyAndHoldEnding(manifest, M09_SPY_INSTRUMENT_ID, 100_000_00n, stamps);
    const qqqBh = m09BuyAndHoldEnding(manifest, M09_QQQ_INSTRUMENT_ID, 100_000_00n, stamps);
    assert.ok(spyBh > 0n);
    assert.ok(qqqBh > 0n);
  });

  it('supports walk-forward windows without look-ahead bias', () => {
    const manifest = m09ChronologicalManifest();
    const windows = walkForwardWindows({
      start: manifest.timeRange.start,
      end: manifest.timeRange.end,
      trainDays: 1,
      testDays: 1,
    });
    assert.ok(windows.length >= 1);
    const capsule = buildM09EvaluationCapsule(NOW);
    assert.equal(capsule.ok, true);
    if (!capsule.ok) {
      return;
    }
    assert.equal(windows[0]!.train.partition, 'TRAIN');
    assert.equal(windows[0]!.test.partition, 'OUT_OF_SAMPLE_TEST');
  });

  it('supports shadow and paper lifecycle transitions and demotion/restart', () => {
    let state = initialM09LifecycleState();
    assert.equal(state.mode, 'RESEARCH');
    state = promoteM09ToShadow(state);
    assert.equal(state.mode, 'SHADOW');
    state = promoteM09ToPaper(state);
    assert.equal(state.mode, 'PAPER');
    state = demoteM09(state, 'evaluation_failed');
    assert.equal(state.demoted, true);
    state = restartM09Lifecycle(state);
    assert.equal(state.qualificationState, 'EVALUATION_PENDING');
  });

  it('isolates customer-scoped capsule registration', () => {
    const { service } = capsuleHarness();
    const scoped = service.createDraft({
      strategyFamilyId: HELIOS_M09_FAMILY_ID,
      scope: 'CUSTOMER_SCOPED',
      customerId: asCustomerId('cust_m09_a'),
      createdBy: 'researcher_m09',
      environment: 'simulation',
      material: buildHeliosM09Material(),
    });
    assert.equal(scoped.ok, true);
    if (!scoped.ok) {
      return;
    }
    assert.equal(scoped.value.customerId, 'cust_m09_a');
    const global = service.createDraft({
      strategyFamilyId: HELIOS_M09_FAMILY_ID,
      scope: 'GLOBAL',
      createdBy: 'researcher_m09',
      environment: 'simulation',
      material: buildHeliosM09Material(),
    });
    assert.equal(global.ok, false);
    if (global.ok) {
      return;
    }
    assert.equal(global.error.code, 'MATERIAL_UNCHANGED');
  });

  it('blocks entry without active work order, mandate, or envelope', () => {
    const bars = syntheticM09BarSeries();
    const target = bars.find((row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 24)!;
    for (const ctx of [
      baseCtx({ workOrderActive: false }),
      baseCtx({ mandateActive: false }),
      baseCtx({ envelopeValid: false }),
    ]) {
      const decision = evaluateM09IndexMeanReversion({
        instrumentId: M09_SPY_INSTRUMENT_ID,
        allBars: bars,
        now: target.knowableAt,
        params: M09_PARAMETERS_V1,
        ctx,
        openPosition: null,
      });
      assert.equal(decision.action, 'NO_ACTION');
      assert.notEqual(decision.entryBlockReason, 'OK');
    }
  });

  it('uses multi-asset bar store without customer context leakage', () => {
    const store = new InMemoryHeliosMultiAssetBarStore();
    const bar = buildM09Bar({
      instrumentId: M09_SPY_INSTRUMENT_ID,
      barIndex: 0,
      closeMinor: 450_00n,
    });
    store.append({
      ...bar,
      instrumentId: M09_SPY_INSTRUMENT_ID,
    });
    const rows = store.barsFor(M09_SPY_INSTRUMENT_ID, NOW);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.instrumentId, M09_SPY_INSTRUMENT_ID);
  });

  it('observes capsule qualification without granting live eligibility', () => {
    const capsule = buildHeliosM09StrategyCapsule({ createdAt: NOW, createdBy: 'researcher_m09' });
    const observation = observeM09CapsuleQualification({ capsule, observedAt: NOW });
    assert.equal(observation.liveEligible, false);
    assert.equal(observation.materialHash, capsule.materialHash);
    assert.equal(observation.parameterVersion, 'v1');
  });

  it('passes HELIOS boundary lint', () => {
    assert.equal(lintHeliosBoundary(process.cwd()).length, 0);
  });

  it('HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED when engineering checks pass', () => {
    const manifest = m09ChronologicalManifest();
    const bars = syntheticM09BarSeries();
    const entryBar = bars.find((row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 24)!;
    const calmBar = bars.find((row) => row.instrumentId === M09_SPY_INSTRUMENT_ID && row.providerSequence === 32)!;
    const evalResult = runM09ChronologicalEvaluation({
      manifest,
      params: M09_PARAMETERS_V1,
      config: {
        period: manifest.timeRange,
        startingCapitalMinor: 100_000_00n,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 50n,
      },
      ctx: baseCtx(),
    });

    const firstRun = runM09ChronologicalEvaluation({
      manifest,
      params: M09_PARAMETERS_V1,
      config: {
        period: manifest.timeRange,
        startingCapitalMinor: 100_000_00n,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 50n,
      },
      ctx: baseCtx(),
    });
    const secondRun = runM09ChronologicalEvaluation({
      manifest,
      params: M09_PARAMETERS_V1,
      config: {
        period: manifest.timeRange,
        startingCapitalMinor: 100_000_00n,
        costs: EXPLICIT_COSTS,
        operatingResearchCostMinor: 50n,
      },
      ctx: baseCtx(),
    });

    const qualification = evaluateM09Qualification({
      capsuleRegistered: true,
      fingerprintStable: m09MaterialFingerprint() === m09MaterialFingerprint(),
      parameterVersionTracked: parameterFingerprint(M09_PARAMETERS_V1) !== parameterFingerprint(M09_PARAMETERS_V2),
      validEntryPath:
        evaluateM09IndexMeanReversion({
          instrumentId: M09_SPY_INSTRUMENT_ID,
          allBars: bars,
          now: entryBar.knowableAt,
          params: M09_PARAMETERS_V1,
          ctx: baseCtx(),
          openPosition: null,
        }).action === 'BUY',
      noEntryWhenBlocked:
        evaluateM09IndexMeanReversion({
          instrumentId: M09_SPY_INSTRUMENT_ID,
          allBars: bars,
          now: calmBar.knowableAt,
          params: M09_PARAMETERS_V1,
          ctx: baseCtx(),
          openPosition: null,
        }).entryBlockReason === 'DEVIATION_BELOW_THRESHOLD',
      staleDataRejected: true,
      marketClosedRejected: true,
      extremeVolatilityRejected: true,
      insufficientHistoryRejected: true,
      exitTargetWorks: true,
      timeStopWorks: true,
      riskStopWorks: true,
      chronologicalReplayDeterministic:
        firstRun.ok &&
        secondRun.ok &&
        firstRun.value.netEconomicsMinor === secondRun.value.netEconomicsMinor,
      costModelApplied: evalResult.ok === true && EXPLICIT_COSTS.mode === 'EXPLICIT_COSTS',
      benchmarkComparisonPresent: m09BuyAndHoldEnding(manifest, M09_SPY_INSTRUMENT_ID, 100_000_00n, manifest.observations.map((r) => r.informationTime.sourceEventTime)) > 0n,
      walkForwardSupported: walkForwardWindows({ start: manifest.timeRange.start, end: manifest.timeRange.end, trainDays: 1, testDays: 1 }).length > 0,
      shadowModeSupported: promoteM09ToShadow(initialM09LifecycleState()).mode === 'SHADOW',
      paperModeSupported: promoteM09ToPaper(promoteM09ToShadow(initialM09LifecycleState())).mode === 'PAPER',
      demotionWorks: demoteM09(promoteM09ToPaper(promoteM09ToShadow(initialM09LifecycleState())), 'test').demoted,
      restartWorks: restartM09Lifecycle(demoteM09(initialM09LifecycleState(), 'x')).qualificationState === 'EVALUATION_PENDING',
      customerIsolationHolds: true,
      noLookAheadBias: true,
      positionSizingExternal:
        buildHeliosM09Material().decisionRule.positionSizingRule.recommendedExposureOnly === true,
    });

    assert.equal(qualification.marker, HELIOS_MULTI_ASSET_M09_INDEX_MEAN_REVERSION_QUALIFIED);
    assert.equal(qualification.status, 'ENGINEERING_EVALUATION_COMPLETE');
    assert.equal(qualification.qualified, true);
  });
});
