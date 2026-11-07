/**
 * EXEC13 qualification harness — chaos matrix + kill-switch + broker failover invariants.
 */

import { listExec13ChaosScenarios } from './chaos.ts';
import { blindResubmitBlocked, planBrokerFailover } from './broker-failover.ts';
import { runExec13ChaosScenario } from './fabric.ts';
import { Exec13KillSwitchRegistry } from './kill-switch.ts';
import { HELIOS_EXEC13_SCHEMA } from './taxonomy.ts';
import type { Exec13QualificationReport } from './types.ts';

export function verifyExec13KillSwitchInvariants(now: string): {
  readonly auditDeterministic: boolean;
  readonly agentCannotDisable: boolean;
} {
  const registry = new Exec13KillSwitchRegistry();
  const first = registry.activate({
    scope: 'global',
    target: 'GLOBAL',
    mode: 'FAIL_SAFE',
    reason: 'harness qualification',
    actorKind: 'HUMAN_OPERATOR',
    activatedAt: now,
  });
  const second = registry.activate({
    scope: 'provider',
    target: 'broker_a_sim',
    mode: 'BROKER_HALT',
    reason: 'harness qualification',
    actorKind: 'SYSTEM',
    activatedAt: now,
  });
  const agentDisable = registry.deactivate({
    killSwitchId: first.killSwitchId,
    actorKind: 'AGENT',
  });
  const auditDeterministic = first.auditDigest.length === 64 && first.activationSequence < second.activationSequence;
  const agentCannotDisable = agentDisable.ok === false && registry.listActive().some((row) => row.killSwitchId === first.killSwitchId);

  return Object.freeze({ auditDeterministic, agentCannotDisable });
}

export function verifyBrokerFailoverNoBlindResubmit(): boolean {
  const blocked = blindResubmitBlocked({
    businessKey: 'harness_timeout',
    brokerAId: 'broker_a_sim',
    brokerBId: 'broker_b_sim',
    submitTimedOut: true,
    acceptanceProbe: Object.freeze({ known: false, reason: 'timeout' }),
  });
  const plan = planBrokerFailover({
    businessKey: 'harness_timeout',
    brokerAId: 'broker_a_sim',
    brokerBId: 'broker_b_sim',
    submitTimedOut: true,
    acceptanceProbe: Object.freeze({ known: false, reason: 'timeout' }),
  });
  return blocked && plan.ok === false && plan.code === 'BROKER_A_ACCEPTANCE_UNKNOWN';
}

export function runExec13ExecutionResilienceHarness(now = '2026-11-07T16:00:00.000Z'): Exec13QualificationReport {
  const scenarios = listExec13ChaosScenarios().map((scenarioId) => runExec13ChaosScenario(scenarioId));
  const killSwitch = verifyExec13KillSwitchInvariants(now);
  const brokerFailoverNoBlindResubmit = verifyBrokerFailoverNoBlindResubmit();
  const allScenariosPassed = scenarios.every((row) => row.passed);

  return Object.freeze({
    schema: HELIOS_EXEC13_SCHEMA,
    scenarios: Object.freeze(scenarios),
    killSwitchAuditDeterministic: killSwitch.auditDeterministic,
    agentCannotDisableKillSwitch: killSwitch.agentCannotDisable,
    brokerFailoverNoBlindResubmit,
    allScenariosPassed,
  });
}
