import {
  ALPHA12_CAPITAL_SCALE_MULTIPLIERS,
  ALPHA12_CAPACITY_ENGINE_SCHEMA,
  HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED,
} from './taxonomy.ts';
import {
  allScaleMultipliersPresent,
  classifyCapacity,
  estimateBreakEvenCapital,
  estimateCapacityCeiling,
} from './break-even.ts';
import {
  bpsFromMinor,
  bpsOnNotional,
  estimateImpactBps,
  signalRetentionFactor,
} from './impact-model.ts';
import {
  buildLiquidityCapacityEnvelope,
  effectiveParticipationRate,
  liquidityPermitsScale,
} from './liquidity.ts';
import type {
  Alpha12CapacityEngineInput,
  Alpha12CapacityEngineResult,
  CapitalScaleScenario,
  ImpactAdjustedAlpha,
  StrategyCapacityCurve,
} from './types.ts';

function parseMinor(value: string): bigint {
  return BigInt(value);
}

function weightedSpreadBps(legs: Alpha12CapacityEngineInput['legs']): number {
  if (legs.length === 0) {
    return 0;
  }
  let weighted = 0;
  let total = 0;
  for (const leg of legs) {
    weighted += leg.spreadBps * leg.weightBps;
    total += leg.weightBps;
  }
  return total > 0 ? weighted / total : 0;
}

function buildScenario(
  input: Alpha12CapacityEngineInput,
  scale: (typeof ALPHA12_CAPITAL_SCALE_MULTIPLIERS)[number],
  liquidity: ReturnType<typeof buildLiquidityCapacityEnvelope>,
): CapitalScaleScenario {
  const shadow = parseMinor(input.campaignShadowCapitalMinor);
  const deployed = shadow * BigInt(scale);
  const permitted = liquidityPermitsScale(deployed, liquidity);
  const participation = effectiveParticipationRate(deployed, input.legs);
  const participationBps = Math.round(participation * 10_000);

  if (!permitted) {
    return Object.freeze({
      scaleMultiplier: scale,
      liquidityPermitted: false,
      deployedCapitalMinor: deployed.toString(),
      effectiveParticipationRateBps: participationBps,
      grossAlphaMinor: '0',
      grossAlphaBps: 0,
      estimatedTradingCostMinor: '0',
      estimatedTradingCostBps: 0,
      estimatedImpactMinor: '0',
      estimatedImpactBps: 0,
      netAlphaMinor: '0',
      netAlphaBps: 0,
      signalRetentionFactor: 0,
      notes: Object.freeze(['scale_exceeds_liquidity_envelope']),
    });
  }

  const retention = signalRetentionFactor(participation, input.annualTurnoverRatio);
  const grossAlphaBps = input.baselineGrossAlphaBps * retention;
  const grossAlphaMinor = bpsOnNotional(deployed, grossAlphaBps);

  const spreadBps = weightedSpreadBps(input.legs);
  const roundTrips = Math.max(0, input.annualTurnoverRatio);
  const tradingCostBps = roundTrips * (spreadBps + 2 * input.commissionBpsPerSide);
  const tradingCostMinor = bpsOnNotional(deployed, tradingCostBps);

  const impactBps = estimateImpactBps(participation, input.impactModel) * roundTrips;
  const impactMinor = bpsOnNotional(deployed, impactBps);

  const netAlphaMinor = grossAlphaMinor - tradingCostMinor - impactMinor;
  const netAlphaBps = bpsFromMinor(netAlphaMinor, deployed);

  const notes: string[] = [];
  if (retention < 0.35) {
    notes.push('signal_decay_material');
  }
  if (impactBps > grossAlphaBps * 0.5) {
    notes.push('impact_dominates_edge');
  }
  if (participationBps > 500) {
    notes.push('participation_elevated');
  }

  return Object.freeze({
    scaleMultiplier: scale,
    liquidityPermitted: true,
    deployedCapitalMinor: deployed.toString(),
    effectiveParticipationRateBps: participationBps,
    grossAlphaMinor: grossAlphaMinor.toString(),
    grossAlphaBps,
    estimatedTradingCostMinor: tradingCostMinor.toString(),
    estimatedTradingCostBps: tradingCostBps,
    estimatedImpactMinor: impactMinor.toString(),
    estimatedImpactBps: impactBps,
    netAlphaMinor: netAlphaMinor.toString(),
    netAlphaBps,
    signalRetentionFactor: Math.round(retention * 10_000) / 10_000,
    notes: Object.freeze(notes),
  });
}

function toImpactAdjusted(row: CapitalScaleScenario): ImpactAdjustedAlpha {
  return Object.freeze({
    scaleMultiplier: row.scaleMultiplier,
    grossAlphaBps: row.grossAlphaBps,
    grossAlphaMinor: row.grossAlphaMinor,
    impactBps: row.estimatedImpactBps,
    impactMinor: row.estimatedImpactMinor,
    tradingCostBps: row.estimatedTradingCostBps,
    tradingCostMinor: row.estimatedTradingCostMinor,
    netAlphaBps: row.netAlphaBps,
    netAlphaMinor: row.netAlphaMinor,
  });
}

export function buildStrategyCapacityCurve(input: Alpha12CapacityEngineInput): StrategyCapacityCurve {
  const liquidity = buildLiquidityCapacityEnvelope(input.legs, input.executionDurationHours);
  const scenarios = ALPHA12_CAPITAL_SCALE_MULTIPLIERS.map((scale) => buildScenario(input, scale, liquidity));
  const shadow = parseMinor(input.campaignShadowCapitalMinor);
  const breakEven = estimateBreakEvenCapital(shadow, scenarios);
  const ceiling = estimateCapacityCeiling(scenarios);
  const classification = classifyCapacity(shadow, scenarios);

  return Object.freeze({
    strategyId: input.strategyId,
    shadowCapitalMinor: input.campaignShadowCapitalMinor,
    currency: input.currency,
    scenarios: Object.freeze(scenarios),
    impactAdjusted: Object.freeze(scenarios.map(toImpactAdjusted)),
    liquidity,
    breakEven,
    ceiling,
    classification,
    nonLinearReturnsEnforced: true,
  });
}

export function runAlpha12CapacityEngine(input: Alpha12CapacityEngineInput): Alpha12CapacityEngineResult {
  const curve = buildStrategyCapacityCurve(input);
  void allScaleMultipliersPresent(curve.scenarios);

  return Object.freeze({
    schema: ALPHA12_CAPACITY_ENGINE_SCHEMA,
    strategyId: input.strategyId,
    grantsExecutionAuthority: false,
    researchOnly: true,
    curve,
    scaleMultipliersRequested: ALPHA12_CAPITAL_SCALE_MULTIPLIERS,
    qualificationMarker: HELIOS_ALPHA12_CAPACITY_ENGINE_QUALIFIED,
  });
}
