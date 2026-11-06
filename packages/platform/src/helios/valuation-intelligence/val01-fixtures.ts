import { asUtcInstant } from '@solstice/domain';
import type { UtcInstant } from '@solstice/domain';
import type { PointInTimeFundamentalSnapshot } from '../feature-fabric/fundamental-types.ts';
import { HELIOS_FUNDAMENTAL_FEATURE_SCHEMA } from '../feature-fabric/fundamental-types.ts';
import { freezeValuationAssumption } from './assumption.ts';
import type { IntrinsicValueDistribution } from './distribution.ts';
import type { ValuationIssuerProfile } from './applicability.ts';
import {
  HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA,
  HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
} from './taxonomy.ts';
import type { ValuationScenario, ValuationSnapshot } from './val01-canonical-domain.ts';

const ENTITY = 'entity.val01.demo';
const INSTRUMENT = 'inst.val01.demo';

function envelope(knowableAt: UtcInstant) {
  return Object.freeze({
    canonicalEntityId: ENTITY,
    canonicalInstrumentId: INSTRUMENT,
    asOfTradeDate: '2024-06-30',
    eventTime: null,
    publishedTime: null,
    providerAvailabilityTime: knowableAt,
    sunreyArrivalTime: knowableAt,
    knowableAt,
    revisionId: null,
    sourceRefs: Object.freeze([
      Object.freeze({
        sourceId: 'sec.edgar',
        providerId: 'sec',
        capability: 'point_in_time_fundamentals',
        upstreamRef: 'filing.demo',
      }),
    ]),
    evidenceRefs: Object.freeze(['evidence.val01.demo']),
    qualityState: 'VALID' as const,
  });
}

export const demoVal01EvaluationTime = asUtcInstant('2024-07-15T20:00:00.000Z');
export const demoVal01FutureLeakTime = asUtcInstant('2024-07-20T20:00:00.000Z');

export function demoVal01IssuerProfile(): ValuationIssuerProfile {
  return Object.freeze({
    canonicalEntityId: ENTITY,
    sector: 'Technology',
    reportingSegments: 1,
    paysRegularDividend: false,
    hasPositiveOperatingCashFlow: true,
    hasMeaningfulBookEquity: true,
    hasMarketPrice: true,
    hasPeerUniverse: true,
    isPreRevenue: false,
    hasLeverageInputs: true,
  });
}

export function demoVal01FundamentalSnapshot(): PointInTimeFundamentalSnapshot {
  const evaluationTimeUtc = demoVal01EvaluationTime;
  const knowableAt = asUtcInstant('2024-07-01T16:00:00.000Z');
  const feature = (valueMinor: bigint) =>
    Object.freeze({
      supported: true,
      valueMinor,
      ratio: null,
      unit: 'USD',
      fiscalPeriod: 'FY2024-Q2',
      reportPeriod: '2024-06-30',
      sourceFilingId: 'filing.demo',
      evidenceRef: 'evidence.fundamental.demo',
      knowableAt,
    });

  return Object.freeze({
    schema: HELIOS_FUNDAMENTAL_FEATURE_SCHEMA,
    canonicalEntityId: ENTITY,
    evaluationTimeUtc,
    features: Object.freeze({
      revenue: feature(10_000_000_000n),
      revenue_growth: Object.freeze({ ...feature(0n), ratio: '0.12', valueMinor: null }),
      gross_margin: Object.freeze({ ...feature(0n), ratio: '0.55', valueMinor: null }),
      operating_margin: Object.freeze({ ...feature(0n), ratio: '0.28', valueMinor: null }),
      fcf: feature(2_500_000_000n),
      fcf_margin: Object.freeze({ ...feature(0n), ratio: '0.25', valueMinor: null }),
      roic_proxy: Object.freeze({ ...feature(0n), ratio: '0.18', valueMinor: null }),
      cash: feature(5_000_000_000n),
      debt: feature(3_000_000_000n),
      net_debt: feature(-2_000_000_000n),
      share_count: feature(4_000_000_000n),
      capex: feature(800_000_000n),
      sbc: feature(200_000_000n),
      working_capital_change: feature(-50_000_000n),
    }),
  }) as PointInTimeFundamentalSnapshot;
}

export function demoVal01WaccAssumption() {
  return freezeValuationAssumption(
    Object.freeze({
      ...envelope(demoVal01EvaluationTime),
      assumptionId: 'assumption.val01.wacc',
      assumptionVersion: '1.0.0',
      parameterKey: 'discount_rate.wacc',
      parameterLabel: 'Weighted average cost of capital',
      valueKind: 'ratio_decimal',
      value: Object.freeze({ kind: 'ratio_decimal', decimal: '0.085', unit: 'ratio' }),
      inputSource: 'macro_intelligence_yield_rates',
      derivedFromEvidenceRefs: Object.freeze(['evidence.macro.treasury_10y']),
      authoredAt: demoVal01EvaluationTime,
      supersedesAssumptionId: null,
      explicitRationale: 'Risk-free + ERP from macro yield observations',
      hiddenInPrompt: false,
      grantsExecutionAuthority: false,
    }),
  );
}

export function demoVal01FutureLeakAssumption() {
  return freezeValuationAssumption(
    Object.freeze({
      ...envelope(demoVal01FutureLeakTime),
      assumptionId: 'assumption.val01.future_leak',
      assumptionVersion: '1.0.0',
      parameterKey: 'terminal.growth',
      parameterLabel: 'Terminal growth',
      valueKind: 'ratio_decimal',
      value: Object.freeze({ kind: 'ratio_decimal', decimal: '0.03', unit: 'ratio' }),
      inputSource: 'sec_point_in_time_fundamentals',
      derivedFromEvidenceRefs: Object.freeze(['evidence.future']),
      authoredAt: demoVal01FutureLeakTime,
      supersedesAssumptionId: null,
      explicitRationale: 'Fixture leakage row',
      hiddenInPrompt: false,
      grantsExecutionAuthority: false,
    }),
  );
}

export function demoVal01BaseScenario(): ValuationScenario {
  return Object.freeze({
    ...envelope(demoVal01EvaluationTime),
    scenarioId: 'scenario.val01.base',
    scenarioKind: 'BASE',
    label: 'Base DCF FCFF',
    assumptionIds: Object.freeze(['assumption.val01.wacc']),
    method: 'DCF_FCFF',
    grantsExecutionAuthority: false,
  });
}

export function demoVal01Snapshot(): ValuationSnapshot {
  return Object.freeze({
    schema: HELIOS_VAL01_CANONICAL_DOMAIN_SCHEMA,
    authority: HELIOS_VALUATION_INTELLIGENCE_AUTHORITY,
    ...envelope(demoVal01EvaluationTime),
    snapshotId: 'snapshot.val01.demo',
    evaluationTime: demoVal01EvaluationTime,
    compiledAt: demoVal01EvaluationTime,
    issuerProfileRef: 'profile.val01.demo',
    scenarioIds: Object.freeze(['scenario.val01.base']),
    assumptionIds: Object.freeze(['assumption.val01.wacc']),
    distributionIds: Object.freeze(['distribution.val01.intrinsic']),
    marketImpliedExpectationIds: Object.freeze([]),
    inputManifestRef: 'input.val01.demo',
    grantsExecutionAuthority: false,
    grantsFinancialMutation: false,
  });
}

export function demoVal01IntrinsicDistribution(): IntrinsicValueDistribution {
  return Object.freeze({
    distributionId: 'distribution.val01.intrinsic',
    kind: 'intrinsic_value',
    method: 'DCF_FCFF',
    currency: 'USD',
    meanValueMinor: 180_000_000_000n,
    medianValueMinor: 178_000_000_000n,
    standardDeviationMinor: 12_000_000_000n,
    enterpriseValueMinor: 185_000_000_000n,
    equityValueMinor: 180_000_000_000n,
    sharesOutstandingMinor: 4_000_000_000n,
    quantiles: Object.freeze([
      Object.freeze({ quantile: '0.05', valueMinor: 160_000_000_000n, valuePerShareMinor: 40_00n }),
      Object.freeze({ quantile: '0.50', valueMinor: 178_000_000_000n, valuePerShareMinor: 44_50n }),
      Object.freeze({ quantile: '0.95', valueMinor: 205_000_000_000n, valuePerShareMinor: 51_25n }),
    ]),
    sampleCount: 10_000,
    computedAt: demoVal01EvaluationTime,
    knowableAt: demoVal01EvaluationTime,
    notAFact: true,
    researchOnly: true,
    grantsExecutionAuthority: false,
  });
}
