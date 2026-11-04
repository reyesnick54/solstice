/**
 * SEC EDGAR as-filed dataflow (simulation fixtures only).
 *
 * Modeled after public EDGAR submission + company-facts extraction patterns used in
 * open-source research stacks (e.g. TradingAgents SEC pipelines), without copying
 * live "current fundamentals" snapshots into historical evaluation.
 */

import { asUtcInstant, type UtcInstant } from '@solstice/domain';
import type {
  AmendmentKind,
  CompanyFilingObservation,
  CorporateActionObservation,
  FinancialFactObservation,
  FinancialStatementObservation,
  GuidanceObservation,
  SecForm,
  SecFundamentalObservation,
  SegmentObservation,
} from './types.ts';

export type SecEdgarFactRecord = {
  readonly concept: string;
  readonly unit: string;
  readonly valueMinor?: bigint | null;
  readonly numericValue?: number | null;
  readonly periodEnd: string;
  readonly periodStart?: string | null;
};

export type SecEdgarSegmentRecord = {
  readonly segmentId: string;
  readonly label: string;
  readonly concept: string;
  readonly valueMinor: bigint | null;
};

export type SecEdgarGuidanceRecord = {
  readonly metric: string;
  readonly guidanceLowMinor: bigint | null;
  readonly guidanceHighMinor: bigint | null;
  readonly guidanceText: string | null;
};

export type SecEdgarCorporateActionRecord = {
  readonly actionType: string;
  readonly effectiveDate: string | null;
  readonly description: string;
};

export type SecEdgarSubmissionRecord = {
  readonly filingId: string;
  readonly accessionNumber: string;
  readonly form: SecForm;
  readonly filingDate: string;
  readonly acceptedAtUtc: UtcInstant;
  readonly publishedAtUtc: UtcInstant;
  readonly fiscalPeriod: string;
  readonly reportPeriod: string;
  readonly canonicalEntityId: string;
  readonly companyName: string;
  readonly documentUrl: string;
  readonly amendsFilingId?: string | null;
  readonly amendmentKind?: AmendmentKind;
  readonly facts: readonly SecEdgarFactRecord[];
  readonly segments: readonly SecEdgarSegmentRecord[];
  readonly guidance: readonly SecEdgarGuidanceRecord[];
  readonly corporateActions: readonly SecEdgarCorporateActionRecord[];
};

function computeKnowableAt(record: SecEdgarSubmissionRecord): UtcInstant {
  return record.publishedAtUtc > record.acceptedAtUtc ? record.publishedAtUtc : record.acceptedAtUtc;
}

function lineageFor(record: SecEdgarSubmissionRecord): {
  kind: AmendmentKind;
  supersedesFilingId: string | null;
  amendsFilingId: string | null;
  rootFilingId: string;
} {
  const kind = record.amendmentKind ?? (record.form.endsWith('/A') ? 'amendment' : 'original');
  const amendsFilingId = record.amendsFilingId ?? null;
  const rootFilingId = amendsFilingId ?? record.filingId;
  return Object.freeze({
    kind,
    supersedesFilingId: amendsFilingId,
    amendsFilingId,
    rootFilingId,
  });
}

function baseProvenance(record: SecEdgarSubmissionRecord) {
  const knowableAt = computeKnowableAt(record);
  return Object.freeze({
    filingId: record.filingId,
    accessionNumber: record.accessionNumber,
    form: record.form,
    filingDate: record.filingDate,
    acceptedAtUtc: record.acceptedAtUtc,
    publishedAtUtc: record.publishedAtUtc,
    fiscalPeriod: record.fiscalPeriod,
    reportPeriod: record.reportPeriod,
    source: 'sec-edgar:as-filed',
    knowableAt,
    amendmentLineage: lineageFor(record),
    canonicalEntityId: record.canonicalEntityId,
    evidenceRef: `sec-edgar:${record.accessionNumber}`,
  });
}

export function materializeSubmissionObservations(record: SecEdgarSubmissionRecord): readonly SecFundamentalObservation[] {
  const base = baseProvenance(record);
  const out: SecFundamentalObservation[] = [];

  const filingObs: CompanyFilingObservation = Object.freeze({
    ...base,
    observationKind: 'company_filing',
    companyName: record.companyName,
    documentUrl: record.documentUrl,
  });
  out.push(filingObs);

  const statements: FinancialStatementObservation[] = [
    Object.freeze({
      ...base,
      observationKind: 'financial_statement',
      statementRole: 'income',
      currency: 'USD',
    }),
    Object.freeze({
      ...base,
      observationKind: 'financial_statement',
      statementRole: 'balance',
      currency: 'USD',
    }),
    Object.freeze({
      ...base,
      observationKind: 'financial_statement',
      statementRole: 'cash_flow',
      currency: 'USD',
    }),
  ];
  out.push(...statements);

  for (const fact of record.facts) {
    const factId = `${record.filingId}:${fact.concept}:${fact.periodEnd}`;
    const factObs: FinancialFactObservation = Object.freeze({
      ...base,
      observationKind: 'financial_fact',
      concept: fact.concept,
      unit: fact.unit,
      valueMinor: fact.valueMinor ?? null,
      numericValue: fact.numericValue ?? null,
      periodStart: fact.periodStart ?? null,
      periodEnd: fact.periodEnd,
      factId,
    });
    out.push(factObs);
  }

  for (const segment of record.segments) {
    const segmentObs: SegmentObservation = Object.freeze({
      ...base,
      observationKind: 'segment',
      segmentId: segment.segmentId,
      segmentLabel: segment.label,
      metricConcept: segment.concept,
      valueMinor: segment.valueMinor,
    });
    out.push(segmentObs);
  }

  for (const guide of record.guidance) {
    const guideObs: GuidanceObservation = Object.freeze({
      ...base,
      observationKind: 'guidance',
      metric: guide.metric,
      guidanceLowMinor: guide.guidanceLowMinor,
      guidanceHighMinor: guide.guidanceHighMinor,
      guidanceText: guide.guidanceText,
    });
    out.push(guideObs);
  }

  for (const action of record.corporateActions) {
    const actionObs: CorporateActionObservation = Object.freeze({
      ...base,
      observationKind: 'corporate_action',
      actionType: action.actionType,
      effectiveDate: action.effectiveDate,
      description: action.description,
    });
    out.push(actionObs);
  }

  return Object.freeze(out);
}

export function runSecEdgarAsFiledDataflow(
  submissions: readonly SecEdgarSubmissionRecord[],
): readonly SecFundamentalObservation[] {
  const all: SecFundamentalObservation[] = [];
  for (const submission of submissions) {
    all.push(...materializeSubmissionObservations(submission));
  }
  return Object.freeze(all);
}

/** Reject observations whose knowableAt is after the evaluation instant. */
export function filterKnowableObservations<T extends { readonly knowableAt: UtcInstant }>(
  observations: readonly T[],
  evaluationTimeUtc: UtcInstant,
): readonly T[] {
  const evalMs = Date.parse(evaluationTimeUtc);
  if (!Number.isFinite(evalMs)) {
    return Object.freeze([]);
  }
  return Object.freeze(
    observations.filter((obs) => {
      const knowMs = Date.parse(obs.knowableAt);
      return Number.isFinite(knowMs) && knowMs <= evalMs;
    }),
  );
}

export function parseEdgarAcceptanceTimestamp(raw: string): UtcInstant {
  return asUtcInstant(raw);
}
