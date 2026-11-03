/**
 * Bridge SEC fundamental observations into AAF revision ledger + entity resolution.
 */

import { resolveSecCorporateEntity } from '../../../../economic-awareness-fabric/src/entities/sec-corporate.ts';
import { createAafRevisionLedger, type AafRevisionLedger } from '../../../../economic-awareness-fabric/src/revisions/ledger.ts';
import type { SecFundamentalObservation } from '../../../../external-data/src/sec-fundamentals/types.ts';

export type SecFundamentalAafBinding = {
  readonly ledger: AafRevisionLedger;
  readonly entityResolution: ReturnType<typeof resolveSecCorporateEntity>;
};

export function bindSecObservationsToAaf(input: {
  readonly cik: string;
  readonly ticker?: string | null;
  readonly observations: readonly SecFundamentalObservation[];
}): SecFundamentalAafBinding {
  const entityResolution = resolveSecCorporateEntity({ cik: input.cik, ticker: input.ticker ?? null });
  const ledger = createAafRevisionLedger();
  const seenFilings = new Set<string>();

  for (const obs of input.observations) {
    if (obs.canonicalEntityId !== entityResolution.canonicalEntityId) {
      continue;
    }
    if (seenFilings.has(obs.filingId)) {
      continue;
    }
    seenFilings.add(obs.filingId);
    ledger.append({
      filingId: obs.filingId,
      rootFilingId: obs.amendmentLineage.rootFilingId,
      knowableAtUtc: obs.knowableAt,
      amendmentKind: obs.amendmentLineage.kind,
      supersedesFilingId: obs.amendmentLineage.supersedesFilingId,
      evidenceRef: obs.evidenceRef,
      payloadMaterial: Object.freeze([
        obs.filingId,
        obs.form,
        obs.fiscalPeriod,
        obs.reportPeriod,
        obs.evidenceRef,
      ]),
    });
  }

  return Object.freeze({ ledger, entityResolution });
}
