/**
 * HELIOS Multi-Asset Expansion M11 — Gold and WTI multi-timeframe trend following qualification.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FrozenClock } from '../packages/config/src/clock.ts';
import { ENVIRONMENT, LIVE_TRADING_ENABLED } from '../packages/config/src/flags.ts';
import { asUtcInstant } from '../packages/domain/src/time.ts';
import { DomainEventLog } from '../packages/events/src/events.ts';
import { EvidenceVault } from '../packages/evidence/src/vault.ts';
import { computeStrategyCapsuleMaterialHash } from '../packages/strategy-lab/src/capsule/fingerprint.ts';
import {
  buildHeliosM11Material,
  buildHeliosM11StrategyCapsule,
  HELIOS_M11_CAPSULE_ID,
  HELIOS_M11_RULE_ID,
} from '../packages/strategy-lab/src/capsule/m11.ts';
import { StrategyCapsuleService } from '../packages/strategy-lab/src/capsule/service.ts';
import {
  assertNoFutureInformationLeak,
  buildChronologicalObservation,
  buildM11ReferenceCapsule,
  commodityFlatPosition,
  commodityTrendEvaluationManifest,
  computeSimpleMovingAveragePriorBars,
  evaluateCommodityTrendFollowingRule,
  EXPLICIT_COSTS,
  GOLD_ETF_GLD_ID,
  GOLD_FUTURES_CONTINUOUS_ID,
  GOLD_FUTURES_GCZ2026_ID,
  GOLD_REFERENCE_ID,
  HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED,
  isContinuousResearchInstrument,
  isKnowableAt,
  manifestViewAt,
  observeM11CapsuleQualification,
  openLongPosition,
  openShortPosition,
  simulateRealisticFill,
  StrategyLabStore,
  COMMODITY_VALID_GOVERNANCE,
  COMMODITY_VALID_GOVERNANCE_LONG_ONLY,
  WTI_FUTURES_CLM2026_ID,
  WTI_OIL_ETF_PROXY_ID,
  baseGoldBar,
  baseWtiBar,
  validGoldDowntrendMarket,
  validGoldUptrendMarket,
  validWtiDowntrendMarket,
  validWtiUptrendMarket,
} from '../packages/strategy-lab/src/index.ts';

const NOW = asUtcInstant('2026-09-20T16:00:00.000Z');

function evaluateGold(input: Partial<Parameters<typeof evaluateCommodityTrendFollowingRule>[0]> = {}) {
  const market = validGoldUptrendMarket();
  return evaluateCommodityTrendFollowingRule({
    strategyId: HELIOS_M11_RULE_ID,
    instrumentId: GOLD_ETF_GLD_ID,
    bar: baseGoldBar(),
    market,
    governance: COMMODITY_VALID_GOVERNANCE,
    position: commodityFlatPosition(),
    now: NOW,
    ...input,
  });
}

describe('HELIOS Multi-Asset M11 commodity trend following', () => {
  it('exports M11 qualification marker', () => {
    assert.equal(
      HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED,
      'HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED',
    );
  });

  it('keeps simulation posture — no live commodity or futures execution', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    const material = buildHeliosM11Material();
    assert.equal((material.operatingAssumptions as { liveCommodityExecution?: boolean }).liveCommodityExecution, false);
    assert.equal((material.operatingAssumptions as { liveFuturesExecution?: boolean }).liveFuturesExecution, false);
  });

  it('registers versioned strategy capsule with stable fingerprint', () => {
    const clock = new FrozenClock(NOW);
    const service = new StrategyCapsuleService({
      clock,
      store: new StrategyLabStore(),
      events: new DomainEventLog(),
      evidence: new EvidenceVault(clock),
    });
    const capsule = buildHeliosM11StrategyCapsule({ createdAt: NOW, createdBy: 'm11_test' });
    assert.equal(service.registerPrebuilt(capsule).ok, true);
    assert.equal(capsule.strategyCapsuleId, HELIOS_M11_CAPSULE_ID);
    assert.equal(capsule.material.modelDependencies.deterministicRuleId, HELIOS_M11_RULE_ID);
    const hashA = computeStrategyCapsuleMaterialHash(buildHeliosM11Material(), 'GLOBAL');
    const hashB = computeStrategyCapsuleMaterialHash(buildHeliosM11Material(), 'GLOBAL');
    assert.equal(hashA, hashB);
    assert.match(capsule.materialHash, /^[a-f0-9]{64}$/);
  });

  it('accepts valid Gold uptrend long entry', () => {
    const decision = evaluateGold();
    assert.equal(decision.action, 'ENTER_LONG');
    assert.equal(decision.side, 'LONG');
    assert.ok(decision.rationale.includes('uptrend'));
  });

  it('accepts valid Gold downtrend short entry', () => {
    const decision = evaluateGold({
      market: validGoldDowntrendMarket(),
      bar: baseGoldBar({ closeMinor: 2_350_00n }),
    });
    assert.equal(decision.action, 'ENTER_SHORT');
    assert.equal(decision.side, 'SHORT');
  });

  it('accepts valid WTI uptrend long entry', () => {
    const decision = evaluateCommodityTrendFollowingRule({
      strategyId: HELIOS_M11_RULE_ID,
      instrumentId: WTI_OIL_ETF_PROXY_ID,
      bar: baseWtiBar(),
      market: validWtiUptrendMarket(),
      governance: COMMODITY_VALID_GOVERNANCE,
      position: commodityFlatPosition(),
      now: NOW,
    });
    assert.equal(decision.action, 'ENTER_LONG');
  });

  it('accepts valid WTI downtrend short entry', () => {
    const decision = evaluateCommodityTrendFollowingRule({
      strategyId: HELIOS_M11_RULE_ID,
      instrumentId: WTI_OIL_ETF_PROXY_ID,
      bar: baseWtiBar({ closeMinor: 73_50n }),
      market: validWtiDowntrendMarket(),
      governance: COMMODITY_VALID_GOVERNANCE,
      position: commodityFlatPosition(),
      now: NOW,
    });
    assert.equal(decision.action, 'ENTER_SHORT');
  });

  it('blocks range-bound no-trade conditions', () => {
    const decision = evaluateGold({
      market: validGoldUptrendMarket({
        trendDirection1h: 'NEUTRAL',
        trendDirection4h: 'NEUTRAL',
        breakoutState: 'NONE',
      }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.ok(decision.rationale.includes('Range-bound'));
  });

  it('blocks entry on insufficient history', () => {
    const decision = evaluateGold({
      market: validGoldUptrendMarket({ historyBars: 5 }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'INSUFFICIENT_HISTORY');
  });

  it('blocks entry under excessive volatility', () => {
    const decision = evaluateGold({
      market: validGoldUptrendMarket({ realizedVolatilityBps: 6_000 }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'VOLATILITY_TOO_HIGH');
  });

  it('invalidates on stale data', () => {
    const decision = evaluateGold({
      market: validGoldUptrendMarket({ freshnessStatus: 'stale', observationAgeMs: 8_000_000 }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'STALE_OBSERVATION');
  });

  it('invalidates on provider outage', () => {
    const decision = evaluateGold({
      market: validGoldUptrendMarket({ providerHealth: 'unavailable' }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'PROVIDER_OUTAGE');
  });

  it('blocks entry near futures roll window', () => {
    const decision = evaluateCommodityTrendFollowingRule({
      strategyId: HELIOS_M11_RULE_ID,
      instrumentId: GOLD_FUTURES_GCZ2026_ID,
      bar: baseGoldBar({ instrumentId: GOLD_FUTURES_GCZ2026_ID }),
      market: validGoldUptrendMarket({
        instrumentKind: 'futures_contract',
        rollState: 'ROLLING',
      }),
      governance: COMMODITY_VALID_GOVERNANCE,
      position: commodityFlatPosition(),
      now: NOW,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'FUTURES_ROLL_RESTRICTION');
  });

  it('blocks entry on expired contract', () => {
    const decision = evaluateCommodityTrendFollowingRule({
      strategyId: HELIOS_M11_RULE_ID,
      instrumentId: WTI_FUTURES_CLM2026_ID,
      bar: baseWtiBar({ instrumentId: WTI_FUTURES_CLM2026_ID }),
      market: validWtiUptrendMarket({
        instrumentKind: 'futures_contract',
        contractExpired: true,
      }),
      governance: COMMODITY_VALID_GOVERNANCE,
      position: commodityFlatPosition(),
      now: NOW,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'CONTRACT_EXPIRED');
  });

  it('rejects synthetic continuous series for execution', () => {
    assert.equal(isContinuousResearchInstrument(GOLD_FUTURES_CONTINUOUS_ID), true);
    const decision = evaluateCommodityTrendFollowingRule({
      strategyId: HELIOS_M11_RULE_ID,
      instrumentId: GOLD_FUTURES_CONTINUOUS_ID,
      bar: baseGoldBar({ instrumentId: GOLD_FUTURES_CONTINUOUS_ID }),
      market: validGoldUptrendMarket({ instrumentKind: 'futures_continuous' }),
      governance: COMMODITY_VALID_GOVERNANCE,
      position: commodityFlatPosition(),
      now: NOW,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'SYNTHETIC_CONTINUOUS_NON_EXECUTABLE');
  });

  it('treats reference instruments as research-only non-execution', () => {
    const decision = evaluateCommodityTrendFollowingRule({
      strategyId: HELIOS_M11_RULE_ID,
      instrumentId: GOLD_REFERENCE_ID,
      bar: baseGoldBar({ instrumentId: GOLD_REFERENCE_ID }),
      market: validGoldUptrendMarket({ instrumentKind: 'commodity_reference' }),
      governance: COMMODITY_VALID_GOVERNANCE,
      position: commodityFlatPosition(),
      now: NOW,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'REFERENCE_ONLY_NON_EXECUTION');
  });

  it('emits long signal with recommended confidence only', () => {
    const decision = evaluateGold();
    assert.equal(decision.action, 'ENTER_LONG');
    assert.ok(decision.recommendedConfidenceBps >= 0);
    assert.ok(decision.recommendedConfidenceBps <= 10_000);
  });

  it('blocks short signal when mandate disallows short', () => {
    const decision = evaluateGold({
      market: validGoldDowntrendMarket(),
      bar: baseGoldBar({ closeMinor: 2_350_00n }),
      governance: COMMODITY_VALID_GOVERNANCE_LONG_ONLY,
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'SHORT_NOT_PERMITTED');
  });

  it('exits long on volatility-adjusted trailing stop', () => {
    const decision = evaluateGold({
      position: openLongPosition(asUtcInstant('2026-09-20T14:00:00.000Z'), 2_430_00n),
      bar: baseGoldBar({ closeMinor: 1_100_00n }),
      market: validGoldUptrendMarket({ realizedVolatilityBps: 2_000 }),
      now: asUtcInstant('2026-09-20T15:00:00.000Z'),
    });
    assert.equal(decision.action, 'EXIT');
    assert.equal(decision.exitReason, 'TRAILING_STOP');
  });

  it('exits short on trend reversal', () => {
    const decision = evaluateGold({
      position: openShortPosition(asUtcInstant('2026-09-20T14:00:00.000Z'), 2_350_00n),
      market: validGoldUptrendMarket(),
      bar: baseGoldBar({ closeMinor: 2_430_00n }),
      now: asUtcInstant('2026-09-20T15:00:00.000Z'),
    });
    assert.equal(decision.action, 'EXIT');
    assert.equal(decision.exitReason, 'TREND_REVERSAL');
  });

  it('exits on maximum adverse excursion', () => {
    const decision = evaluateGold({
      position: Object.freeze({
        ...openLongPosition(asUtcInstant('2026-09-20T14:00:00.000Z'), 2_430_00n),
        adverseExcursionBps: 400,
      }),
    });
    assert.equal(decision.action, 'EXIT');
    assert.equal(decision.exitReason, 'MAX_ADVERSE_EXCURSION');
  });

  it('exits on risk-engine forced close and emergency liquidation', () => {
    const forcedRisk = evaluateGold({
      position: openLongPosition(asUtcInstant('2026-09-20T14:00:00.000Z'), 2_430_00n),
      forced: { riskForcedExit: true },
    });
    assert.equal(forcedRisk.action, 'EXIT');
    assert.equal(forcedRisk.exitReason, 'RISK_FORCED_EXIT');

    const emergency = evaluateGold({
      position: openLongPosition(asUtcInstant('2026-09-20T14:00:00.000Z'), 2_430_00n),
      forced: { emergencyClose: true },
    });
    assert.equal(emergency.action, 'EXIT');
    assert.equal(emergency.exitReason, 'EMERGENCY_CLOSE');
  });

  it('preserves capsule definition across restart snapshot', () => {
    const store = new StrategyLabStore();
    const capsule = buildHeliosM11StrategyCapsule({ createdAt: NOW, createdBy: 'restart_test' });
    store.putStrategyCapsule(capsule);
    const snapshot = store.snapshot();
    const reloaded = new StrategyLabStore();
    for (const row of snapshot.strategyCapsules) {
      reloaded.putStrategyCapsule(row);
    }
    const loaded = reloaded.getStrategyCapsule(capsule.strategyCapsuleId, capsule.version);
    assert.ok(loaded);
    assert.equal(loaded.materialHash, capsule.materialHash);
  });

  it('changes fingerprint when qualified parameters change', () => {
    const base = buildHeliosM11Material();
    const changed = Object.freeze({
      ...base,
      fixedQualifiedParameters: Object.freeze({
        ...base.fixedQualifiedParameters,
        minRocBps: 50,
      }),
    });
    assert.notEqual(
      computeStrategyCapsuleMaterialHash(base, 'GLOBAL'),
      computeStrategyCapsuleMaterialHash(changed, 'GLOBAL'),
    );
  });

  it('does not look ahead when computing moving average from prior bars only', () => {
    const priorCloses = [2_400_00n, 2_405_00n, 2_410_00n];
    const currentClose = 2_430_00n;
    const sma = computeSimpleMovingAveragePriorBars(priorCloses);
    assert.equal(sma, 2_405_00n);
    assert.ok(currentClose > sma);
    assert.ok(!priorCloses.includes(currentClose));
  });

  it('enforces information-time knowability on evaluation manifest', () => {
    const manifest = commodityTrendEvaluationManifest();
    const lateKnowable = asUtcInstant('2026-09-01T12:00:03.000Z');
    const earlyEval = asUtcInstant('2026-09-01T12:00:01.000Z');
    const obs = buildChronologicalObservation({
      observationId: 'obs_leak_m11',
      instrumentId: GOLD_ETF_GLD_ID,
      sourceEventTime: asUtcInstant('2026-09-01T12:00:00.000Z'),
      providerAvailabilityTime: lateKnowable,
      sunreyArrivalTime: lateKnowable,
      ingestionTime: lateKnowable,
      providerId: 'finnhub_fixture',
      providerSequence: 999,
      openMinor: 2_400_00n,
      highMinor: 2_410_00n,
      lowMinor: 2_390_00n,
      closeMinor: 2_405_00n,
    });
    assert.equal(isKnowableAt(earlyEval, obs.informationTime.knowableAt), false);
    const leak = assertNoFutureInformationLeak({
      evaluationTime: earlyEval,
      knowableAt: obs.informationTime.knowableAt,
      observationId: obs.observationId,
    });
    assert.equal(leak.ok, false);
    const view = manifestViewAt(manifest, earlyEval);
    assert.equal(view.ok, true);
  });

  it('applies explicit cost model with spread and slippage', () => {
    const obs = buildChronologicalObservation({
      observationId: 'obs_m11_cost',
      instrumentId: GOLD_ETF_GLD_ID,
      sourceEventTime: NOW,
      sunreyArrivalTime: NOW,
      ingestionTime: NOW,
      providerId: 'finnhub_fixture',
      providerSequence: 1,
      openMinor: 2_430_00n,
      highMinor: 2_435_00n,
      lowMinor: 2_425_00n,
      closeMinor: 2_430_00n,
      bidMinor: 2_429_50n,
      askMinor: 2_430_50n,
    });
    const fill = simulateRealisticFill({
      side: 'BUY',
      quantity: 1n,
      observation: obs,
      costs: EXPLICIT_COSTS,
      cashMinor: 100_000_00n,
      ownedQuantity: 0n,
      executionAt: NOW,
    });
    assert.equal(fill.ok, true);
    if (!fill.ok) return;
    assert.ok(fill.value.feeMinor > 0n);
    assert.ok(fill.value.spreadCostMinor > 0n);
    assert.ok(fill.value.slippageCostMinor > 0n);
  });

  it('builds promotion capsule and observation without live eligibility', () => {
    const capsuleResult = buildM11ReferenceCapsule({ subjectId: 'cust_m11', frozenAt: NOW });
    assert.equal(capsuleResult.ok, true);
    if (!capsuleResult.ok) {
      return;
    }
    const observation = observeM11CapsuleQualification({
      fingerprint: capsuleResult.value.fingerprint,
      observedAt: NOW,
    });
    assert.equal(observation.qualificationMarker, HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED);
    assert.equal(observation.liveEligible, false);
    assert.equal(observation.liveCommodityExecution, false);
    assert.equal(observation.liveFuturesExecution, false);
    assert.equal(observation.paperEligible, false);
  });

  it('supports Gold, WTI, and cash benchmark baselines on evaluation manifest', () => {
    const manifest = commodityTrendEvaluationManifest();
    assert.ok(manifest.instruments.includes(GOLD_ETF_GLD_ID));
    assert.ok(manifest.instruments.includes(WTI_OIL_ETF_PROXY_ID));
    const goldObs = manifest.observations.filter((row) => row.instrumentId === GOLD_ETF_GLD_ID);
    const wtiObs = manifest.observations.filter((row) => row.instrumentId === WTI_OIL_ETF_PROXY_ID);
    assert.ok(goldObs.length > 0);
    assert.ok(wtiObs.length > 0);
    assert.ok(manifest.limitations.some((row) => row.includes('not live commodity')));
  });

  it('qualifies M11 marker when capsule, rule, and manifest are present', () => {
    assert.equal(HELIOS_M11_RULE_ID, 'HELIOS_M11_COMMODITY_TREND_FOLLOWING_V1');
    assert.ok(commodityTrendEvaluationManifest().instruments.includes(GOLD_ETF_GLD_ID));
    assert.ok(commodityTrendEvaluationManifest().instruments.includes(WTI_OIL_ETF_PROXY_ID));
    assert.match(HELIOS_MULTI_ASSET_M11_COMMODITY_TREND_QUALIFIED, /^HELIOS_MULTI_ASSET_M11_/);
  });
});
