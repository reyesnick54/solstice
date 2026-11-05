/**
 * HEALTH08 — HELIOS restart, backup, and disaster-recovery qualification markers.
 * Engineering CI measurements only — not production RPO/RTO claims.
 */

export const HEALTH08_PROGRAM = 'HELIOS_HARDENING_HEALTH08' as const;

export const HELIOS_RESTART_RECOVERY_QUALIFIED = 'HELIOS_RESTART_RECOVERY_QUALIFIED' as const;
export const HELIOS_RESTART_RECOVERY_BLOCKED = 'HELIOS_RESTART_RECOVERY_BLOCKED' as const;

export type HeliosRestartRecoveryMarker =
  | typeof HELIOS_RESTART_RECOVERY_QUALIFIED
  | typeof HELIOS_RESTART_RECOVERY_BLOCKED;

export type HeliosDrHarnessStepId =
  | 'clean_database_creation'
  | 'migrations'
  | 'helios_state_write'
  | 'market_observations'
  | 'feature_fabric_observations'
  | 'strategy_lab_state'
  | 'evidence_vault_records'
  | 'order_fill_reconciliation_state'
  | 'backup'
  | 'destructive_database_loss'
  | 'restore'
  | 'service_restart'
  | 'state_rehydration'
  | 'reconciliation'
  | 'deterministic_continuation';

export type HeliosDrFailureModeId =
  | 'database_unavailable'
  | 'connection_interruption'
  | 'backup_corruption'
  | 'partial_restore'
  | 'migration_mismatch'
  | 'restart_during_work_order'
  | 'restart_during_paper_order'
  | 'restart_during_evidence_sealing';

export type HeliosDrStepResult = Readonly<{
  stepId: HeliosDrHarnessStepId;
  pass: boolean;
  detail: string;
  durationMs: number;
}>;

export type HeliosDrFailureModeResult = Readonly<{
  modeId: HeliosDrFailureModeId;
  pass: boolean;
  failClosed: boolean;
  detail: string;
}>;

export type HeliosDrPostRestoreProof = Readonly<{
  proofId: string;
  pass: boolean;
  detail: string;
}>;

export type HeliosDrEngineeringSlo = Readonly<{
  /** Maximum data loss window observed in the harness (milliseconds). */
  readonly rpoMs: number;
  /** Time from destructive loss through restore and rehydration (milliseconds). */
  readonly rtoMs: number;
  readonly tier: 'simulation_fixture' | 'ephemeral_postgresql';
  readonly disclaimer: string;
}>;

export type HeliosDrHarnessReport = Readonly<{
  program: typeof HEALTH08_PROGRAM;
  tier: 'simulation_fixture' | 'ephemeral_postgresql';
  steps: readonly HeliosDrStepResult[];
  failureModes: readonly HeliosDrFailureModeResult[];
  postRestoreProofs: readonly HeliosDrPostRestoreProof[];
  engineeringSlo: HeliosDrEngineeringSlo;
  postgresTierAttempted: boolean;
  postgresTierPass: boolean;
}>;

export type HeliosRestartRecoveryQualification = Readonly<{
  marker: HeliosRestartRecoveryMarker;
  qualified: boolean;
  blockers: readonly string[];
  report: HeliosDrHarnessReport;
}>;

export function evaluateHeliosRestartRecoveryQualification(
  report: HeliosDrHarnessReport,
): HeliosRestartRecoveryQualification {
  const blockers: string[] = [];

  for (const step of report.steps) {
    if (!step.pass) {
      blockers.push(`step:${step.stepId}: ${step.detail}`);
    }
  }
  for (const mode of report.failureModes) {
    if (!mode.pass) {
      blockers.push(`failure_mode:${mode.modeId}: ${mode.detail}`);
    }
  }
  for (const proof of report.postRestoreProofs) {
    if (!proof.pass) {
      blockers.push(`post_restore:${proof.proofId}: ${proof.detail}`);
    }
  }
  if (report.postgresTierAttempted && !report.postgresTierPass) {
    blockers.push('postgres_tier: ephemeral PostgreSQL tier did not complete');
  }

  const qualified = blockers.length === 0;
  return Object.freeze({
    marker: qualified ? HELIOS_RESTART_RECOVERY_QUALIFIED : HELIOS_RESTART_RECOVERY_BLOCKED,
    qualified,
    blockers: Object.freeze(blockers),
    report,
  });
}
