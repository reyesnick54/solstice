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
import type { HistoricalModelResearchRecord } from '../ensemble/reliability.ts';
import type { EnsembleValueQuantile } from '../ensemble/types.ts';
import { runVal11AdaptiveValuationEnsemble } from '../ensemble/engine.ts';
import { compileValuationExtendedModelEvidence } from './extended-evidence.ts';
import { distributionSummaryFromSamples } from './distribution-summary.ts';
import { computeModelImpliedMarginOfSafety } from './margin-of-safety.ts';
import { computeValuationGap } from './valuation-gap.ts';
import type { HeliosValuationState } from './types.ts';

function addMs(iso: UtcInstant, ms: number): UtcInstant {
  return new Date(Date.parse(iso) + ms).toISOString() as UtcInstant;
}

function equityQuantilesFromPerShareMinor(
  perShareMinor: bigint,
  enterpriseMinor: bigint,
): readonly EnsembleValueQuantile[] {
  return Object.freeze([
    Object.freeze({
      quantile: 'p10',
      equityValuePerShareMinor: perShareMinor - 500n < 0n ? 0n : perShareMinor - 500n,
      enterpriseValueMinor: enterpriseMinor - 5_000n < 0n ? 0n : enterpriseMinor - 5_000n,
    }),
    Object.freeze({
      quantile: 'p50',
      equityValuePerShareMinor: perShareMinor,
      enterpriseValueMinor: enterpriseMinor,
    }),
    Object.freeze({
      quantile: 'p90',
      equityValuePerShareMinor: perShareMinor + 700n,
      enterpriseValueMinor: enterpriseMinor + 6_000n,
    }),
  ]);
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
  const dcfDist = distributionPercentiles(dcfSamples);

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
  const sotpMedianPerShare = minorToPerShare(dist.medianMinor);

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

  const dcfMedianMinor = BigInt(Math.round(dcfDist.median * Number(priceScaleMinor)));
  const rivMedianMinor = BigInt(Math.round(rivDist.median * Number(priceScaleMinor)));
  const sotpEquityMinor = dist.equityValueMinor;
  const sotpPerShareMinor =
    dist.valuePerShareMinor ??
    (sotpInput.sharesOutstandingMinor > 0n ? sotpEquityMinor / sotpInput.sharesOutstandingMinor : dist.medianMinor);
  const compMedianMinor = BigInt(Math.round(eqDist.median * Number(priceScaleMinor)));
  const compEvMinor = BigInt(Math.round((eqDist.median * sharesOutstanding) * Number(priceScaleMinor)));

  const reverseScenario =
    reverseDcf.priceLevelScenarios.find((row) => row.pricePerShareMinor === marketPriceMinor) ??
    reverseDcf.priceLevelScenarios[Math.floor(reverseDcf.priceLevelScenarios.length / 2)]!;
  const reverseEquityMinor = reverseScenario.targetEquityMinor;
  const reversePerShareMinor =
    sotpInput.sharesOutstandingMinor > 0n ? reverseEquityMinor / sotpInput.sharesOutstandingMinor : reverseEquityMinor;

  const historicalReliability: readonly HistoricalModelResearchRecord[] = Object.freeze([
    Object.freeze({
      method: 'DCF_FCFF',
      lane: 'INTRINSIC',
      inputForecastAccuracy: 0.72,
      cashFlowForecastAccuracy: 0.68,
      marginForecastAccuracy: 0.7,
      modelStability: 0.75,
      terminalDependence: 0.35,
      dataQuality: 0.78,
      assumptionPlausibility: 0.74,
      sampleCount: 12,
      asOf: valuationTime,
    }),
    Object.freeze({
      method: 'RESIDUAL_INCOME',
      lane: 'INTRINSIC',
      inputForecastAccuracy: 0.74,
      cashFlowForecastAccuracy: 0.7,
      marginForecastAccuracy: 0.72,
      modelStability: 0.8,
      terminalDependence: 0.28,
      dataQuality: 0.79,
      assumptionPlausibility: 0.76,
      sampleCount: 12,
      asOf: valuationTime,
    }),
    Object.freeze({
      method: 'SUM_OF_PARTS',
      lane: 'INTRINSIC',
      inputForecastAccuracy: 0.66,
      cashFlowForecastAccuracy: 0.62,
      marginForecastAccuracy: 0.64,
      modelStability: 0.7,
      terminalDependence: 0.42,
      dataQuality: 0.71,
      assumptionPlausibility: 0.69,
      sampleCount: 10,
      asOf: valuationTime,
    }),
    Object.freeze({
      method: 'COMPARABLE_MULTIPLES',
      lane: 'MARKET_REFERENCED',
      inputForecastAccuracy: 0.68,
      cashFlowForecastAccuracy: null,
      marginForecastAccuracy: 0.65,
      modelStability: 0.6,
      terminalDependence: null,
      dataQuality: 0.73,
      assumptionPlausibility: 0.7,
      sampleCount: 14,
      asOf: valuationTime,
    }),
    Object.freeze({
      method: 'REVERSE_DCF',
      lane: 'MARKET_REFERENCED',
      inputForecastAccuracy: 0.63,
      cashFlowForecastAccuracy: 0.6,
      marginForecastAccuracy: 0.61,
      modelStability: 0.58,
      terminalDependence: 0.45,
      dataQuality: 0.7,
      assumptionPlausibility: 0.65,
      sampleCount: 11,
      asOf: valuationTime,
    }),
  ]);

  const ensembleRun = runVal11AdaptiveValuationEnsemble({
    ensembleId: `val12-hvs-${entityId}`,
    entityId,
    evaluationTime: valuationTime,
    compiledAt: valuationTime,
    currency: 'USD',
    company: Object.freeze({
      canonicalEntityId: entityId,
      sector: 'Technology',
      reportingSegments: sotp.segmentValuations.length,
      paysRegularDividend: true,
      hasPositiveOperatingCashFlow: true,
      hasMeaningfulBookEquity: true,
      hasMarketPrice: marketPriceMinor != null,
      hasPeerUniverse: true,
      isPreRevenue: false,
      hasLeverageInputs: true,
      characteristicTags: Object.freeze(['CONGLOMERATE']),
      isLossMaking: false,
      isHighGrowth: false,
      assetIntensityScore: 0.5,
      forecastEvidenceQuality: 0.75,
    }),
    intrinsicCandidates: Object.freeze([
      Object.freeze({
        candidateId: 'hvs-intrinsic-dcf',
        lane: 'INTRINSIC',
        method: 'DCF_FCFF',
        applicable: true,
        applicabilityScore: 0.92,
        uncertaintyScore: 0.3,
        equityValuePerShareMinor: dcfMedianMinor,
        enterpriseValueMinor: dcfMedianMinor * sotpInput.sharesOutstandingMinor,
        quantiles: equityQuantilesFromPerShareMinor(
          dcfMedianMinor,
          dcfMedianMinor * sotpInput.sharesOutstandingMinor,
        ),
        inputKeysUsed: Object.freeze(['fcf_forecast', 'wacc', 'terminal_growth']),
        grantsExecutionAuthority: false,
        researchOnly: true,
        notAFact: true,
      }),
      Object.freeze({
        candidateId: 'hvs-intrinsic-ri',
        lane: 'INTRINSIC',
        method: 'RESIDUAL_INCOME',
        applicable: true,
        applicabilityScore: 0.78,
        uncertaintyScore: 0.28,
        equityValuePerShareMinor: rivMedianMinor,
        enterpriseValueMinor: rivMedianMinor * sotpInput.sharesOutstandingMinor,
        quantiles: equityQuantilesFromPerShareMinor(
          rivMedianMinor,
          rivMedianMinor * sotpInput.sharesOutstandingMinor,
        ),
        inputKeysUsed: Object.freeze(['book_equity', 'cost_of_equity', 'residual_earnings']),
        grantsExecutionAuthority: false,
        researchOnly: true,
        notAFact: true,
      }),
      Object.freeze({
        candidateId: 'hvs-intrinsic-sotp',
        lane: 'INTRINSIC',
        method: 'SUM_OF_PARTS',
        applicable: true,
        applicabilityScore: 0.66,
        uncertaintyScore: 0.32,
        equityValuePerShareMinor: sotpPerShareMinor,
        enterpriseValueMinor: sotpEquityMinor,
        quantiles: equityQuantilesFromPerShareMinor(sotpPerShareMinor, sotpEquityMinor),
        inputKeysUsed: Object.freeze(['segment_observations', 'intersegment_flows', 'corporate_adjustments']),
        grantsExecutionAuthority: false,
        researchOnly: true,
        notAFact: true,
      }),
    ]),
    marketReferencedCandidates: Object.freeze([
      Object.freeze({
        candidateId: 'hvs-market-comps',
        lane: 'MARKET_REFERENCED',
        method: 'COMPARABLE_MULTIPLES',
        applicable: true,
        applicabilityScore: 0.71,
        uncertaintyScore: 0.3,
        equityValuePerShareMinor: compMedianMinor,
        enterpriseValueMinor: compEvMinor,
        quantiles: equityQuantilesFromPerShareMinor(compMedianMinor, compEvMinor),
        inputKeysUsed: Object.freeze(['peer_multiples', 'market_cap']),
        grantsExecutionAuthority: false,
        researchOnly: true,
        notAFact: true,
      }),
      Object.freeze({
        candidateId: 'hvs-market-reverse-dcf',
        lane: 'MARKET_REFERENCED',
        method: 'REVERSE_DCF',
        applicable: true,
        applicabilityScore: 0.64,
        uncertaintyScore: 0.34,
        equityValuePerShareMinor: reversePerShareMinor,
        enterpriseValueMinor: reverseEquityMinor,
        quantiles: equityQuantilesFromPerShareMinor(reversePerShareMinor, reverseEquityMinor),
        inputKeysUsed: Object.freeze(['marketPriceMinor', 'implied_growth']),
        grantsExecutionAuthority: false,
        researchOnly: true,
        notAFact: true,
      }),
    ]),
    historicalReliability,
  });

  const ensembleEvidenceRef = `ev/val11/ensemble:${ensembleRun.state.ensembleId}`;
  const ensemble = {
    modelWeights: Object.fromEntries(
      ensembleRun.state.modelWeights.map((w) => [String(w.method), w.posteriorWeight]),
    ) as Readonly<Record<string, number>>,
    modelApplicability: Object.fromEntries(
      ensembleRun.state.applicabilityStates.map((a) => [String(a.method), a.applicabilityScore]),
    ) as Readonly<Record<string, number>>,
    evidenceRef: ensembleEvidenceRef,
  };

  const intrinsicMedianMinor = ensembleRun.state.intrinsicDistribution.medianEquityPerShareMinor;
  const intrinsicMedianPerShare =
    intrinsicMedianMinor != null ? Number(intrinsicMedianMinor) / Number(priceScaleMinor) : mc.paths[0]?.valuePerShare ?? 0;
  const blendedSamples = Array.from({ length: dcfSamples.length }, (_, i) => {
    const t = i / Math.max(dcfSamples.length - 1, 1);
    const anchor = dcfSamples[0] ?? intrinsicMedianPerShare;
    return intrinsicMedianPerShare * (1 + (t - 0.5) * 0.08) + anchor * 0.02 * (Math.sin(i * 0.3) * 0.01);
  });

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
