/**
 * Derive point-in-time fundamental features from facts when supported.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import {
  FUNDAMENTAL_FEATURE_IDS,
  HELIOS_FUNDAMENTAL_FEATURE_SCHEMA,
  type FundamentalFactRecord,
  type FundamentalFeatureId,
  type FundamentalFeatureValue,
  type PointInTimeFundamentalSnapshot,
} from './fundamental-types.ts';
import { effectiveFactsAt } from './fundamental-store.ts';

function findFact(
  facts: readonly FundamentalFactRecord[],
  concept: string,
  periodEnd?: string,
): FundamentalFactRecord | undefined {
  const matches = facts.filter((f) => f.concept === concept && (!periodEnd || f.periodEnd === periodEnd));
  if (matches.length === 0) {
    return undefined;
  }
  return matches.reduce((best, current) =>
    Date.parse(current.knowableAt) >= Date.parse(best.knowableAt) ? current : best,
  );
}

function unsupported(featureId: FundamentalFeatureId): FundamentalFeatureValue {
  return Object.freeze({
    featureId,
    supported: false,
    valueMinor: null,
    ratio: null,
    unit: null,
    fiscalPeriod: null,
    reportPeriod: null,
    sourceFilingId: null,
    evidenceRef: null,
    knowableAt: null,
  });
}

function supportedFromFact(
  featureId: FundamentalFeatureId,
  fact: FundamentalFactRecord,
  extras: { ratio?: string | null; valueMinor?: bigint | null; unit?: string | null } = {},
): FundamentalFeatureValue {
  return Object.freeze({
    featureId,
    supported: true,
    valueMinor: extras.valueMinor ?? fact.valueMinor,
    ratio: extras.ratio ?? null,
    unit: extras.unit ?? fact.unit,
    fiscalPeriod: fact.fiscalPeriod,
    reportPeriod: fact.periodEnd,
    sourceFilingId: fact.filingId,
    evidenceRef: fact.evidenceRef,
    knowableAt: fact.knowableAt,
  });
}

function ratioString(numerator: bigint, denominator: bigint): string | null {
  if (denominator === 0n) {
    return null;
  }
  const scaled = (numerator * 10000n) / denominator;
  const whole = scaled / 100n;
  const frac = scaled % 100n;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

export function buildPointInTimeFundamentalSnapshot(input: {
  readonly canonicalEntityId: string;
  readonly evaluationTimeUtc: UtcInstant;
  readonly facts: readonly FundamentalFactRecord[];
  readonly priorPeriodFacts?: readonly FundamentalFactRecord[];
}): PointInTimeFundamentalSnapshot {
  const effective = effectiveFactsAt(input.facts, input.evaluationTimeUtc);
  const priorEffective = input.priorPeriodFacts
    ? effectiveFactsAt(input.priorPeriodFacts, input.evaluationTimeUtc)
    : [];

  const revenueFact = findFact(effective, 'us-gaap:Revenues');
  const cogsFact = findFact(effective, 'us-gaap:CostOfGoodsAndServicesSold');
  const opIncomeFact = findFact(effective, 'us-gaap:OperatingIncomeLoss');
  const ocfFact = findFact(effective, 'us-gaap:NetCashProvidedByUsedInOperatingActivities');
  const capexFact = findFact(effective, 'us-gaap:PaymentsToAcquirePropertyPlantAndEquipment');
  const cashFact = findFact(effective, 'us-gaap:CashAndCashEquivalentsAtCarryingValue');
  const debtFact = findFact(effective, 'us-gaap:LongTermDebtNoncurrent');
  const sharesFact = findFact(effective, 'us-gaap:CommonStockSharesOutstanding');
  const sbcFact = findFact(effective, 'us-gaap:ShareBasedCompensation');
  const wcFact = findFact(effective, 'us-gaap:IncreaseDecreaseInInventories');
  const investedCapitalFact = findFact(effective, 'us-gaap:InvestedCapital');

  const features = {} as Record<FundamentalFeatureId, FundamentalFeatureValue>;

  for (const id of FUNDAMENTAL_FEATURE_IDS) {
    features[id] = unsupported(id);
  }

  if (revenueFact?.valueMinor != null) {
    features.revenue = supportedFromFact('revenue', revenueFact);
  }

  const priorRevenue = findFact(priorEffective, 'us-gaap:Revenues');
  if (revenueFact?.valueMinor != null && priorRevenue?.valueMinor != null && priorRevenue.valueMinor !== 0n) {
    const growth = ratioString(revenueFact.valueMinor - priorRevenue.valueMinor, priorRevenue.valueMinor);
    features.revenue_growth = Object.freeze({
      ...supportedFromFact('revenue_growth', revenueFact, { ratio: growth, valueMinor: null }),
      unit: 'ratio',
    });
  }

  if (revenueFact?.valueMinor != null && cogsFact?.valueMinor != null && revenueFact.valueMinor !== 0n) {
    const gross = revenueFact.valueMinor - cogsFact.valueMinor;
    features.gross_margin = Object.freeze({
      ...supportedFromFact('gross_margin', revenueFact, {
        ratio: ratioString(gross, revenueFact.valueMinor),
        valueMinor: null,
      }),
      unit: 'ratio',
    });
  }

  if (revenueFact?.valueMinor != null && opIncomeFact?.valueMinor != null && revenueFact.valueMinor !== 0n) {
    features.operating_margin = Object.freeze({
      ...supportedFromFact('operating_margin', opIncomeFact, {
        ratio: ratioString(opIncomeFact.valueMinor, revenueFact.valueMinor),
        valueMinor: null,
      }),
      unit: 'ratio',
    });
  }

  if (ocfFact?.valueMinor != null && capexFact?.valueMinor != null) {
    const fcf = ocfFact.valueMinor - capexFact.valueMinor;
    features.fcf = Object.freeze({
      ...supportedFromFact('fcf', ocfFact, { valueMinor: fcf }),
    });
    if (revenueFact?.valueMinor != null && revenueFact.valueMinor !== 0n) {
      features.fcf_margin = Object.freeze({
        ...supportedFromFact('fcf_margin', ocfFact, {
          ratio: ratioString(fcf, revenueFact.valueMinor),
          valueMinor: null,
        }),
        unit: 'ratio',
      });
    }
  }

  if (opIncomeFact?.valueMinor != null && investedCapitalFact?.valueMinor != null && investedCapitalFact.valueMinor !== 0n) {
    features.roic_proxy = Object.freeze({
      ...supportedFromFact('roic_proxy', opIncomeFact, {
        ratio: ratioString(opIncomeFact.valueMinor, investedCapitalFact.valueMinor),
        valueMinor: null,
      }),
      unit: 'ratio',
    });
  }

  if (cashFact?.valueMinor != null) {
    features.cash = supportedFromFact('cash', cashFact);
  }
  if (debtFact?.valueMinor != null) {
    features.debt = supportedFromFact('debt', debtFact);
  }
  if (cashFact?.valueMinor != null && debtFact?.valueMinor != null) {
    features.net_debt = Object.freeze({
      ...supportedFromFact('net_debt', debtFact, { valueMinor: debtFact.valueMinor - cashFact.valueMinor }),
    });
  }
  if (sharesFact?.numericValue != null) {
    features.share_count = Object.freeze({
      ...supportedFromFact('share_count', sharesFact, { valueMinor: null, unit: 'shares' }),
      ratio: String(sharesFact.numericValue),
    });
  }
  if (capexFact?.valueMinor != null) {
    features.capex = supportedFromFact('capex', capexFact);
  }
  if (sbcFact?.valueMinor != null) {
    features.sbc = supportedFromFact('sbc', sbcFact);
  }
  if (wcFact?.valueMinor != null) {
    features.working_capital_change = supportedFromFact('working_capital_change', wcFact);
  }

  return Object.freeze({
    schema: HELIOS_FUNDAMENTAL_FEATURE_SCHEMA,
    canonicalEntityId: input.canonicalEntityId,
    evaluationTimeUtc: input.evaluationTimeUtc,
    features: Object.freeze(features),
  });
}

export function assertNoFutureFundamentalLeak(input: {
  readonly evaluationTimeUtc: UtcInstant;
  readonly snapshot: PointInTimeFundamentalSnapshot;
}): { readonly ok: true } | { readonly ok: false; readonly featureId: FundamentalFeatureId; readonly knowableAt: UtcInstant } {
  const evalMs = Date.parse(input.evaluationTimeUtc);
  for (const featureId of FUNDAMENTAL_FEATURE_IDS) {
    const feature = input.snapshot.features[featureId];
    if (!feature.supported || !feature.knowableAt) {
      continue;
    }
    const knowMs = Date.parse(feature.knowableAt);
    if (Number.isFinite(evalMs) && Number.isFinite(knowMs) && knowMs > evalMs) {
      return Object.freeze({ ok: false, featureId, knowableAt: feature.knowableAt });
    }
  }
  return Object.freeze({ ok: true });
}

export function parseEvaluationUtc(value: string): UtcInstant {
  return asUtcInstant(value);
}
