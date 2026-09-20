/**
 * HELIOS Multi-Asset Expansion M10 — crypto volume-confirmed momentum breakout qualification.
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
  buildHeliosM10Material,
  buildHeliosM10StrategyCapsule,
  HELIOS_M10_CAPSULE_ID,
  HELIOS_M10_RULE_ID,
} from '../packages/strategy-lab/src/capsule/m10.ts';
import { StrategyCapsuleService } from '../packages/strategy-lab/src/capsule/service.ts';
import {
  assertNoFutureInformationLeak,
  buildChronologicalObservation,
  buildM10ReferenceCapsule,
  computeRollingRangeHighPriorBars,
  cryptoMomentumEvaluationManifest,
  CRYPTO_BTC_USD_ASSET_ID,
  CRYPTO_ETH_USD_ASSET_ID,
  evaluateCryptoMomentumBreakoutRule,
  EXPLICIT_COSTS,
  flatPosition,
  HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED,
  HELIOS_MULTI_ASSET_M09_STRATEGY_LAB_FOUNDATION,
  isKnowableAt,
  manifestViewAt,
  observeM10CapsuleQualification,
  openPosition,
  simulateRealisticFill,
  StrategyLabStore,
  validBreakoutControls,
  validBtcBreakoutMarket,
  validEthBreakoutMarket,
  VALID_GOVERNANCE,
  baseBtcBar,
  baseEthBar,
} from '../packages/strategy-lab/src/index.ts';

const NOW = asUtcInstant('2026-09-20T16:00:00.000Z');

function evaluateBtc(input: Partial<Parameters<typeof evaluateCryptoMomentumBreakoutRule>[0]> = {}) {
  const market = validBtcBreakoutMarket();
  return evaluateCryptoMomentumBreakoutRule({
    strategyId: HELIOS_M10_RULE_ID,
    instrumentId: CRYPTO_BTC_USD_ASSET_ID,
    bar: baseBtcBar(),
    market,
    governance: VALID_GOVERNANCE,
    position: flatPosition(),
    controls: validBreakoutControls(market.rollingRangeHighMinor),
    now: NOW,
    ...input,
  });
}

describe('HELIOS Multi-Asset M10 crypto momentum breakout', () => {
  it('exports M09 foundation and M10 qualification markers', () => {
    assert.equal(HELIOS_MULTI_ASSET_M09_STRATEGY_LAB_FOUNDATION, 'HELIOS_MULTI_ASSET_M09_STRATEGY_LAB_FOUNDATION');
    assert.equal(
      HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED,
      'HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED',
    );
  });

  it('keeps simulation posture — no live crypto execution', () => {
    assert.equal(ENVIRONMENT, 'simulation');
    assert.equal(LIVE_TRADING_ENABLED, false);
    const material = buildHeliosM10Material();
    assert.equal((material.operatingAssumptions as { liveCryptoExecution?: boolean }).liveCryptoExecution, false);
  });

  it('registers versioned strategy capsule with stable fingerprint', () => {
    const clock = new FrozenClock(NOW);
    const service = new StrategyCapsuleService({
      clock,
      store: new StrategyLabStore(),
      events: new DomainEventLog(),
      evidence: new EvidenceVault(clock),
    });
    const capsule = buildHeliosM10StrategyCapsule({ createdAt: NOW, createdBy: 'm10_test' });
    assert.equal(service.registerPrebuilt(capsule).ok, true);
    assert.equal(capsule.strategyCapsuleId, HELIOS_M10_CAPSULE_ID);
    assert.equal(capsule.material.modelDependencies.deterministicRuleId, HELIOS_M10_RULE_ID);
    const hashA = computeStrategyCapsuleMaterialHash(buildHeliosM10Material(), 'GLOBAL');
    const hashB = computeStrategyCapsuleMaterialHash(buildHeliosM10Material(), 'GLOBAL');
    assert.equal(hashA, hashB);
    assert.match(capsule.materialHash, /^[a-f0-9]{64}$/);
  });

  it('accepts valid BTC breakout with volume confirmation', () => {
    const decision = evaluateBtc();
    assert.equal(decision.action, 'BUY');
    assert.equal(decision.instrumentId, CRYPTO_BTC_USD_ASSET_ID);
    assert.ok(decision.rationale.includes('Volume-confirmed breakout'));
  });

  it('accepts valid ETH breakout with volume confirmation', () => {
    const market = validEthBreakoutMarket();
    const decision = evaluateCryptoMomentumBreakoutRule({
      strategyId: HELIOS_M10_RULE_ID,
      instrumentId: CRYPTO_ETH_USD_ASSET_ID,
      bar: baseEthBar(),
      market,
      governance: VALID_GOVERNANCE,
      position: flatPosition(),
      controls: validBreakoutControls(market.rollingRangeHighMinor),
      now: NOW,
    });
    assert.equal(decision.action, 'BUY');
  });

  it('rejects breakout without volume confirmation', () => {
    const decision = evaluateBtc({
      market: validBtcBreakoutMarket({ relativeVolumeRatio: 0.8 }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.ok(decision.rationale.includes('without volume confirmation'));
  });

  it('invalidates on stale data', () => {
    const decision = evaluateBtc({
      market: validBtcBreakoutMarket({ freshnessStatus: 'stale', observationAgeMs: 7_200_000 }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'STALE_OBSERVATION');
  });

  it('invalidates on provider outage', () => {
    const decision = evaluateBtc({
      market: validBtcBreakoutMarket({ providerHealth: 'unavailable' }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'PROVIDER_OUTAGE');
  });

  it('blocks false breakout when close does not exceed minimum beyond threshold', () => {
    const market = validBtcBreakoutMarket();
    const decision = evaluateBtc({
      bar: baseBtcBar({ closeMinor: 65_010_00n }),
      controls: validBreakoutControls(market.rollingRangeHighMinor, {
        minimumCloseBeyondBreakoutMinor: 65_500_00n,
      }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.ok(decision.rationale.includes('False breakout'));
  });

  it('blocks entry under excessive volatility', () => {
    const decision = evaluateBtc({
      market: validBtcBreakoutMarket({ realizedVolatilityBps: 8_000 }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'VOLATILITY_TOO_HIGH');
  });

  it('blocks entry when spread is too wide', () => {
    const decision = evaluateBtc({
      market: validBtcBreakoutMarket({ spreadBps: 120 }),
    });
    assert.equal(decision.action, 'NO_ACTION');
    assert.equal(decision.invalidationReason, 'SPREAD_TOO_WIDE');
  });

  it('exits on volatility-adjusted trailing stop', () => {
    const entryAt = asUtcInstant('2026-09-20T14:00:00.000Z');
    const decision = evaluateBtc({
      position: openPosition(entryAt, 65_400_00n),
      bar: baseBtcBar({ closeMinor: 3_900_00n }),
      market: validBtcBreakoutMarket({
        realizedVolatilityBps: 2_000,
      }),
      now: asUtcInstant('2026-09-20T15:00:00.000Z'),
    });
    assert.equal(decision.action, 'SELL');
    assert.equal(decision.exitReason, 'TRAILING_STOP');
  });

  it('exits on momentum failure', () => {
    const entryAt = asUtcInstant('2026-09-20T14:00:00.000Z');
    const decision = evaluateBtc({
      position: openPosition(entryAt, 65_400_00n),
      bar: baseBtcBar({ closeMinor: 64_900_00n }),
      market: validBtcBreakoutMarket({ rollingRangeHighMinor: 65_000_00n }),
      now: asUtcInstant('2026-09-20T15:00:00.000Z'),
    });
    assert.equal(decision.action, 'SELL');
    assert.equal(decision.exitReason, 'MOMENTUM_FAILURE');
  });

  it('exits on maximum holding period timeout', () => {
    const decision = evaluateBtc({
      position: openPosition(asUtcInstant('2026-08-28T10:00:00.000Z'), 65_400_00n),
      now: asUtcInstant('2026-09-01T12:00:00.000Z'),
    });
    assert.equal(decision.action, 'SELL');
    assert.equal(decision.exitReason, 'MAX_HOLDING_PERIOD');
  });

  it('exits on risk-engine forced exit and emergency close', () => {
    const forcedRisk = evaluateBtc({
      position: openPosition(ENTRY_AT, 65_400_00n),
      forced: { riskForcedExit: true },
    });
    assert.equal(forcedRisk.action, 'SELL');
    assert.equal(forcedRisk.exitReason, 'RISK_FORCED_EXIT');

    const emergency = evaluateBtc({
      position: openPosition(ENTRY_AT, 65_400_00n),
      forced: { emergencyClose: true },
    });
    assert.equal(emergency.action, 'SELL');
    assert.equal(emergency.exitReason, 'EMERGENCY_CLOSE');
  });

  it('preserves capsule definition across restart snapshot', () => {
    const store = new StrategyLabStore();
    const capsule = buildHeliosM10StrategyCapsule({ createdAt: NOW, createdBy: 'restart_test' });
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
    const base = buildHeliosM10Material();
    const changed = Object.freeze({
      ...base,
      fixedQualifiedParameters: Object.freeze({
        ...base.fixedQualifiedParameters,
        volumeRatioThreshold: 2.0,
      }),
    });
    assert.notEqual(
      computeStrategyCapsuleMaterialHash(base, 'GLOBAL'),
      computeStrategyCapsuleMaterialHash(changed, 'GLOBAL'),
    );
  });

  it('does not look ahead when computing rolling range from prior bars only', () => {
    const priorCloses = [64_000_00n, 64_200_00n, 64_500_00n];
    const currentClose = 66_000_00n;
    const rollingHigh = computeRollingRangeHighPriorBars(priorCloses);
    assert.equal(rollingHigh, 64_500_00n);
    assert.ok(currentClose > rollingHigh);
    assert.ok(!priorCloses.includes(currentClose));
  });

  it('enforces information-time knowability on evaluation manifest', () => {
    const manifest = cryptoMomentumEvaluationManifest();
    const lateKnowable = asUtcInstant('2026-09-01T12:00:03.000Z');
    const earlyEval = asUtcInstant('2026-09-01T12:00:01.000Z');
    const obs = buildChronologicalObservation({
      observationId: 'obs_leak_m10',
      instrumentId: CRYPTO_BTC_USD_ASSET_ID,
      sourceEventTime: asUtcInstant('2026-09-01T12:00:00.000Z'),
      providerAvailabilityTime: lateKnowable,
      sunreyArrivalTime: lateKnowable,
      ingestionTime: lateKnowable,
      providerId: 'coingecko_fixture',
      providerSequence: 999,
      openMinor: 65_000_00n,
      highMinor: 65_100_00n,
      lowMinor: 64_900_00n,
      closeMinor: 65_050_00n,
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
      observationId: 'obs_m10_cost',
      instrumentId: CRYPTO_BTC_USD_ASSET_ID,
      sourceEventTime: NOW,
      sunreyArrivalTime: NOW,
      ingestionTime: NOW,
      providerId: 'coingecko_fixture',
      providerSequence: 1,
      openMinor: 65_000_00n,
      highMinor: 65_200_00n,
      lowMinor: 64_800_00n,
      closeMinor: 65_000_00n,
      bidMinor: 64_990_00n,
      askMinor: 65_010_00n,
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

  it('isolates customer-scoped capsule from global registration', () => {
    const clock = new FrozenClock(NOW);
    const service = new StrategyCapsuleService({
      clock,
      store: new StrategyLabStore(),
      events: new DomainEventLog(),
      evidence: new EvidenceVault(clock),
    });
    const leaked = service.createDraft({
      strategyFamilyId: buildHeliosM10StrategyCapsule({ createdAt: NOW, createdBy: 'x' }).strategyFamilyId,
      scope: 'GLOBAL',
      customerId: 'cust_private_m10',
      createdBy: 'researcher',
      environment: 'simulation',
      material: buildHeliosM10Material(),
    });
    assert.equal(leaked.ok, false);
  });

  it('builds promotion capsule and observation without live eligibility', () => {
    const capsule = buildM10ReferenceCapsule({ subjectId: 'cust_m10', frozenAt: NOW });
    const observation = observeM10CapsuleQualification({
      fingerprint: capsule.fingerprint,
      observedAt: NOW,
    });
    assert.equal(observation.qualificationMarker, HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED);
    assert.equal(observation.liveEligible, false);
    assert.equal(observation.liveCryptoExecution, false);
    assert.equal(observation.paperEligible, false);
  });

  it('supports BTC, ETH, and cash benchmark baselines on evaluation manifest', () => {
    const manifest = cryptoMomentumEvaluationManifest();
    assert.ok(manifest.instruments.includes(CRYPTO_BTC_USD_ASSET_ID));
    assert.ok(manifest.instruments.includes(CRYPTO_ETH_USD_ASSET_ID));
    const btcObs = manifest.observations.filter((row) => row.instrumentId === CRYPTO_BTC_USD_ASSET_ID);
    const ethObs = manifest.observations.filter((row) => row.instrumentId === CRYPTO_ETH_USD_ASSET_ID);
    assert.ok(btcObs.length > 0);
    assert.ok(ethObs.length > 0);
    assert.ok(manifest.limitations.some((row) => row.includes('not live crypto execution')));
  });

  it('qualifies M10 marker when capsule, rule, and manifest are present', () => {
    assert.equal(HELIOS_M10_RULE_ID, 'HELIOS_M10_CRYPTO_MOMENTUM_BREAKOUT_V1');
    assert.ok(cryptoMomentumEvaluationManifest().instruments.includes(CRYPTO_BTC_USD_ASSET_ID));
    assert.ok(cryptoMomentumEvaluationManifest().instruments.includes(CRYPTO_ETH_USD_ASSET_ID));
    const qualified = HELIOS_MULTI_ASSET_M10_CRYPTO_MOMENTUM_BREAKOUT_QUALIFIED;
    assert.match(qualified, /^HELIOS_MULTI_ASSET_M10_/);
  });
});
