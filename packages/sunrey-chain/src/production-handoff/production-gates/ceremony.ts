import { currentRepositoryGateSnapshot } from './evaluate.ts';
import type { CeremonyItemStatus, ProductionGateSnapshot } from './types.ts';

export type CeremonyChecklistItem = {
  readonly id: string;
  readonly label: string;
  readonly status: CeremonyItemStatus;
  readonly notes: string;
};

export type LaunchCeremonyChecklist = {
  readonly schema: 'sunrey.launch.ceremony.checklist.v1';
  readonly prepared: true;
  readonly executed: false;
  readonly productionActivated: false;
  readonly releaseDecision: ProductionGateSnapshot['releaseDecision'];
  readonly items: readonly CeremonyChecklistItem[];
};

function item(id: string, label: string, status: CeremonyItemStatus, notes: string): CeremonyChecklistItem {
  return Object.freeze({ id, label, status, notes });
}

export function prepareLaunchCeremonyChecklist(
  snapshot: ProductionGateSnapshot = currentRepositoryGateSnapshot(),
): LaunchCeremonyChecklist {
  const blocked = snapshot.releaseDecision === 'BLOCKED' ? 'BLOCKED_MISSING_INPUT' : 'PREPARED_NOT_EXECUTED';
  return Object.freeze({
    schema: 'sunrey.launch.ceremony.checklist.v1',
    prepared: true,
    executed: false,
    productionActivated: false,
    releaseDecision: snapshot.releaseDecision,
    items: Object.freeze([
      item('release-artifact', 'Release artifact', 'PREPARED_NOT_EXECUTED', 'Build and pin the release artifact. Do not execute the ceremony.'),
      item('config-hash', 'Config hash', 'PREPARED_NOT_EXECUTED', `Gate registry hash ${snapshot.registryHash}. Bind the exact hash at ceremony time.`),
      item('gate-report', 'Gate report', blocked, `Current decision ${snapshot.releaseDecision}. Missing external gates fail closed.`),
      item('human-signoffs', 'Human signoffs', 'BLOCKED_MISSING_INPUT', 'Real human governance signatures are absent. Fixture acceptances do not count.'),
      item('hsm-status', 'HSM status', 'BLOCKED_MISSING_INPUT', 'Development HSM simulator is not a launch key.'),
      item('provider-status', 'Provider status', 'BLOCKED_MISSING_INPUT', 'No production provider is certified or connected.'),
      item('database-status', 'Database status', 'PREPARED_NOT_EXECUTED', 'Migrations and recovery fixtures exist. Production restore evidence is absent.'),
      item('rollback', 'Rollback plan', 'PREPARED_NOT_EXECUTED', 'Application rollback is not chain-history rollback. Rollback exercise evidence is absent.'),
      item('communications', 'Communications plan', 'PREPARED_NOT_EXECUTED', 'Communications remain unapproved. Not executed.'),
      item('monitoring', 'Monitoring', 'BLOCKED_MISSING_INPUT', 'Monitoring catalogs exist; staffed on-call does not.'),
      item('limited-live-cohort', 'Limited-live cohort', 'BLOCKED_MISSING_INPUT', 'Cohort authorization is a human governance record.'),
      item('kill-switches', 'Kill switches', 'PREPARED_NOT_EXECUTED', 'Software kill switches exist. Production enablement is not authorized.'),
    ]),
  });
}
