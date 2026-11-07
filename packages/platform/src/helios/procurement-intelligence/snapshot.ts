/**
 * Compile point-in-time GovernmentDemandState from sealed observations.
 */

import type { UtcInstant } from '@solstice/domain';
import type { ProcurementExternalObservation } from '@solstice/external-data';

import { assertProcurementAttributionIntegrity } from './attribution-guard.ts';
import { filterKnowableProcurementObservations } from './knowable-at.ts';
import type { CompileGovernmentDemandSnapshotInput, GovernmentDemandState } from './types.ts';
import { HELIOS_PROCUREMENT_DEMAND_SCHEMA } from './taxonomy.ts';
import type { ProcurementIntelligenceStore } from './store.ts';

function withinLookback(decisionMs: number, knowableMs: number, lookbackDays: number): boolean {
  const windowMs = lookbackDays * 86_400_000;
  return decisionMs - knowableMs <= windowMs;
}

export function compileGovernmentDemandState(
  store: ProcurementIntelligenceStore,
  input: CompileGovernmentDemandSnapshotInput,
): GovernmentDemandState | null {
  const decisionMs = Date.parse(input.decisionTimeUtc);
  const lookbackDays = input.lookbackDays ?? 3650;
  const knowable = filterKnowableProcurementObservations(
    input.decisionTimeUtc,
    store.list(),
  ).filter(
    (row) =>
      row.attributionEntityId === input.attributionEntityId &&
      withinLookback(decisionMs, Date.parse(row.provenance.knowableAt), lookbackDays) &&
      assertProcurementAttributionIntegrity(row),
  );

  if (knowable.length === 0) {
    return null;
  }

  const awards = knowable.filter((row) => row.artifactKind === 'PROCUREMENT_AWARD' && row.award && !row.award.cancelled);
  const obligations = knowable.filter((row) => row.artifactKind === 'PROCUREMENT_OBLIGATION' && row.obligation);
  const modifications = knowable.filter((row) => row.artifactKind === 'PROCUREMENT_MODIFICATION' && row.modification);
  const cancellations = modifications.filter((row) => row.modification?.cancellation);
  const backlog = knowable
    .filter((row) => row.artifactKind === 'PROCUREMENT_BACKLOG_ESTIMATE' && row.backlogEstimate)
    .sort((a, b) => Date.parse(b.provenance.knowableAt) - Date.parse(a.provenance.knowableAt))[0];

  let totalAwardCeilingMinor = 0n;
  const agencyExposure: Record<string, bigint> = {};
  const programExposure: Record<string, bigint> = {};
  const currency = awards[0]?.award?.awardCeiling.currency ?? 'USD';

  for (const row of awards) {
    const award = row.award!;
    totalAwardCeilingMinor += award.awardCeiling.amountMinor;
    agencyExposure[award.agency] = (agencyExposure[award.agency] ?? 0n) + award.awardCeiling.amountMinor;
    const programKey = award.program ?? '_unspecified';
    programExposure[programKey] = (programExposure[programKey] ?? 0n) + award.awardCeiling.amountMinor;
    for (const mod of modifications) {
      if (mod.modification?.awardId === award.awardId && mod.modification.deltaCeilingMinor) {
        totalAwardCeilingMinor += mod.modification.deltaCeilingMinor;
        agencyExposure[award.agency] =
          (agencyExposure[award.agency] ?? 0n) + mod.modification.deltaCeilingMinor;
        programExposure[programKey] =
          (programExposure[programKey] ?? 0n) + mod.modification.deltaCeilingMinor;
      }
    }
  }

  let totalObligatedMinor = 0n;
  let totalPaidMinor = 0n;
  for (const row of obligations) {
    const obl = row.obligation!;
    totalObligatedMinor += obl.obligatedValue.amountMinor;
    if (obl.paidValue) {
      totalPaidMinor += obl.paidValue.amountMinor;
    }
  }

  return Object.freeze({
    schema: HELIOS_PROCUREMENT_DEMAND_SCHEMA,
    decisionTimeUtc: input.decisionTimeUtc,
    attributionEntityId: input.attributionEntityId,
    activeAwardCount: awards.length,
    totalAwardCeilingMinor,
    totalObligatedMinor,
    totalPaidMinor,
    agencyExposure: Object.freeze({ ...agencyExposure }),
    programExposure: Object.freeze({ ...programExposure }),
    modificationCount: modifications.length,
    cancellationCount: cancellations.length,
    backlogRemainingCeilingMinor: backlog?.backlogEstimate?.remainingCeilingMinor ?? null,
    backlogRemainingObligationMinor: backlog?.backlogEstimate?.remainingObligationMinor ?? null,
    currency,
    observations: knowable,
    grantsExecutionAuthority: false as const,
  });
}
