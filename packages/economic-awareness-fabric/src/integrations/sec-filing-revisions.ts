/**
 * Bind SEC filing observations into the AAF revision ledger (append-only).
 */

import { resolveSecCorporateEntity } from '../entities/sec-corporate.ts';
import { createAafRevisionLedger, type AafRevisionLedger } from '../revisions/ledger.ts';

export type SecFilingRevisionSource = {
  readonly filingId: string;
  readonly form: string;
  readonly fiscalPeriod: string;
  readonly reportPeriod: string;
  readonly knowableAtUtc: string;
  readonly amendmentKind: 'original' | 'amendment' | 'restatement';
  readonly supersedesFilingId: string | null;
  readonly rootFilingId: string;
  readonly evidenceRef: string;
  readonly canonicalEntityId: string;
};

export type SecFilingAafBinding = {
  readonly ledger: AafRevisionLedger;
  readonly entityResolution: ReturnType<typeof resolveSecCorporateEntity>;
};

export function bindSecFilingsToAafRevisionLedger(input: {
  readonly cik: string;
  readonly ticker?: string | null;
  readonly filings: readonly SecFilingRevisionSource[];
}): SecFilingAafBinding {
  const entityResolution = resolveSecCorporateEntity({ cik: input.cik, ticker: input.ticker ?? null });
  const ledger = createAafRevisionLedger();
  const seen = new Set<string>();

  for (const filing of input.filings) {
    if (filing.canonicalEntityId !== entityResolution.canonicalEntityId) {
      continue;
    }
    if (seen.has(filing.filingId)) {
      continue;
    }
    seen.add(filing.filingId);
    ledger.append({
      filingId: filing.filingId,
      rootFilingId: filing.rootFilingId,
      knowableAtUtc: filing.knowableAtUtc,
      amendmentKind: filing.amendmentKind,
      supersedesFilingId: filing.supersedesFilingId,
      evidenceRef: filing.evidenceRef,
      payloadMaterial: Object.freeze([
        filing.filingId,
        filing.form,
        filing.fiscalPeriod,
        filing.reportPeriod,
        filing.evidenceRef,
      ]),
    });
  }

  return Object.freeze({ ledger, entityResolution });
}
