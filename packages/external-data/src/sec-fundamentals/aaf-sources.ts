/**
 * Map SEC observations to AAF revision ledger inputs (orchestration layer).
 */

import type { SecFundamentalObservation } from './types.ts';

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

export function mapSecObservationsToAafFilingSources(
  observations: readonly SecFundamentalObservation[],
): readonly SecFilingRevisionSource[] {
  const byFiling = new Map<string, SecFilingRevisionSource>();
  for (const obs of observations) {
    if (obs.observationKind !== 'company_filing') {
      continue;
    }
    if (byFiling.has(obs.filingId)) {
      continue;
    }
    byFiling.set(
      obs.filingId,
      Object.freeze({
        filingId: obs.filingId,
        form: obs.form,
        fiscalPeriod: obs.fiscalPeriod,
        reportPeriod: obs.reportPeriod,
        knowableAtUtc: obs.knowableAt,
        amendmentKind: obs.amendmentLineage.kind,
        supersedesFilingId: obs.amendmentLineage.supersedesFilingId,
        rootFilingId: obs.amendmentLineage.rootFilingId,
        evidenceRef: obs.evidenceRef,
        canonicalEntityId: obs.canonicalEntityId,
      }),
    );
  }
  return Object.freeze([...byFiling.values()]);
}
