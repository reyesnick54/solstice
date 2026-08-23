import { databaseStatus, databaseRestoreTest } from '../database.ts';
import { ENGINEERING_TARGET_LABEL } from './types.ts';

export type PitrEngineeringTarget = {
  readonly component: 'POSTGRES_APPLICATION_DATA';
  readonly mode: 'LOCAL_WAL_ARCHIVE';
  readonly managedCloudPitrClaimed: false;
  readonly targetRpoMs: bigint;
  readonly targetRtoMs: bigint;
  readonly label: typeof ENGINEERING_TARGET_LABEL;
  readonly humanApproved: false;
};

export function pitrEngineeringTarget(): PitrEngineeringTarget {
  const status = databaseStatus();
  return Object.freeze({
    component: 'POSTGRES_APPLICATION_DATA',
    mode: status.pitr,
    managedCloudPitrClaimed: status.managedPitrClaimed,
    targetRpoMs: 120_000n,
    targetRtoMs: 600_000n,
    label: ENGINEERING_TARGET_LABEL,
    humanApproved: false,
  });
}

export function pitrConfigured(): boolean {
  const target = pitrEngineeringTarget();
  return target.mode === 'LOCAL_WAL_ARCHIVE' && target.managedCloudPitrClaimed === false;
}

export function pitrRestoreProbe(): boolean {
  const result = databaseRestoreTest();
  return result.ok && result.value.postgres && result.value.managedPitrClaimed === false;
}
