/**
 * Deterministic SIMCORP EDGAR-style fixture timeline for point-in-time tests.
 * Values are synthetic — not live or "current" SEC fundamentals.
 */

import { asUtcInstant, type UtcInstant } from '../../../../domain/src/time.ts';
import type { SecEdgarSubmissionRecord } from '../edgar-dataflow.ts';

export const SIMCORP_CIK = '0000999999';
export const SIMCORP_ENTITY_ID = 'sunrey:company:us:0000999999';
export const SIMCORP_TICKER = 'SIMC';

function submission(input: SecEdgarSubmissionRecord): SecEdgarSubmissionRecord {
  return Object.freeze(input);
}

/** Q2 FY2024 10-Q — knowable when SEC accepts the filing. */
export const SIMCORP_Q2_2024_10Q = submission({
  filingId: 'simcorp-fy2024q2-10q',
  accessionNumber: '0000999999-24-000010',
  form: '10-Q',
  filingDate: '2024-08-01',
  acceptedAtUtc: asUtcInstant('2024-08-01T16:30:00.000Z'),
  publishedAtUtc: asUtcInstant('2024-08-01T16:35:00.000Z'),
  fiscalPeriod: 'FY2024Q2',
  reportPeriod: '2024-06-30',
  canonicalEntityId: SIMCORP_ENTITY_ID,
  companyName: 'SimCorp Industries Inc.',
  documentUrl: 'https://www.sec.gov/Archives/edgar/data/999999/simcorp-20240630.htm',
  facts: Object.freeze([
    { concept: 'us-gaap:Revenues', unit: 'USD', valueMinor: 1_000_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:CostOfGoodsAndServicesSold', unit: 'USD', valueMinor: 400_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:OperatingIncomeLoss', unit: 'USD', valueMinor: 150_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:NetCashProvidedByUsedInOperatingActivities', unit: 'USD', valueMinor: 120_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:PaymentsToAcquirePropertyPlantAndEquipment', unit: 'USD', valueMinor: 30_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:CashAndCashEquivalentsAtCarryingValue', unit: 'USD', valueMinor: 200_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:LongTermDebtNoncurrent', unit: 'USD', valueMinor: 500_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:CommonStockSharesOutstanding', unit: 'shares', numericValue: 100_000_000, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:ShareBasedCompensation', unit: 'USD', valueMinor: 10_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:IncreaseDecreaseInInventories', unit: 'USD', valueMinor: 5_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:InvestedCapital', unit: 'USD', valueMinor: 2_000_000_000_00n, periodEnd: '2024-06-30' },
  ]),
  segments: Object.freeze([
    { segmentId: 'seg-us', label: 'United States', concept: 'us-gaap:Revenues', valueMinor: 700_000_000_00n },
  ]),
  guidance: Object.freeze([]),
  corporateActions: Object.freeze([]),
});

/** Q1 FY2024 10-Q — prior quarter for growth calculations. */
export const SIMCORP_Q1_2024_10Q = submission({
  filingId: 'simcorp-fy2024q1-10q',
  accessionNumber: '0000999999-24-000005',
  form: '10-Q',
  filingDate: '2024-05-01',
  acceptedAtUtc: asUtcInstant('2024-05-01T16:00:00.000Z'),
  publishedAtUtc: asUtcInstant('2024-05-01T16:05:00.000Z'),
  fiscalPeriod: 'FY2024Q1',
  reportPeriod: '2024-03-31',
  canonicalEntityId: SIMCORP_ENTITY_ID,
  companyName: 'SimCorp Industries Inc.',
  documentUrl: 'https://www.sec.gov/Archives/edgar/data/999999/simcorp-20240331.htm',
  facts: Object.freeze([
    { concept: 'us-gaap:Revenues', unit: 'USD', valueMinor: 900_000_000_00n, periodEnd: '2024-03-31' },
  ]),
  segments: Object.freeze([]),
  guidance: Object.freeze([]),
  corporateActions: Object.freeze([]),
});

/** Q2 10-Q/A restatement — amends Q2 revenue; original filing remains in the ledger. */
export const SIMCORP_Q2_2024_10Q_A = submission({
  filingId: 'simcorp-fy2024q2-10q-a',
  accessionNumber: '0000999999-24-000011',
  form: '10-Q/A',
  filingDate: '2024-09-15',
  acceptedAtUtc: asUtcInstant('2024-09-15T18:00:00.000Z'),
  publishedAtUtc: asUtcInstant('2024-09-15T18:05:00.000Z'),
  fiscalPeriod: 'FY2024Q2',
  reportPeriod: '2024-06-30',
  canonicalEntityId: SIMCORP_ENTITY_ID,
  companyName: 'SimCorp Industries Inc.',
  documentUrl: 'https://www.sec.gov/Archives/edgar/data/999999/simcorp-20240630a.htm',
  amendsFilingId: SIMCORP_Q2_2024_10Q.filingId,
  amendmentKind: 'restatement',
  facts: Object.freeze([
    { concept: 'us-gaap:Revenues', unit: 'USD', valueMinor: 980_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:CostOfGoodsAndServicesSold', unit: 'USD', valueMinor: 392_000_000_00n, periodEnd: '2024-06-30' },
    { concept: 'us-gaap:OperatingIncomeLoss', unit: 'USD', valueMinor: 147_000_000_00n, periodEnd: '2024-06-30' },
  ]),
  segments: Object.freeze([]),
  guidance: Object.freeze([]),
  corporateActions: Object.freeze([]),
});

/** Q3 FY2024 10-Q — filed after Q2 restatement; tests no future leakage into Q2 backtest window. */
export const SIMCORP_Q3_2024_10Q = submission({
  filingId: 'simcorp-fy2024q3-10q',
  accessionNumber: '0000999999-24-000015',
  form: '10-Q',
  filingDate: '2024-11-01',
  acceptedAtUtc: asUtcInstant('2024-11-01T16:00:00.000Z'),
  publishedAtUtc: asUtcInstant('2024-11-01T16:10:00.000Z'),
  fiscalPeriod: 'FY2024Q3',
  reportPeriod: '2024-09-30',
  canonicalEntityId: SIMCORP_ENTITY_ID,
  companyName: 'SimCorp Industries Inc.',
  documentUrl: 'https://www.sec.gov/Archives/edgar/data/999999/simcorp-20240930.htm',
  facts: Object.freeze([
    { concept: 'us-gaap:Revenues', unit: 'USD', valueMinor: 1_100_000_000_00n, periodEnd: '2024-09-30' },
  ]),
  segments: Object.freeze([]),
  guidance: Object.freeze([
    {
      metric: 'revenue',
      guidanceLowMinor: 4_000_000_000_00n,
      guidanceHighMinor: 4_100_000_000_00n,
      guidanceText: 'Full-year revenue outlook raised.',
    },
  ]),
  corporateActions: Object.freeze([]),
});

export const SIMCORP_8K_DIVIDEND = submission({
  filingId: 'simcorp-8k-div-2024',
  accessionNumber: '0000999999-24-000020',
  form: '8-K',
  filingDate: '2024-10-05',
  acceptedAtUtc: asUtcInstant('2024-10-05T14:00:00.000Z'),
  publishedAtUtc: asUtcInstant('2024-10-05T14:02:00.000Z'),
  fiscalPeriod: 'FY2024Q3',
  reportPeriod: '2024-10-05',
  canonicalEntityId: SIMCORP_ENTITY_ID,
  companyName: 'SimCorp Industries Inc.',
  documentUrl: 'https://www.sec.gov/Archives/edgar/data/999999/simcorp-8k-div.htm',
  facts: Object.freeze([]),
  segments: Object.freeze([]),
  guidance: Object.freeze([]),
  corporateActions: Object.freeze([
    {
      actionType: 'dividend_declared',
      effectiveDate: '2024-11-15',
      description: 'Quarterly cash dividend of $0.25 per share.',
    },
  ]),
});

export const SIMCORP_SUBMISSION_TIMELINE = Object.freeze([
  SIMCORP_Q1_2024_10Q,
  SIMCORP_Q2_2024_10Q,
  SIMCORP_Q2_2024_10Q_A,
  SIMCORP_Q3_2024_10Q,
  SIMCORP_8K_DIVIDEND,
]);

export function simcorpKnowableAt(filingId: string): UtcInstant | null {
  const row = SIMCORP_SUBMISSION_TIMELINE.find((s) => s.filingId === filingId);
  return row?.acceptedAtUtc ?? null;
}
