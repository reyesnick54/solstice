/**
 * Canonical earnings event identity — binds entity, fiscal year/quarter, and report period.
 */

import { createHash } from 'node:crypto';

import type { EarningsFiscalIdentity } from './types.ts';

export function earningsEventKey(input: {
  readonly canonicalEntityId: string;
  readonly fiscal: EarningsFiscalIdentity;
}): string {
  const material = [
    input.canonicalEntityId,
    String(input.fiscal.fiscalYear),
    input.fiscal.fiscalQuarter === null ? 'FY' : `Q${input.fiscal.fiscalQuarter}`,
    input.fiscal.reportPeriod,
  ].join('|');
  const digest = createHash('sha256').update(material).digest('hex').slice(0, 16);
  return `earn:${digest}`;
}

export function parseFiscalPeriodLabel(label: string): EarningsFiscalIdentity {
  const fyMatch = /^FY(\d{4})Q([1-4])$/i.exec(label.trim());
  if (fyMatch) {
    const year = Number(fyMatch[1]);
    const quarter = Number(fyMatch[2]) as 1 | 2 | 3 | 4;
    return Object.freeze({
      fiscalYear: year,
      fiscalQuarter: quarter,
      reportPeriod: inferReportPeriodEnd(year, quarter),
      fiscalPeriodLabel: `FY${year}Q${quarter}`,
    });
  }
  const annualMatch = /^FY(\d{4})$/i.exec(label.trim());
  if (annualMatch) {
    const year = Number(annualMatch[1]);
    return Object.freeze({
      fiscalYear: year,
      fiscalQuarter: null,
      reportPeriod: `${year}-12-31`,
      fiscalPeriodLabel: `FY${year}`,
    });
  }
  throw new Error(`EARNINGS_FISCAL_LABEL_UNPARSEABLE:${label}`);
}

function inferReportPeriodEnd(fiscalYear: number, quarter: 1 | 2 | 3 | 4): string {
  const monthByQuarter: Record<1 | 2 | 3 | 4, string> = {
    1: '03-31',
    2: '06-30',
    3: '09-30',
    4: '12-31',
  };
  return `${fiscalYear}-${monthByQuarter[quarter]}`;
}
