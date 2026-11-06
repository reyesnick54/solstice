import type { UtcInstant } from '@solstice/domain';

import {
  HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED,
  HELIOS_COUNTERFACTUAL_LEARNING_CF10_SCHEMA,
  HELIOS_CF10_POLICY_PROTECTIVE_GATE_FAMILIES,
  type HeliosCf10GateFamily,
  type HeliosCf10RejectionClassification,
} from './taxonomy.ts';
import type {
  HeliosCf10DecisionAttributionReport,
  HeliosCf10DecisionGateAttribution,
  HeliosCf10EstimatedDecisionRegret,
  HeliosCf10GateCalibrationState,
  HeliosCf10GateDecisionObservation,
  HeliosCf10OpportunityCostEstimate,
  HeliosCf10PerObservationAttribution,
  HeliosCf10RejectionReasonPerformance,
} from './types.ts';

function parseMinor(value: string): bigint {
  const t = value.trim();
  if (t === '' || !/^-?\d+$/.test(t)) {
    throw new Error(`HELIOS CF10: minor amount must be an integer decimal string, got '${value}'`);
  }
  return BigInt(t);
}

function formatMinor(value: bigint): string {
  return value.toString();
}

function maxBigint(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function weightMicro(observation: HeliosCf10GateDecisionObservation): bigint {
  const raw = observation.estimateSupport > 0 ? observation.estimateSupport : 1;
  return BigInt(Math.max(1, Math.round(raw * 1_000_000)));
}

function classifyRejection(input: {
  readonly gateFamily: HeliosCf10GateFamily;
  readonly rejected: boolean;
  readonly riskAdjustedRegretMinor: bigint;
  readonly observedDownsideStress: boolean;
  readonly observedLiquidityStress: boolean;
}): HeliosCf10RejectionClassification {
  if (!input.rejected) {
    return 'INCONCLUSIVE';
  }

  const protectiveFamily = (HELIOS_CF10_POLICY_PROTECTIVE_GATE_FAMILIES as readonly string[]).includes(
    input.gateFamily,
  );
  const stress = input.observedDownsideStress || input.observedLiquidityStress;

  if (protectiveFamily) {
    /** Do not label Risk / Compliance / mandate rejects as “costly” from price path alone. */
    if (stress && input.riskAdjustedRegretMinor > 0n) {
      return 'MIXED';
    }
    if (input.riskAdjustedRegretMinor > 0n && !stress) {
      return 'REJECTION_APPEARS_PROTECTIVE';
    }
    return 'REJECTION_APPEARS_PROTECTIVE';
  }

  if (input.riskAdjustedRegretMinor > 0n && stress) {
    return 'MIXED';
  }
  if (input.riskAdjustedRegretMinor > 0n) {
    return 'REJECTION_APPEARS_COSTLY';
  }
  return 'REJECTION_APPEARS_PROTECTIVE';
}

function opportunityCostFor(observation: HeliosCf10GateDecisionObservation): HeliosCf10OpportunityCostEstimate {
  const path = parseMinor(observation.futureMarketPathResultMinor);
  const counterfactual = parseMinor(observation.executionCounterfactualEstimateMinor);
  const net = counterfactual - path;
  return {
    foregoneBestPathMinor: formatMinor(path),
    counterfactualExecutionMinor: formatMinor(counterfactual),
    netOpportunityCostMinor: formatMinor(net),
    semantics: 'ESTIMATED',
  };
}

function decisionRegretFor(observation: HeliosCf10GateDecisionObservation): HeliosCf10EstimatedDecisionRegret {
  const path = parseMinor(observation.futureMarketPathResultMinor);
  const counterfactual = parseMinor(observation.executionCounterfactualEstimateMinor);
  const raw = maxBigint(0n, counterfactual - path);
  const riskAdj = parseMinor(observation.riskAdjustmentMinor ?? '0');
  const riskAdjusted = maxBigint(0n, raw - riskAdj);
  return {
    rawRegretMinor: formatMinor(raw),
    riskAdjustedRegretMinor: formatMinor(riskAdjusted),
    semantics: 'ESTIMATED',
  };
}

function perObservation(
  observation: HeliosCf10GateDecisionObservation,
): HeliosCf10PerObservationAttribution {
  const regret = decisionRegretFor(observation);
  const riskAdj = parseMinor(regret.riskAdjustedRegretMinor);
  const notes: string[] = [
    'ESTIMATED: counterfactual outcomes do not authorize loosening Risk, Compliance, or mandate gates.',
  ];

  const rejectionInterpretation = classifyRejection({
    gateFamily: observation.gateFamily,
    rejected: observation.rejected,
    riskAdjustedRegretMinor: riskAdj,
    observedDownsideStress: observation.observedDownsideStress ?? false,
    observedLiquidityStress: observation.observedLiquidityStress ?? false,
  });

  return {
    observationId: observation.observationId,
    gateFamily: observation.gateFamily,
    reasonCode: observation.reasonCode,
    opportunityCost: opportunityCostFor(observation),
    decisionRegret: regret,
    rejectionInterpretation,
    notes,
    semantics: 'ESTIMATED',
  };
}

type ReasonAgg = {
  readonly gateFamily: HeliosCf10GateFamily;
  readonly reasonCode: string;
  evaluated: bigint;
  rejected: bigint;
  wFuture: bigint;
  wCounterfactual: bigint;
  wOpe: bigint;
  wConf: bigint;
  weightSum: bigint;
  regimes: Map<string, bigint>;
};

function ensureReason(
  map: Map<string, ReasonAgg>,
  gateFamily: HeliosCf10GateFamily,
  reasonCode: string,
): ReasonAgg {
  const key = `${gateFamily}::${reasonCode}`;
  let row = map.get(key);
  if (!row) {
    row = {
      gateFamily,
      reasonCode,
      evaluated: 0n,
      rejected: 0n,
      wFuture: 0n,
      wCounterfactual: 0n,
      wOpe: 0n,
      wConf: 0n,
      weightSum: 0n,
      regimes: new Map(),
    };
    map.set(key, row);
  }
  return row;
}

function addWeighted(
  row: ReasonAgg,
  observation: HeliosCf10GateDecisionObservation,
): void {
  const w = weightMicro(observation);
  row.evaluated += observation.evaluationCount;
  row.rejected += observation.rejectionCount;
  row.wFuture += parseMinor(observation.futureMarketPathResultMinor) * w;
  row.wCounterfactual += parseMinor(observation.executionCounterfactualEstimateMinor) * w;
  row.wOpe += parseMinor(observation.opeEstimateMinor) * w;
  row.wConf += BigInt(Math.round(observation.estimateConfidence * 1_000_000)) * w;
  row.weightSum += w;
  const prev = row.regimes.get(observation.regimeId) ?? 0n;
  row.regimes.set(observation.regimeId, prev + w);
}

function divideWeightedMoney(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    return 0n;
  }
  /** Denominator is in micro-weight units; values were scaled by the same w, so divide by w only once. */
  return numerator / denominator;
}

function divideConfidence(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) {
    return 0;
  }
  return Number(numerator) / Number(denominator);
}

export function buildHeliosCf10DecisionAttributionReport(input: {
  readonly generatedAt: UtcInstant;
  readonly observations: readonly HeliosCf10GateDecisionObservation[];
}): HeliosCf10DecisionAttributionReport {
  const perObs = input.observations.map(perObservation);

  const reasonMap = new Map<string, ReasonAgg>();
  for (const o of input.observations) {
    addWeighted(ensureReason(reasonMap, o.gateFamily, o.reasonCode), o);
  }

  const reasonPerformances: HeliosCf10RejectionReasonPerformance[] = [];
  for (const agg of reasonMap.values()) {
    const denom = agg.weightSum > 0n ? agg.weightSum : 1n;
    const regimeDependence: Record<string, number> = {};
    for (const [reg, mass] of agg.regimes) {
      regimeDependence[reg] = Number(mass) / Number(denom);
    }
    reasonPerformances.push({
      gateFamily: agg.gateFamily,
      reasonCode: agg.reasonCode,
      evaluated: agg.evaluated,
      rejected: agg.rejected,
      futureMarketPathResultMinor: formatMinor(divideWeightedMoney(agg.wFuture, denom)),
      executionCounterfactualEstimateMinor: formatMinor(divideWeightedMoney(agg.wCounterfactual, denom)),
      opeEstimateMinor: formatMinor(divideWeightedMoney(agg.wOpe, denom)),
      confidence: divideConfidence(agg.wConf, denom),
      support: Number(agg.weightSum) / 1_000_000,
      regimeDependence,
      semantics: 'ESTIMATED',
    });
  }

  const byFamily = new Map<HeliosCf10GateFamily, HeliosCf10RejectionReasonPerformance[]>();
  for (const r of reasonPerformances) {
    const list = byFamily.get(r.gateFamily) ?? [];
    list.push(r);
    byFamily.set(r.gateFamily, list);
  }

  const gateAttribution: HeliosCf10DecisionGateAttribution[] = [];
  for (const [family, rollups] of byFamily) {
    gateAttribution.push({
      gateFamily: family,
      reasonRollups: Object.freeze([...rollups].sort((a, b) => a.reasonCode.localeCompare(b.reasonCode))),
      semantics: 'ESTIMATED',
    });
  }
  gateAttribution.sort((a, b) => a.gateFamily.localeCompare(b.gateFamily));

  const familyAbsRegretSum = new Map<HeliosCf10GateFamily, bigint>();
  const familyAbsRegretDenominator = new Map<HeliosCf10GateFamily, bigint>();

  for (const o of input.observations) {
    if (!o.rejected) {
      continue;
    }
    const regret = parseMinor(decisionRegretFor(o).riskAdjustedRegretMinor);
    const absRegret = regret >= 0n ? regret : -regret;
    const weight = o.rejectionCount > 0n ? o.rejectionCount : 1n;

    familyAbsRegretSum.set(
      o.gateFamily,
      (familyAbsRegretSum.get(o.gateFamily) ?? 0n) + absRegret * weight,
    );
    familyAbsRegretDenominator.set(
      o.gateFamily,
      (familyAbsRegretDenominator.get(o.gateFamily) ?? 0n) + weight,
    );
  }

  const gateCalibration: HeliosCf10GateCalibrationState[] = [];
  for (const family of byFamily.keys()) {
    const rows = byFamily.get(family) ?? [];
    let evaluatedTotal = 0n;
    let rejectedTotal = 0n;
    for (const r of rows) {
      evaluatedTotal += r.evaluated;
      rejectedTotal += r.rejected;
    }

    let entropy = 0;
    const ev = evaluatedTotal > 0n ? evaluatedTotal : 1n;
    for (const r of rows) {
      const p = Number(r.evaluated) / Number(ev);
      entropy += p > 0 ? -p * Math.log2(p) : 0;
    }
    const maxH = Math.log2(Math.max(1, rows.length));
    const reasonMixEntropy = maxH > 0 ? entropy / maxH : 0;

    const absSum = familyAbsRegretSum.get(family) ?? 0n;
    const absDenom = familyAbsRegretDenominator.get(family) ?? 0n;
    const meanAbs = absDenom > 0n ? absSum / absDenom : 0n;

    gateCalibration.push({
      gateFamily: family,
      empiricalRejectRate:
        evaluatedTotal > 0n ? Number(rejectedTotal) / Number(evaluatedTotal) : 0,
      reasonMixEntropy,
      meanAbsRiskAdjustedRegretRejectedMinor: formatMinor(meanAbs),
      sampleRejected: rejectedTotal,
      semantics: 'ESTIMATED',
    });
  }
  gateCalibration.sort((a, b) => a.gateFamily.localeCompare(b.gateFamily));

  return {
    schema: HELIOS_COUNTERFACTUAL_LEARNING_CF10_SCHEMA,
    qualificationMarker: HELIOS_CF10_DECISION_ATTRIBUTION_QUALIFIED,
    generatedAt: input.generatedAt,
    perObservation: Object.freeze(perObs),
    gateAttribution: Object.freeze(gateAttribution),
    gateCalibration: Object.freeze(gateCalibration),
    semantics: 'ESTIMATED',
  };
}
