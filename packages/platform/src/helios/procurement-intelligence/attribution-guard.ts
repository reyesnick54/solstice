/**
 * Enforces JV / subsidiary attribution boundaries (no automatic parent rollup).
 */

import { assertNoParentRollupForJointVenture } from '@solstice/external-data';
import type { ProcurementExternalObservation } from '@solstice/external-data';

export function assertProcurementAttributionIntegrity(observation: ProcurementExternalObservation): boolean {
  const award = observation.award;
  if (!award) {
    return true;
  }
  if (observation.attributionEntityId !== award.attribution.attributionEntityId) {
    return false;
  }
  if (award.attribution.rollsUpToParent !== false) {
    return false;
  }
  return assertNoParentRollupForJointVenture({
    counterparty: award.attribution.counterpartyBinding,
    attributionEntityId: award.attribution.attributionEntityId,
  });
}

export function sumAwardCeilingForEntity(
  observations: readonly ProcurementExternalObservation[],
  attributionEntityId: string,
): bigint {
  let total = 0n;
  for (const row of observations) {
    if (row.artifactKind !== 'PROCUREMENT_AWARD' || !row.award || row.award.cancelled) {
      continue;
    }
    if (row.attributionEntityId !== attributionEntityId) {
      continue;
    }
    if (!assertProcurementAttributionIntegrity(row)) {
      continue;
    }
    total += row.award.awardCeiling.amountMinor;
    for (const mod of observations) {
      if (mod.artifactKind !== 'PROCUREMENT_MODIFICATION' || !mod.modification) {
        continue;
      }
      if (mod.modification.awardId !== row.award.awardId || mod.modification.cancellation) {
        continue;
      }
      if (mod.modification.deltaCeilingMinor !== null) {
        total += mod.modification.deltaCeilingMinor;
      }
    }
  }
  return total;
}

/** Parent company views must not inherit JV award ceilings implicitly. */
export function parentDoesNotInheritJvCeiling(input: {
  readonly parentEntityId: string;
  readonly jointVentureEntityId: string;
  readonly observations: readonly ProcurementExternalObservation[];
}): boolean {
  const parentCeiling = sumAwardCeilingForEntity(input.observations, input.parentEntityId);
  const jvCeiling = sumAwardCeilingForEntity(input.observations, input.jointVentureEntityId);
  if (jvCeiling === 0n) {
    return true;
  }
  return parentCeiling < jvCeiling;
}
