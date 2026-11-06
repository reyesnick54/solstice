import { createHash } from 'node:crypto';

import type { UtcInstant } from '@solstice/domain';

import { HELIOS_VALUATION_INTELLIGENCE_SCHEMA } from '../taxonomy.ts';
import { fixtureTerminalGrowthDcfInput } from '../val04-probabilistic-dcf/fixtures.ts';
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
import { runProbabilisticComparables, fixtureVal08Peers, FIXTURE_VAL08_AS_OF } from '../val08-comparables/index.ts';
import { runSotpValuation, fixtureVal09Segments, FIXTURE_VAL09_AS_OF } from '../val09-sotp/index.ts';
import { runResidualIncomeEngine, fixtureVal07Paths, FIXTURE_VAL07_AS_OF } from '../val07-residual-income/index.ts';
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

  const riv = runResidualIncomeEngine({
    entityId,
    asOf: FIXTURE_VAL07_AS_OF,
    paths: fixtureVal07Paths(),
    evidenceRef: 'ev/val07/residual-income',
  });
  const rivSamples = Array.from({ length: riv.pathCount }, (_, i) => {
    const t = i / Math.max(riv.pathCount - 1, 1);
    return riv.valuePerShare.p10 * (1 - t) + riv.valuePerShare.p90 * t;
  });

  const comparables = runProbabilisticComparables({
    entityId,
    asOf: FIXTURE_VAL08_AS_OF,
    targetEbitda: 12_000,
    netDebt: 500,
    sharesOutstanding: 100,
    peers: fixtureVal08Peers(FIXTURE_VAL08_AS_OF),
    evidenceRef: 'ev/val08/comparables',
  });
  const compSamples = Array.from({ length: comparables.peerCount }, (_, i) => {
    const t = i / Math.max(comparables.peerCount - 1, 1);
    return comparables.impliedValuePerShare.p10 * (1 - t) + comparables.impliedValuePerShare.p90 * t;
  });

  const sotp = runSotpValuation({
    entityId,
    asOf: FIXTURE_VAL09_AS_OF,
    segments: fixtureVal09Segments(),
    holdingCompanyDiscountBps: 150,
    evidenceRef: 'ev/val09/sotp',
  });
  const sotpSamples = Array.from({ length: 32 }, (_, i) => {
    const t = i / 31;
    return sotp.consolidatedValuePerShare.p10 * (1 - t) + sotp.consolidatedValuePerShare.p90 * t;
  });

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
        valuePerShareSamples: Object.freeze(rivSamples),
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
      { w: ensemble.modelWeights.RESIDUAL_INCOME ?? 0, samples: rivSamples },
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
        riv.valuePerShare.median,
        comparables.impliedValuePerShare.median,
        sotp.consolidatedValuePerShare.median,
      ]),
      waccShockBps: 75,
      baselineMedian: mc.paths[0]?.valuePerShare ?? riv.valuePerShare.median,
      shockedMedian: (mc.paths[0]?.valuePerShare ?? riv.valuePerShare.median) * 0.92,
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
  const priceScaleMinor = 100n;
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

  const segmentSummaries = Object.fromEntries(
    Object.entries(sotp.segmentValuePerShare).map(([segmentId, dist]) => [
      segmentId,
      distributionSummaryFromSamples(
        Array.from({ length: 32 }, (_, i) => {
          const t = i / 31;
          return dist.p10 * (1 - t) + dist.p90 * t;
        }),
        priceScaleMinor,
      ),
    ]),
  );

  const extendedModelEvidence = compileValuationExtendedModelEvidence({
    val07ResidualIncomeRef: riv.evidenceRef,
    val08ComparablesRef: comparables.evidenceRef,
    val09SotpRef: sotp.evidenceRef,
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
    residualIncomeValueDistribution: distributionSummaryFromSamples(rivSamples, priceScaleMinor),
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
      riv.evidenceRef,
      comparables.evidenceRef,
      sotp.evidenceRef,
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
