import type { UtcInstant } from '../../../../../domain/src/time.ts';
import { selectAsOfSeries } from '../compiler/as-of.ts';
import { laggedValueMinor } from '../compiler/rolling.ts';
import type { RevisionPolicy, TemporalObservation } from '../temporal-types.ts';
import { AAF10_FORMULA_VERSIONS } from './taxonomy.ts';
import type {
  Aaf10ComputedFeature,
  CertifiedExpectationInput,
  MacroOfficialReleaseEvent,
} from './types.ts';

const STALE_THRESHOLD_MS = 120 * 24 * 60 * 60 * 1000;

function seriesForKey(
  observations: readonly TemporalObservation[],
  seriesKey: string,
  decisionTime: UtcInstant,
  revisionPolicy: RevisionPolicy,
): readonly TemporalObservation[] {
  const filtered = observations.filter((row) => row.metadata.seriesKey === seriesKey);
  const series = selectAsOfSeries(filtered, decisionTime, revisionPolicy);
  return Object.freeze([...series].sort((a, b) => Date.parse(a.knowableAt) - Date.parse(b.knowableAt)));
}

function trendBps(series: readonly TemporalObservation[]): bigint | null {
  if (series.length < 2) {
    return null;
  }
  const latest = series[series.length - 1]!;
  const prior = series[series.length - 2]!;
  return latest.valueMinor - prior.valueMinor;
}

function latestValue(series: readonly TemporalObservation[]): bigint | null {
  const last = series[series.length - 1];
  return last?.valueMinor ?? null;
}

function staleQuality(
  series: readonly TemporalObservation[],
  decisionTime: UtcInstant,
): Aaf10ComputedFeature['quality'] {
  const last = series[series.length - 1];
  if (!last) {
    return 'DEGRADED_MISSING_INPUT';
  }
  if (Date.parse(decisionTime) - Date.parse(last.knowableAt) > STALE_THRESHOLD_MS) {
    return 'DEGRADED_STALE';
  }
  return 'VALID';
}

function feature(
  featureId: Aaf10ComputedFeature['featureId'],
  formulaVersion: string,
  valueMinor: bigint | null,
  valueText: string | null,
  knowableAt: UtcInstant,
  quality: Aaf10ComputedFeature['quality'],
  observationRefs: readonly string[],
): Aaf10ComputedFeature {
  return Object.freeze({
    featureId,
    formulaVersion,
    valueMinor,
    valueText,
    knowableAt,
    quality,
    observationRefs: Object.freeze([...observationRefs]),
    grantsExecutionAuthority: false,
  });
}

export function computeMacroFeatures(input: {
  readonly evaluationTime: UtcInstant;
  readonly revisionPolicy: RevisionPolicy;
  readonly observations: readonly TemporalObservation[];
  readonly releaseEvents: readonly MacroOfficialReleaseEvent[];
  readonly certifiedExpectation?: CertifiedExpectationInput | null;
}): readonly Aaf10ComputedFeature[] {
  const { evaluationTime, revisionPolicy, observations } = input;
  const cpi = seriesForKey(observations, 'cpi', evaluationTime, revisionPolicy);
  const unemployment = seriesForKey(observations, 'unemployment', evaluationTime, revisionPolicy);
  const policy = seriesForKey(observations, 'policy_rate', evaluationTime, revisionPolicy);
  const y2 = seriesForKey(observations, 'treasury_yield_2y', evaluationTime, revisionPolicy);
  const y10 = seriesForKey(observations, 'treasury_yield_10y', evaluationTime, revisionPolicy);
  const inflExp = seriesForKey(observations, 'inflation_expectations', evaluationTime, revisionPolicy);

  const inflationTrend = trendBps(cpi);
  const unemploymentTrend = trendBps(unemployment);
  const slope =
    latestValue(y10) !== null && latestValue(y2) !== null
      ? latestValue(y10)! - latestValue(y2)!
      : null;

  const policyRate = latestValue(policy);
  const inflationProxy = latestValue(inflExp) ?? laggedValueMinor(cpi, 0);
  const realRate =
    policyRate !== null && inflationProxy !== null ? policyRate - inflationProxy : null;

  const priorPolicy = laggedValueMinor(policy, 1);
  let rateChangeState: string | null = null;
  if (policyRate !== null && priorPolicy !== null) {
    if (policyRate > priorPolicy) rateChangeState = 'TIGHTENING';
    else if (policyRate < priorPolicy) rateChangeState = 'EASING';
    else rateChangeState = 'UNCHANGED';
  }

  const surprise = computeReleaseSurprise(input.releaseEvents, input.certifiedExpectation ?? null, evaluationTime);

  const knowableAt = maxKnowableFromSeries([cpi, unemployment, policy, y2, y10, inflExp], evaluationTime);

  const regimeText = buildRegimeInputText({
    inflationTrend,
    unemploymentTrend,
    slope,
    realRate,
    rateChangeState,
  });

  return Object.freeze([
    feature(
      'aaf10.inflation_trend',
      AAF10_FORMULA_VERSIONS.inflationTrend,
      inflationTrend,
      null,
      knowableAt,
      staleQuality(cpi, evaluationTime),
      cpi.map((row) => row.observationRef),
    ),
    feature(
      'aaf10.unemployment_trend',
      AAF10_FORMULA_VERSIONS.unemploymentTrend,
      unemploymentTrend,
      null,
      knowableAt,
      staleQuality(unemployment, evaluationTime),
      unemployment.map((row) => row.observationRef),
    ),
    feature(
      'aaf10.yield_curve_slope',
      AAF10_FORMULA_VERSIONS.yieldCurveSlope,
      slope,
      null,
      knowableAt,
      slope === null ? 'DEGRADED_MISSING_INPUT' : staleQuality(y10, evaluationTime),
      [...y10, ...y2].map((row) => row.observationRef),
    ),
    feature(
      'aaf10.real_rate_proxy',
      AAF10_FORMULA_VERSIONS.realRateProxy,
      realRate,
      null,
      knowableAt,
      realRate === null ? 'DEGRADED_MISSING_INPUT' : 'VALID',
      [...policy, ...inflExp, ...cpi].map((row) => row.observationRef),
    ),
    feature(
      'aaf10.rate_change_state',
      AAF10_FORMULA_VERSIONS.rateChangeState,
      null,
      rateChangeState,
      knowableAt,
      rateChangeState === null ? 'DEGRADED_MISSING_INPUT' : 'VALID',
      policy.map((row) => row.observationRef),
    ),
    surprise,
    feature(
      'aaf10.macro_regime_inputs',
      AAF10_FORMULA_VERSIONS.macroRegimeInputs,
      null,
      regimeText,
      knowableAt,
      regimeText === null ? 'UNAVAILABLE' : 'VALID',
      observations.map((row) => row.observationRef),
    ),
  ]);
}

function maxKnowableFromSeries(
  seriesList: readonly (readonly TemporalObservation[])[],
  evaluationTime: UtcInstant,
): UtcInstant {
  let latest = evaluationTime;
  for (const series of seriesList) {
    const last = series[series.length - 1];
    if (last && Date.parse(last.knowableAt) > Date.parse(latest)) {
      latest = last.knowableAt;
    }
  }
  return latest;
}

function buildRegimeInputText(input: {
  readonly inflationTrend: bigint | null;
  readonly unemploymentTrend: bigint | null;
  readonly slope: bigint | null;
  readonly realRate: bigint | null;
  readonly rateChangeState: string | null;
}): string | null {
  if (
    input.inflationTrend === null &&
    input.unemploymentTrend === null &&
    input.slope === null &&
    input.realRate === null &&
    input.rateChangeState === null
  ) {
    return null;
  }
  return JSON.stringify({
    inflationTrendBps: input.inflationTrend?.toString() ?? null,
    unemploymentTrendBps: input.unemploymentTrend?.toString() ?? null,
    yieldCurveSlopeBps: input.slope?.toString() ?? null,
    realRateProxyBps: input.realRate?.toString() ?? null,
    rateChangeState: input.rateChangeState,
  });
}

function computeReleaseSurprise(
  events: readonly MacroOfficialReleaseEvent[],
  expectation: CertifiedExpectationInput | null,
  evaluationTime: UtcInstant,
): Aaf10ComputedFeature {
  if (!expectation) {
    return feature(
      'aaf10.release_surprise',
      AAF10_FORMULA_VERSIONS.releaseSurprise,
      null,
      'CONSENSUS_UNAVAILABLE',
      evaluationTime,
      'UNAVAILABLE',
      [],
    );
  }
  if (Date.parse(evaluationTime) < Date.parse(expectation.knowableAt)) {
    return feature(
      'aaf10.release_surprise',
      AAF10_FORMULA_VERSIONS.releaseSurprise,
      null,
      'EXPECTATION_NOT_YET_KNOWABLE',
      evaluationTime,
      'UNAVAILABLE',
      [],
    );
  }
  const release = events.find(
    (row) =>
      Date.parse(row.knowableAt) <= Date.parse(evaluationTime) &&
      row.initialReportedValue.revisionSequence === 0,
  );
  if (!release) {
    return feature(
      'aaf10.release_surprise',
      AAF10_FORMULA_VERSIONS.releaseSurprise,
      null,
      'MISSING_RELEASE',
      evaluationTime,
      'DEGRADED_MISSING_INPUT',
      [],
    );
  }
  const actual = release.initialReportedValue.valueMinor;
  const surprise = actual - expectation.valueMinor;
  return feature(
    'aaf10.release_surprise',
    AAF10_FORMULA_VERSIONS.releaseSurprise,
    surprise,
    null,
    maxInstant(release.knowableAt, expectation.knowableAt),
    'VALID',
    [...release.evidenceRefs, expectation.sourceId],
  );
}

function maxInstant(a: UtcInstant, b: UtcInstant): UtcInstant {
  return Date.parse(a) >= Date.parse(b) ? a : b;
}
