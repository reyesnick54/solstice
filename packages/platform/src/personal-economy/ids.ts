import type { UtcInstant } from '../../../domain/src/time.ts';

export type PersonalEconomySnapshotId = `pes_${string}`;
export type PersonalEconomyPlanId = `pep_${string}`;
export type PersonalEconomyProposalId = `pepr_${string}`;
export type PersonalEconomyScenarioId = `pesc_${string}`;
export type PersonalEconomyObjectiveVersion = `peov_${string}`;

export function deterministicSnapshotId(subjectId: string, at: UtcInstant): PersonalEconomySnapshotId {
  const stamp = at.replace(/[:.TZ-]/g, '');
  return `pes_${subjectId}_${stamp}` as PersonalEconomySnapshotId;
}

export function deterministicPlanId(subjectId: string, at: UtcInstant): PersonalEconomyPlanId {
  const stamp = at.replace(/[:.TZ-]/g, '');
  return `pep_${subjectId}_${stamp}` as PersonalEconomyPlanId;
}

export function deterministicProposalId(subjectId: string, kind: string, at: UtcInstant): PersonalEconomyProposalId {
  const stamp = at.replace(/[:.TZ-]/g, '');
  return `pepr_${subjectId}_${kind}_${stamp}` as PersonalEconomyProposalId;
}

export function deterministicScenarioId(subjectId: string, scenarioKind: string, at: UtcInstant): PersonalEconomyScenarioId {
  const stamp = at.replace(/[:.TZ-]/g, '');
  return `pesc_${subjectId}_${scenarioKind}_${stamp}` as PersonalEconomyScenarioId;
}

export function objectiveVersionFor(subjectId: string, version: number): PersonalEconomyObjectiveVersion {
  return `peov_${subjectId}_v${version}` as PersonalEconomyObjectiveVersion;
}
