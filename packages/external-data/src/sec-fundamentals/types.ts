/**
 * HELIOS OS10 — SEC / EDGAR point-in-time fundamental observation types.
 * Observations only; no execution authority or ledger mutation.
 */

import type { UtcInstant } from '@solstice/domain';

export const SEC_FUNDAMENTAL_OBSERVATION_SCHEMA = 'sunrey.external.sec-fundamental-observation.v1' as const;

export const SEC_FORMS = ['10-K', '10-Q', '8-K', '10-K/A', '10-Q/A', '8-K/A'] as const;
export type SecForm = (typeof SEC_FORMS)[number];

export const AMENDMENT_KINDS = ['original', 'amendment', 'restatement'] as const;
export type AmendmentKind = (typeof AMENDMENT_KINDS)[number];

/** Shared provenance for every fundamental observation envelope. */
export type FundamentalObservationProvenance = {
  readonly filingId: string;
  readonly accessionNumber: string | null;
  readonly form: SecForm;
  readonly filingDate: string;
  readonly acceptedAtUtc: UtcInstant | null;
  readonly publishedAtUtc: UtcInstant | null;
  readonly fiscalPeriod: string;
  readonly reportPeriod: string;
  readonly source: string;
  readonly knowableAt: UtcInstant;
  readonly amendmentLineage: AmendmentLineage;
  readonly canonicalEntityId: string;
  readonly evidenceRef: string;
};

export type AmendmentLineage = {
  readonly kind: AmendmentKind;
  readonly supersedesFilingId: string | null;
  readonly amendsFilingId: string | null;
  readonly rootFilingId: string;
};

export type CompanyFilingObservation = FundamentalObservationProvenance & {
  readonly observationKind: 'company_filing';
  readonly companyName: string;
  readonly documentUrl: string | null;
};

export type FinancialStatementObservation = FundamentalObservationProvenance & {
  readonly observationKind: 'financial_statement';
  readonly statementRole: 'income' | 'balance' | 'cash_flow' | 'equity' | 'comprehensive_income';
  readonly currency: string;
};

export type FinancialFactObservation = FundamentalObservationProvenance & {
  readonly observationKind: 'financial_fact';
  readonly concept: string;
  readonly unit: string;
  readonly valueMinor: bigint | null;
  readonly numericValue: number | null;
  readonly periodStart: string | null;
  readonly periodEnd: string;
  readonly factId: string;
};

export type SegmentObservation = FundamentalObservationProvenance & {
  readonly observationKind: 'segment';
  readonly segmentId: string;
  readonly segmentLabel: string;
  readonly metricConcept: string;
  readonly valueMinor: bigint | null;
};

export type GuidanceObservation = FundamentalObservationProvenance & {
  readonly observationKind: 'guidance';
  readonly metric: string;
  readonly guidanceLowMinor: bigint | null;
  readonly guidanceHighMinor: bigint | null;
  readonly guidanceText: string | null;
};

export type CorporateActionObservation = FundamentalObservationProvenance & {
  readonly observationKind: 'corporate_action';
  readonly actionType: string;
  readonly effectiveDate: string | null;
  readonly description: string;
};

export type SecFundamentalObservation =
  | CompanyFilingObservation
  | FinancialStatementObservation
  | FinancialFactObservation
  | SegmentObservation
  | GuidanceObservation
  | CorporateActionObservation;

export type SecFundamentalObservationKind = SecFundamentalObservation['observationKind'];
