import type { HeliosMigrationEntry } from './migration-inventory.ts';
import type { RollbackLevel, RollbackState } from './taxonomy.ts';

export type RollbackMatrixEntry = {
  readonly dimension: string;
  readonly previousSupported: string;
  readonly currentRelease: string;
  readonly state: RollbackState;
  readonly level: RollbackLevel;
  readonly limitation: string;
};

export type RollbackMatrix = {
  readonly previousSupportedReleaseId: string;
  readonly currentReleaseId: string;
  readonly entries: readonly RollbackMatrixEntry[];
  readonly overallAppRollback: RollbackState;
  readonly overallDatabaseRollback: RollbackState;
};

function worstState(states: readonly RollbackState[]): RollbackState {
  if (states.includes('MANUAL_REVIEW_REQUIRED')) {
    return 'MANUAL_REVIEW_REQUIRED';
  }
  if (states.includes('DATABASE_RESTORE_REQUIRED')) {
    return 'DATABASE_RESTORE_REQUIRED';
  }
  if (states.includes('FORWARD_FIX_REQUIRED')) {
    return 'FORWARD_FIX_REQUIRED';
  }
  return 'SAFE_APP_ROLLBACK';
}

export function buildRollbackMatrix(input: {
  readonly previousReleaseId: string;
  readonly currentReleaseId: string;
  readonly previousSchemaHead: string;
  readonly currentSchemaHead: string;
  readonly heliosMigrations: readonly HeliosMigrationEntry[];
  readonly apiCompatible: boolean;
}): RollbackMatrix {
  const forwardFixMigrations = input.heliosMigrations.filter(
    (row) => row.rollbackStrategy === 'FORWARD_FIX_ONLY',
  );
  const dbState: RollbackState =
    forwardFixMigrations.length > 0 ? 'FORWARD_FIX_REQUIRED' : 'SAFE_APP_ROLLBACK';

  const appState: RollbackState = input.apiCompatible ? 'SAFE_APP_ROLLBACK' : 'MANUAL_REVIEW_REQUIRED';

  const entries: RollbackMatrixEntry[] = [
    {
      dimension: 'application-artifact',
      previousSupported: input.previousReleaseId,
      currentRelease: input.currentReleaseId,
      state: appState,
      level: 'LEVEL_1_APPLICATION',
      limitation: 'Redeploy prior qualified digest against current schema when compatible',
    },
    {
      dimension: 'configuration-policy',
      previousSupported: 'prior-qualified-config-pack',
      currentRelease: input.currentReleaseId,
      state: 'SAFE_APP_ROLLBACK',
      level: 'LEVEL_2_CONFIGURATION',
      limitation: 'Restore prior provider/model/jurisdiction config references; secrets remain external',
    },
    {
      dimension: 'database-schema',
      previousSupported: input.previousSchemaHead,
      currentRelease: input.currentSchemaHead,
      state: dbState,
      level: 'LEVEL_3_DATABASE',
      limitation:
        forwardFixMigrations.length > 0
          ? `Forward-fix or snapshot restore required for ${forwardFixMigrations.map((row) => row.migrationId).join(', ')}`
          : 'Schema rollback via DOWN migration is not supported; snapshot restore if needed',
    },
    {
      dimension: 'api-openapi',
      previousSupported: 'v1',
      currentRelease: 'v1',
      state: input.apiCompatible ? 'SAFE_APP_ROLLBACK' : 'MANUAL_REVIEW_REQUIRED',
      level: 'LEVEL_1_APPLICATION',
      limitation: 'Breaking API changes require frontend/SDK coordination before rollback',
    },
    {
      dimension: 'provider-state',
      previousSupported: 'simulation-fixture',
      currentRelease: 'simulation-fixture',
      state: 'SAFE_APP_ROLLBACK',
      level: 'LEVEL_2_CONFIGURATION',
      limitation: 'Provider orchestration state is durable; app rollback retains provider records',
    },
  ];

  return Object.freeze({
    previousSupportedReleaseId: input.previousReleaseId,
    currentReleaseId: input.currentReleaseId,
    entries: Object.freeze(entries),
    overallAppRollback: worstState(entries.filter((row) => row.level === 'LEVEL_1_APPLICATION').map((row) => row.state)),
    overallDatabaseRollback: dbState,
  });
}
