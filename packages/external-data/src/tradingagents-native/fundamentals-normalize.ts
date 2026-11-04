/**
 * Fundamentals line normalization (concept tags aligned with SEC EDGAR as-filed patterns).
 */

import type { UtcInstant } from '@solstice/domain';
import type { NormalizedStatementLine } from './types.ts';

export const STATEMENT_LINE_MAP = Object.freeze({
  balance_sheet: Object.freeze([
    Object.freeze({ label: 'Total Assets', conceptTags: Object.freeze(['Assets']) }),
    Object.freeze({ label: 'Cash and Equivalents', conceptTags: Object.freeze(['CashAndCashEquivalentsAtCarryingValue']) }),
    Object.freeze({ label: 'Stockholders Equity', conceptTags: Object.freeze(['StockholdersEquity']) }),
  ]),
  income_statement: Object.freeze([
    Object.freeze({
      label: 'Revenue',
      conceptTags: Object.freeze(['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet']),
    }),
    Object.freeze({ label: 'Net Income', conceptTags: Object.freeze(['NetIncomeLoss']) }),
  ]),
  cashflow: Object.freeze([
    Object.freeze({
      label: 'Operating Cash Flow',
      conceptTags: Object.freeze(['NetCashProvidedByUsedInOperatingActivities']),
    }),
  ]),
} as const);

export type RawFactRow = {
  readonly concept: string;
  readonly valueMinor: bigint | null;
  readonly periodEnd: string;
  readonly filingId: string;
  readonly knowableAt: UtcInstant;
};

export function normalizeStatementLines(
  statementRole: keyof typeof STATEMENT_LINE_MAP,
  facts: readonly RawFactRow[],
): readonly NormalizedStatementLine[] {
  const spec = STATEMENT_LINE_MAP[statementRole];
  const out: NormalizedStatementLine[] = [];
  for (const line of spec) {
    const match = facts.find((fact) => line.conceptTags.some((tag) => fact.concept.endsWith(tag) || fact.concept.includes(tag)));
    if (!match) continue;
    out.push(
      Object.freeze({
        label: line.label,
        conceptTags: line.conceptTags,
        valueMinor: match.valueMinor,
        periodEnd: match.periodEnd,
        filingId: match.filingId,
        knowableAt: match.knowableAt,
      }),
    );
  }
  return Object.freeze(out);
}
