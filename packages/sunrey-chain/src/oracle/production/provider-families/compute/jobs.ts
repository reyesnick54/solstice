/**
 * Privacy-safe compute execution identity.
 *
 * The same job may appear in scheduler, billing, container, GPU, and
 * AI-gateway meters. Those are corroborating sources of one economic
 * event, not automatically separate productive events.
 */

import { identityRef } from '../../../../productive/policy-governance/attribution/identity.ts';
import {
  createProductiveEconomicEvent,
  eventIdFromFingerprint,
} from '../../../../productive/policy-governance/attribution/event.ts';
import { economicEventFingerprintV3 } from '../../../../productive/policy-governance/attribution/identity.ts';
import type {
  EventIdentityEvidence,
  ProductiveEconomicEvent,
  ProductiveEconomicEventClass,
} from '../../../../productive/policy-governance/attribution/types.ts';
import type { ComputeEconomicExecutionReference, ComputeSourceObservation, ComputeWorkloadClass } from './types.ts';

export function executionReferenceOf(observation: ComputeSourceObservation): ComputeEconomicExecutionReference {
  return Object.freeze({
    schemaVersion: 1,
    executionRef: identityRef('execution', observation.executionId),
    jobRef: identityRef('job', observation.jobId),
    clusterRef: identityRef('cluster', observation.clusterId),
    resourcePoolRef: identityRef('pool', observation.resourcePoolId),
    controllerRef: identityRef('controller', observation.controllerId),
    measurementStart: observation.measurementStart,
    measurementEnd: observation.measurementEnd,
    resourceClass: observation.resourceClass,
    resourceCount: observation.resourceCount,
    workloadClass: observation.workloadClass,
    promptContentStored: false,
    modelOutputStored: false,
    credentialMaterialStored: false,
  });
}

export function eventClassFor(workloadClass: ComputeWorkloadClass): ProductiveEconomicEventClass {
  if (workloadClass === 'AI_INFERENCE' || workloadClass === 'AI_TRAINING') {
    return 'AI_COMPUTE_EVENT';
  }
  return 'COMPUTE_EXECUTION_EVENT';
}

export function computeEventEvidence(
  observation: ComputeSourceObservation,
  execution: ComputeEconomicExecutionReference,
  measurementRef: string,
): EventIdentityEvidence {
  const period = {
    validFromUnixSeconds: observation.measurementStart,
    validUntilUnixSeconds: observation.measurementEnd,
    epoch: 1,
  };
  return Object.freeze({
    transformationRef: execution.executionRef,
    alternateViewGroupRef: execution.executionRef,
    physicalObjectRefs: Object.freeze([execution.clusterRef, execution.resourcePoolRef]),
    sourceObjectRefs: Object.freeze([execution.jobRef]),
    inputLotRefs: Object.freeze([]),
    outputLotRefs: Object.freeze([execution.jobRef]),
    serialAssetRefs: Object.freeze([execution.executionRef]),
    measurementPeriod: period,
    deliveryPeriod: {
      fromUnixSeconds: observation.measurementStart,
      untilUnixSeconds: observation.measurementEnd,
    },
    geographyId: observation.region,
    jurisdiction: 'US',
    oracleFactRefs: Object.freeze([identityRef('source', `${observation.sourceClass}:${observation.identifier}`)]),
    sourceProvenanceRefs: Object.freeze([identityRef('schema', observation.schemaId)]),
    upstreamEventRefs: Object.freeze(
      observation.energyConsumptionFactRef
        ? [identityRef('energy-consumption', observation.energyConsumptionFactRef)]
        : [],
    ),
    downstreamEventRefs: Object.freeze([]),
    canonicalMeasurementRefs: Object.freeze([identityRef('measurement', measurementRef)]),
    controllerRefs: Object.freeze([execution.controllerRef]),
    participantRefs: Object.freeze([identityRef('account', observation.accountControllerId)]),
    sourceSystemRefs: Object.freeze([identityRef('source-class', observation.sourceClass)]),
    lineageRoot: execution.executionRef,
    economicTransformationRef: execution.executionRef,
  });
}

export function economicEventForCompute(
  observation: ComputeSourceObservation,
  execution: ComputeEconomicExecutionReference,
  measurementRef: string,
): ProductiveEconomicEvent {
  return createProductiveEconomicEvent({
    eventClass: eventClassFor(observation.workloadClass),
    evidence: computeEventEvidence(observation, execution, measurementRef),
  });
}

export function sameComputeExecution(
  left: ComputeSourceObservation,
  right: ComputeSourceObservation,
): boolean {
  const leftEvent = economicEventForCompute(left, executionReferenceOf(left), 'measure');
  const rightEvent = economicEventForCompute(right, executionReferenceOf(right), 'measure');
  return leftEvent.eventId === rightEvent.eventId || leftEvent.eventFingerprint === rightEvent.eventFingerprint;
}

export function computeEventId(observation: ComputeSourceObservation): string {
  const execution = executionReferenceOf(observation);
  const evidence = computeEventEvidence(observation, execution, 'measure');
  return eventIdFromFingerprint(economicEventFingerprintV3(evidence));
}
