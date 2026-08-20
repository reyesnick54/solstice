export const RECOVERY_READINESS = [
  'READY',
  'DEGRADED',
  'RECONCILIATION_REQUIRED',
  'CORRUPT_STATE',
  'SCHEMA_MISMATCH',
  'BACKUP_REQUIRED',
  'MANUAL_REVIEW_REQUIRED',
] as const;
export type RecoveryReadiness = (typeof RECOVERY_READINESS)[number];

export const REHYDRATION_STEPS = [
  'DATABASE_SCHEMA',
  'SECURITY_KEY_METADATA',
  'PROVIDER_CONFIGURATION',
  'IDENTITY_COMPLIANCE',
  'PAYMENT_CUSTODY_EXCHANGE',
  'EVENT_OUTBOX_INBOX',
  'RECONCILIATION_CHECKS',
  'APPLICATION_READY',
] as const;
export type RehydrationStep = (typeof REHYDRATION_STEPS)[number];

export type UnresolvedOperation = {
  readonly domain: 'PAYMENT' | 'CUSTODY' | 'EXCHANGE' | 'OUTBOX' | 'INBOX' | 'PROVIDER';
  readonly id: string;
  readonly reason:
    | 'SUBMISSION_UNKNOWN'
    | 'PENDING_SETTLEMENT'
    | 'IN_FLIGHT_LEASE_EXPIRED'
    | 'INBOX_INTERRUPTED'
    | 'REVALIDATION_PENDING'
    | 'REVOKED_PROVIDER';
  readonly queryBeforeRetry: true;
};

export type RecoveryAuthorityBoundaries = {
  readonly postgresCannotMintSunReyCoin: true;
  readonly postgresCannotMintMoonReyCoin: true;
  readonly postgresCannotMutateAssetSupplyBook: true;
  readonly postgresCannotIssueExecutionAuthority: true;
  readonly postgresCannotReplaceLedgerPostings: true;
  readonly providerStateCannotReplaceKernelDecisions: true;
  readonly postgresIsLedger: false;
  readonly postgresIsNativeSupplyAuthority: false;
};

export type RecoveryIntegrityFinding = {
  readonly code: string;
  readonly failClosed: boolean;
  readonly message: string;
};

export type RecoveryReport = {
  readonly readiness: RecoveryReadiness;
  readonly rehydrationOrder: readonly RehydrationStep[];
  readonly unresolved: readonly UnresolvedOperation[];
  readonly findings: readonly RecoveryIntegrityFinding[];
  readonly authority: RecoveryAuthorityBoundaries;
  readonly rawCredentialPersisted: false;
  readonly realProviderCalled: false;
  readonly productionActive: false;
  readonly jsonIntegrityPass: boolean;
  readonly duplicatePackageKeys: false;
  readonly corruptionFailsClosed: true;
};
