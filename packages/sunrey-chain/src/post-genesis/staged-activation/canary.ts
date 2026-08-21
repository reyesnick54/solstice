/**
 * Rehearsal-only capability canary plans.
 *
 * No real customer canary. No real-money limit. Fixture values are
 * REHEARSAL_ONLY and have no production meaning.
 */

import { commitPostGenesis } from '../hash.ts';
import type { CapabilityCanaryPlan, StagedActivationDomain, StagedActivationObservation } from './types.ts';
import { CANARY_REAL_CUSTOMERS, CANARY_FIXTURE_CLASS } from './types.ts';
import { evaluateDomainGates, failedGates } from './gates.ts';

export const REHEARSAL_CANARY_POPULATION_FIXTURE = 3 as const;
export const REHEARSAL_CANARY_OPERATION_IDS = Object.freeze([
  'op_rehearsal_read_status',
  'op_rehearsal_checkpoint_probe',
]);

export function hashCanaryPlan(plan: Omit<CapabilityCanaryPlan, never>): string {
  return commitPostGenesis({
    domain: plan.domain,
    candidateFreezeHash: plan.candidateFreezeHash,
    policyHash: plan.policyHash,
    operatingScopeHash: plan.operatingScopeHash,
    providerBindingHash: plan.providerBindingHash,
    fixtureClass: plan.fixtureClass,
  });
}

export function rehearsalCanaryPlan(domain: StagedActivationDomain): CapabilityCanaryPlan {
  return Object.freeze({
    domain,
    candidateFreezeHash: commitPostGenesis({ kind: 'candidate-freeze', domain, class: CANARY_FIXTURE_CLASS }),
    policyHash: commitPostGenesis({ kind: 'policy', domain, class: CANARY_FIXTURE_CLASS }),
    operatingScopeHash: commitPostGenesis({ kind: 'operating-scope', domain, class: CANARY_FIXTURE_CLASS }),
    providerBindingHash: commitPostGenesis({ kind: 'provider-binding', domain, class: CANARY_FIXTURE_CLASS }),
    allowedFixturePopulation: Object.freeze({
      class: CANARY_FIXTURE_CLASS,
      fixtureId: 'pop_rehearsal_only_deterministic',
      count: REHEARSAL_CANARY_POPULATION_FIXTURE,
    }),
    allowedFixtureOperations: Object.freeze(
      REHEARSAL_CANARY_OPERATION_IDS.map((operationId) =>
        Object.freeze({ class: CANARY_FIXTURE_CLASS, operationId }),
      ),
    ),
    durationPolicy: Object.freeze({
      class: CANARY_FIXTURE_CLASS,
      fixtureWindowId: 'window_rehearsal_only_checkpoint',
    }),
    checkpointPolicy: Object.freeze({
      class: CANARY_FIXTURE_CLASS,
      fixtureCheckpointId: 'ckpt_rehearsal_only',
    }),
    healthGates: Object.freeze(['CHAIN_FIRST', 'CONTROL_ROOM_HEALTH', 'CRITICAL_INCIDENT']),
    reconciliationGates: Object.freeze(['SUPPLY_RECONCILIATION', 'DOMAIN_RECONCILIATION']),
    abortConditions: Object.freeze([
      'critical incident open',
      'provider ineligible',
      'supply mismatch',
      'operating scope lost',
    ]),
    rehearsalOnly: true,
    realCustomers: CANARY_REAL_CUSTOMERS,
    realMoneyLimits: false,
    fixtureClass: CANARY_FIXTURE_CLASS,
  });
}

export function canaryIsRehearsalOnly(plan: CapabilityCanaryPlan): boolean {
  return (
    plan.rehearsalOnly === true &&
    plan.realCustomers === false &&
    plan.realMoneyLimits === false &&
    plan.fixtureClass === 'REHEARSAL_ONLY' &&
    plan.allowedFixturePopulation.class === 'REHEARSAL_ONLY' &&
    plan.durationPolicy.class === 'REHEARSAL_ONLY' &&
    plan.checkpointPolicy.class === 'REHEARSAL_ONLY' &&
    plan.allowedFixtureOperations.every((row) => row.class === 'REHEARSAL_ONLY')
  );
}

export function evaluateCanary(
  plan: CapabilityCanaryPlan,
  observation: StagedActivationObservation,
): {
  readonly admitted: boolean;
  readonly reasons: readonly string[];
  readonly realCustomers: false;
  readonly realMoneyLimits: false;
} {
  const reasons: string[] = [];
  if (!canaryIsRehearsalOnly(plan)) {
    reasons.push('canary must be REHEARSAL_ONLY');
  }
  if (plan.realCustomers) {
    reasons.push('real customer canary is forbidden');
  }
  const failed = failedGates(evaluateDomainGates(plan.domain, observation));
  reasons.push(...failed.map((row) => row.reason));
  return Object.freeze({
    admitted: reasons.length === 0,
    reasons: Object.freeze(reasons),
    realCustomers: false,
    realMoneyLimits: false,
  });
}
