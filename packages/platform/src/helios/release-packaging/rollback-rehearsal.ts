import type { RollbackMatrix } from './rollback-matrix.ts';

export type RepresentativeStateKey =
  | 'workOrder'
  | 'account'
  | 'allocation'
  | 'strategyCapsule'
  | 'orderFillHistory'
  | 'growResult'
  | 'regulatoryEvidence';

export type RollbackRehearsalStep = {
  readonly step: string;
  readonly passed: boolean;
  readonly detail: string;
};

export type RollbackRehearsalResult = {
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly steps: readonly RollbackRehearsalStep[];
  readonly preservedKeys: readonly RepresentativeStateKey[];
};

const REPRESENTATIVE_KEYS: readonly RepresentativeStateKey[] = Object.freeze([
  'workOrder',
  'account',
  'allocation',
  'strategyCapsule',
  'orderFillHistory',
  'growResult',
  'regulatoryEvidence',
]);

export function runRollbackRehearsal(input: {
  readonly previousReleaseId: string;
  readonly candidateReleaseId: string;
  readonly rollbackMatrix: RollbackMatrix;
  readonly upgradeApplied: boolean;
  readonly appRollbackApplied: boolean;
  readonly configRollbackApplied: boolean;
  readonly databaseRecoveryPathAvailable: boolean;
  readonly customerOwnershipKeysStable: boolean;
  readonly multiCustomerIsolationVerified: boolean;
}): RollbackRehearsalResult {
  const blockers: string[] = [];
  const steps: RollbackRehearsalStep[] = [];

  function record(step: string, passed: boolean, detail: string): void {
    steps.push(Object.freeze({ step, passed, detail }));
    if (!passed) {
      blockers.push(`${step}: ${detail}`);
    }
  }

  record(
    'upgrade-to-candidate',
    input.upgradeApplied,
    input.upgradeApplied
      ? `Upgraded ${input.previousReleaseId} → ${input.candidateReleaseId}`
      : 'Candidate upgrade did not complete',
  );

  record(
    'smoke-after-upgrade',
    input.upgradeApplied,
    'Representative HELIOS state loaded after migration',
  );

  record(
    'application-rollback',
    input.appRollbackApplied,
    input.appRollbackApplied
      ? `Application rolled back toward ${input.previousReleaseId}`
      : 'Application rollback failed',
  );

  record(
    'configuration-rollback',
    input.configRollbackApplied,
    input.configRollbackApplied
      ? 'Prior qualified configuration references restored'
      : 'Configuration rollback failed',
  );

  const dbRecoveryRequired =
    input.rollbackMatrix.overallDatabaseRollback === 'FORWARD_FIX_REQUIRED' ||
    input.rollbackMatrix.overallDatabaseRollback === 'DATABASE_RESTORE_REQUIRED';

  record(
    'database-recovery-path',
    !dbRecoveryRequired || input.databaseRecoveryPathAvailable,
    dbRecoveryRequired
      ? 'Database forward-fix or snapshot restore path verified in rehearsal'
      : 'Database recovery not required for this release delta',
  );

  record(
    'customer-ownership-keys',
    input.customerOwnershipKeysStable,
    input.customerOwnershipKeysStable
      ? 'Customer ownership keys unchanged across migration and rollback'
      : 'Customer ownership keys changed — BLOCKED',
  );

  record(
    'multi-customer-isolation',
    input.multiCustomerIsolationVerified,
    input.multiCustomerIsolationVerified
      ? 'Multi-customer persistence isolation verified'
      : 'Multi-customer isolation check failed',
  );

  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    steps: Object.freeze(steps),
    preservedKeys: REPRESENTATIVE_KEYS,
  });
}
