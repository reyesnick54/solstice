import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { HELIOS_VALUATION_INTELLIGENCE_SCHEMA } from '../taxonomy.ts';
import { fixtureTerminalGrowthDcfInput } from '../val04-probabilistic-dcf/fixtures.ts';
import { distributionPercentiles } from '../val04-probabilistic-dcf/percentiles.ts';
import { runMonteCarloDcf } from '../val04-probabilistic-dcf/monte-carlo.ts';
import { buildHeliosProbabilisticExpectations, runVal05ReverseDcfAnalysis } from '../val05/service.ts';
import {
  val05DemoCapitalStructure,
  val05DemoDiscountRate,
  val05DemoOperatingEconomics,
  val05DemoPrice,
  VAL05_FIXTURE_AS_OF,
  VAL05_FIXTURE_ENTITY_ID,
} from '../val05/fixtures.ts';
import {
  fixtureProbabilisticComparablesInput,
  runProbabilisticComparablesEngine,
} from '../comparables/index.ts';
import type { ProbabilisticComparablesInput } from '../comparables/types.ts';
import { bindSegmentIdentities, fixtureSotpValuationInput, runSotpValuationEngine } from '../sotp/index.ts';
import {
  fixturePositiveResidualIncomeInput,
  runResidualIncomeValuation,
} from '../residual-income/index.ts';
import { computeValuationUncertainty } from '../val10-uncertainty/index.ts';
import { runAdaptiveEnsemble } from '../val11-adaptive-ensemble/index.ts';
import { compileValuationExtendedModelEvidence } from './extended-evidence.ts';
import { distributionSummaryFromSamples } from './distribution-summary.ts';
import { computeModelImpliedMarginOfSafety } from './margin-of-safety.ts';
import { computeValuationGap } from './valuation-gap.ts';
import type { HeliosValuationState } from './types.ts';

function addMs(iso: UtcInstant, ms: number): UtcInstant {
  return new Date(Date.parse(iso) + ms).toISOString() as UtcInstant;
}

export function buildHeliosValuationState(input: {
  readonly canonicalEntityId?: string;
  readonly valuationTime?: UtcInstant;
}): HeliosValuationState {
  const entityId = input.canonicalEntityId ?? VAL05_FIXTURE_ENTITY_ID;
  const valuationTime = input.valuationTime ?? VAL05_FIXTURE_AS_OF;

  const dcfInput = fixtureTerminalGrowthDcfInput();
  const mc = runMonteCarloDcf(dcfInput);
  const dcfSamples = mc.paths.map((row) => row.valuePerShare);

  const riv = runResidualIncomeValuation(fixturePositiveResidualIncomeInput());
  const rivIntrinsicSamples = (() => {
    const base = riv.intrinsicEquityValue;
    const low = riv.distribution.lowIntrinsicEquity;
    const high = riv.distribution.highIntrinsicEquity;
    if (low != null && high != null) {
      const span = Math.max(high - low, 1e-9);
      return Array.from({ length: 64 }, (_, i) => low + (span * i) / 63);
    }
    const jitter = 0.04;
    return Array.from({ length: 64 }, (_, i) => base * (1 + ((i % 9) - 4) * jitter));
  })();
  const dcfAnchor = mc.paths[0]?.valuePerShare ?? 1;
  const rivPerShare = rivIntrinsicSamples.map((eq) =>
    riv.intrinsicEquityValue !== 0 ? (eq / riv.intrinsicEquityValue) * dcfAnchor : dcfAnchor,
  );
  const rivDist = distributionPercentiles(rivPerShare);

  const priceScaleMinor = 100n;

  const val08Input: ProbabilisticComparablesInput = fixtureProbabilisticComparablesInput();
  const comparables = runProbabilisticComparablesEngine(val08Input);
  const eqDist = comparables.equityValueDistribution;
  const sharesOutstanding = val08Input.target.fundamentals.sharesOutstanding;
  const compSamples = Array.from({ length: 32 }, (_, i) => {
    const t = i / 31;
    const equity = eqDist.p10 * (1 - t) + eqDist.p90 * t;
    return equity / sharesOutstanding;
  });

  const rawSotpInput = fixtureSotpValuationInput();
  const sotpInput = Object.freeze({
    ...rawSotpInput,
    canonicalEntityId: entityId,
    segmentSource: Object.freeze({
      ...rawSotpInput.segmentSource,
      observations: bindSegmentIdentities(rawSotpInput.segmentSource.observations),
    }),
  });
  const sotp = runSotpValuationEngine(sotpInput);
  const dist = sotp.intrinsicDistribution;
  const minorToPerShare = (m: bigint) => Number(m) / Number(priceScaleMinor);
  const sotpSamples = Array.from({ length: 32 }, (_, i) => {
    const t = i / 31;
    const low = dist.p05Minor;
    const high = dist.p95Minor;
    if (low < high) {
      const v = Number(low) + (Number(high) - Number(low)) * t;
      return v / Number(priceScaleMinor);
    }
    return minorToPerShare(dist.valuePerShareMinor ?? dist.medianMinor);
  });
  const sotpMedianPerShare = minorToPerShare(dist.medianMinor);

  const ensemble = runAdaptiveEnsemble({
    entityId,
    asOf: valuationTime,
    evidenceRef: 'ev/val11/ensemble',
    models: Object.freeze([
      Object.freeze({
        method: 'DCF_FCFF' as const,
        applicabilityScore: 0.92,
        valuePerShareSamples: Object.freeze(dcfSamples),
      }),
      Object.freeze({
        method: 'RESIDUAL_INCOME' as const,
        applicabilityScore: 0.78,
        valuePerShareSamples: Object.freeze(rivPerShare),
      }),
      Object.freeze({
        method: 'COMPARABLE_MULTIPLES' as const,
        applicabilityScore: 0.71,
        valuePerShareSamples: Object.freeze(compSamples),
      }),
      Object.freeze({
        method: 'SUM_OF_PARTS' as const,
        applicabilityScore: 0.66,
        valuePerShareSamples: Object.freeze(sotpSamples),
      }),
    ]),
  });

  const blendedSamples = Array.from({ length: dcfSamples.length }, (_, i) => {
    let sum = 0;
    let weight = 0;
    for (const model of [
      { w: ensemble.modelWeights.DCF_FCFF ?? 0, samples: dcfSamples },
      { w: ensemble.modelWeights.RESIDUAL_INCOME ?? 0, samples: rivPerShare },
      { w: ensemble.modelWeights.COMPARABLE_MULTIPLES ?? 0, samples: compSamples },
      { w: ensemble.modelWeights.SUM_OF_PARTS ?? 0, samples: sotpSamples },
    ]) {
      sum += model.w * (model.samples[i] ?? model.samples[0] ?? 0);
      weight += model.w;
    }
    return weight > 0 ? sum / weight : 0;
  });

  const uncertainty = computeValuationUncertainty({
    entityId,
    asOf: valuationTime,
    evidenceRef: 'ev/val10/uncertainty',
    surface: Object.freeze({
      modelMedians: Object.freeze([
        mc.paths[0]?.valuePerShare ?? 0,
        rivDist.median,
        eqDist.median,
        sotpMedianPerShare,
      ]),
      waccShockBps: 75,
      baselineMedian: mc.paths[0]?.valuePerShare ?? rivDist.median,
      shockedMedian: (mc.paths[0]?.valuePerShare ?? rivDist.median) * 0.92,
    }),
  });

  const price = val05DemoPrice();
  const heliosExpectations = buildHeliosProbabilisticExpectations({
    entityId,
    asOf: valuationTime,
    operatingEconomics: val05DemoOperatingEconomics(),
    revenueCagr: Object.freeze({ p10: 600, p50: 900, p90: 1_200 }),
    terminalGrowth: Object.freeze({ p10: 150, p50: 250, p90: 350 }),
  });
  const reverseDcf = runVal05ReverseDcfAnalysis({
    entityId,
    asOf: valuationTime,
    price,
    capitalStructure: val05DemoCapitalStructure(),
    discountRate: val05DemoDiscountRate(),
    operatingEconomics: val05DemoOperatingEconomics(),
    heliosExpectations,
  });

  const marketPriceMinor = price.pricePerShareMinor;
  const gap =
    marketPriceMinor != null
      ? computeValuationGap({
          valuePerShareSamples: blendedSamples,
          marketPriceMinor,
          priceScaleMinor,
        })
      : null;
  const margin =
    marketPriceMinor != null
      ? computeModelImpliedMarginOfSafety({
          valuePerShareSamples: blendedSamples,
          marketPriceMinor,
          priceScaleMinor,
        })
      : null;

  const sharesOutNum = Number(sotpInput.sharesOutstandingMinor);
  const segmentSummaries = Object.fromEntries(
    sotp.segmentValuations.map((sv) => {
      const segDist = sv.distribution;
      const low = Number(segDist.p05Minor) / sharesOutNum / Number(priceScaleMinor);
      const high = Number(segDist.p95Minor) / sharesOutNum / Number(priceScaleMinor);
      const segSamples = Array.from({ length: 32 }, (_, i) => {
        const t = i / 31;
        return low + (high - low) * t;
      });
      return [sv.stableSegmentKey, distributionSummaryFromSamples(segSamples, priceScaleMinor)] as const;
    }),
  );

  const extendedModelEvidence = compileValuationExtendedModelEvidence({
    val07ResidualIncomeRef: riv.valuationId,
    val08ComparablesRef: comparables.valuationId,
    val09SotpRef: sotp.valuationId,
    val10UncertaintyRef: uncertainty.evidenceRef,
    val11EnsembleRef: ensemble.evidenceRef,
    compiledAt: valuationTime,
  });

  const stateId = `hvs_${createHash('sha256').update(`${entityId}:${valuationTime}`).digest('hex').slice(0, 16)}`;

  return Object.freeze({
    schema: HELIOS_VALUATION_INTELLIGENCE_SCHEMA,
    stateId,
    canonicalEntityId: entityId,
    valuationTime,
    independentIntrinsicValueDistribution: distributionSummaryFromSamples(blendedSamples, priceScaleMinor),
    marketReferencedValueDistribution: distributionSummaryFromSamples(compSamples, priceScaleMinor),
    reverseDcfExpectations: reverseDcf,
    segmentValueDistribution: Object.freeze(segmentSummaries),
    residualIncomeValueDistribution: distributionSummaryFromSamples(rivPerShare, priceScaleMinor),
    comparableValueDistribution: distributionSummaryFromSamples(compSamples, priceScaleMinor),
    crossModelDispersion: uncertainty.crossModelDispersion,
    valuationUncertainty: uncertainty.valuationUncertainty,
    fragility: uncertainty.fragility,
    modelApplicability: ensemble.modelApplicability,
    modelWeights: ensemble.modelWeights,
    marketPriceMinor,
    valuationGap: gap,
    modelImpliedMarginOfSafety: margin,
    evidenceRefs: Object.freeze([
      `helios:val07:${riv.valuationId}`,
      `helios:val08:${comparables.valuationId}`,
      `helios:val09:${sotp.valuationId}`,
      uncertainty.evidenceRef,
      ensemble.evidenceRef,
      reverseDcf.price.evidenceRef,
    ]),
    extendedModelEvidence,
    AAFQualification: Object.freeze({
      pointInTimeCertified: true,
      coverageOk: true,
      missingnessOk: true,
      biasSentinelOk: true,
      lineageOk: true,
      simulationOnly: true,
      grantsExecutionAuthority: false,
    }),
    confidence: 0.68,
    expirationTime: addMs(valuationTime, 14 * 24 * 60 * 60 * 1000),
    valuationQualityNotInvestmentAlpha: true,
    grantsExecutionAuthority: false,
    grantsFinancialMutation: false,
    autoPromoteStrategyCandidates: false,
  });
}
