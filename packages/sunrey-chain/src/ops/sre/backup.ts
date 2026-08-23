import { BACKUP_CLASSES, SLO_LABEL } from '../types.ts';
import { backupRecoveryStrategies } from '../backup.ts';
import { ENGINEERING_TARGET_LABEL, type BackupClaimState } from './types.ts';

export type BackupSchedule = {
  readonly backupClass: (typeof BACKUP_CLASSES)[number];
  readonly cadence: string;
  readonly encryption: 'BACKUP_ENCRYPTION' | 'NONE';
  readonly retention: string;
  readonly integrityVerification: true;
  readonly restoreTestingRequired: true;
  readonly claimState: BackupClaimState;
};

export type ObjectStorageBackupPolicy = {
  readonly plane: 'EVIDENCE' | 'PDV_OBJECT' | 'BACKUP_OBJECT';
  readonly versioning: true;
  readonly retention: string;
  readonly encryption: 'BACKUP_ENCRYPTION';
  readonly restoreDefined: true;
  readonly secretsCopiedIntoOrdinaryArchive: false;
};

export type ConfigurationBackupPolicy = {
  readonly includesInfrastructureConfig: true;
  readonly includesNonSecretApplicationConfig: true;
  readonly includesPolicyVersions: true;
  readonly includesEconomicPolicyFiles: true;
  readonly includesProviderMetadata: true;
  readonly secretsRestoredViaSecretSystem: true;
  readonly ordinaryArchiveContainsSecrets: false;
};

export function backupSchedules(): readonly BackupSchedule[] {
  return Object.freeze([
    schedule('POSTGRES_APPLICATION_DATA', 'PT1H', 'BACKUP_ENCRYPTION', 'P35D'),
    schedule('CONSENSUS_WAL', 'PT15M', 'NONE', 'P7D'),
    schedule('BLOCKCHAIN_STATE', 'PT1H', 'NONE', 'P35D'),
    schedule('SIGNER_SAFETY', 'PT15M', 'BACKUP_ENCRYPTION', 'P35D'),
    schedule('VALIDATOR_CONFIGURATION', 'P1D', 'NONE', 'P90D'),
    schedule('EXPLORER_INDEX', 'P1D', 'NONE', 'P7D'),
    schedule('CUSTODY_METADATA', 'PT1H', 'BACKUP_ENCRYPTION', 'P35D'),
    schedule('ENCRYPTED_CONFIGURATION', 'P1D', 'BACKUP_ENCRYPTION', 'P90D'),
  ]);
}

export function objectStorageBackupPolicies(): readonly ObjectStorageBackupPolicy[] {
  return Object.freeze([
    policy('EVIDENCE', 'P2555D'),
    policy('PDV_OBJECT', 'P2555D'),
    policy('BACKUP_OBJECT', 'P35D'),
  ]);
}

export function configurationBackupPolicy(): ConfigurationBackupPolicy {
  return Object.freeze({
    includesInfrastructureConfig: true,
    includesNonSecretApplicationConfig: true,
    includesPolicyVersions: true,
    includesEconomicPolicyFiles: true,
    includesProviderMetadata: true,
    secretsRestoredViaSecretSystem: true,
    ordinaryArchiveContainsSecrets: false,
  });
}

export function backupClaim(state: BackupClaimState): { readonly works: boolean; readonly label: typeof ENGINEERING_TARGET_LABEL } {
  return Object.freeze({
    works: state === 'RESTORE_TESTED',
    label: ENGINEERING_TARGET_LABEL,
  });
}

export function backupCatalogAligned(): boolean {
  return backupSchedules().length === BACKUP_CLASSES.length && backupRecoveryStrategies().length === BACKUP_CLASSES.length;
}

export const BACKUP_ENGINEERING_LABEL = SLO_LABEL;

function schedule(
  backupClass: BackupSchedule['backupClass'],
  cadence: string,
  encryption: BackupSchedule['encryption'],
  retention: string,
): BackupSchedule {
  return Object.freeze({
    backupClass,
    cadence,
    encryption,
    retention,
    integrityVerification: true,
    restoreTestingRequired: true,
    claimState: 'CONFIGURED_UNTESTED',
  });
}

function policy(plane: ObjectStorageBackupPolicy['plane'], retention: string): ObjectStorageBackupPolicy {
  return Object.freeze({
    plane,
    versioning: true,
    retention,
    encryption: 'BACKUP_ENCRYPTION',
    restoreDefined: true,
    secretsCopiedIntoOrdinaryArchive: false,
  });
}
