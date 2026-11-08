import type { CohortMemberRole } from './taxonomy.ts';
import { HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA } from './taxonomy.ts';
import type { ForwardControlStrategy, ForwardTreatmentStrategy } from './types.ts';

const CONTROL_ROLES: ReadonlySet<CohortMemberRole> = new Set([
  'CASH',
  'MARKET_BENCHMARK',
  'NAIVE_BASELINE',
  'SIMPLE_FACTOR',
]);

const TREATMENT_ROLES: ReadonlySet<CohortMemberRole> = new Set(['INCUMBENT_CHAMPION', 'CHALLENGER']);

export function isControlRole(role: CohortMemberRole): boolean {
  return CONTROL_ROLES.has(role);
}

export function isTreatmentRole(role: CohortMemberRole): boolean {
  return TREATMENT_ROLES.has(role);
}

export function createForwardControlStrategy(input: {
  readonly memberId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly role: CohortMemberRole;
  readonly shadowCapitalRegistrationId: string;
  readonly assignedOpportunityIds: readonly string[];
}): ForwardControlStrategy {
  if (!isControlRole(input.role)) {
    throw new Error(`ALPHA20 role ${input.role} is not a control-arm member`);
  }
  return Object.freeze({
    schema: HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
    memberId: input.memberId,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    role: input.role,
    lane: 'CONTROL',
    shadowCapitalRegistrationId: input.shadowCapitalRegistrationId,
    assignedOpportunityIds: Object.freeze([...input.assignedOpportunityIds]),
  });
}

export function createForwardTreatmentStrategy(input: {
  readonly memberId: string;
  readonly strategyId: string;
  readonly strategyVersion: string;
  readonly role: CohortMemberRole;
  readonly shadowCapitalRegistrationId: string;
  readonly assignedOpportunityIds: readonly string[];
  readonly evolNominationRef?: string | null;
}): ForwardTreatmentStrategy {
  if (!isTreatmentRole(input.role)) {
    throw new Error(`ALPHA20 role ${input.role} is not a treatment-arm member`);
  }
  return Object.freeze({
    schema: HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
    memberId: input.memberId,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    role: input.role,
    lane: 'TREATMENT',
    shadowCapitalRegistrationId: input.shadowCapitalRegistrationId,
    assignedOpportunityIds: Object.freeze([...input.assignedOpportunityIds]),
    evolNominationRef: input.evolNominationRef ?? null,
  });
}
