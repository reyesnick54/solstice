import type { UtcInstant } from '@solstice/domain';

import { HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA } from './taxonomy.ts';
import type {
  ChronologicalOpportunitySet,
  CohortAllocationPolicy,
  ForwardCohort,
  ForwardControlStrategy,
  ForwardExperimentId,
  ForwardExperimentLifecycle,
  ForwardExperimentPreregistration,
  ForwardTreatmentStrategy,
} from './types.ts';
import { assertCustomerCapitalNeverRandomized } from './allocation.ts';
import {
  assertMembersShareIdenticalOpportunityCalendar,
  sharedOpportunityIdsForCohort,
} from './opportunity-alignment.ts';

export function asForwardExperimentId(value: string): ForwardExperimentId {
  if (!value.trim()) {
    throw new Error('ForwardExperimentId must be non-empty');
  }
  return value as ForwardExperimentId;
}

export function createForwardCohort(input: {
  readonly experimentId: ForwardExperimentId;
  readonly cohortId: string;
  readonly preregistration: ForwardExperimentPreregistration;
  readonly sealedAt: UtcInstant;
  readonly opportunitySet: ChronologicalOpportunitySet;
  readonly allocationPolicy: CohortAllocationPolicy;
  readonly controlStrategies: readonly ForwardControlStrategy[];
  readonly treatmentStrategies: readonly ForwardTreatmentStrategy[];
}): ForwardCohort {
  if (input.allocationPolicy.experimentId !== input.experimentId) {
    throw new Error('ALPHA20 allocation policy experimentId mismatch');
  }
  assertCustomerCapitalNeverRandomized(input.allocationPolicy);

  const canonical = sharedOpportunityIdsForCohort(input.opportunitySet);
  const memberMap: Record<string, readonly string[]> = {};
  for (const s of [...input.controlStrategies, ...input.treatmentStrategies]) {
    memberMap[s.memberId] = s.assignedOpportunityIds;
  }
  assertMembersShareIdenticalOpportunityCalendar(memberMap, canonical);

  const lifecycle: ForwardExperimentLifecycle = Object.freeze({
    state: 'SEALED',
    sealedAt: input.sealedAt,
    startedAt: null,
    completedAt: null,
  });

  return Object.freeze({
    schema: HELIOS_ALPHA20_FORWARD_EXPERIMENTS_SCHEMA,
    experimentId: input.experimentId,
    cohortId: input.cohortId,
    preregistration: input.preregistration,
    lifecycle,
    opportunitySet: input.opportunitySet,
    allocationPolicy: input.allocationPolicy,
    controlStrategies: Object.freeze([...input.controlStrategies]),
    treatmentStrategies: Object.freeze([...input.treatmentStrategies]),
    simulationOnly: true,
    grantsExecutionAuthority: false,
  });
}

export function startForwardCohortExperiment(
  cohort: ForwardCohort,
  startedAt: UtcInstant,
): ForwardCohort {
  if (cohort.lifecycle.state !== 'SEALED') {
    throw new Error('ALPHA20 cohort start requires SEALED state');
  }
  return Object.freeze({
    ...cohort,
    lifecycle: Object.freeze({
      ...cohort.lifecycle,
      state: 'ACTIVE',
      startedAt,
    }),
  });
}
