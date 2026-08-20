import type { RecoveryAuthorityBoundaries } from './types.ts';

export const RECOVERY_AUTHORITY: RecoveryAuthorityBoundaries = Object.freeze({
  postgresCannotMintSunReyCoin: true,
  postgresCannotMintMoonReyCoin: true,
  postgresCannotMutateAssetSupplyBook: true,
  postgresCannotIssueExecutionAuthority: true,
  postgresCannotReplaceLedgerPostings: true,
  providerStateCannotReplaceKernelDecisions: true,
  postgresIsLedger: false,
  postgresIsNativeSupplyAuthority: false,
});

export function assertDatabaseAuthorityBoundaries(boundaries: RecoveryAuthorityBoundaries): void {
  if (
    boundaries.postgresIsLedger ||
    boundaries.postgresIsNativeSupplyAuthority ||
    !boundaries.postgresCannotMintSunReyCoin ||
    !boundaries.postgresCannotMintMoonReyCoin ||
    !boundaries.postgresCannotMutateAssetSupplyBook ||
    !boundaries.postgresCannotIssueExecutionAuthority ||
    !boundaries.postgresCannotReplaceLedgerPostings ||
    !boundaries.providerStateCannotReplaceKernelDecisions
  ) {
    throw new Error('PostgreSQL operational state must not assume ledger or supply authority');
  }
}
