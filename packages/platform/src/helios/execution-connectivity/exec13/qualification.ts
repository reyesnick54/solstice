/**
 * EXEC13 qualification marker — HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED
 */

import { EXEC13_CHAOS_SCENARIOS } from './taxonomy.ts';
import { runExec13ExecutionResilienceHarness } from './harness.ts';
import type { Exec13QualificationReport } from './types.ts';

export const HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED =
  'HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED' as const;
export const HELIOS_EXEC13_EXECUTION_RESILIENCE_BLOCKED =
  'HELIOS_EXEC13_EXECUTION_RESILIENCE_BLOCKED' as const;

export type Exec13ExecutionResilienceQualification = {
  readonly marker:
    | typeof HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED
    | typeof HELIOS_EXEC13_EXECUTION_RESILIENCE_BLOCKED;
  readonly qualified: boolean;
  readonly blockers: readonly string[];
  readonly report: Exec13QualificationReport;
};

export function evaluateExec13ExecutionResilienceQualification(
  report: Exec13QualificationReport = runExec13ExecutionResilienceHarness(),
): Exec13ExecutionResilienceQualification {
  const blockers: string[] = [];

  if (report.scenarios.length !== EXEC13_CHAOS_SCENARIOS.length) {
    blockers.push('chaos_catalog_incomplete');
  }
  if (!report.killSwitchAuditDeterministic) {
    blockers.push('kill_switch_audit_not_deterministic');
  }
  if (!report.agentCannotDisableKillSwitch) {
    blockers.push('agent_can_disable_kill_switch');
  }
  if (!report.brokerFailoverNoBlindResubmit) {
    blockers.push('broker_failover_blind_resubmit');
  }
  if (!report.allScenariosPassed) {
    for (const row of report.scenarios) {
      if (!row.passed) {
        blockers.push(`chaos:${row.scenarioId}`);
      }
    }
  }

  const qualified = blockers.length === 0;
  const marker = qualified
    ? HELIOS_EXEC13_EXECUTION_RESILIENCE_QUALIFIED
    : HELIOS_EXEC13_EXECUTION_RESILIENCE_BLOCKED;

  return Object.freeze({
    marker,
    qualified,
    blockers: Object.freeze(blockers),
    report,
  });
}
